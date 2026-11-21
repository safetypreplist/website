import { fulfillGroupSharingSession } from "./groupSharing.ts";
import {
  findLicenseByKey,
  normalizeLicenseKeyLoose,
  sendLicenseEmail,
  uniqueLicenseKey,
  type LicenseProduct,
  type LicenseRow,
} from "./licenses.ts";
import { recordLicensePayment, type CheckoutProduct } from "./payments.ts";
import { stripeRequest } from "./stripe.ts";
import { serviceClient } from "./supabase.ts";

type Admin = ReturnType<typeof serviceClient>;

export type LicenseFulfillResult =
  | {
      ok: true;
      alreadyProcessed: boolean;
      licenseKey: string;
      product: LicenseProduct;
      checkoutProduct: "basic" | "basic_additional" | "pro" | "upgrade_to_pro" | "group_sharing";
      licenseId: string;
      email: string | null;
      groupId?: string;
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

function processedRow(row: LicenseRow, checkoutProduct: CheckoutProduct): LicenseFulfillResult {
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

async function ensurePayment(
  admin: Admin,
  licenseId: string,
  session: StripeSession,
  checkoutProduct: CheckoutProduct,
) {
  const amountCents = typeof session.amount_total === "number" ? session.amount_total : 0;
  await recordLicensePayment(admin, {
    licenseId,
    stripeSessionId: session.id,
    checkoutProduct,
    amountCents,
  });
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
  if (productMeta === "group_sharing" || String(session.metadata?.group_lookup || "").startsWith("spl_group_")) {
    const groupResult = await fulfillGroupSharingSession(admin, session);
    if (!groupResult.ok) return groupResult;
    const host = await findLicenseByKey(admin, groupResult.licenseKey);
    return {
      ok: true,
      alreadyProcessed: groupResult.alreadyProcessed,
      licenseKey: groupResult.licenseKey,
      product: (host?.product || "basic") as LicenseProduct,
      checkoutProduct: "group_sharing",
      licenseId: groupResult.licenseId,
      email: groupResult.email,
      groupId: groupResult.groupId,
    };
  }

  const existing = await admin.from("licenses").select("*").eq("stripe_session_id", session.id).maybeSingle();
  if (existing.data) {
    const row = existing.data as LicenseRow;
    const checkoutProduct: CheckoutProduct =
      productMeta === "upgrade_to_pro"
        ? "upgrade_to_pro"
        : productMeta === "basic_additional" || row.linked_to
          ? "basic_additional"
          : row.product === "pro"
            ? "pro"
            : "basic";
    await ensurePayment(admin, row.id, session, checkoutProduct);
    return processedRow(row, checkoutProduct);
  }

  // Upgrade sessions overwrite licenses.stripe_session_id — still find by payment row.
  const priorPayment = await admin
    .from("license_payments")
    .select("license_id, checkout_product")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (priorPayment.data?.license_id) {
    const { data: paidLicense } = await admin
      .from("licenses")
      .select("*")
      .eq("id", priorPayment.data.license_id)
      .maybeSingle();
    if (paidLicense) {
      const checkoutProduct = (priorPayment.data.checkout_product || productMeta || "basic") as CheckoutProduct;
      return processedRow(paidLicense as LicenseRow, checkoutProduct);
    }
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
    await ensurePayment(admin, row.id, session, "upgrade_to_pro");
    // Preserve a first-purchase history line. Prefer original amount_cents; if an older
    // upgrade overwrote it with the $12 upgrade price, fall back to Basic list price.
    const initialCents =
      license.amount_cents != null && license.amount_cents !== 1200
        ? license.amount_cents
        : 1299;
    await recordLicensePayment(admin, {
      licenseId: row.id,
      stripeSessionId: `legacy:${row.id}:initial`,
      checkoutProduct: "basic",
      amountCents: initialCents,
      paidAt: license.created_at,
    });
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
  const checkoutProduct: CheckoutProduct = isAdditional ? "basic_additional" : product;
  await ensurePayment(admin, row.id, session, checkoutProduct);

  // Also attach additional-device purchases to the parent license history when the parent key is known.
  if (isAdditional) {
    const parentKey = session.metadata?.license_key || "";
    if (parentKey) {
      const parent = await findLicenseByKey(admin, parentKey);
      if (parent) {
        await ensurePayment(admin, parent.id, session, "basic_additional");
      }
    }
  }

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
    checkoutProduct,
    licenseId: row.id,
    email: row.email,
  };
}

export { normalizeLicenseKeyLoose };
