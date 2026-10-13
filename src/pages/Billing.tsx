import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { formatDate, money } from "../lib/format";
import { personName } from "../lib/identity";
import { supabase } from "../lib/supabase";

type PaymentKind = "plan" | "plan_vault" | "vault" | "device" | "items";
type PaymentStatus = "completed" | "failed" | "refunded" | "pending";

type BillingPayment = {
  id: string;
  at: string;
  amount_cents: number;
  status: PaymentStatus;
  failure_reason: string | null;
  reference: string | null;
  kind: PaymentKind;
  purpose: "new" | "add_member" | "renew" | "one_time";
  quantity: number;
  access_interval: "monthly" | "annual" | null;
  product_code: string | null;
};

type BillingSubscription = {
  id: string;
  purpose: "new" | "add_member" | "renew";
  status: "active" | "suspended" | "cancelled";
  quantity: number;
  access_interval: "monthly" | "annual";
  regular_cents: number;
  discount_cents: number;
  discount_payments: number | null;
  paid_cycles: number;
  paid_through: string | null;
  access_ends_at: string | null;
};

type Billing = {
  payments: BillingPayment[];
  subscriptions: BillingSubscription[];
  payer_email: string | null;
};

const EMPTY: Billing = { payments: [], subscriptions: [], payer_email: null };

const PAYPAL_AUTOPAY_URL =
  import.meta.env.VITE_PAYPAL_ENV === "sandbox"
    ? "https://www.sandbox.paypal.com/myaccount/autopay/"
    : "https://www.paypal.com/myaccount/autopay/";

function useBilling() {
  const { demoMode, user } = useApp();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demoMode || !user) {
      setBilling(EMPTY);
      return;
    }
    let active = true;
    void supabase.rpc("my_billing").then(({ data, error: rpcError }) => {
      if (!active) return;
      if (rpcError) {
        setError("We couldn't load your billing history. Refresh the page to try again.");
        setBilling(EMPTY);
        return;
      }
      const row = (data || {}) as Partial<Billing>;
      setBilling({
        payments: row.payments || [],
        subscriptions: row.subscriptions || [],
        payer_email: row.payer_email || null,
      });
    });
    return () => {
      active = false;
    };
  }, [demoMode, user]);

  return { billing, error };
}

function intervalLabel(interval: string | null) {
  if (interval === "annual") return "Annual";
  if (interval === "monthly") return "Monthly";
  return "";
}

function planLabel(purpose: string, quantity: number) {
  if (purpose === "add_member") {
    return quantity === 1 ? "Added family member" : `Added ${quantity} family members`;
  }
  return quantity > 1 ? `Family Plan, ${quantity} checklists` : "Individual Plan";
}

export function paymentDescription(payment: BillingPayment) {
  if (payment.kind === "vault") return "Survival Vault, one time";
  if (payment.kind === "device") return "Extra device";
  if (payment.kind === "items") return "Extra custom items";
  const interval = intervalLabel(payment.access_interval);
  const base = [planLabel(payment.purpose, payment.quantity), interval].filter(Boolean).join(", ");
  return payment.kind === "plan_vault" ? `${base} + Survival Vault` : base;
}

function statusLabel(status: PaymentStatus) {
  switch (status) {
    case "completed":
      return "Paid";
    case "failed":
      return "Declined";
    case "refunded":
      return "Refunded";
    default:
      return "Pending";
  }
}

function failureText(reason: string | null) {
  if (!reason) return "PayPal could not complete this payment.";
  const words = reason.toLowerCase().replace(/_/g, " ");
  return `PayPal reason: ${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}

function nextChargeCents(sub: BillingSubscription) {
  const discounted = sub.discount_cents > 0 && sub.discount_payments != null && sub.paid_cycles < sub.discount_payments;
  return Math.max(0, sub.regular_cents - (discounted ? sub.discount_cents : 0));
}

function SubscriptionRow({ sub }: { sub: BillingSubscription }) {
  const per = sub.access_interval === "annual" ? "year" : "month";
  let detail = "";
  let tone = "is-ok";
  let pill = "Active";
  if (sub.status === "active") {
    detail = sub.paid_through
      ? `Next payment ${money(nextChargeCents(sub))} on ${formatDate(sub.paid_through)}`
      : `${money(sub.regular_cents)}/${per}`;
  } else if (sub.status === "suspended") {
    tone = "is-error";
    pill = "Past due";
    detail = "Your last payment didn't go through. Update your payment method in PayPal to keep access.";
  } else {
    tone = "is-muted";
    pill = "Cancelled";
    detail = sub.access_ends_at ? `Won't renew. Access ends ${formatDate(sub.access_ends_at)}.` : "Won't renew.";
  }
  return (
    <li className="billing-sub">
      <div>
        <b>{[planLabel(sub.purpose, sub.quantity), intervalLabel(sub.access_interval)].join(", ")}</b>
        <span className="muted">{money(sub.regular_cents)}/{per}</span>
        <p className="billing-sub-detail">{detail}</p>
      </div>
      <span className={`billing-status ${tone}`}>{pill}</span>
    </li>
  );
}

export function BillingPage() {
  const { profile } = useApp();
  const { billing, error } = useBilling();
  const subscriptions = billing?.subscriptions || [];
  const payments = billing?.payments || [];
  const recurring = subscriptions.some((sub) => sub.status !== "cancelled");

  return (
    <div className="billing-page">
      <p className="eyebrow">
        <Link to="/app/account">Account</Link>
      </p>
      <h1 className="page-title">Billing &amp; payments</h1>
      <p className="muted">Your subscription, how you pay, and every payment on this account.</p>

      {billing === null ? <p className="muted">Loading billing…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {billing ? (
        <>
          <article className="account-card">
            <h2>Subscription</h2>
            {subscriptions.length ? (
              <ul className="billing-sub-list">
                {subscriptions.map((sub) => (
                  <SubscriptionRow key={sub.id} sub={sub} />
                ))}
              </ul>
            ) : profile?.plan && profile.plan !== "none" ? (
              <p className="muted">
                There are no renewal charges on this account. If someone added you to their Family Plan, they handle
                the billing.
              </p>
            ) : (
              <p className="muted">You don't have a plan yet.</p>
            )}
          </article>

          <article className="account-card">
            <h2>Payment method</h2>
            {recurring ? (
              <>
                <div className="billing-method">
                  <span className="billing-method-badge" aria-hidden="true">
                    PayPal
                  </span>
                  <div>
                    <b>Paid with PayPal</b>
                    {billing.payer_email ? <span className="muted">{billing.payer_email}</span> : null}
                  </div>
                </div>
                <p className="muted">
                  PayPal stores your card or bank account securely. Safety Prep List never sees or stores your card
                  details. To change how you pay, update it in PayPal under Automatic payments.
                </p>
                <a className="btn btn-ghost" href={PAYPAL_AUTOPAY_URL} target="_blank" rel="noopener noreferrer">
                  Change payment method in PayPal
                </a>
              </>
            ) : (
              <p className="muted">No payment method is needed right now because nothing on this account renews.</p>
            )}
          </article>

          <article className="account-card">
            <h2>Billing history</h2>
            {payments.length ? (
              <ul className="billing-history">
                {payments.map((payment) => (
                  <li key={payment.id} className={`billing-row is-${payment.status}`}>
                    <div className="billing-row-main">
                      <span className="billing-row-date">{formatDate(payment.at)}</span>
                      <b>{paymentDescription(payment)}</b>
                      {payment.status === "failed" ? (
                        <span className="billing-row-note">{failureText(payment.failure_reason)}</span>
                      ) : null}
                    </div>
                    <div className="billing-row-end">
                      <span className="billing-row-amount">{money(payment.amount_cents)}</span>
                      <span
                        className={`billing-status ${
                          payment.status === "completed" ? "is-ok" : payment.status === "failed" ? "is-error" : "is-muted"
                        }`}
                      >
                        {statusLabel(payment.status)}
                      </span>
                      {payment.status === "completed" || payment.status === "refunded" ? (
                        <Link className="billing-receipt-link" to={`/app/billing/receipt/${encodeURIComponent(payment.id)}`}>
                          Receipt
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No payments on this account yet.</p>
            )}
          </article>

          <p className="muted billing-help">
            Questions about a charge? <Link to="/contact">Click here to contact us</Link>.
          </p>
        </>
      ) : null}
    </div>
  );
}

export function ReceiptPage() {
  const { id = "" } = useParams();
  const { profile, user } = useApp();
  const { billing, error } = useBilling();
  const payment = billing?.payments.find((row) => row.id === id);
  const receiptNumber = payment?.reference || payment?.product_code || "";

  useEffect(() => {
    if (!payment) return;
    const previous = document.title;
    document.title = `Safety Prep List Receipt ${formatDate(payment.at)}`;
    return () => {
      document.title = previous;
    };
  }, [payment]);

  if (billing === null) return <p className="muted">Loading receipt…</p>;
  if (!payment || payment.status === "failed" || payment.status === "pending") {
    return (
      <div className="billing-page">
        {error ? <p className="form-error">{error}</p> : null}
        <p>We couldn't find that receipt.</p>
        <Link className="btn btn-ghost" to="/app/billing">
          Back to billing
        </Link>
      </div>
    );
  }

  const name = personName(profile);
  const billedTo = name === "My" ? "" : name;

  return (
    <div className="billing-page">
      <div className="receipt-actions">
        <Link className="btn btn-ghost" to="/app/billing">
          Back to billing
        </Link>
        <button className="btn btn-primary" type="button" onClick={() => window.print()}>
          Download or print receipt
        </button>
      </div>
      <p className="muted receipt-tip">To save a PDF, choose "Save as PDF" in the print window.</p>

      <article className="receipt-sheet">
        <header className="receipt-head">
          <img src="/brand/logo.png" alt="" width={52} height={64} />
          <div>
            <b>Safety Prep List</b>
            <span>safetypreplist.com</span>
          </div>
          <h2>{payment.status === "refunded" ? "Receipt (refunded)" : "Receipt"}</h2>
        </header>

        <dl className="receipt-meta">
          <div>
            <dt>Date paid</dt>
            <dd>{formatDate(payment.at)}</dd>
          </div>
          {receiptNumber ? (
            <div>
              <dt>{payment.reference && payment.reference !== payment.product_code ? "PayPal transaction" : "Receipt number"}</dt>
              <dd>{receiptNumber}</dd>
            </div>
          ) : null}
          {payment.product_code && payment.product_code !== receiptNumber ? (
            <div>
              <dt>Confirmation number</dt>
              <dd>{payment.product_code}</dd>
            </div>
          ) : null}
          <div>
            <dt>Billed to</dt>
            <dd>
              {billedTo ? (
                <>
                  {billedTo}
                  <br />
                </>
              ) : null}
              {user?.email || profile?.email}
            </dd>
          </div>
          <div>
            <dt>Paid with</dt>
            <dd>PayPal{billing?.payer_email ? ` (${billing.payer_email})` : ""}</dd>
          </div>
        </dl>

        <table className="receipt-lines">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{paymentDescription(payment)}</td>
              <td>{money(payment.amount_cents)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th>{payment.status === "refunded" ? "Total (refunded)" : "Total paid"}</th>
              <th>{money(payment.amount_cents)} USD</th>
            </tr>
          </tfoot>
        </table>

        <p className="receipt-foot">Thank you for preparing with Safety Prep List.</p>
      </article>
    </div>
  );
}
