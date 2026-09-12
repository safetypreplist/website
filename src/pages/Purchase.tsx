import { Navigate, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "../components/Brand";
import { PayPalCheckout } from "../components/PayPalCheckout";
import { PublicHeader } from "../components/PublicChrome";
import { SurvivalVaultModal } from "../components/SurvivalVaultModal";
import { useApp } from "../context/AppContext";
import { money } from "../lib/format";
import { FAMILY_MIN_SEATS } from "../lib/identity";
import { isPaypalConfigured } from "../lib/paypal";
import { PHOTO_LIBRARY } from "../lib/photos";
import {
  ANNUAL_MONTHLY_EQUIVALENT_CENTS,
  LAUNCH_PROBE_CENTS,
  LAUNCH_PROBE_TOKEN,
  MONTHLY_CENTS,
  SURVIVAL_VAULT_CENTS,
  SURVIVAL_VAULT_DESCRIPTION,
  checkoutBreakdown,
  type AccessInterval,
} from "../lib/pricing";
import { invokeFunction } from "../lib/supabase";

const PROGRESS = ["Choose Plan", "Purchase", "Create Account", "Get Ready"] as const;

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
        >
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function PricingPage() {
  return <Navigate to="/#pricing" replace />;
}

export function CheckoutPage() {
  const { products } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isProbe = params.get("probe") === LAUNCH_PROBE_TOKEN;
  const planKind = isProbe ? "individual" : params.get("plan") === "family" ? "family" : "individual";
  const people = isProbe ? 1 : planKind === "family"
    ? Math.max(FAMILY_MIN_SEATS, Number(params.get("qty") || FAMILY_MIN_SEATS) || FAMILY_MIN_SEATS)
    : 1;
  const access: AccessInterval = isProbe ? "monthly" : params.get("access") === "annual" ? "annual" : "monthly";
  const [vault, setVault] = useState(isProbe ? false : params.get("vault") === "1" || params.get("household") === "1");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState("");
  const upgrade = products.find((p) => p.slug === "upgrade_full");
  const vaultCents = upgrade?.amount_cents ?? SURVIVAL_VAULT_CENTS;
  const breakdown = isProbe
    ? {
        seats: 1,
        subscriptionCents: LAUNCH_PROBE_CENTS,
        vaultCents: 0,
        dueTodayCents: LAUNCH_PROBE_CENTS,
        recurringCents: MONTHLY_CENTS,
        interval: "monthly" as const,
        unitCents: LAUNCH_PROBE_CENTS,
        monthlyEquivalentCents: LAUNCH_PROBE_CENTS,
      }
    : checkoutBreakdown(people, access, vault);
  const title = isProbe ? "Live checkout test" : planKind === "family" ? "Family Plan" : "Individual Plan";
  const unit = access === "annual" ? ANNUAL_MONTHLY_EQUIVALENT_CENTS : MONTHLY_CENTS;
  const paypalReady = isPaypalConfigured();

  useEffect(() => {
    sessionStorage.setItem("spl.plan", planKind);
    sessionStorage.setItem("spl.familyQty", String(people));
    sessionStorage.setItem("spl.vault", vault ? "1" : "0");
    sessionStorage.setItem("spl.household", vault ? "1" : "0");
    sessionStorage.setItem("spl.access", access);
    sessionStorage.setItem("spl.probe", isProbe ? LAUNCH_PROBE_TOKEN : "");
  }, [planKind, people, vault, access, isProbe]);

  const onCaptured = useMemo(
    () => (result: { productCode: string; productType: string }) => {
      sessionStorage.setItem("spl.productCode", result.productCode);
      sessionStorage.setItem("spl.productType", result.productType);
      sessionStorage.setItem("spl.familyQty", String(people));
      sessionStorage.setItem("spl.vault", vault ? "1" : "0");
      sessionStorage.setItem("spl.household", vault ? "1" : "0");
      sessionStorage.setItem("spl.access", access);
      sessionStorage.setItem("spl.probe", isProbe ? LAUNCH_PROBE_TOKEN : "");
      navigate(`/thank-you?code=${encodeURIComponent(result.productCode)}&plan=${planKind}&qty=${people}&vault=${vault ? "1" : "0"}&access=${access}${isProbe ? `&probe=${LAUNCH_PROBE_TOKEN}` : ""}`);
    },
    [navigate, people, vault, planKind, access, isProbe],
  );

  return (
    <div className="checkout-stage">
      <div
        className="checkout-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <div className="checkout-panel">
        <CheckoutProgress current={1} />
        <BrandMark />

        <section className="checkout-step">
          <p className="eyebrow">Your Plan</p>
          <h1>{title}</h1>
          <p className="muted">
            {isProbe ? "One-time $0.50 charge to confirm live PayPal." : people === 1 ? "1 Personal Checklist" : `${people} Personal Checklists`}
          </p>
          {isProbe ? (
            <p className="checkout-rate">{money(LAUNCH_PROBE_CENTS)}</p>
          ) : access === "annual" ? (
            <>
              <p className="plan-line">{money(unit)}/person/month</p>
              <p className="checkout-rate">{money(breakdown.subscriptionCents)}/year</p>
            </>
          ) : (
            <>
              {people > 1 ? <p className="plan-line">{money(unit)} × {people}</p> : null}
              <p className="checkout-rate">{money(breakdown.subscriptionCents)}/month</p>
            </>
          )}
        </section>

        {!isProbe ? (
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
        ) : null}

        <section className="checkout-step checkout-summary">
          {vault ? (
            <div className="summary-block">
              <p>
                <span>Survival Vault</span>
                <b>{money(vaultCents)} one time</b>
              </p>
            </div>
          ) : null}
          <p className="checkout-due">
            Due today
            <b>{money(breakdown.dueTodayCents)}</b>
          </p>
          <p className="muted">
            {isProbe
              ? "This is a live $0.50 PayPal charge. Public pricing stays $11.99/month."
              : access === "annual"
              ? `Renews annually at ${money(breakdown.recurringCents)}.`
              : `Renews monthly at ${money(breakdown.recurringCents)}.`}
            {!isProbe && vault ? " Survival Vault does not renew." : ""}
          </p>
        </section>

        {paypalReady ? (
          <>
            {error && <p className="form-error">{error}</p>}
            <PayPalCheckout
              key={`${planKind}-${people}-${access}-${vault ? "v" : "n"}-${isProbe ? "probe" : "live"}`}
              productSlug="core"
              quantity={people}
              includeHousehold={vault}
              accessInterval={access}
              planKind={planKind}
              probe={isProbe}
              onCaptured={onCaptured}
              onError={setError}
            />
          </>
        ) : (
          <p className="form-error">PayPal is not configured yet.</p>
        )}
        <p className="muted checkout-back">
          <Link to="/#pricing">Change plan</Link>
        </p>
      </div>

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
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const paypalToken = params.get("token") || params.get("orderId") || "";
  const initialCode = params.get("code") || sessionStorage.getItem("spl.productCode") || "";
  const [code, setCode] = useState(initialCode);
  const [captureError, setCaptureError] = useState("");
  const [finishing, setFinishing] = useState(Boolean(paypalToken && !initialCode));
  const capturing = useRef(false);
  const plan = params.get("plan") || sessionStorage.getItem("spl.plan") || "individual";
  const qty = Number(params.get("qty") || sessionStorage.getItem("spl.familyQty") || "1");
  const vault =
    params.get("vault") === "1" ||
    params.get("household") === "1" ||
    sessionStorage.getItem("spl.vault") === "1" ||
    sessionStorage.getItem("spl.household") === "1";
  const access = (params.get("access") || sessionStorage.getItem("spl.access") || "monthly") === "annual" ? "annual" : "monthly";
  const isProbe = params.get("probe") === LAUNCH_PROBE_TOKEN || sessionStorage.getItem("spl.probe") === LAUNCH_PROBE_TOKEN;
  const [copied, setCopied] = useState(false);
  const breakdown = isProbe
    ? { dueTodayCents: LAUNCH_PROBE_CENTS, recurringCents: MONTHLY_CENTS }
    : checkoutBreakdown(plan === "family" ? qty : 1, access, vault);

  useEffect(() => {
    if (code || !paypalToken || capturing.current) return;
    capturing.current = true;
    setFinishing(true);
    void invokeFunction<{ productCode: string }>("capture-paypal-order", {
      orderId: paypalToken,
      productSlug: "core",
      quantity: qty,
      includeHousehold: vault,
      accessInterval: access,
      ...(isProbe ? { probe: LAUNCH_PROBE_TOKEN } : {}),
    })
      .then((captured) => {
        if (!captured?.productCode) throw new Error("No Product ID was returned.");
        sessionStorage.setItem("spl.productCode", captured.productCode);
        setCode(captured.productCode);
        navigate(
          `/thank-you?code=${encodeURIComponent(captured.productCode)}&plan=${plan}&qty=${qty}&vault=${vault ? "1" : "0"}&access=${access}${isProbe ? `&probe=${LAUNCH_PROBE_TOKEN}` : ""}`,
          { replace: true },
        );
      })
      .catch((err) => {
        setCaptureError(err instanceof Error ? err.message : "Could not finish the purchase.");
      })
      .finally(() => setFinishing(false));
  }, [access, code, navigate, paypalToken, plan, qty, vault]);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }

  return (
    <div className="checkout-stage">
      <div
        className="checkout-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <div className="checkout-panel">
        <CheckoutProgress current={2} />
        <BrandMark />
        <h1>Thank you for your purchase.</h1>
        <p className="muted">
          {plan === "family"
            ? `Your Family Plan includes ${qty} personal Safety Prep Checklists.`
            : "Your personal Safety Prep Checklist is ready."}
          {vault ? " Survival Vault is included as a one-time add-on." : ""}{" "}
          {isProbe
            ? "This $0.50 live PayPal test is complete. Create an account to open the checklists."
            : access === "annual"
            ? `Renews annually at ${money(breakdown.recurringCents)}.`
            : `Renews monthly at ${money(breakdown.recurringCents)}.`}
        </p>
        <p className="muted">PayPal will email your receipt to the address on the PayPal account you paid with.</p>
        {captureError ? <p className="form-error">{captureError}</p> : null}
        {code ? (
          <Link className="btn btn-primary btn-block" style={{ marginTop: 18 }} to={`/create-account?code=${encodeURIComponent(code)}`}>
            Create My Account
          </Link>
        ) : (
          <p className="muted" style={{ marginTop: 18 }}>
            {finishing ? "Finishing your purchase…" : "Hang tight while we confirm your purchase."}
          </p>
        )}
        {code ? (
          <p className="purchase-ref">
            <span>Purchase reference</span>
            <code>{code}</code>
            <button
              className="purchase-ref-copy"
              type="button"
              onClick={() => void copy()}
              aria-label={copied ? "Copied purchase reference" : "Copy purchase reference"}
              title={copied ? "Copied" : "Copy"}
            >
              {copied ? "✓" : <CopyIcon />}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
