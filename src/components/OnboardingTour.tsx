import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { firstNameOf } from "../lib/identity";
import { supabase } from "../lib/supabase";

type Step = { title: string; body: string; selector: string; path: string };
export type TourCopy = Pick<Step, "title" | "body">[];

const DEFAULT_STEPS: Step[] = [
  { title: "Start with your checklist", body: "Your readiness plan is organized into simple systems. Open any list to see what to gather and what is already complete.", selector: '[data-onboarding="checklist-card"]', path: "/app" },
  { title: "Check items off as you go", body: "Tap an item when it is ready. Your progress saves to your account and stays with you across devices.", selector: '[data-onboarding="check-item"]', path: "/app/lists/grab-go" },
  { title: "Leave a note for yourself", body: "Add short notes to remember where something is stored, what size to buy, or what still needs attention.", selector: '[data-onboarding="notes"]', path: "/app/lists/grab-go" },
  { title: "Connect your family", body: "Invite family members or connect an existing checklist from Manage Family Plan so everyone can prepare together.", selector: '[data-onboarding="family"]', path: "/app/family" },
  { title: "Keep your account current", body: "Your Profile is where you can update your details, change your password, manage devices, and find your Checklist ID.", selector: '[data-onboarding="profile"]', path: "/app/account" },
];

const COPY_KEY = "spl.onboarding.copy.v1";
const VIDEO_CACHE_KEY = "spl.onboarding.video.v1";
export const DEFAULT_VIDEO_URL = "/videos/welcome.mp4";
const PREVIEW_KEY = "spl.onboarding.preview";
const PREVIEW_EVENT = "spl:preview-onboarding";
const REPLAY_KEY = "spl.onboarding.replay";
const REPLAY_EVENT = "spl:replay-onboarding";

function loadCopy(): TourCopy {
  try {
    return JSON.parse(localStorage.getItem(COPY_KEY) || "null") || DEFAULT_STEPS.map(({ title, body }) => ({ title, body }));
  } catch {
    return DEFAULT_STEPS.map(({ title, body }) => ({ title, body }));
  }
}

function loadCachedVideo(): string {
  return localStorage.getItem(VIDEO_CACHE_KEY) ?? DEFAULT_VIDEO_URL;
}

function configString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "url" in value && typeof (value as { url: unknown }).url === "string") {
    return (value as { url: string }).url;
  }
  return "";
}

export function onboardingVideoSrc(url: string): { type: "iframe" | "video"; src: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) {
    return /\.(mp4|webm|ogg)(\?|$)/i.test(trimmed) ? { type: "video", src: trimmed } : null;
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "");
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (host === "youtu.be" && parts[0]) {
      return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${parts[0]}?rel=0` };
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const id = parsed.searchParams.get("v") || (parts[0] === "embed" || parts[0] === "shorts" ? parts[1] : parts.at(-1));
      if (id && id !== "watch") return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
    }
    if (host === "vimeo.com" && parts[0]) {
      return { type: "iframe", src: `https://player.vimeo.com/video/${parts[0]}` };
    }
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(parsed.pathname)) return { type: "video", src: trimmed };
    return { type: "iframe", src: trimmed };
  } catch {
    return null;
  }
}

export function startOnboardingPreview() {
  sessionStorage.setItem(PREVIEW_KEY, "1");
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}

export function isOnboardingPreview() {
  return sessionStorage.getItem(PREVIEW_KEY) === "1";
}

export function startOnboardingReplay() {
  sessionStorage.setItem(REPLAY_KEY, "1");
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

function previewActive() {
  return sessionStorage.getItem(PREVIEW_KEY) === "1";
}

function replayActive() {
  return sessionStorage.getItem(REPLAY_KEY) === "1";
}

export function OnboardingTour() {
  const { profile } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const storageKey = profile ? `spl.onboarding.v1.${profile.id}` : "";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"welcome" | "tour" | "done">("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [copy, setCopy] = useState<TourCopy>(loadCopy);
  const [videoUrl, setVideoUrl] = useState(loadCachedVideo);
  const step = { ...(DEFAULT_STEPS[stepIndex] ?? DEFAULT_STEPS[0]), ...copy[stepIndex] };
  const video = onboardingVideoSrc(videoUrl);

  useEffect(() => {
    void supabase.from("app_config").select("key, value").in("key", ["onboarding_copy", "onboarding_video_url"]).then(({ data, error }) => {
      if (error || !data) return;
      for (const row of data) {
        if (row.key === "onboarding_copy" && Array.isArray(row.value)) {
          const stored = row.value as TourCopy;
          if (stored.length) {
            setCopy(stored);
            localStorage.setItem(COPY_KEY, JSON.stringify(stored));
          }
        }
        if (row.key === "onboarding_video_url") {
          const url = configString(row.value);
          setVideoUrl(url);
          localStorage.setItem(VIDEO_CACHE_KEY, url);
        }
      }
    });
  }, []);

  useEffect(() => {
    function syncOpen() {
      if (!profile?.id) return;
      if (replayActive()) {
        sessionStorage.removeItem(REPLAY_KEY);
        setMode("tour");
        setStepIndex(0);
        setRect(null);
        setOpen(true);
        navigate(DEFAULT_STEPS[0].path);
        return;
      }
      if (previewActive()) {
        setMode("welcome");
        setStepIndex(0);
        setRect(null);
        setOpen(true);
        return;
      }
      if (profile.plan === "none") {
        setOpen(false);
        return;
      }
      setOpen(localStorage.getItem(storageKey) !== "done");
    }
    syncOpen();
    window.addEventListener(PREVIEW_EVENT, syncOpen);
    window.addEventListener(REPLAY_EVENT, syncOpen);
    return () => {
      window.removeEventListener(PREVIEW_EVENT, syncOpen);
      window.removeEventListener(REPLAY_EVENT, syncOpen);
    };
  }, [profile?.id, profile?.plan, storageKey, navigate]);

  useEffect(() => {
    if (!open || mode !== "tour") return;
    let cancelled = false;
    let target: HTMLElement | null = null;
    const pad = 16;
    const expectedPath = DEFAULT_STEPS[stepIndex]?.path;

    function measure() {
      if (!target) return;
      const box = target.getBoundingClientRect();
      setRect(new DOMRect(box.left - pad, box.top - pad, box.width + pad * 2, box.height + pad * 2));
    }

    async function locate() {
      for (let attempt = 0; attempt < 50 && !cancelled; attempt += 1) {
        target = document.querySelector(step.selector) as HTMLElement | null;
        if (target) {
          target.classList.add("onboarding-target-highlight");
          target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
          await new Promise((resolve) => window.setTimeout(resolve, 80));
          if (!cancelled) measure();
          return;
        }
        if (expectedPath && window.location.pathname !== expectedPath) {
          await new Promise((resolve) => window.setTimeout(resolve, 80));
          continue;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }
      if (!cancelled) setRect(null);
    }

    void locate();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      target?.classList.remove("onboarding-target-highlight");
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, mode, step.selector, stepIndex, location.pathname]);

  useEffect(() => {
    if (!open || mode !== "done") return;
    const timer = window.setTimeout(() => {
      const preview = previewActive();
      sessionStorage.removeItem(PREVIEW_KEY);
      if (!preview && storageKey) localStorage.setItem(storageKey, "done");
      setOpen(false);
      navigate("/app/lists");
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [open, mode, navigate, storageKey]);

  const progress = useMemo(() => `${stepIndex + 1} of ${DEFAULT_STEPS.length}`, [stepIndex]);
  const firstName = firstNameOf(profile?.first_name || profile?.display_name || profile?.full_name);
  if (!open || !profile) return null;

  function finish() {
    const preview = previewActive();
    sessionStorage.removeItem(PREVIEW_KEY);
    if (!preview && storageKey) localStorage.setItem(storageKey, "done");
    setOpen(false);
  }
  function completeTour() {
    setMode("done");
    setRect(null);
  }
  function startTour() {
    setRect(null);
    setMode("tour");
    setStepIndex(0);
    navigate(DEFAULT_STEPS[0].path);
  }
  function nextTour() {
    if (stepIndex >= DEFAULT_STEPS.length - 1) {
      completeTour();
      return;
    }
    const nextIndex = stepIndex + 1;
    const next = DEFAULT_STEPS[nextIndex];
    setRect(null);
    setStepIndex(nextIndex);
    if (next?.path && next.path !== location.pathname) navigate(next.path);
  }

  const hole = rect
    ? {
        top: Math.max(0, rect.top),
        left: Math.max(0, rect.left),
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      }
    : null;

  return (
    <div className={`onboarding-layer ${mode === "tour" ? "tour-mode" : "welcome-mode"}`}>
      {mode === "welcome" ? (
        <div className="onboarding-welcome-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
          <div className="onboarding-welcome-head">
            <button
              className="onboarding-close"
              type="button"
              aria-label="Close the video and start the guided tour"
              onClick={startTour}
            >
              ×
            </button>
          </div>
          <div className="onboarding-video">
            {video?.type === "video" ? (
              <video
                src={video.src}
                controls
                playsInline
                preload="metadata"
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
              />
            ) : video ? (
              <iframe
                src={video.src}
                title="Welcome video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <>
                <span className="onboarding-play" aria-hidden="true">▶</span>
                <span>Welcome video</span>
                <small>Your intro video will play here</small>
              </>
            )}
          </div>
          <p className="eyebrow">Your checklist is ready</p>
          <h2 id="onboarding-title">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h2>
          <p className="onboarding-copy">
            Congratulations on your new Safety Prep List. The intro video above walks you through how it all works, and
            from here we can show you where to check items, leave notes, and connect your family.
          </p>
          <div className="onboarding-actions">
            <button className="btn btn-ghost" type="button" onClick={finish}>Start on my own</button>
            <button className="btn btn-primary" type="button" onClick={startTour}>Take the guided tour</button>
          </div>
        </div>
      ) : mode === "done" ? (
        <div className="onboarding-done-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-done-title">
          <span className="onboarding-done-check" aria-hidden="true">✓</span>
          <h2 id="onboarding-done-title">You’re all set.</h2>
          <div className="onboarding-loader" aria-hidden="true" />
          <p className="onboarding-copy">Loading your checklist…</p>
        </div>
      ) : (
        <>
          {hole ? (
            <>
              <div className="onboarding-tint" style={{ top: 0, left: 0, right: 0, height: hole.top }} />
              <div className="onboarding-tint" style={{ top: hole.bottom, left: 0, right: 0, bottom: 0 }} />
              <div className="onboarding-tint" style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
              <div className="onboarding-tint" style={{ top: hole.top, left: hole.right, right: 0, height: hole.height }} />
              <div
                className="onboarding-spotlight"
                style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
              />
            </>
          ) : (
            <div className="onboarding-tint onboarding-tint-full" aria-hidden="true" />
          )}
          <aside className={`onboarding-tour-card ${rect && rect.top > window.innerHeight * 0.55 ? "above" : ""}`} role="dialog" aria-modal="true" aria-labelledby="tour-title">
            <div className="onboarding-tour-head"><span>{progress}</span><button type="button" onClick={finish}>×</button></div>
            <p className="eyebrow">Guided tour</p>
            <h2 id="tour-title">{step.title}</h2>
            <p>{step.body}</p>
            <div className="onboarding-tour-actions">
              <button className="btn btn-ghost" type="button" onClick={finish}>Exit tour</button>
              <button className="btn btn-primary" type="button" onClick={nextTour}>{stepIndex === DEFAULT_STEPS.length - 1 ? "Finish tour" : "Next"}</button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export { COPY_KEY, DEFAULT_STEPS, VIDEO_CACHE_KEY, loadCopy };
