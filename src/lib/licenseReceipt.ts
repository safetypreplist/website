import { money } from "./format";
import { buildTextPdf } from "./checklistShare";
import { shareOrDownloadFile } from "./checklistShare";

export type LicensePaymentReceipt = {
  id: string;
  description: string;
  amountCents: number;
  taxCents: number | null;
  currency: string;
  paymentMethodSummary: string | null;
  stripeSessionId: string;
  paymentIntentId: string | null;
  receiptUrl: string | null;
  paidAt: string;
  licenseKey: string;
  product: "basic" | "pro";
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return money(cents);
  }
}

export async function downloadLicenseReceiptPdf(payment: LicensePaymentReceipt) {
  const lines = [
    "Safety Prep List",
    "Official purchase receipt",
    "",
    `Transaction date: ${formatDate(payment.paidAt)}`,
    `Purchase: ${payment.description}`,
    `Amount paid: ${formatMoney(payment.amountCents, payment.currency)}`,
    `Currency: ${payment.currency.toUpperCase()}`,
    payment.taxCents != null && payment.taxCents > 0
      ? `Tax: ${formatMoney(payment.taxCents, payment.currency)}`
      : "Tax: Not separately reported on this checkout",
    payment.paymentMethodSummary
      ? `Payment method: ${payment.paymentMethodSummary}`
      : "Payment method: See Stripe receipt if available",
    `Receipt / session reference: ${payment.stripeSessionId}`,
    payment.paymentIntentId ? `Payment intent: ${payment.paymentIntentId}` : "",
    `License key: ${payment.licenseKey}`,
    `Current plan on this license: ${payment.product === "pro" ? "Pro" : "Basic"}`,
    "",
    "This receipt reflects a verified Safety Prep List purchase processed through Stripe where applicable.",
    "Keep this file for your records.",
  ].filter(Boolean);

  const blob = buildTextPdf("Safety Prep List Receipt", lines);
  const stamp = payment.paidAt.slice(0, 10);
  const file = new File([blob], `safety-prep-list-receipt-${stamp}.pdf`, { type: "application/pdf" });
  const handoff = await shareOrDownloadFile(file, "Safety Prep List receipt", "Your branded purchase receipt.");
  if (handoff === "aborted") {
    throw new Error("Receipt download was cancelled. Try Download Receipt PDF again.");
  }
}
