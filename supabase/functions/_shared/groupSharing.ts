import { escapeHtml, sendEmail } from "./email.ts";
import { json } from "./http.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose, type LicenseRow } from "./licenses.ts";
import { clientIp, rateLimitBlock } from "./rateLimit.ts";
import {
  GROUP_SHARING_PRICES,
  groupSharingLookup,
  integrationIdentifier,
  stripeErrorMessage,
  stripePriceId,
  stripeRequest,
  type GroupSharingLookup,
} from "./stripe.ts";
import { serviceClient } from "./supabase.ts";

type Admin = ReturnType<typeof serviceClient>;

export type GroupStatus = "pending_setup" | "active" | "ended" | "expired";
export type InviteStatus = "pending" | "accepted" | "declined" | "expired" | "revoked";
export type GroupPermission = "view" | "edit";

export type SharingGroupRow = {
  id: string;
  name: string | null;
  host_license_id: string;
  max_devices: number;
  duration_days: number;
  expires_at: string | null;
  status: GroupStatus;
  stripe_session_id: string | null;
  created_at: string;
  ended_at: string | null;
};

export type SharingMemberRow = {
  id: string;
  group_id: string;
  license_id: string | null;
  role: "host" | "member";
  permission: GroupPermission;
  permission_accepted: boolean;
  invite_status: InviteStatus;
  invited_email: string | null;
  invited_license_key: string | null;
  invite_token_hash: string | null;
  display_name: string | null;
  invite_sent_at: string | null;
  responded_at: string | null;
  created_at: string;
};

function configuredBase() {
  return (Deno.env.get("APP_URL")?.trim() || "https://safetypreplist.com").replace(/\/+$/, "");
}

export function newInviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function parseGroupLookup(rawProduct: string, devices: number, durationDays: number): GroupSharingLookup | null {
  if (rawProduct in GROUP_SHARING_PRICES) return rawProduct as GroupSharingLookup;
  const match = rawProduct.match(/^spl_group_([2-4])_(7|14|30)d$/);
  if (match) return groupSharingLookup(Number(match[1]), Number(match[2]));
  return groupSharingLookup(devices, durationDays);
}

async function requireActivatedLicense(admin: Admin, licenseKey: string, deviceId: string) {
  const key = normalizeLicenseKeyLoose(licenseKey);
  if (!key.startsWith("SPL-") || !deviceId) {
    return { error: "An activated license on this device is required.", status: 400 as const };
  }
  const license = await findLicenseByKey(admin, key);
  if (!license || license.status !== "active") {
    return { error: "That license key is not active.", status: 400 as const };
  }
  const activeDevice = await admin
    .from("license_devices")
    .select("device_id")
    .eq("license_id", license.id)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!activeDevice.data) {
    return { error: "Open Group Sharing on the device where this license is activated.", status: 403 as const };
  }
  return { license };
}

export async function createGroupSharingCheckout(opts: {
  req: Request;
  admin: Admin;
  appUrl: string;
  body: Record<string, unknown>;
  groupDevices: number;
  groupDurationDays: number;
  rawProduct: string;
}) {
  const limited = await rateLimitBlock(`group-checkout:${clientIp(opts.req)}`, 8, 600);
  if (limited) return limited;

  const lookup = parseGroupLookup(opts.rawProduct, opts.groupDevices, opts.groupDurationDays);
  if (!lookup) {
    return json({ error: "Choose a Group Sharing size (2–4) and duration (7, 14, or 30 days)." }, 400);
  }
  const plan = GROUP_SHARING_PRICES[lookup];

  const auth = await requireActivatedLicense(
    opts.admin,
    String(opts.body.licenseKey || ""),
    String(opts.body.deviceId || ""),
  );
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const existing = await opts.admin
    .from("sharing_groups")
    .select("id, status, expires_at")
    .eq("host_license_id", auth.license.id)
    .in("status", ["pending_setup", "active"])
    .maybeSingle();
  if (existing.data) {
    return json({ error: "You already have an active or unpaid Group Sharing session. Finish or end it first." }, 409);
  }

  const priceId = await stripePriceId(lookup);
  const successUrl = `${opts.appUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}&kind=group`;
  const renewGroupId = String(opts.body.renewGroupId || "").trim();

  const session = await stripeRequest<{ id: string; url?: string }>("POST", "/checkout/sessions", {
    mode: "payment",
    success_url: successUrl,
    cancel_url: `${opts.appUrl}/app/group-sharing`,
    line_items: [{ price: priceId, quantity: 1 }],
    customer_creation: "if_required",
    metadata: {
      product: "group_sharing",
      group_lookup: lookup,
      group_devices: String(plan.devices),
      group_duration_days: String(plan.durationDays),
      license_key: auth.license.license_key,
      ...(renewGroupId ? { renew_group_id: renewGroupId } : {}),
    },
    payment_intent_data: {
      metadata: {
        product: "group_sharing",
        group_lookup: lookup,
        license_key: auth.license.license_key,
      },
    },
    integration_identifier: integrationIdentifier(),
  });

  if (!session.ok || !session.body.url) {
    return json({ error: stripeErrorMessage(session.body, "Could not start Group Sharing checkout") }, 502);
  }
  return json({ url: session.body.url, sessionId: session.body.id });
}

function sessionPaid(session: { payment_status?: string; status?: string }) {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

function customerEmail(session: {
  customer?: string | { id?: string; email?: string } | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
}) {
  if (typeof session.customer === "object" && session.customer?.email) return session.customer.email;
  return session.customer_details?.email || session.customer_email || null;
}

export type GroupFulfillResult =
  | {
      ok: true;
      alreadyProcessed: boolean;
      groupId: string;
      checkoutProduct: "group_sharing";
      licenseKey: string;
      licenseId: string;
      email: string | null;
    }
  | { ok: false; status: number; error: string };

export async function fulfillGroupSharingSession(
  admin: Admin,
  session: {
    id: string;
    mode?: string;
    payment_status?: string;
    status?: string;
    amount_total?: number | null;
    metadata?: Record<string, string> | null;
    customer?: string | { id?: string; email?: string } | null;
    customer_email?: string | null;
    customer_details?: { email?: string | null } | null;
  },
): Promise<GroupFulfillResult> {
  if (!sessionPaid(session) || session.status === "expired") {
    return { ok: false, status: 402, error: "Stripe has not confirmed this payment yet." };
  }

  const existing = await admin.from("sharing_groups").select("*").eq("stripe_session_id", session.id).maybeSingle();
  if (existing.data) {
    const row = existing.data as SharingGroupRow;
    const host = await admin.from("licenses").select("license_key, email").eq("id", row.host_license_id).maybeSingle();
    return {
      ok: true,
      alreadyProcessed: true,
      groupId: row.id,
      checkoutProduct: "group_sharing",
      licenseKey: (host.data as { license_key?: string } | null)?.license_key || "",
      licenseId: row.host_license_id,
      email: (host.data as { email?: string | null } | null)?.email || customerEmail(session),
    };
  }

  const lookup = String(session.metadata?.group_lookup || "") as GroupSharingLookup;
  const plan = lookup in GROUP_SHARING_PRICES ? GROUP_SHARING_PRICES[lookup] : null;
  const devices = plan?.devices || Number(session.metadata?.group_devices || 0);
  const durationDays = plan?.durationDays || Number(session.metadata?.group_duration_days || 0);
  if (!plan && (!devices || !durationDays)) {
    return { ok: false, status: 400, error: "Group Sharing checkout is missing size or duration." };
  }
  const maxDevices = plan?.devices || devices;
  const days = plan?.durationDays || durationDays;

  const hostKey = normalizeLicenseKeyLoose(String(session.metadata?.license_key || ""));
  const host = await findLicenseByKey(admin, hostKey);
  if (!host || host.status !== "active") {
    return { ok: false, status: 400, error: "Group Sharing requires an active host license." };
  }

  const renewGroupId = String(session.metadata?.renew_group_id || "").trim();
  if (renewGroupId) {
    const renewed = await renewGroup(admin, renewGroupId, host, days, maxDevices, session.id);
    if (!renewed.ok) return renewed;
    return {
      ok: true,
      alreadyProcessed: false,
      groupId: renewed.groupId,
      checkoutProduct: "group_sharing",
      licenseKey: host.license_key,
      licenseId: host.id,
      email: customerEmail(session) || host.email,
    };
  }

  const insert = await admin
    .from("sharing_groups")
    .insert({
      name: null,
      host_license_id: host.id,
      max_devices: maxDevices,
      duration_days: days,
      expires_at: null,
      status: "pending_setup",
      stripe_session_id: session.id,
    })
    .select("*")
    .single();

  if (insert.error) {
    const raced = await admin.from("sharing_groups").select("*").eq("stripe_session_id", session.id).maybeSingle();
    if (raced.data) {
      const row = raced.data as SharingGroupRow;
      return {
        ok: true,
        alreadyProcessed: true,
        groupId: row.id,
        checkoutProduct: "group_sharing",
        licenseKey: host.license_key,
        licenseId: host.id,
        email: customerEmail(session) || host.email,
      };
    }
    console.error(insert.error);
    return { ok: false, status: 500, error: "Could not create Group Sharing session." };
  }

  const group = insert.data as SharingGroupRow;
  const hostMember = await admin.from("sharing_group_members").insert({
    group_id: group.id,
    license_id: host.id,
    role: "host",
    permission: "edit",
    permission_accepted: true,
    invite_status: "accepted",
    invited_email: host.email,
    display_name: null,
    responded_at: new Date().toISOString(),
  });
  if (hostMember.error) {
    console.error(hostMember.error);
    return { ok: false, status: 500, error: "Could not attach host to Group Sharing." };
  }

  await admin.from("license_payments").upsert(
    {
      license_id: host.id,
      stripe_session_id: session.id,
      checkout_product: "group_sharing",
      description: `Group Sharing · ${maxDevices} devices · ${days} days`,
      amount_cents: typeof session.amount_total === "number" ? session.amount_total : plan?.unit_amount || 0,
      currency: "usd",
      paid_at: new Date().toISOString(),
    },
    { onConflict: "license_id,stripe_session_id" },
  );

  return {
    ok: true,
    alreadyProcessed: false,
    groupId: group.id,
    checkoutProduct: "group_sharing",
    licenseKey: host.license_key,
    licenseId: host.id,
    email: customerEmail(session) || host.email,
  };
}

async function renewGroup(
  admin: Admin,
  groupId: string,
  host: LicenseRow,
  durationDays: number,
  maxDevices: number,
  sessionId: string,
): Promise<{ ok: true; groupId: string } | { ok: false; status: number; error: string }> {
  const { data: group } = await admin.from("sharing_groups").select("*").eq("id", groupId).maybeSingle();
  if (!group) return { ok: false, status: 404, error: "Group not found for renewal." };
  const row = group as SharingGroupRow;
  if (row.host_license_id !== host.id) {
    return { ok: false, status: 403, error: "Only the host can renew Group Sharing." };
  }
  const base = row.expires_at && Date.parse(row.expires_at) > Date.now() ? new Date(row.expires_at) : new Date();
  base.setUTCDate(base.getUTCDate() + durationDays);
  const updated = await admin
    .from("sharing_groups")
    .update({
      status: "active",
      expires_at: base.toISOString(),
      duration_days: durationDays,
      max_devices: maxDevices,
      stripe_session_id: sessionId,
      ended_at: null,
    })
    .eq("id", groupId)
    .select("id")
    .maybeSingle();
  if (!updated.data) return { ok: false, status: 500, error: "Could not renew Group Sharing." };
  await admin.from("license_payments").upsert(
    {
      license_id: host.id,
      stripe_session_id: sessionId,
      checkout_product: "group_sharing",
      description: `Group Sharing renewal · ${maxDevices} devices · ${durationDays} days`,
      amount_cents: 0,
      currency: "usd",
      paid_at: new Date().toISOString(),
    },
    { onConflict: "license_id,stripe_session_id" },
  );
  return { ok: true, groupId };
}

export async function expireDueGroups(admin: Admin) {
  const now = new Date().toISOString();
  const { data: due } = await admin
    .from("sharing_groups")
    .select("id")
    .eq("status", "active")
    .lt("expires_at", now);
  for (const row of due || []) {
    await endGroup(admin, (row as { id: string }).id, "expired");
  }
}

export async function endGroup(admin: Admin, groupId: string, status: "ended" | "expired" = "ended") {
  await admin
    .from("sharing_groups")
    .update({ status, ended_at: new Date().toISOString() })
    .eq("id", groupId)
    .in("status", ["pending_setup", "active"]);
  await admin.from("sharing_group_items").delete().eq("group_id", groupId);
  await admin.from("sharing_group_custom_items").delete().eq("group_id", groupId);
  await admin
    .from("sharing_group_members")
    .update({ invite_status: "expired" })
    .eq("group_id", groupId)
    .eq("invite_status", "pending");
}

export async function sendGroupInviteEmail(opts: {
  to: string;
  hostName: string;
  groupName: string;
  permission: GroupPermission;
  token: string;
  appUrl?: string;
}) {
  const base = (opts.appUrl || configuredBase()).replace(/\/+$/, "");
  const link = `${base}/group-invite/${encodeURIComponent(opts.token)}`;
  const host = escapeHtml(opts.hostName || "A Safety Prep List customer");
  const group = escapeHtml(opts.groupName || "Group Sharing");
  const permission = opts.permission === "edit" ? "Edit" : "View only";
  const safeLink = escapeHtml(link);
  const html = `
  <div style="background:#F4F0E5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1E2A1F;">
    <div style="max-width:560px;margin:0 auto;background:#FBF8F1;border:1px solid #E6E2D6;border-radius:14px;padding:32px;">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#556B2F;font-weight:bold;">Safety Prep List</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;">Accept Group Invitation</h1>
      <p style="font-size:16px;line-height:1.5;">${host} invited you to <strong>${group}</strong> with <strong>${permission}</strong> permission.</p>
      <p style="font-size:16px;line-height:1.5;">You need your own activated Safety Prep List license. Open this link on the device where your license is activated — the invitation is not granted until you accept there.</p>
      <p style="margin:28px 0;text-align:center;">
        <a href="${safeLink}" style="display:inline-block;background:#C75A2B;color:#FBF8F1;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px;">Review invitation</a>
      </p>
      <p style="font-size:13px;line-height:1.5;color:#4D5348;">If the button doesn’t work, copy this address into your browser:<br><span style="word-break:break-all;color:#556B2F;">${safeLink}</span></p>
    </div>
  </div>`;
  const text = `${opts.hostName} invited you to ${opts.groupName || "Group Sharing"} (${permission}).\n\nOpen this link on the device where your license is activated:\n${link}\n\nAccepting is not automatic — you must confirm on that device.`;
  return sendEmail({
    to: opts.to,
    subject: "Accept Group Invitation — Safety Prep List",
    html,
    text,
  });
}

export async function loadGroupBundle(admin: Admin, groupId: string) {
  await expireDueGroups(admin);
  const { data: group } = await admin.from("sharing_groups").select("*").eq("id", groupId).maybeSingle();
  if (!group) return null;
  const row = group as SharingGroupRow;
  if (row.status === "active" && row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
    await endGroup(admin, row.id, "expired");
    row.status = "expired";
  }
  const { data: members } = await admin
    .from("sharing_group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });
  const licenseIds = (members || [])
    .map((m) => (m as SharingMemberRow).license_id)
    .filter((id): id is string => Boolean(id));
  let licenses: Record<string, { license_key: string; email: string | null; product: string }> = {};
  if (licenseIds.length) {
    const { data: rows } = await admin.from("licenses").select("id, license_key, email, product").in("id", licenseIds);
    for (const lic of rows || []) {
      const l = lic as { id: string; license_key: string; email: string | null; product: string };
      licenses[l.id] = { license_key: l.license_key, email: l.email, product: l.product };
    }
  }
  return { group: row, members: (members || []) as SharingMemberRow[], licenses };
}
