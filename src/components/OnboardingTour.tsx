import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
const HOLD_KEY = "spl.onboarding.active";

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

function visibleTarget(selector: string) {
  return ([...document.querySelectorAll(selector)] as HTMLElement[]).find((node) => {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const box = node.getBoundingClientRect();
    return box.width > 8 && box.height > 8;
  }) ?? null;
}

function isPhoneTour() {
  return window.matchMedia("(max-width: 899px)").matches;
}

function highlightRoot(node: HTMLElement, selector: string) {
  if (selector.includes("notes")) {
    const note = node.closest(".note-tip-wrap");
    if (note instanceof HTMLElement) return note;
  }
  if (selector.includes("check-item")) {
    const row = node.closest(".check-item")?.querySelector(".check-row");
    if (row instanceof HTMLElement) return row;
  }
  return node;
}

function spotlightPad(target: HTMLElement, box: DOMRect) {
  const phone = isPhoneTour();
  if (target.closest(".system-card")) return { x: 8, y: 3 };
  if (target.classList.contains("check-row")) return { x: 6, y: 3 };
  const inList = Boolean(target.closest(".list-group"));
  if (inList && box.height < 110) return { x: 16, y: 4 };
  if (box.height < 80) return { x: phone ? 16 : 20, y: phone ? 12 : 14 };
  return { x: phone ? 18 : 28, y: phone ? 18 : 28 };
}

const TOUR_GAP = 22;
const TOUR_FEATHER = 42;
const TOUR_FEATHER_REACH = TOUR_FEATHER + 24;

function chromeBottom() {
  const header = document.querySelector(".app-top")?.getBoundingClientRect().bottom ?? 0;
  const guidance = document.querySelector(".guidance-ack")?.getBoundingClientRect().bottom ?? 0;
  return Math.max(header, guidance);
}

function scrollToNow(top: number) {
  const scroller = document.scrollingElement || document.documentElement;
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  scroller.scrollTop = top;
  root.style.scrollBehavior = previous;
}

function blockTourScroll(event: Event) {
  const node = event.target;
  if (node instanceof Node && document.querySelector(".onboarding-tour-card")?.contains(node)) return;
  event.preventDefault();
}

function cardWidthFor(hole: DOMRect) {
  const viewport = window.innerWidth;
  if (viewport < 900) return Math.min(hole.width > 260 ? viewport - 28 : 320, viewport - 28);
  return Math.min(360, viewport - 32);
}

function placeTourCard(hole: DOMRect, cardW: number, cardH: number) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const phone = viewportW < 900;
  const margin = 14;
  const topReserve = Math.max(phone ? 78 : 16, chromeBottom() + 10);
  const bottomReserve = phone ? 86 : 16;
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
  const alignedLeft = hole.width > cardW + 24
    ? clamp(hole.left + 12, margin, viewportW - margin - cardW)
    : clamp(hole.left + hole.width / 2 - cardW / 2, margin, viewportW - margin - cardW);

  const options = [
    { placement: "below" as const, top: hole.bottom + TOUR_GAP, left: alignedLeft },
    { placement: "above" as const, top: hole.top - TOUR_GAP - cardH, left: alignedLeft },
    {
      placement: "right" as const,
      top: clamp(hole.top + hole.height / 2 - cardH / 2, topReserve, viewportH - bottomReserve - cardH),
      left: hole.right + TOUR_GAP,
    },
    {
      placement: "left" as const,
      top: clamp(hole.top + hole.height / 2 - cardH / 2, topReserve, viewportH - bottomReserve - cardH),
      left: hole.left - TOUR_GAP - cardW,
    },
  ];

  function coversHole(option: (typeof options)[number]) {
    const overlapsX = option.left < hole.right - 8 && option.left + cardW > hole.left + 8;
    const overlapsY = option.top < hole.bottom - 8 && option.top + cardH > hole.top + 8;
    return overlapsX && overlapsY;
  }

  function fits(option: (typeof options)[number]) {
    return (
      !coversHole(option) &&
      option.top >= topReserve - 1 &&
      option.left >= margin - 1 &&
      option.top + cardH <= viewportH - bottomReserve + 1 &&
      option.left + cardW <= viewportW - margin + 1
    );
  }

  const rail = !phone && hole.width < 280 && hole.left < 280;
  const order = rail ? ["right", "left", "below", "above"] : ["below", "above", "right", "left"];
  for (const placement of order) {
    const option = options.find((item) => item.placement === placement);
    if (option && fits(option)) return option;
  }

  const below = options[0];
  const above = options[1];
  const aboveFits = above.top >= topReserve - 1;
  const chosen = aboveFits && hole.top > viewportH * 0.55 ? above : below;
  return {
    ...chosen,
    left: clamp(chosen.left, margin, viewportW - margin - cardW),
  };
}

function readHeldStep() {
  const raw = sessionStorage.getItem(HOLD_KEY);
  if (raw == null) return null;
  const index = Number(raw);
  return Number.isFinite(index) ? index : 0;
}

function holdStep(index: number) {
  sessionStorage.setItem(HOLD_KEY, String(index));
}

function releaseHold() {
  sessionStorage.removeItem(HOLD_KEY);
}

export function OnboardingTour() {
  const { profile } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const storageKey = profile ? `spl.onboarding.v1.${profile.id}` : "";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"welcome" | "choice" | "tour" | "done">("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardSize, setCardSize] = useState({ w: 340, h: 236 });
  const [placedStep, setPlacedStep] = useState(-1);
  const [searching, setSearching] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const [copy, setCopy] = useState<TourCopy>(loadCopy);
  const [videoUrl, setVideoUrl] = useState(loadCachedVideo);
  const holdingTour = useRef(false);
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
        holdingTour.current = true;
        holdStep(0);
        setMode("tour");
        setStepIndex(0);
        setRect(null);
        setPlacedStep(-1);
        setOpen(true);
        navigate(DEFAULT_STEPS[0].path);
        return;
      }
      const held = readHeldStep();
      if (held != null) {
        holdingTour.current = true;
        setMode("tour");
        setStepIndex(held);
        setOpen(true);
        return;
      }
      if (previewActive()) {
        setMode("welcome");
        setStepIndex(0);
        setRect(null);
        setOpen(true);
        return;
      }
      if (holdingTour.current) return;
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
    setSearching(true);
    let target: HTMLElement | null = null;
    let pinnedScroll = document.scrollingElement?.scrollTop ?? 0;
    let pinning = false;
    const expectedPath = DEFAULT_STEPS[stepIndex]?.path;

    function pinScroll() {
      if (!pinning) return;
      const scroller = document.scrollingElement;
      if (!scroller || Math.abs(scroller.scrollTop - pinnedScroll) <= 1) return;
      scrollToNow(pinnedScroll);
    }

    function measure() {
      if (!target) return;
      const box = target.getBoundingClientRect();
      const pad = spotlightPad(target, box);
      setRect(new DOMRect(box.left - pad.x, box.top - pad.y, box.width + pad.x * 2, box.height + pad.y * 2));
    }

    function settleTarget() {
      if (!target || target.closest(".bottom-nav, .desktop-sidebar")) return;
      const box = target.getBoundingClientRect();
      const pad = spotlightPad(target, box).y;
      const phone = isPhoneTour();
      const tab = phone ? 84 : 20;
      const guidance = document.querySelector(".guidance-ack");
      const noteRoom = phone ? 240 : 270;
      const floor = chromeBottom() + (guidance ? TOUR_FEATHER_REACH + pad + 8 : 10);
      const maxTop = window.innerHeight - tab - noteRoom - TOUR_GAP - box.height - pad;
      const top = Math.max(chromeBottom() + 6, Math.min(floor, maxTop));
      const delta = box.top - top;
      if (Math.abs(delta) <= 2) return;
      const scroller = document.scrollingElement || document.documentElement;
      scrollToNow(scroller.scrollTop + delta);
    }

    function ensureClearance() {
      if (!target || target.closest(".bottom-nav, .desktop-sidebar")) {
        measure();
        return;
      }
      const guidance = document.querySelector(".guidance-ack");
      if (!guidance) {
        measure();
        return;
      }
      const pad = spotlightPad(target, target.getBoundingClientRect()).y;
      const floor = guidance.getBoundingClientRect().bottom + TOUR_FEATHER_REACH + pad + 8;
      if (target.getBoundingClientRect().top < floor - 4) {
        pinning = false;
        settleTarget();
        pinnedScroll = document.scrollingElement?.scrollTop ?? pinnedScroll;
        pinning = true;
      }
      measure();
    }

    let demoItem: HTMLElement | null = null;

    async function locate() {
      for (let attempt = 0; attempt < 50 && !cancelled; attempt += 1) {
        const found = visibleTarget(step.selector);
        target = found ? highlightRoot(found, step.selector) : null;
        if (target) {
          target.classList.add("onboarding-target-highlight");
          const item = step.selector.includes("check-item") ? target.closest(".check-item") : null;
          if (item instanceof HTMLElement) {
            demoItem = item;
            item.classList.add("tour-check-demo");
          }
          settleTarget();
          await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve(undefined))));
          if (!cancelled) {
            pinnedScroll = document.scrollingElement?.scrollTop ?? 0;
            pinning = true;
            document.documentElement.classList.add("tour-scroll-lock");
            measure();
            window.requestAnimationFrame(() => {
              if (cancelled) return;
              ensureClearance();
            });
            setSearching(false);
          }
          return;
        }
        if (expectedPath && window.location.pathname !== expectedPath) {
          await new Promise((resolve) => window.setTimeout(resolve, 80));
          continue;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }
      if (!cancelled) {
        setRect(null);
        setSearching(false);
      }
    }

    const observer = new ResizeObserver(() => ensureClearance());
    window.addEventListener("wheel", blockTourScroll, { passive: false });
    window.addEventListener("touchmove", blockTourScroll, { passive: false });
    window.addEventListener("scroll", pinScroll, true);
    void locate().then(() => {
      if (cancelled || !target) return;
      observer.observe(target);
      const guidance = document.querySelector(".guidance-ack");
      const header = document.querySelector(".app-top");
      if (guidance) observer.observe(guidance);
      if (header) observer.observe(header);
    });
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      observer.disconnect();
      document.documentElement.classList.remove("tour-scroll-lock");
      window.removeEventListener("wheel", blockTourScroll);
      window.removeEventListener("touchmove", blockTourScroll);
      window.removeEventListener("scroll", pinScroll, true);
      target?.classList.remove("onboarding-target-highlight");
      demoItem?.classList.remove("tour-check-demo");
      window.removeEventListener("resize", measure);
    };
  }, [open, mode, step.selector, stepIndex, location.pathname]);

  useLayoutEffect(() => {
    if (mode !== "tour" || searching || !cardRef.current) return;
    const box = cardRef.current.getBoundingClientRect();
    setCardSize((current) => (
      Math.abs(current.w - box.width) < 2 && Math.abs(current.h - box.height) < 2
        ? current
        : { w: Math.round(box.width), h: Math.round(box.height) }
    ));
    setPlacedStep(stepIndex);
  }, [mode, stepIndex, rect, searching, step.title, step.body]);

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
    holdingTour.current = false;
    releaseHold();
    const preview = previewActive();
    sessionStorage.removeItem(PREVIEW_KEY);
    if (!preview && storageKey) localStorage.setItem(storageKey, "done");
    setOpen(false);
  }
  function completeTour() {
    holdingTour.current = false;
    releaseHold();
    setMode("done");
    setRect(null);
  }
  function startTour() {
    holdingTour.current = true;
    holdStep(0);
    setRect(null);
    setMode("tour");
    setStepIndex(0);
    setPlacedStep(-1);
    navigate(DEFAULT_STEPS[0].path);
  }
  function nextTour() {
    if (stepIndex >= DEFAULT_STEPS.length - 1) {
      completeTour();
      return;
    }
    const nextIndex = stepIndex + 1;
    const next = DEFAULT_STEPS[nextIndex];
    holdStep(nextIndex);
    setRect(null);
    setPlacedStep(-1);
    setStepIndex(nextIndex);
    if (next?.path && next.path !== location.pathname) navigate(next.path);
  }

  const tightSpot = step.selector.includes("checklist-card");
  const lineSpot = step.selector.includes("check-item");
  const spotFeather = tightSpot ? 4 : lineSpot ? 6 : TOUR_FEATHER;
  const spotBlur = tightSpot ? 3 : lineSpot ? 2 : 18;
  const hole = rect
    ? { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
    : null;
  const tourWidth = rect ? cardWidthFor(rect) : Math.min(360, typeof window === "undefined" ? 360 : window.innerWidth - 32);
  const tourPlace = rect ? placeTourCard(rect, tourWidth, cardSize.h) : null;
  const tourCardStyle = tourPlace
    ? { top: tourPlace.top, left: tourPlace.left, width: tourWidth }
    : { top: "50%", left: "50%", width: tourWidth, transform: "translate(-50%, -50%)" };
  const tourArrowStyle = tourPlace && rect
    ? tourPlace.placement === "below" || tourPlace.placement === "above"
      ? { left: Math.min(Math.max(rect.left + rect.width / 2 - tourPlace.left - 8, 22), tourWidth - 40) }
      : { top: Math.min(Math.max(rect.top + rect.height / 2 - tourPlace.top - 8, 22), Math.max(22, cardSize.h - 40)) }
    : undefined;

  return (
    <div className={`onboarding-layer ${mode === "tour" ? "tour-mode" : "welcome-mode"}`}>
      {mode === "welcome" ? (
        <div className="onboarding-welcome-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
          <p className="eyebrow">Your checklist is ready</p>
          <h2 id="onboarding-title">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h2>
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
          <div className="onboarding-actions onboarding-actions-stacked">
            <button className="btn btn-primary" type="button" onClick={() => setMode("choice")}>Continue</button>
            <button className="onboarding-skip-inline" type="button" onClick={() => setMode("choice")}>Skip</button>
          </div>
        </div>
      ) : mode === "choice" ? (
        <div className="onboarding-welcome-card onboarding-choice-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-choice-title">
          <p className="eyebrow">Getting started</p>
          <h2 id="onboarding-choice-title">Would you like a guided tour?</h2>
          <p className="onboarding-copy">
            We can show you where to check items off, leave notes, and connect your family. It only takes a minute.
          </p>
          <div className="onboarding-actions">
            <button className="btn btn-ghost" type="button" onClick={finish}>Skip and explore on my own</button>
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
              <svg className="onboarding-veil" aria-hidden="true">
                <defs>
                  <filter id="tour-feather" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation={spotBlur} />
                  </filter>
                  <mask id="tour-hole" maskUnits="userSpaceOnUse">
                    <rect width="100%" height="100%" fill="white" />
                    <rect
                      x={hole.left - spotFeather}
                      y={hole.top - spotFeather}
                      width={hole.width + spotFeather * 2}
                      height={hole.height + spotFeather * 2}
                      rx={tightSpot ? 16 : 36}
                      fill="black"
                      filter="url(#tour-feather)"
                    />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(9, 23, 18, 0.62)" mask="url(#tour-hole)" />
              </svg>
              <div
                className={`onboarding-spotlight${tightSpot ? " is-tight" : ""}${lineSpot ? " is-line" : ""}`}
                style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
              />
            </>
          ) : (
            <div className="onboarding-tint onboarding-tint-full" aria-hidden="true" />
          )}
          <aside
            ref={cardRef}
            className={`onboarding-tour-card place-${tourPlace?.placement ?? "below"}${!searching && placedStep === stepIndex ? "" : " is-placing"}`}
            style={tourCardStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
          >
            {tourPlace ? (
              <span
                className={`onboarding-tour-arrow ${tourPlace.placement}`}
                style={tourArrowStyle}
                aria-hidden="true"
              />
            ) : null}
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
