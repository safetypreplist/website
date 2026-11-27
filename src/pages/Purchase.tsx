import { Navigate, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppSplash } from "../components/AppSplash";
import { BrandMark } from "../components/Brand";
import { Confetti } from "../components/Confetti";
import { LegalAgreement } from "../components/LegalAgreement";
import { ScopeAcknowledgment } from "../components/ScopeAcknowledgment";
import { StripeCheckout } from "../components/StripeCheckout";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { money } from "../lib/format";
import { activate, getLicense, isLicensed, setLocalProduct } from "../lib/licenseClient";
import { rememberCheckoutEmail } from "../lib/localProfile";
import { PHOTO_LIBRARY } from "../lib/photos";
import { BASIC_LICENSE_CENTS, PRO_LICENSE_CENTS } from "../lib/pricing";
import { SCOPE_LINE } from "../lib/copy";
import { invokeFunction } from "../lib/supabase";

const PROGRESS = ["Choose Plan", "Purchase", "Activate"] as const;

const BASIC_FEATURES = [
  "Grab-and-Go Bag",
  "Ready Duffel Bag",
  "Vehicle or Suitcase Prep",
  "Home Resilience",
  "Works offline on one device",
  "Lifetime access — one-time purchase",
] as const;

const PRO_FEATURES = [
  "Everything in Basic",
  "Off-grid, water, power, emergency cooling, and long-term food",
  "Works offline on one device",
  "Lifetime access — one-time purchase",
] as const;

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
                <path
                  d="m6 12.5 4 4 8-9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
  const [params, setParams] = useSearchParams();
  const raw = (params.get("product") || "").toLowerCase();
  const fromVault = params.get("vault") === "1" || params.get("household") === "1" || params.get("plan") === "pro";
  const initial: "basic" | "pro" = raw === "pro" || fromVault ? "pro" : "basic";
  const [product, setProduct] = useState<"basic" | "pro">(initial);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [scopeAck, setScopeAck] = useState(false);

  useEffect(() => {
    setProduct(initial);
  }, [initial]);

  function chooseProduct(next: "basic" | "pro") {
    setProduct(next);
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.delete("plan");
        updated.delete("vault");
        updated.delete("household");
        updated.set("product", next);
        return updated;
      },
      { replace: true },
    );
  }

  const amount = product === "pro" ? PRO_LICENSE_CENTS : BASIC_LICENSE_CENTS;
  const title = product === "pro" ? "Pro" : "Basic";
  const features = product === "pro" ? PRO_FEATURES : BASIC_FEATURES;

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
          <p className="eyebrow">License</p>
          <div className="checkout-plan-toggle" role="group" aria-label="Choose plan">
            <button
              type="button"
              className={product === "basic" ? "is-active" : ""}
              aria-pressed={product === "basic"}
              onClick={() => chooseProduct("basic")}
            >
              Basic
            </button>
            <button
              type="button"
              className={product === "pro" ? "is-active" : ""}
              aria-pressed={product === "pro"}
              onClick={() => chooseProduct("pro")}
            >
              Pro
            </button>
          </div>
          <h1>{title}</h1>
          <p className="checkout-rate">
            {money(amount)} <small>one time</small>
          </p>
          <p className="muted">{SCOPE_LINE}</p>
          <ul className="checkout-feature-list">
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="checkout-step checkout-summary">
          <div className="summary-block">
            <p>
              <span>{title} lifetime license</span>
              <b>{money(amount)}</b>
            </p>
          </div>
          <p className="checkout-due">
            Due today
            <b>{money(amount)}</b>
          </p>
          <p className="muted">One license covers one device. Lifetime access.</p>
        </section>

        <>
          <LegalAgreement checked={agreed} onChange={setAgreed} />
          <ScopeAcknowledgment checked={scopeAck} onChange={setScopeAck} />
          {error ? <p className="form-error">{error}</p> : null}
          {agreed && scopeAck ? (
            <StripeCheckout key={product} product={product} recordTermsAcceptance onError={setError} />
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
          <Link to="/#pricing">Change plan</Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

export function ThankYouPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const checkoutSession = params.get("session_id") || "";
  const kindHint = (params.get("kind") || "").toLowerCase();
  const expectGroup = kindHint === "group" || kindHint === "group_sharing";
  const isRenewal = expectGroup && params.get("renew") === "1";
  const [licenseKey, setLicenseKey] = useState("");
  const [product, setProduct] = useState<"basic" | "pro" | "">("");
  const [checkoutProduct, setCheckoutProduct] = useState<
    "basic" | "basic_additional" | "pro" | "upgrade_to_pro" | "group_sharing" | ""
  >(expectGroup ? "group_sharing" : "");
  const [groupId, setGroupId] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(checkoutSession));
  const [activating, setActivating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [redirectingGroup, setRedirectingGroup] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUpgrade = checkoutProduct === "upgrade_to_pro";
  const upgradedHere = isUpgrade && isLicensed() && getLicense()?.key === licenseKey;

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

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
          checkoutProduct?: "basic" | "basic_additional" | "pro" | "upgrade_to_pro" | "group_sharing";
          groupId?: string;
          email?: string | null;
          error?: string;
        }>("checkout-status", { sessionId: checkoutSession });
        if (cancelled) return;
        if (captured?.email) {
          setBuyerEmail(captured.email);
          rememberCheckoutEmail(captured.email);
        }
        if (captured?.checkoutProduct === "group_sharing" || captured?.groupId) {
          setCheckoutProduct("group_sharing");
          setGroupId(captured.groupId || "");
          setLicenseKey(captured.licenseKey || "");
          setProduct(captured.product || "");
          setBusy(false);
          setRedirectingGroup(true);
          const setupPath = isRenewal
            ? "/app/group-sharing?renewed=1"
            : `/app/group-sharing?setup=1${
                captured.groupId ? `&group=${encodeURIComponent(captured.groupId)}` : ""
              }`;
          window.setTimeout(() => {
            if (!cancelled) navigate(setupPath, { replace: true });
          }, 900);
          return;
        }
        if (captured?.licenseKey) {
          setLicenseKey(captured.licenseKey);
          setProduct(captured.product || "");
          setCheckoutProduct(captured.checkoutProduct || captured.product || "");
          // Upgrade checkout keeps the same key/device — update local product so Pro lists unlock.
          if (
            isLicensed() &&
            (captured.product === "pro" || captured.checkoutProduct === "upgrade_to_pro")
          ) {
            setLocalProduct("pro");
          }
          setBusy(false);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        attempt += 1;
        if (attempt < 10) {
          window.setTimeout(() => void poll(), Math.min(1500 * attempt, 6000));
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : expectGroup
              ? "Could not confirm Group Sharing yet."
              : "Could not load your license key.",
        );
        setBusy(false);
        return;
      }
      attempt += 1;
      if (attempt < 10) window.setTimeout(() => void poll(), Math.min(1500 * attempt, 6000));
      else {
        setError(
          expectGroup
            ? "Payment is still confirming. Open Group Sharing in a minute to finish setup."
            : "Payment is still confirming. Check your email for the license key.",
        );
        setBusy(false);
      }
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [checkoutSession, expectGroup, isRenewal, navigate]);

  async function activateNow() {
    if (!licenseKey) return;
    if (checkoutProduct === "basic_additional" && isLicensed()) {
      setError(
        "This additional license is for another device. Open Activate on that device — the key below is ready to use.",
      );
      return;
    }
    setActivating(true);
    setError("");
    try {
      await activate(licenseKey);
      navigate("/app", { replace: true });
    } catch (err) {
      setActivating(false);
      const message = err instanceof Error ? err.message : "Could not activate on this device.";
      setError(
        message.toLowerCase().includes("already active on another device")
          ? "This license is already active on another device. Use Deactivate & transfer with your license key, then activate here."
          : message,
      );
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

  if (busy || redirectingGroup) {
    return (
      <div className="marketing-page thank-you-loading">
        <AppSplash />
        <p className="thank-you-loading-copy muted" role="status">
          {expectGroup || checkoutProduct === "group_sharing"
            ? isRenewal
              ? redirectingGroup
                ? "Renewal confirmed — opening Group Sharing…"
                : "Confirming your Group Sharing renewal…"
              : redirectingGroup
                ? "Group Sharing is ready — opening setup…"
                : "Confirming your Group Sharing purchase…"
            : "Confirming your purchase and preparing your license key…"}
        </p>
      </div>
    );
  }

  return (
    <div className="marketing-page">
      <Confetti fire={Boolean(licenseKey) || checkoutProduct === "group_sharing"} />
      <PublicHeader />
      <main className="section cream">
        <div className="wrap legal-page" style={{ maxWidth: 560 }}>
          <p className="eyebrow">Purchase complete</p>
          {error ? <p className="form-error">{error}</p> : null}
          {checkoutProduct === "group_sharing" && isRenewal ? (
            <>
              <h1>Group Sharing renewed</h1>
              <p>Your group keeps its members and settings.</p>
              <div className="toolbar" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <Link className="btn btn-primary" to="/app/group-sharing?renewed=1">
                  Open Group Sharing
                </Link>
              </div>
            </>
          ) : checkoutProduct === "group_sharing" ? (
            <>
              <h1>Group Sharing is ready</h1>
              <p>Name your group and invite other licensed devices next.</p>
              <div className="toolbar" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <Link
                  className="btn btn-primary"
                  to={`/app/group-sharing?setup=1${groupId ? `&group=${encodeURIComponent(groupId)}` : ""}`}
                >
                  Open Group Sharing setup
                </Link>
              </div>
            </>
          ) : null}
          {licenseKey && checkoutProduct !== "group_sharing" ? (
            <>
              <h1>{isUpgrade ? "You're upgraded to Pro" : "Your license key"}</h1>
              <p>
                {isUpgrade
                  ? "Your Pro checklists are unlocked. Your license key stays the same."
                  : checkoutProduct === "basic_additional"
                    ? "Your additional device license is ready."
                    : product === "pro"
                      ? "Pro license is ready."
                      : product === "basic"
                        ? "Basic license is ready."
                        : "Your license is ready."}
              </p>
              <div className="thank-you-key">
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
                <button className="btn btn-ghost" type="button" onClick={() => void copyKey()}>
                  {copied ? "Copied" : "Copy key"}
                </button>
              </div>
              <div className="toolbar" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                {upgradedHere ? (
                  <Link className="btn btn-primary" to="/app">
                    Return to my checklist
                  </Link>
                ) : checkoutProduct === "basic_additional" && isLicensed() ? (
                  <Link className="btn btn-primary" to={`/activate?key=${encodeURIComponent(licenseKey)}`}>
                    Open Activate with this key
                  </Link>
                ) : (
                  <button className="btn btn-primary" type="button" disabled={activating} onClick={() => void activateNow()}>
                    {activating ? "Activating…" : "Activate now"}
                  </button>
                )}
              </div>
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-ghost" type="button" onClick={() => setShowDetails((v) => !v)}>
                  {showDetails ? "Hide details" : "Details"}
                </button>
                {showDetails ? (
                  <p className="muted" style={{ marginTop: 10 }}>
                    {isUpgrade
                      ? buyerEmail
                        ? `A confirmation is on its way to ${buyerEmail}. `
                        : ""
                      : buyerEmail
                        ? `We've also emailed this key to ${buyerEmail}. `
                        : "Save this key somewhere safe. "}
                    One license covers one device. You can open{" "}
                    <Link to={`/activate?key=${encodeURIComponent(licenseKey)}`}>Activate</Link> on another browser with
                    the key already filled in.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
          {!licenseKey && checkoutProduct !== "group_sharing" && error ? (
            <div className="toolbar" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              {expectGroup ? (
                <Link className="btn btn-primary" to="/app/group-sharing">
                  Open Group Sharing
                </Link>
              ) : (
                <Link className="btn btn-primary" to="/activate">
                  Go to Activate
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
