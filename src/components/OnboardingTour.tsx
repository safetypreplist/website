import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

type Step = { title: string; body: string; selector: string; path: string };
type Copy = Pick<Step, "title" | "body">[];

const DEFAULT_STEPS: Step[] = [
  { title: "Start with your checklist", body: "Your readiness plan is organized into simple systems. Open any list to see what to gather and what is already complete.", selector: '[data-onboarding="checklist-card"]', path: "/app" },
  { title: "Check items off as you go", body: "Tap an item when it is ready. Your progress saves to your account and stays with you across devices.", selector: '[data-onboarding="check-item"]', path: "/app/lists/grab-go" },
  { title: "Leave a note for yourself", body: "Add short notes to remember where something is stored, what size to buy, or what still needs attention.", selector: '[data-onboarding="notes"]', path: "/app/lists/grab-go" },
  { title: "Connect your family", body: "Invite family members or connect an existing checklist from Manage Family Plan so everyone can prepare together.", selector: '[data-onboarding="family"]', path: "/app/family" },
  { title: "Keep your account current", body: "Your Profile is where you can update your details, change your password, manage devices, and find your Checklist ID.", selector: '[data-onboarding="profile"]', path: "/app/account" },
];

const COPY_KEY = "spl.onboarding.copy.v1";
function loadCopy(): Copy {
  try { return JSON.parse(localStorage.getItem(COPY_KEY) || "null") || DEFAULT_STEPS.map(({ title, body }) => ({ title, body })); } catch { return DEFAULT_STEPS.map(({ title, body }) => ({ title, body })); }
}

export function OnboardingTour() {
  const { profile } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const storageKey = profile ? `spl.onboarding.v1.${profile.id}` : "";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"welcome" | "tour">("welcome");
  const [slide, setSlide] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [copy] = useState<Copy>(loadCopy);
  const step = { ...DEFAULT_STEPS[stepIndex], ...copy[stepIndex] };

  useEffect(() => {
    if (!profile?.id || profile.plan === "none") return;
    if (localStorage.getItem(storageKey) !== "done") setOpen(true);
  }, [profile?.id, profile?.plan, storageKey]);

  useEffect(() => {
    if (!open || mode !== "tour") return;
    const target = document.querySelector(step.selector) as HTMLElement | null;
    target?.classList.add("onboarding-target-highlight");
    const timer = window.setTimeout(() => setRect(target?.getBoundingClientRect() || null), 120);
    const update = () => setRect(target?.getBoundingClientRect() || null);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.clearTimeout(timer); target?.classList.remove("onboarding-target-highlight"); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, mode, step.selector, location.pathname]);

  const progress = useMemo(() => `${stepIndex + 1} of ${DEFAULT_STEPS.length}`, [stepIndex]);
  if (!open || !profile) return null;

  function finish() { if (storageKey) localStorage.setItem(storageKey, "done"); setOpen(false); }
  function startTour() { setMode("tour"); setStepIndex(0); navigate(DEFAULT_STEPS[0].path); }
  function nextWelcome() { if (slide === 0) setSlide(1); else startTour(); }
  function nextTour() { if (stepIndex === DEFAULT_STEPS.length - 1) { finish(); return; } const nextIndex = stepIndex + 1; setStepIndex(nextIndex); navigate(DEFAULT_STEPS[nextIndex].path); }

  return <div className={`onboarding-layer ${mode === "tour" ? "tour-mode" : ""}`}>
    {mode === "welcome" ? <div className="onboarding-welcome-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-slide-dots" aria-label={`Welcome slide ${slide + 1} of 2`}>{[0, 1].map((dot) => <span className={dot === slide ? "active" : ""} key={dot} />)}</div>
      {slide === 0 ? <><div className="onboarding-video"><span className="onboarding-play">▶</span><span>Welcome to your safety checklist</span><small>Watch the quick welcome video</small></div><p className="eyebrow">A calmer way to prepare</p><h2 id="onboarding-title">Welcome to Safety Prep List.</h2><p className="onboarding-copy">Watch the welcome video now, or skip it and learn more on the next slide.</p><div className="onboarding-actions onboarding-actions-stacked"><button className="btn btn-primary" type="button" onClick={nextWelcome}>Watch welcome video</button><button className="onboarding-skip-inline" type="button" onClick={nextWelcome}>Skip video</button></div></> : null}
      {slide === 1 ? <><p className="eyebrow">Your checklist is ready</p><h2 id="onboarding-title">Do you want a guided tour?</h2><p className="onboarding-copy">We can show you where to check items, leave notes, connect family members, and manage your account. You can exit at any time.</p><div className="onboarding-actions"><button className="btn btn-ghost" type="button" onClick={finish}>Start on my own</button><button className="btn btn-primary" type="button" onClick={startTour}>Take the guided tour</button></div></> : null}
    </div> : <><div className="onboarding-scrim" aria-hidden="true" />{rect ? <div className="onboarding-spotlight" style={{ top: rect.top - 30, left: rect.left - 40, width: rect.width + 80, height: rect.height + 60 }} /> : null}<aside className={`onboarding-tour-card ${rect && rect.top > window.innerHeight * .55 ? "above" : ""}`} role="dialog" aria-modal="true" aria-labelledby="tour-title"><div className="onboarding-tour-head"><span>{progress}</span><button type="button" onClick={finish}>×</button></div><p className="eyebrow">Guided tour</p><h2 id="tour-title">{step.title}</h2><p>{step.body}</p><div className="onboarding-tour-actions"><button className="btn btn-ghost" type="button" onClick={finish}>Exit tour</button><button className="btn btn-primary" type="button" onClick={nextTour}>{stepIndex === DEFAULT_STEPS.length - 1 ? "Finish tour" : "Next"}</button></div></aside></>}
  </div>;
}

export { COPY_KEY, DEFAULT_STEPS, loadCopy };
