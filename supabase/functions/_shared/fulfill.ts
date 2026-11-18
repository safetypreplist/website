import {
  findLicenseByKey,
  normalizeLicenseKeyLoose,
  sendLicenseEmail,
  uniqueLicenseKey,
  type LicenseProduct,
  type LicenseRow,
} from "./licenses.ts";
import { stripeRequest } from "./stripe.ts";
import { serviceClient } from "./supabase.ts";

type Admin = ReturnType<typeof serviceClient>;

export type LicenseFulfillResult =
  | {
      ok: true;
      alreadyProcessed: boolean;
      licenseKey: string;
      product: LicenseProduct;
      checkoutProduct: "basic" | "basic_additional" | "pro" | "upgrade_to_pro";
      licenseId: string;
      email: string | null;
    }
  | { ok: false; status: number; error: string };

type StripeSession = {
  id: string;
  mode?: string;
  payment_status?: string;
  status?: string;
  customer?: string | { id?: string; email?: string } | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  payment_intent?: string | { id?: string } | null;
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
};

function sessionPaid(session: StripeSession) {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

function customerEmail(session: StripeSession) {
  if (typeof session.customer === "object" && session.customer?.email) return session.customer.email;
  return session.customer_details?.email || session.customer_email || null;
}

function processedRow(row: LicenseRow, checkoutProduct: "basic" | "basic_additional" | "pro" | "upgrade_to_pro"): LicenseFulfillResult {
  return {
    ok: true,
    alreadyProcessed: true,
    licenseKey: row.license_key,
    product: row.product,
    checkoutProduct,
    licenseId: row.id,
    email: row.email,
  };
}

export async function retrieveCheckoutSession(sessionId: string) {
  const res = await stripeRequest<StripeSession>("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    expand: ["customer", "payment_intent"],
  });
  if (!res.ok) return null;
  return res.body;
}

/**
 * Idempotent on stripe_session_id.
 * basic / basic_additional / pro → insert license + email key.
 * upgrade_to_pro → flip existing Basic license to Pro (same key).
 */
export async function fulfillCheckoutSession(admin: Admin, session: StripeSession): Promise<LicenseFulfillResult> {
  if (!sessionPaid(session) || session.status === "expired") {
    return { ok: false, status: 402, error: "Stripe has not confirmed this payment yet. Refresh this page in a minute." };
  }
  if (session.mode && session.mode !== "payment") {
    return { ok: false, status: 400, error: "Unexpected checkout mode." };
  }

  const productMeta = String(session.metadata?.product || "");
  const existing = await admin.from("licenses").select("*").eq("stripe_session_id", session.id).maybeSingle();
  if (existing.data) {
    const row = existing.data as LicenseRow;
    if (productMeta === "upgrade_to_pro") return processedRow(row, "upgrade_to_pro");
    if (productMeta === "basic_additional" || row.linked_to) return processedRow(row, "basic_additional");
    if (row.product === "pro") return processedRow(row, "pro");
    return processedRow(row, "basic");
  }

  const email = customerEmail(session);

  if (productMeta === "upgrade_to_pro") {
    const rawKey = session.metadata?.license_key || "";
    const license = await findLicenseByKey(admin, rawKey);
    if (!license || license.status !== "active" || license.product !== "basic") {
      return { ok: false, status: 400, error: "Upgrade requires an active Basic license." };
    }
    // Keep original amount_cents and created_at; only flip product + latest session id.
    const updated = await admin
      .from("licenses")
      .update({
        product: "pro",
        stripe_session_id: session.id,
        email: email || license.email,
      })
      .eq("id", license.id)
      .eq("product", "basic")
      .select("*")
      .maybeSingle();
    if (!updated.data) {
      const raced = await admin.from("licenses").select("*").eq("stripe_session_id", session.id).maybeSingle();
      if (raced.data) return processedRow(raced.data as LicenseRow, "upgrade_to_pro");
      return { ok: false, status: 500, error: "Could not upgrade license." };
    }
    const row = updated.data as LicenseRow;
    if (row.email) {
      await sendLicenseEmail({ to: row.email, licenseKey: row.license_key, product: "pro", upgraded: true });
    }
    return {
      ok: true,
      alreadyProcessed: false,
      licenseKey: row.license_key,
      product: "pro",
      checkoutProduct: "upgrade_to_pro",
      licenseId: row.id,
      email: row.email,
    };
  }

  const isAdditional = productMeta === "basic_additional";
  if (productMeta !== "basic" && productMeta !== "pro" && !isAdditional) {
    return { ok: false, status: 400, error: "Unknown product on checkout session." };
  }

  const product: LicenseProduct = productMeta === "pro" ? "pro" : "basic";
  const licenseKey = await uniqueLicenseKey(admin);
  const amountCents = typeof session.amount_total === "number" ? session.amount_total : null;
  const linkedTo = isAdditional && email ? email.trim().toLowerCase() : null;

  // Persist linked_to on the Stripe session metadata for support/audit when possible.
  if (isAdditional && linkedTo) {
    try {
      await stripeRequest("POST", `/checkout/sessions/${encodeURIComponent(session.id)}`, {
        metadata: {
          product: "basic_additional",
          linked_to: linkedTo,
        },
      });
    } catch (err) {
      console.warn("Could not write linked_to onto checkout session", err);
    }
  }

  const insert = await admin
    .from("licenses")
    .insert({
      license_key: licenseKey,
      product,
      devices_allowed: 1,
      status: "active",
      email,
      stripe_session_id: session.id,
      amount_cents: amountCents,
      linked_to: linkedTo,
    })
    .select("*")
    .single();

  if (insert.error) {
    const raced = await admin.from("licenses").select("*").eq("stripe_session_id", session.id).maybeSingle();
    if (raced.data) {
      return processedRow(raced.data as LicenseRow, isAdditional ? "basic_additional" : product);
    }
    console.error(insert.error);
    return { ok: false, status: 500, error: "Could not create license." };
  }

  const row = insert.data as LicenseRow;
  if (email) {
    await sendLicenseEmail({
      to: email,
      licenseKey: row.license_key,
      product: row.product,
      additional: isAdditional,
    });
  }

  return {
    ok: true,
    alreadyProcessed: false,
    licenseKey: row.license_key,
    product: row.product,
    checkoutProduct: isAdditional ? "basic_additional" : product,
    licenseId: row.id,
    email: row.email,
  };
}

export { normalizeLicenseKeyLoose };
