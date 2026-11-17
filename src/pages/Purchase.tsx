import { Navigate, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "../components/Brand";
import { AutoRenewalNote, LegalAgreement } from "../components/LegalAgreement";
import { ScopeAcknowledgment } from "../components/ScopeAcknowledgment";
import { StripeCheckout } from "../components/StripeCheckout";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { SurvivalVaultModal } from "../components/SurvivalVaultModal";
import { useApp } from "../context/AppContext";
import { money } from "../lib/format";
import { FAMILY_MIN_SEATS } from "../lib/identity";
import { PHOTO_LIBRARY } from "../lib/photos";
import {
  ANNUAL_CENTS,
  MAX_CHECKLIST_QUANTITY,
  PUBLIC_ACCESS,
  SURVIVAL_VAULT_CENTS,
  checkoutBreakdown,
  type AccessInterval,
} from "../lib/pricing";
import { SCOPE_LINE } from "../lib/copy";
import { invokeFunction } from "../lib/supabase";

const PROGRESS = ["Choose Plan", "Purchase", "Activate"] as const;

function plural(count: number, unit: string) {
  return count === 1 ? `1 ${unit}` : `${count} ${unit}s`;
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
  const { loading, hasSurvivalVault } = useApp();
  const [params] = useSearchParams();
  const renew = params.get("renew") === "1";
  const requestedPlan = params.get("plan") === "family" ? "family" : "individual";
  // Customers who already own a checklist buy additional checklists; their own is never counted again.
  const addingChecklists = false;
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
  const vaultCents = SURVIVAL_VAULT_CENTS;
  const unitCents = ANNUAL_CENTS;
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

  if (renew && !loading) {
    return <Navigate to="/activate" replace />;
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
            <p className="eyebrow">Add-on</p>
            <div className={`vault-add ${vault ? "added" : ""}`}>
              <label>
                <input type="checkbox" checked={vault} onChange={(e) => setVault(e.target.checked)} />
                <span>
                  <b>Add Survival Vault for an extra $10/year</b>
                  <small>
                    Includes Off-Grid Systems, Water Purification, Home Battery &amp; Solar, Emergency Cooling / Heat
                    Resilience, and Long-Term Food.
                  </small>
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
                <b>{money(vaultCents)}/year</b>
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





export function ThankYouPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const checkoutSession = params.get("session_id") || "";
  const [licenseKey, setLicenseKey] = useState("");
  const [product, setProduct] = useState<"basic" | "pro" | "">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(checkoutSession));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!checkoutSession) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    let attempt = 0;
    async function poll() {
      try {
        const captured = await invokeFunction<{
          licenseKey?: string;
          product?: "basic" | "pro";
          error?: string;
        }>("checkout-status", { sessionId: checkoutSession });
        if (cancelled) return;
        if (captured?.licenseKey) {
          setLicenseKey(captured.licenseKey);
          setProduct(captured.product || "");
          setBusy(false);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        attempt += 1;
        if (attempt < 8) {
          window.setTimeout(() => void poll(), Math.min(1500 * attempt, 6000));
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load your license key.");
        setBusy(false);
        return;
      }
      attempt += 1;
      if (attempt < 8) window.setTimeout(() => void poll(), Math.min(1500 * attempt, 6000));
      else {
        setError("Payment is still confirming. Check your email for the license key.");
        setBusy(false);
      }
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [checkoutSession]);

  async function copyKey() {
    if (!licenseKey) return;
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!checkoutSession && !licenseKey) {
    return (
      <div className="marketing-page">
        <PublicHeader />
        <main className="section cream">
          <div className="wrap legal-page">
            <h1>Thank you</h1>
            <p className="muted">No checkout session was found.</p>
            <Link className="btn btn-primary" to="/#pricing">
              View plans
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="section cream">
        <div className="wrap legal-page" style={{ maxWidth: 560 }}>
          <p className="eyebrow">Purchase complete</p>
          <h1>Your license key</h1>
          {busy ? <p className="muted">Confirming payment…</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {licenseKey ? (
            <>
              <p>
                {product === "pro" ? "Pro" : product === "basic" ? "Basic" : "Your"} license is ready.
              </p>
              <p
                style={{
                  fontFamily: "Consolas, Monaco, monospace",
                  fontSize: 22,
                  letterSpacing: "0.04em",
                  fontWeight: 700,
                }}
              >
                {licenseKey}
              </p>
              <div className="toolbar" style={{ gap: 10, marginTop: 12 }}>
                <button className="btn btn-primary" type="button" onClick={() => void copyKey()}>
                  {copied ? "Copied" : "Copy key"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => navigate("/activate")}>
                  Activate now
                </button>
              </div>
              <p className="muted" style={{ marginTop: 16 }}>
                We&apos;ve also emailed this key to you. Save it — you will need it on each device.
              </p>
            </>
          ) : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
