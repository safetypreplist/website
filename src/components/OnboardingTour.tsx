import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { isRetiredAccountCopy } from "../lib/copy";
import { isLocalProfileComplete } from "../lib/localProfile";
import { OnboardingProfileStep } from "./OnboardingProfileStep";
import { supabase } from "../lib/supabase";

type Step = { title: string; body: string; selector: string; path: string };
export type TourCopy = Pick<Step, "title" | "body">[];

const DEFAULT_STEPS: Step[] = [
  {
    title: "Checklist progress",
    body: "This ring shows how far you have checked off items across your readiness lists.",
    selector: '[data-onboarding="progress"]',
    path: "/app",
  },
  {
    title: "Start with your checklist",
    body: "Your readiness plan is organized into simple systems. Open a card to see what to gather and what is already complete.",
    selector: '[data-onboarding="checklist-card"]',
    path: "/app",
  },
  {
    title: "Check items off as you go",
    body: "Tap the circle beside an item when it is ready. Your progress saves on this device and stays with you offline.",
    selector: '[data-onboarding="check-item"]',
    path: "/app/lists/grab-go",
  },
  {
    title: "Leave a note for yourself",
    body: "Use Add note to remember where something is stored, what size to buy, or what still needs attention.",
    selector: '[data-onboarding="notes"]',
    path: "/app/lists/grab-go",
  },
  {
    title: "Group Sharing",
    body: "Invite other licensed devices for a temporary online sync. Everyone needs their own license. On phones, it's under More.",
    selector: '[data-onboarding="group-sharing"]',
    path: "/app",
  },
  {
    title: "Emergency Contacts",
    body: "Keep family and household numbers here so they are easy to find in a hurry.",
    selector: '[data-onboarding="contacts"]',
    path: "/app",
  },
  {
    title: "Safety Resources",
    body: "National and local emergency resources follow your saved location when you set one in Profile.",
    selector: '[data-onboarding="safety"]',
    path: "/app",
  },
  {
    title: "Your profile",
    body: "Update your name, photo, and location here. Location powers local time, weather, and safety resources.",
    selector: '[data-onboarding="profile"]',
    path: "/app/profile",
  },
  {
    title: "Your license",
    body: "Open License to see your key, review upgrade options, or move to a new device.",
    selector: '[data-onboarding="license"]',
    path: "/app",
  },
];

const COPY_KEY = "spl.onboarding.copy.v1";
const VIDEO_CACHE_KEY = "spl.onboarding.video.v1";
export const DEFAULT_VIDEO_URL = "/videos/welcome.mp4";
const PREVIEW_KEY = "spl.onboarding.preview";
const PREVIEW_EVENT = "spl:preview-onboarding";
const REPLAY_KEY = "spl.onboarding.replay";
const REPLAY_EVENT = "spl:replay-onboarding";
const HOLD_KEY = "spl.onboarding.active";
const DONE_KEY = "spl.onboarding.v1.local";
export const ONBOARDING_CHANGE_EVENT = "spl:onboarding-change";
const ESTIMATED_CARD_H = 236;

let onboardingVisible = false;

/** True while first-run onboarding is open or still owed on this device; other prompts wait for it. */
export function isOnboardingPending() {
  return onboardingVisible || localStorage.getItem(DONE_KEY) !== "done";
}

/** A restored backup means this person already knows the app; skip the first-run tour on this device. */
export function markOnboardingSeen() {
  localStorage.setItem(DONE_KEY, "done");
}

function announceOnboarding(visible: boolean) {
  onboardingVisible = visible;
  window.dispatchEvent(new Event(ONBOARDING_CHANGE_EVENT));
}
const TOUR_GAP = 18;

type Placement = "below" | "above" | "right" | "left";
type TourFrame = {
  hole: { top: number; left: number; width: number; height: number };
  card: { top: number; left: number; width: number; placement: Placement };
  fallback?: boolean;
};

function defaultCopy(): TourCopy {
  return DEFAULT_STEPS.map(({ title, body }) => ({ title, body }));
}

/** Saved copy only applies when it lines up with today's stops; stale lines fall back per step. */
export function resolveTourCopy(raw: unknown): TourCopy {
  const defaults = defaultCopy();
  if (!Array.isArray(raw) || raw.length !== defaults.length) return defaults;
  return defaults.map((fallback, index) => {
    const row = raw[index] as Partial<Record<"title" | "body", unknown>> | null;
    const title = typeof row?.title === "string" ? row.title.trim() : "";
    const body = typeof row?.body === "string" ? row.body.trim() : "";
    if (!title || !body || isRetiredAccountCopy(title, body)) return fallback;
    return { title, body };
  });
}

function loadCopy(): TourCopy {
  try {
    return resolveTourCopy(JSON.parse(localStorage.getItem(COPY_KEY) || "null"));
  } catch {
    return defaultCopy();
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

function waitFrames(count = 2) {
  return new Promise<void>((resolve) => {
    let left = count;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

function visibleTarget(selector: string) {
  return ([...document.querySelectorAll(selector)] as HTMLElement[]).find((node) => {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
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
  if (selector.includes("progress")) {
    const readiness = node.closest(".readiness");
    if (readiness instanceof HTMLElement) return readiness;
  }
  if (selector.includes('"profile"') && isPhoneTour()) {
    const photo = node.querySelector(".account-photo");
    if (photo instanceof HTMLElement) return photo;
  }
  return node;
}

function spotlightPad(target: HTMLElement, box: DOMRect) {
  const phone = isPhoneTour();
  if (target.closest(".readiness")) return { x: 10, y: 10 };
  if (target.closest(".system-card")) return { x: 8, y: 4 };
  if (target.classList.contains("check-row")) return { x: 6, y: 3 };
  if (target.closest(".desktop-sidebar, .bottom-nav")) return { x: 6, y: 4 };
  if (box.height < 80) return { x: phone ? 12 : 16, y: phone ? 10 : 12 };
  return { x: phone ? 14 : 20, y: phone ? 14 : 18 };
}

function chromeBottom() {
  const header = document.querySelector(".app-top")?.getBoundingClientRect().bottom ?? 0;
  const guidance = document.querySelector(".guidance-ack")?.getBoundingClientRect().bottom ?? 0;
  return Math.max(header, guidance);
}

function cardWidthFor(hole: { width: number }) {
  const viewport = window.innerWidth;
  if (viewport < 900) return Math.min(Math.max(280, hole.width > 240 ? viewport - 28 : 320), viewport - 28);
  return Math.min(360, viewport - 32);
}

function placeTourCard(hole: DOMRect, cardW: number, cardH: number) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const phone = viewportW < 900;
  const margin = 14;
  const topReserve = Math.max(phone ? 72 : 16, chromeBottom() + 8);
  const bottomReserve = phone ? 90 : 16;
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
  const alignedLeft =
    hole.width > cardW + 24
      ? clamp(hole.left + 12, margin, viewportW - margin - cardW)
      : clamp(hole.left + hole.width / 2 - cardW / 2, margin, viewportW - margin - cardW);

  const options: Array<{ placement: Placement; top: number; left: number }> = [
    { placement: "below", top: hole.bottom + TOUR_GAP, left: alignedLeft },
    { placement: "above", top: hole.top - TOUR_GAP - cardH, left: alignedLeft },
    {
      placement: "right",
      top: clamp(hole.top + hole.height / 2 - cardH / 2, topReserve, viewportH - bottomReserve - cardH),
      left: hole.right + TOUR_GAP,
    },
    {
      placement: "left",
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

  const inSidebar = hole.left < 240 && hole.width < 280;
  const order: Placement[] = phone
    ? hole.top > viewportH * 0.45
      ? ["above", "below", "left", "right"]
      : ["below", "above", "left", "right"]
    : inSidebar
      ? ["right", "below", "above", "left"]
      : ["below", "above", "right", "left"];

  for (const placement of order) {
    const option = options.find((item) => item.placement === placement);
    if (option && fits(option)) return option;
  }

  const below = options[0];
  const above = options[1];
  const chosen = above.top >= topReserve - 1 && hole.top > viewportH * 0.55 ? above : below;
  return {
    ...chosen,
    top: clamp(chosen.top, topReserve, Math.max(topReserve, viewportH - bottomReserve - cardH)),
    left: clamp(chosen.left, margin, viewportW - margin - cardW),
  };
}

function measureHole(target: HTMLElement) {
  const box = target.getBoundingClientRect();
  const pad = spotlightPad(target, box);
  return new DOMRect(box.left - pad.x, box.top - pad.y, box.width + pad.x * 2, box.height + pad.y * 2);
}

function scrollTargetIntoView(target: HTMLElement) {
  if (target.closest(".bottom-nav, .desktop-sidebar, .app-top")) return;
  const box = target.getBoundingClientRect();
  const topEdge = chromeBottom() + 16;
  const bottomEdge = window.innerHeight - (isPhoneTour() ? 110 : 24) - ESTIMATED_CARD_H - TOUR_GAP;
  if (box.top >= topEdge && box.bottom <= bottomEdge) return;
  const scroller = document.scrollingElement || document.documentElement;
  const desiredTop = box.top - (topEdge + Math.max(24, (bottomEdge - topEdge - box.height) / 2));
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  scroller.scrollTop += desiredTop;
  root.style.scrollBehavior = previous;
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

function blockTourScroll(event: Event) {
  const node = event.target;
  if (node instanceof Node && document.querySelector(".onboarding-tour-card")?.contains(node)) return;
  event.preventDefault();
}

type OnboardingMode = "profile" | "welcome" | "choice" | "tour" | "done";

export function OnboardingTour() {
  const { profile, localProfile } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const storageKey = profile ? DONE_KEY : "";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<OnboardingMode>("profile");
  const [stepIndex, setStepIndex] = useState(0);
  const [frame, setFrame] = useState<TourFrame | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const [copy, setCopy] = useState<TourCopy>(loadCopy);
  const [videoUrl, setVideoUrl] = useState(loadCachedVideo);
  const holdingTour = useRef(false);
  const openRef = useRef(false);
  openRef.current = open;
  const step = { ...(DEFAULT_STEPS[stepIndex] ?? DEFAULT_STEPS[0]), ...copy[stepIndex] };
  const video = onboardingVideoSrc(videoUrl);
  const visible = open && Boolean(profile);

  useEffect(() => {
    announceOnboarding(visible);
  }, [visible]);

  useEffect(() => () => announceOnboarding(false), []);

  useEffect(() => {
    void supabase.from("app_config").select("key, value").in("key", ["onboarding_copy", "onboarding_video_url"]).then(({ data, error }) => {
      if (error || !data) return;
      for (const row of data) {
        if (row.key === "onboarding_copy") {
          const resolved = resolveTourCopy(row.value);
          setCopy(resolved);
          localStorage.setItem(COPY_KEY, JSON.stringify(resolved));
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
      if (!profile) return;
      if (replayActive()) {
        sessionStorage.removeItem(REPLAY_KEY);
        holdingTour.current = true;
        holdStep(0);
        setMode("tour");
        setStepIndex(0);
        setFrame(null);
        setCardReady(false);
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
        setMode(isLocalProfileComplete(localProfile) ? "welcome" : "profile");
        setStepIndex(0);
        setFrame(null);
        setOpen(true);
        return;
      }
      if (holdingTour.current) return;
      if (openRef.current) return;
      const tourDone = localStorage.getItem(storageKey) === "done";
      const needsProfile = !isLocalProfileComplete(localProfile);
      if (needsProfile) {
        setMode("profile");
        setOpen(true);
        return;
      }
      if (!tourDone) {
        setMode("welcome");
        setOpen(true);
        return;
      }
      setOpen(false);
    }
    syncOpen();
    window.addEventListener(PREVIEW_EVENT, syncOpen);
    window.addEventListener(REPLAY_EVENT, syncOpen);
    return () => {
      window.removeEventListener(PREVIEW_EVENT, syncOpen);
      window.removeEventListener(REPLAY_EVENT, syncOpen);
    };
  }, [profile, storageKey, navigate, localProfile]);

  useEffect(() => {
    if (!open || mode !== "tour") return;
    let cancelled = false;
    let target: HTMLElement | null = null;
    let demoItem: HTMLElement | null = null;
    const expectedPath = DEFAULT_STEPS[stepIndex]?.path;
    const chromeSelector =
      step.selector.includes('"license"') ||
      step.selector.includes('"upgrade-pro"') ||
      step.selector.includes('"my-checklist"') ||
      step.selector.includes('"contacts"') ||
      step.selector.includes('"safety"') ||
      step.selector.includes('"profile"');

    setSearching(true);
    setCardReady(false);
    setFrame(null);

    function publishFrame(nextTarget: HTMLElement, cardH = ESTIMATED_CARD_H) {
      const holeRect = measureHole(nextTarget);
      const width = cardWidthFor(holeRect);
      const placed = placeTourCard(holeRect, width, cardH);
      setFrame({
        hole: {
          top: holeRect.top,
          left: holeRect.left,
          width: holeRect.width,
          height: holeRect.height,
        },
        card: {
          top: placed.top,
          left: placed.left,
          width,
          placement: placed.placement,
        },
      });
    }

    async function locate() {
      if (expectedPath && window.location.pathname !== expectedPath) {
        navigate(expectedPath);
      }

      for (let attempt = 0; attempt < 80 && !cancelled; attempt += 1) {
        if (expectedPath && window.location.pathname !== expectedPath) {
          await new Promise((resolve) => window.setTimeout(resolve, 80));
          continue;
        }
        const found = visibleTarget(step.selector);
        target = found ? highlightRoot(found, step.selector) : null;
        if (!target) {
          await new Promise((resolve) => window.setTimeout(resolve, 80));
          continue;
        }

        target.classList.add("onboarding-target-highlight");
        // Lifting page content above the tour layer would hide the tour card underneath it.
        if (chromeSelector && !target.closest(".app-main")) target.classList.add("onboarding-chrome-target");
        const item = step.selector.includes("check-item") ? target.closest(".check-item") : null;
        if (item instanceof HTMLElement) {
          demoItem = item;
          item.classList.add("tour-check-demo");
        }

        scrollTargetIntoView(target);
        await waitFrames(2);
        if (cancelled || !target) return;
        publishFrame(target, ESTIMATED_CARD_H);
        setSearching(false);
        return;
      }

      if (!cancelled) {
        setFrame({
          hole: { top: 0, left: 0, width: 0, height: 0 },
          card: {
            top: 0,
            left: 0,
            width: Math.min(360, window.innerWidth - 32),
            placement: "below",
          },
          fallback: true,
        });
        setSearching(false);
      }
    }

    function remeasure() {
      if (!target || cancelled) return;
      publishFrame(target, cardRef.current?.offsetHeight || ESTIMATED_CARD_H);
    }

    void locate();
    window.addEventListener("resize", remeasure);
    window.addEventListener("wheel", blockTourScroll, { passive: false });
    window.addEventListener("touchmove", blockTourScroll, { passive: false });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("wheel", blockTourScroll);
      window.removeEventListener("touchmove", blockTourScroll);
      target?.classList.remove("onboarding-target-highlight");
      target?.classList.remove("onboarding-chrome-target");
      demoItem?.classList.remove("tour-check-demo");
    };
  }, [open, mode, step.selector, stepIndex, location.pathname, navigate]);

  useLayoutEffect(() => {
    if (mode !== "tour" || !frame || frame.fallback || !cardRef.current) {
      if (frame && !searching) setCardReady(true);
      return;
    }
    const measured = Math.round(cardRef.current.getBoundingClientRect().height);
    if (measured > 40 && Math.abs(measured - ESTIMATED_CARD_H) > 12) {
      const holeRect = new DOMRect(frame.hole.left, frame.hole.top, frame.hole.width, frame.hole.height);
      const placed = placeTourCard(holeRect, frame.card.width, measured);
      if (
        Math.abs(placed.top - frame.card.top) > 2 ||
        Math.abs(placed.left - frame.card.left) > 2 ||
        placed.placement !== frame.card.placement
      ) {
        setFrame({
          ...frame,
          card: {
            top: placed.top,
            left: placed.left,
            width: frame.card.width,
            placement: placed.placement,
          },
        });
        return;
      }
    }
    setCardReady(true);
  }, [mode, frame, searching, step.title, step.body]);

  useEffect(() => {
    if (!open || mode !== "done") return;
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem(PREVIEW_KEY);
      if (storageKey) localStorage.setItem(storageKey, "done");
      setOpen(false);
      navigate("/app");
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [open, mode, navigate, storageKey]);

  const progress = useMemo(() => `${stepIndex + 1} of ${DEFAULT_STEPS.length}`, [stepIndex]);
  const fullName = localProfile.displayName.trim() || profile?.full_name?.trim() || "";
  if (!open || !profile) return null;

  function finish() {
    holdingTour.current = false;
    releaseHold();
    sessionStorage.removeItem(PREVIEW_KEY);
    if (storageKey) localStorage.setItem(storageKey, "done");
    setOpen(false);
    if (location.pathname !== "/app") navigate("/app");
  }
  function continueAfterProfile() {
    const tourDone = storageKey ? localStorage.getItem(storageKey) === "done" : false;
    if (tourDone && !previewActive()) {
      finish();
      return;
    }
    setMode("welcome");
  }
  function completeTour() {
    holdingTour.current = false;
    releaseHold();
    setMode("done");
    setFrame(null);
    setCardReady(false);
  }
  function startTour() {
    holdingTour.current = true;
    holdStep(0);
    setFrame(null);
    setCardReady(false);
    setMode("tour");
    setStepIndex(0);
    navigate(DEFAULT_STEPS[0].path);
  }
  function goToStep(nextIndex: number) {
    const next = DEFAULT_STEPS[nextIndex];
    if (!next) return;
    holdStep(nextIndex);
    setCardReady(false);
    setFrame(null);
    setStepIndex(nextIndex);
    if (next.path !== location.pathname) navigate(next.path);
  }
  function nextTour() {
    if (stepIndex >= DEFAULT_STEPS.length - 1) {
      completeTour();
      return;
    }
    goToStep(stepIndex + 1);
  }
  function backTour() {
    if (stepIndex <= 0) return;
    goToStep(stepIndex - 1);
  }

  const tightSpot = step.selector.includes("checklist-card") || step.selector.includes("progress");
  const lineSpot = step.selector.includes("check-item");
  const spotFeather = tightSpot ? 4 : lineSpot ? 6 : 18;
  const spotBlur = tightSpot ? 3 : lineSpot ? 2 : 14;
  const hole =
    frame && !frame.fallback && frame.hole.width > 0
      ? {
          top: frame.hole.top,
          left: frame.hole.left,
          right: frame.hole.left + frame.hole.width,
          bottom: frame.hole.top + frame.hole.height,
          width: frame.hole.width,
          height: frame.hole.height,
        }
      : null;
  const tourCardStyle = frame
    ? frame.fallback
      ? { width: frame.card.width }
      : {
          top: frame.card.top,
          left: frame.card.left,
          width: frame.card.width,
        }
    : undefined;
  const tourArrowStyle =
    frame && hole && !frame.fallback
      ? frame.card.placement === "below" || frame.card.placement === "above"
        ? {
            left: Math.min(
              Math.max(hole.left + hole.width / 2 - frame.card.left - 8, 22),
              frame.card.width - 40,
            ),
          }
        : {
            top: Math.min(
              Math.max(hole.top + hole.height / 2 - frame.card.top - 8, 22),
              Math.max(22, ESTIMATED_CARD_H - 40),
            ),
          }
      : undefined;

  return (
    <div className={`onboarding-layer ${mode === "tour" ? "tour-mode" : "welcome-mode"}`}>
      {mode === "profile" ? (
        <OnboardingProfileStep onContinue={continueAfterProfile} />
      ) : mode === "welcome" ? (
        <div className="onboarding-welcome-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
          <p className="eyebrow">Your checklist is ready</p>
          <h2 id="onboarding-title">{fullName ? `Welcome, ${fullName}` : "Welcome"}</h2>
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
                <span className="onboarding-play" aria-hidden="true">
                  ▶
                </span>
                <span>Welcome video</span>
                <small>Your intro video will play here</small>
              </>
            )}
          </div>
          <p className="onboarding-copy onboarding-welcome-intro">
            <strong>
              {fullName
                ? `Congratulations, ${fullName}! Welcome to your SafetyPrepList preparedness journey.`
                : "Congratulations! Welcome to your SafetyPrepList preparedness journey."}
            </strong>{" "}
            Feel free to watch the introduction video and take the guided tour so you can get familiar with your new
            checklist.
          </p>
          <div className="onboarding-actions onboarding-actions-stacked">
            <button className="btn btn-primary" type="button" onClick={() => setMode("choice")}>
              Continue onboarding
            </button>
          </div>
        </div>
      ) : mode === "choice" ? (
        <div
          className="onboarding-welcome-card onboarding-choice-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-choice-title"
        >
          <p className="eyebrow">Getting started</p>
          <h2 id="onboarding-choice-title">Would you like a guided tour?</h2>
          <p className="onboarding-copy">
            We can show you checklist progress, notes, contacts, safety resources, profile, and your license. It only
            takes a minute.
          </p>
          <div className="onboarding-actions">
            <button className="btn btn-ghost" type="button" onClick={finish}>
              Skip and explore on my own
            </button>
            <button className="btn btn-primary" type="button" onClick={startTour}>
              Take the guided tour
            </button>
          </div>
        </div>
      ) : mode === "done" ? (
        <div className="onboarding-done-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-done-title">
          <span className="onboarding-done-check" aria-hidden="true">
            ✓
          </span>
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
                      rx={tightSpot ? 16 : 28}
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
          {frame ? (
            <aside
              ref={cardRef}
              className={`onboarding-tour-card place-${frame.card.placement}${cardReady ? " is-ready" : ""}${
                frame.fallback ? " is-fallback" : ""
              }`}
              style={tourCardStyle}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tour-title"
            >
              {hole && !frame.fallback ? (
                <span className={`onboarding-tour-arrow ${frame.card.placement}`} style={tourArrowStyle} aria-hidden="true" />
              ) : null}
              <div className="onboarding-tour-head">
                <span>{progress}</span>
                <button type="button" onClick={finish} aria-label="Skip tour">
                  ×
                </button>
              </div>
              <p className="eyebrow">Guided tour</p>
              <h2 id="tour-title">{step.title}</h2>
              <p>{step.body}</p>
              {searching ? <p className="muted">Finding that section…</p> : null}
              {frame.fallback ? (
                <p className="muted">That control is not on this screen right now. Continue to the next stop.</p>
              ) : null}
              <div className="onboarding-tour-actions">
                <button className="btn btn-ghost" type="button" onClick={finish}>
                  Skip
                </button>
                <button className="btn btn-ghost" type="button" onClick={backTour} disabled={stepIndex === 0 || searching}>
                  Back
                </button>
                <button className="btn btn-primary" type="button" onClick={nextTour} disabled={searching && !frame}>
                  {stepIndex === DEFAULT_STEPS.length - 1 ? "Finish" : "Next"}
                </button>
              </div>
            </aside>
          ) : null}
        </>
      )}
    </div>
  );
}

export { COPY_KEY, DEFAULT_STEPS, VIDEO_CACHE_KEY, loadCopy };
