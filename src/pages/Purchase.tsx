import { Navigate, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { BrandMark } from "../components/Brand";
import { LegalAgreement } from "../components/LegalAgreement";
import { ScopeAcknowledgment } from "../components/ScopeAcknowledgment";
import { StripeCheckout } from "../components/StripeCheckout";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { money } from "../lib/format";
import { PHOTO_LIBRARY } from "../lib/photos";
import {
  BASIC_ADDITIONAL_CENTS,
  BASIC_LICENSE_CENTS,
  PRO_LICENSE_CENTS,
} from "../lib/pricing";
import {
  BASIC_LICENSE_DESCRIPTION,
  ONE_LICENSE_ONE_DEVICE_LINE,
  PRO_LICENSE_DESCRIPTION,
  SCOPE_LINE,
} from "../lib/copy";
import { invokeFunction } from "../lib/supabase";

const PROGRESS = ["Choose Plan", "Purchase", "Activate"] as const;

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
  const [params] = useSearchParams();
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

  const amount = product === "pro" ? PRO_LICENSE_CENTS : BASIC_LICENSE_CENTS;
  const title = product === "pro" ? "Pro" : "Basic";
  const description = product === "pro" ? PRO_LICENSE_DESCRIPTION : BASIC_LICENSE_DESCRIPTION;

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
          <p className="eyebrow">Your license</p>
          <h1>{title}</h1>
          <p className="muted">{SCOPE_LINE}</p>
          <p className="checkout-rate">
            {money(amount)} <small>one time</small>
          </p>
          <p className="muted">{description}</p>
          <p className="muted">{ONE_LICENSE_ONE_DEVICE_LINE}</p>
          <div className="toolbar" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn ${product === "basic" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setProduct("basic")}
            >
              Basic — {money(BASIC_LICENSE_CENTS)}
            </button>
            <button
              type="button"
              className={`btn ${product === "pro" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setProduct("pro")}
            >
              Pro — {money(PRO_LICENSE_CENTS)}
            </button>
          </div>
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
          <p className="muted">
            Need another device later? An additional Basic license is {money(BASIC_ADDITIONAL_CENTS)}.
          </p>
        </section>

        <>
          <LegalAgreement checked={agreed} onChange={setAgreed} />
          <ScopeAcknowledgment checked={scopeAck} onChange={setScopeAck} />
          {error ? <p className="form-error">{error}</p> : null}
          {agreed && scopeAck ? (
            <StripeCheckout key={product} product={product} onError={setError} />
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
  const [licenseKey, setLicenseKey] = useState("");
  const [product, setProduct] = useState<"basic" | "pro" | "">("");
  const [checkoutProduct, setCheckoutProduct] = useState<"basic" | "basic_additional" | "pro" | "upgrade_to_pro" | "">(
    "",
  );
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
          checkoutProduct?: "basic" | "basic_additional" | "pro" | "upgrade_to_pro";
          error?: string;
        }>("checkout-status", { sessionId: checkoutSession });
        if (cancelled) return;
        if (captured?.licenseKey) {
          setLicenseKey(captured.licenseKey);
          setProduct(captured.product || "");
          setCheckoutProduct(captured.checkoutProduct || captured.product || "");
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
          <h1>{checkoutProduct === "basic_additional" ? "Your second license" : "Your license key"}</h1>
          {busy ? <p className="muted">Confirming payment…</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {licenseKey ? (
            <>
              <p>
                {checkoutProduct === "basic_additional"
                  ? "Your second license is ready. Enter this key on the other device at /activate."
                  : product === "pro"
                    ? "Pro license is ready."
                    : product === "basic"
                      ? "Basic license is ready."
                      : "Your license is ready."}
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
                We&apos;ve also emailed this key to you. One license covers one device.
              </p>
            </>
          ) : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
