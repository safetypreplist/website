import { Navigate, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "../components/Brand";
import { Confetti } from "../components/Confetti";
import { FamilySeatSetup, loadOpenFamilySeats } from "../components/FamilySeatSetup";
import { AutoRenewalNote, LegalAgreement } from "../components/LegalAgreement";
import { ScopeAcknowledgment } from "../components/ScopeAcknowledgment";
import { StripeCheckout } from "../components/StripeCheckout";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { SurvivalVaultModal } from "../components/SurvivalVaultModal";
import { useApp } from "../context/AppContext";
import { money } from "../lib/format";
import { trackPurchase } from "../lib/analytics";
import { FAMILY_MIN_SEATS } from "../lib/identity";
import { PHOTO_LIBRARY } from "../lib/photos";
import {
  ANNUAL_CENTS,
  MAX_CHECKLIST_QUANTITY,
  PUBLIC_ACCESS,
  SURVIVAL_VAULT_CENTS,
  SURVIVAL_VAULT_DESCRIPTION,
  checkoutBreakdown,
  type AccessInterval,
} from "../lib/pricing";
import { SCOPE_LINE } from "../lib/copy";
import { invokeFunction } from "../lib/supabase";

const PROGRESS = ["Choose Plan", "Purchase", "Create Account", "Get Ready"] as const;

function plural(count: number, unit: string) {
  return count === 1 ? `1 ${unit}` : `${count} ${unit}s`;
}

function readDiscountTerms(): { renewalCents: number; payments: number } | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem("spl.discountTerms") || "null");
    if (!parsed || typeof parsed.renewalCents !== "number" || typeof parsed.payments !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 5.5V3.8A1.3 1.3 0 0 0 9.2 2.5H3.8A1.3 1.3 0 0 0 2.5 3.8v5.4A1.3 1.3 0 0 0 3.8 10.5H5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function CheckoutProgress({ current }: { current: number }) {
  return (
    <ol className="checkout-progress" aria-label="Purchase progress">
      {PROGRESS.map((label, index) => (
        <li
          key={label}
          className={index < current ? "done" : index === current ? "current" : ""}
          aria-current={index === current ? "step" : undefined}
        >
          <span className="checkout-progress-dot" aria-hidden="true">
            {index < current ? (
              <svg viewBox="0 0 24 24">
                <path d="m6 12.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              index + 1
            )}
          </span>
          <span className="checkout-progress-label">{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function PricingPage() {
  return <Navigate to="/#pricing" replace />;
}

export function CheckoutPage() {
  const { products, session, loading, signOut, myChecklist, hasSurvivalVault } = useApp();
  const [params] = useSearchParams();
  const renew = params.get("renew") === "1";
  const requestedPlan = params.get("plan") === "family" ? "family" : "individual";
  // Customers who already own a checklist buy additional checklists; their own is never counted again.
  const addingChecklists = Boolean(
    session && !renew && myChecklist?.status === "active" && myChecklist.ownerUserId === session.user.id,
  );
  const [additional, setAdditional] = useState(() =>
    Math.min(MAX_CHECKLIST_QUANTITY, Math.max(1, Number(params.get("qty") || 1) || 1)),
  );
  const [familyQty, setFamilyQty] = useState(() =>
    Math.min(
      MAX_CHECKLIST_QUANTITY,
      Math.max(FAMILY_MIN_SEATS, Number(params.get("qty") || FAMILY_MIN_SEATS) || FAMILY_MIN_SEATS),
    ),
  );
  const people = addingChecklists ? additional : requestedPlan === "family" ? familyQty : 1;
  const planKind = addingChecklists ? (people > 1 ? "family" : "individual") : requestedPlan;
  const access: AccessInterval = PUBLIC_ACCESS;
  const [vault, setVault] = useState(!renew && (params.get("vault") === "1" || params.get("household") === "1"));
  const vaultOffered = !renew && !(addingChecklists && hasSurvivalVault);
  useEffect(() => {
    if (!vaultOffered) setVault(false);
  }, [vaultOffered]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [discountMessage, setDiscountMessage] = useState("");
  const [discountApplied, setDiscountApplied] = useState(0);
  const [discountPayments, setDiscountPayments] = useState(1);
  const [checkingCode, setCheckingCode] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [scopeAck, setScopeAck] = useState(false);
  const upgrade = products.find((p) => p.slug === "upgrade_full");
  const vaultCents = upgrade?.amount_cents ?? SURVIVAL_VAULT_CENTS;
  const annualProduct = products.find((p) => p.slug === "access_annual");
  const unitCents = annualProduct?.amount_cents ?? ANNUAL_CENTS;
  const breakdown = checkoutBreakdown(people, access, vault);
  const shownDiscount = discountApplied;
  const shownCode = appliedCode;
  const discountedDueToday = Math.max(0, breakdown.dueTodayCents - shownDiscount);
  const discountedRenewalCents = Math.max(0, breakdown.recurringCents - shownDiscount);
  const title = addingChecklists
    ? "Additional Checklists"
    : `${renew ? "Renew " : ""}${planKind === "family" ? "Family Plan" : "Individual Plan"}`;

  useEffect(() => {
    sessionStorage.setItem("spl.plan", planKind);
    sessionStorage.setItem("spl.familyQty", String(people));
    sessionStorage.setItem("spl.vault", vault ? "1" : "0");
    sessionStorage.setItem("spl.household", vault ? "1" : "0");
    sessionStorage.setItem("spl.access", access);
    sessionStorage.setItem("spl.discountCode", appliedCode);
    sessionStorage.setItem("spl.addOn", addingChecklists ? "1" : "0");
  }, [planKind, people, vault, access, appliedCode, addingChecklists]);

  useEffect(() => {
    sessionStorage.setItem(
      "spl.discountTerms",
      discountApplied > 0 ? JSON.stringify({ renewalCents: discountedRenewalCents, payments: discountPayments }) : "",
    );
  }, [discountApplied, discountedRenewalCents, discountPayments]);

  const applyCode = useCallback(async (raw: string) => {
    const normalized = raw.trim().toUpperCase();
    if (!normalized) {
      setDiscountMessage("Enter a discount code.");
      return;
    }
    setCheckingCode(true);
    try {
      const preview = await invokeFunction<{
        code: string;
        kind?: string;
        discountCents: number;
        dueTodayCents: number;
        regularCents?: number;
        discountPayments?: number;
      }>(
        "preview-discount",
        {
          code: normalized,
          plan: planKind,
          quantity: people,
          accessInterval: access,
          includeHousehold: vault,
        },
      );
      setAppliedCode(preview.code);
      const payments = Math.max(1, preview.discountPayments || 1);
      setDiscountApplied(preview.discountCents);
      setDiscountPayments(payments);
      const regular = preview.regularCents ?? breakdown.subscriptionCents;
      setDiscountMessage(
        preview.kind === "price" && payments === 1
          ? `${preview.code} applied — your first year is ${money(regular - preview.discountCents)}, then ${money(regular)} per year.`
          : payments > 1
            ? `${preview.code} applied — you save ${money(preview.discountCents)} on each of your first ${payments} payments.`
            : `${preview.code} applied — you save ${money(preview.discountCents)}.`,
      );
    } catch (err) {
      setAppliedCode("");
      setDiscountApplied(0);
      setDiscountPayments(1);
      setDiscountMessage(err instanceof Error ? err.message : "That code is not active or does not apply to this plan.");
    } finally {
      setCheckingCode(false);
    }
  }, [breakdown.subscriptionCents, people, planKind, vault]);

  if (renew && !loading && !session) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="checkout-stage">
      <div
        className="checkout-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <main className="checkout-panel">
        <CheckoutProgress current={1} />
        <BrandMark />

        {session && !renew ? (
          <div className="checkout-signed-in" role="note">
            <p>
              You're signed in as <b>{session.user.email}</b>. This purchase will be added to that account.
            </p>
            <p className="muted">Buying for someone new? Sign out first so they can create their own account.</p>
            <button className="btn btn-ghost" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        ) : null}

        <section className="checkout-step">
          <p className="eyebrow">{addingChecklists ? "Add to Your Plan" : "Your Plan"}</p>
          <h1>{title}</h1>
          {addingChecklists ? (
            <>
              <div className="qty-picker">
                <span>How many additional checklists would you like to purchase?</span>
                <div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label="One fewer checklist"
                    disabled={additional <= 1}
                    onClick={() => setAdditional((n) => Math.max(1, n - 1))}
                  >
                    -
                  </button>
                  <b>{additional}</b>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label="One more checklist"
                    disabled={additional >= MAX_CHECKLIST_QUANTITY}
                    onClick={() => setAdditional((n) => Math.min(MAX_CHECKLIST_QUANTITY, n + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="muted">
                {plural(people, "additional checklist")} to share with family members or guests. Your own checklist is
                already on your account and isn't charged again.
              </p>
            </>
          ) : (
            <>
              {requestedPlan === "family" && !renew ? (
                <div className="qty-picker">
                  <span>Family Members</span>
                  <div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      aria-label="One fewer family member"
                      disabled={familyQty <= FAMILY_MIN_SEATS}
                      onClick={() => setFamilyQty((n) => Math.max(FAMILY_MIN_SEATS, n - 1))}
                    >
                      -
                    </button>
                    <b>{familyQty}</b>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      aria-label="One more family member"
                      disabled={familyQty >= MAX_CHECKLIST_QUANTITY}
                      onClick={() => setFamilyQty((n) => Math.min(MAX_CHECKLIST_QUANTITY, n + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : null}
              <p className="muted">
                {people === 1 ? "1 Personal Checklist" : `${people} Personal Checklists`}
              </p>
            </>
          )}
          <p className="muted">{SCOPE_LINE}</p>
          {people > 1 ? <p className="plan-line">{money(unitCents)} × {people} for the year</p> : null}
          <p className="checkout-rate">{money(breakdown.subscriptionCents)} <small>/ year</small></p>
          <p className="muted">One yearly payment. No monthly subscription.</p>
        </section>

        {!vaultOffered ? null : (
          <section className="checkout-step">
            <p className="eyebrow">Optional</p>
            <div className={`vault-add ${vault ? "added" : ""}`}>
              <label>
                <input type="checkbox" checked={vault} onChange={(e) => setVault(e.target.checked)} />
                <span>
                  <b>Add Survival Vault, $10 one time</b>
                  <small>{SURVIVAL_VAULT_DESCRIPTION}</small>
                </span>
              </label>
              <button type="button" className="vault-details" onClick={() => setDetailsOpen(true)}>
                See details
              </button>
            </div>
          </section>
        )}

        <section className="checkout-step discount-checkout">
          {showDiscount ? (
            <>
              <p className="eyebrow">Have a code?</p>
              <div className="discount-entry">
                <input
                  value={discountCode}
                  onChange={(e) => {
                    setDiscountCode(e.target.value.toUpperCase());
                    setAppliedCode("");
                    setDiscountApplied(0);
                    setDiscountMessage("");
                  }}
                  placeholder="Enter discount code"
                  aria-label="Discount code"
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={checkingCode}
                  onClick={() => void applyCode(discountCode)}
                >
                  {checkingCode ? "Checking…" : "Apply"}
                </button>
              </div>
              {discountMessage || shownDiscount ? (
                <p className={`discount-result ${shownDiscount ? "success" : "error"}`}>{discountMessage}</p>
              ) : null}
            </>
          ) : (
            <button type="button" className="btn btn-ghost discount-toggle" onClick={() => setShowDiscount(true)}>
              Have a discount code?
            </button>
          )}
        </section>

        <section className="checkout-step checkout-summary">
          <div className="summary-block">
            <p>
              <span>
                {addingChecklists ? plural(people, "additional checklist") : title}
                {!addingChecklists && people > 1 ? ` (${people} checklists)` : ""}
              </span>
              <b>{money(breakdown.subscriptionCents)}/year</b>
            </p>
          </div>
          {vault ? (
            <div className="summary-block">
              <p>
                <span>Survival Vault</span>
                <b>{money(vaultCents)} one time</b>
              </p>
            </div>
          ) : null}
          {shownDiscount ? (
            <div className="summary-block discount-summary">
              <p>
                <span>Discount ({shownCode})</span>
                <b>−{money(shownDiscount)}</b>
              </p>
            </div>
          ) : null}
          <p className="checkout-due">
            Due today
            <b>{money(discountedDueToday)}</b>
          </p>
          <p className="muted">
            {shownDiscount > 0 && discountPayments > 1
              ? `Renews at ${money(discountedRenewalCents)} for the next ${plural(discountPayments - 1, "year")}, then ${money(breakdown.recurringCents)} per year.`
              : `Renews once a year at ${money(breakdown.recurringCents)}. Cancel anytime before renewal.`}
            {vault ? " Survival Vault is one time and does not renew." : ""}
          </p>
        </section>

        <>
          <LegalAgreement checked={agreed} onChange={setAgreed} />
          <ScopeAcknowledgment checked={scopeAck} onChange={setScopeAck} />
          <AutoRenewalNote
            amount={money(breakdown.recurringCents)}
            interval="year"
            discountedAmount={shownDiscount > 0 ? money(discountedRenewalCents) : undefined}
            discountedPayments={shownDiscount > 0 ? discountPayments : 1}
          />
          {error && <p className="form-error">{error}</p>}
          {agreed && scopeAck ? (
            <StripeCheckout
              key={`${planKind}-${people}-annual-${vault ? "v" : "n"}-${shownCode}-${addingChecklists ? "add" : "new"}`}
              productSlug="core"
              quantity={people}
              includeHousehold={vault}
              accessInterval={PUBLIC_ACCESS}
              planKind={planKind}
              discountCode={shownCode}
              renew={renew}
              onError={setError}
            />
          ) : (
            <p className="form-error checkout-locked">
              {!agreed && !scopeAck
                ? "Check both boxes above to continue to checkout."
                : !scopeAck
                  ? "Agree to the Scope & Use Acknowledgment above to continue to checkout."
                  : "Agree to the Terms, Privacy Policy, and Refund Policy above to continue to checkout."}
            </p>
          )}
        </>
        <p className="muted checkout-back">
          {renew ? <Link to="/app/account">Back to account</Link> : <Link to="/#pricing">Change plan</Link>}
        </p>
      </main>
      <PublicFooter />

      {detailsOpen ? (
        <SurvivalVaultModal
          price={money(vaultCents)}
          onClose={() => setDetailsOpen(false)}
          onAdd={() => setVault(true)}
        />
      ) : null}
    </div>
  );
}

const REVIEW_STEPS = [
  "Checking with Stripe…",
  "Confirming your payment…",
  "Creating your confirmation number…",
  "Getting your receipt ready…",
];

function PaymentReviewing({ error, onRetry }: { error: string; onRetry: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (error) return;
    const id = window.setInterval(() => setStep((current) => (current + 1) % REVIEW_STEPS.length), 2200);
    return () => window.clearInterval(id);
  }, [error]);

  return (
    <div className="payment-review" role="status" aria-live="polite">
      <p className="payment-review-kicker">Checkout</p>
      <h1>Reviewing payment</h1>
      <p className="payment-review-status">{error || REVIEW_STEPS[step]}</p>
      {error ? (
        <button className="btn btn-primary" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : (
        <div className="payment-review-bar" aria-hidden="true" />
      )}
      <p className="payment-review-hint">{error ? "Your card was charged. We’re still matching it to your plan." : "This only takes a moment. Keep this page open."}</p>
    </div>
  );
}

type CheckoutReceipt = {
  productCode: string;
  linkedToUser?: boolean;
  plan?: string;
  quantity?: number;
  vault?: boolean;
  access?: AccessInterval;
  paidCents?: number;
  recurringCents?: number;
  discountCents?: number;
  discountPayments?: number;
  addOn?: boolean;
};

export function ThankYouPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshAccount, user } = useApp();
  const addOn = params.get("add") === "1" || (!params.get("plan") && sessionStorage.getItem("spl.addOn") === "1");
  const [linked, setLinked] = useState(params.get("linked") === "1" || addOn);
  const checkoutSession = params.get("session_id") || "";
  const initialCode = params.get("code") || (checkoutSession ? "" : sessionStorage.getItem("spl.productCode") || "");
  const [code, setCode] = useState(initialCode);
  const [captureError, setCaptureError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const capturing = useRef(false);
  const [plan, setPlan] = useState(params.get("plan") || sessionStorage.getItem("spl.plan") || "individual");
  const [qty, setQty] = useState(Number(params.get("qty") || sessionStorage.getItem("spl.familyQty") || "1"));
  const isFamily = plan === "family" && qty > 1;
  const [vault, setVault] = useState(
    params.get("vault") === "1" ||
      params.get("household") === "1" ||
      sessionStorage.getItem("spl.vault") === "1" ||
      sessionStorage.getItem("spl.household") === "1",
  );
  const [access, setAccess] = useState<AccessInterval>(PUBLIC_ACCESS);
  const [paidCents, setPaidCents] = useState(() => Number(params.get("paid") || sessionStorage.getItem("spl.paidCents") || "0") || 0);
  const [recurringCents, setRecurringCents] = useState(
    () => Number(params.get("renew") || sessionStorage.getItem("spl.recurringCents") || "0") || 0,
  );
  const finishing = Boolean(checkoutSession && !code);
  const [copied, setCopied] = useState(false);
  const [familySeats, setFamilySeats] = useState<string[]>([]);
  const [burst, setBurst] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!code || finishing) return;
    const timer = window.setTimeout(() => setBurst(true), 400);
    return () => window.clearTimeout(timer);
  }, [code, finishing]);

  useEffect(() => {
    if (!linked || !code || !userId || (plan !== "family" && !addOn)) return;
    let active = true;
    void loadOpenFamilySeats(userId).then((seats) => {
      if (active) setFamilySeats(seats);
    });
    return () => {
      active = false;
    };
  }, [linked, code, userId, plan, addOn]);
  const breakdown = checkoutBreakdown(plan === "family" || addOn ? qty : 1, access, vault);
  const discountTerms = useMemo(() => readDiscountTerms(), []);
  const listedRecurring = recurringCents || breakdown.recurringCents;
  const listedPaid =
    paidCents ||
    (discountTerms ? Math.max(0, breakdown.dueTodayCents - (breakdown.recurringCents - discountTerms.renewalCents)) : 0) ||
    breakdown.dueTodayCents;
  const remainingDiscounted = discountTerms ? discountTerms.payments - 1 : listedPaid < listedRecurring ? 0 : 0;
  const intervalWord = access === "annual" ? "annual" : "monthly";

  useEffect(() => {
    if (!code || finishing) return;
    const itemName = addOn ? "Additional Checklists" : plan === "family" ? "Family Plan" : "Individual Plan";
    trackPurchase({ transactionId: code, valueCents: listedPaid, itemName });
  }, [addOn, code, finishing, listedPaid, plan]);

  const renewal =
    listedPaid < listedRecurring
      ? `You paid ${money(listedPaid)} today. Then ${money(listedRecurring)} per ${access === "annual" ? "year" : "month"}.`
      : discountTerms && remainingDiscounted > 0
        ? remainingDiscounted === 1
          ? `Your next ${intervalWord} payment is ${money(discountTerms.renewalCents)}, then ${money(listedRecurring)} per ${access === "annual" ? "year" : "month"}.`
          : `Your next ${remainingDiscounted} ${intervalWord} payments are ${money(discountTerms.renewalCents)} each, then ${money(listedRecurring)} per ${access === "annual" ? "year" : "month"}.`
        : `Renews ${access === "annual" ? "annually" : "monthly"} at ${money(listedRecurring)}.`;

  useEffect(() => {
    if (code || !checkoutSession) return;
    capturing.current = true;
    setCaptureError("");
    let cancelled = false;

    async function wait(ms: number) {
      await new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    async function finish() {
      const pauses = [0, 900, 1400, 1800, 2200, 2800, 3500];
      let lastError = "Could not finish the purchase.";
      for (const pause of pauses) {
        if (pause) await wait(pause);
        if (cancelled) return;
        try {
          const captured = await invokeFunction<CheckoutReceipt>("checkout-status", {
            sessionId: checkoutSession,
          });
          if (!captured?.productCode) throw new Error("No confirmation number was returned.");
          if (cancelled) return;
          sessionStorage.setItem("spl.productCode", captured.productCode);
          const nextPlan = captured.plan || plan;
          const nextQty = captured.quantity || qty;
          const nextVault = Boolean(captured.vault ?? vault);
          const nextAccess = captured.access === "annual" ? "annual" : captured.access === "monthly" ? "monthly" : access;
          const nextPaid = captured.paidCents || 0;
          const nextRecurring = captured.recurringCents || 0;
          setPlan(nextPlan);
          setQty(nextQty);
          setVault(nextVault);
          setAccess(nextAccess);
          if (nextPaid) {
            setPaidCents(nextPaid);
            sessionStorage.setItem("spl.paidCents", String(nextPaid));
          }
          if (nextRecurring) {
            setRecurringCents(nextRecurring);
            sessionStorage.setItem("spl.recurringCents", String(nextRecurring));
          }
          if (captured.linkedToUser) {
            setLinked(true);
            void refreshAccount();
          }
          setCode(captured.productCode);
          navigate(
            `/thank-you?code=${encodeURIComponent(captured.productCode)}&plan=${nextPlan}&qty=${nextQty}&vault=${nextVault ? "1" : "0"}&access=${nextAccess}&paid=${nextPaid}&renew=${nextRecurring}${addOn || captured.addOn ? "&add=1" : ""}${captured.linkedToUser ? "&linked=1" : ""}`,
            { replace: true },
          );
          return;
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Could not finish the purchase.";
        }
      }
      if (!cancelled) setCaptureError(lastError);
    }

    void finish();
    return () => {
      cancelled = true;
      capturing.current = false;
    };
  }, [access, addOn, attempt, checkoutSession, code, navigate, plan, qty, refreshAccount, vault]);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }

  if (finishing) {
    return (
      <PaymentReviewing
        error={captureError}
        onRetry={() => {
          capturing.current = false;
          setCaptureError("");
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  if (!code) {
    return (
      <div className="checkout-stage">
        <div
          className="checkout-bg"
          style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
          aria-hidden="true"
        />
        <PublicHeader />
        <main className="checkout-panel">
          <BrandMark />
          <h1>No purchase to show yet.</h1>
          <p className="muted">
            This page appears after checkout. If you already paid, use the confirmation number in your email, or contact
            us and we’ll help.
          </p>
          <Link className="btn btn-primary btn-block" style={{ marginTop: 18 }} to="/#pricing">
            See plans
          </Link>
          <p className="muted checkout-back">
            <Link to="/contact">Contact us</Link>
          </p>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="checkout-stage">
      <div
        className="checkout-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <Confetti fire={burst} />
      <main className="checkout-panel thank-you-panel">
        <CheckoutProgress current={linked ? 3 : 2} />
        <h1>{addOn ? "Thank you for your purchase!" : "Thank you for signing up!"}</h1>
        <p className="muted thank-you-lead">
          {addOn
            ? "Your additional checklists have been added to your account. Invite the people you'd like to share them with."
            : linked
              ? "Here is your plan. It’s already been added to your account."
              : isFamily
                ? "Here is your plan. Next, create your account and add your family members."
                : "Here is your plan."}
        </p>

        <section className="thank-you-plan" aria-label="Your plan">
          <div className="thank-you-plan-head">
            <div>
              <p className="thank-you-plan-label">{addOn ? "Added to your plan" : "Your new plan"}</p>
              <h2>{addOn ? "Additional Checklists" : plan === "family" ? "Family Plan" : "Individual Plan"}</h2>
            </div>
            <p className="thank-you-plan-price">
              {money(listedPaid)}
              <small>{listedPaid < listedRecurring ? " today" : `/${access === "annual" ? "year" : "month"}`}</small>
            </p>
          </div>
          <dl className="thank-you-plan-rows">
            <div>
              <dt>Checklists</dt>
              <dd>
                {addOn
                  ? plural(qty, "additional checklist")
                  : plan === "family"
                    ? plural(qty, "personal checklist")
                    : "1 personal checklist"}
              </dd>
            </div>
            {vault ? (
              <div>
                <dt>Survival Vault</dt>
                <dd>Included, one time</dd>
              </div>
            ) : null}
          </dl>
          <p className="thank-you-plan-note">{renewal}</p>
        </section>

        <div className="thank-you-ref">
          <div className="thank-you-ref-row">
            <span className="thank-you-ref-label">Confirmation number</span>
            <code>{code}</code>
            <button
              className="purchase-ref-copy"
              type="button"
              onClick={() => void copy()}
              aria-label={copied ? "Copied confirmation number" : "Copy confirmation number"}
              title={copied ? "Copied" : "Copy"}
            >
              {copied ? "✓" : <CopyIcon />}
            </button>
          </div>
        </div>

        {code && linked && familySeats.length ? (
          <div className="thank-you-family">
            <h2>Set up your family</h2>
            <FamilySeatSetup
              seatIds={familySeats}
              onDone={() => {
                sessionStorage.removeItem("spl.productCode");
                void refreshAccount().then(() => navigate("/app"));
              }}
            />
          </div>
        ) : code && linked ? (
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 14 }}
            type="button"
            onClick={() => {
              sessionStorage.removeItem("spl.productCode");
              void refreshAccount().then(() => navigate("/app"));
            }}
          >
            Go to My Checklist
          </button>
        ) : code ? (
          <Link
            className="btn btn-primary btn-block"
            style={{ marginTop: 14 }}
            to={`/create-account?code=${encodeURIComponent(code)}${isFamily ? `&qty=${qty}` : ""}`}
          >
            {isFamily ? "Create Accounts" : "Create My Account"}
          </Link>
        ) : null}
        <p className="muted thank-you-receipt">Stripe will email your receipt to the address you used at checkout.</p>
      </main>
      <PublicFooter />
    </div>
  );
}
