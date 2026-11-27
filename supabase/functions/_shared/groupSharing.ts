import { escapeHtml, sendEmail } from "./email.ts";
import { canRenewGroup, renewedExpiry, seatSummary } from "./groupRules.ts";
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
  invite_email_status?: "sent" | "failed" | "not_sent" | null;
  invite_email_error?: string | null;
};

function configuredBase() {
  return (Deno.env.get("APP_URL")?.trim() || "https://safetypreplist.com").replace(/\/+$/, "");
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newInviteToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function inviteSecret() {
  const secret = Deno.env.get("GROUP_INVITE_SECRET")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!secret) throw new Error("Group invite secret missing");
  return secret;
}

/**
 * Invite tokens are derived from the invite row and its send time, so the host can copy the same link
 * later without the raw token ever being stored. Resending (new send time) replaces the link.
 */
export async function inviteTokenFor(memberId: string, sentAt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(inviteSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const stamp = String(Date.parse(sentAt));
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`group-invite:${memberId}:${stamp}`));
  return base64Url(new Uint8Array(sig));
}

export function inviteUrlFor(token: string, appUrl?: string) {
  const base = (appUrl || configuredBase()).replace(/\/+$/, "");
  return `${base}/group-invite/${encodeURIComponent(token)}`;
}

/** Only our own site may be used as the link base in invite emails. */
export function safeAppOrigin(raw: unknown) {
  const value = String(raw || "").trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const allowed = new URL(configuredBase());
    const bare = (host: string) => host.replace(/^www\./, "");
    if (url.protocol === "https:" && bare(url.hostname) === bare(allowed.hostname)) return url.origin;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return url.origin;
  } catch {
    /* ignore malformed origins */
  }
  return undefined;
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

  const renewGroupId = String(opts.body.renewGroupId || "").trim();
  const { data: openGroups } = await opts.admin
    .from("sharing_groups")
    .select("id, status")
    .eq("host_license_id", auth.license.id)
    .in("status", ["pending_setup", "active"]);
  const open = (openGroups || []) as Array<{ id: string; status: string }>;

  if (renewGroupId) {
    const { data: target } = await opts.admin.from("sharing_groups").select("*").eq("id", renewGroupId).maybeSingle();
    const group = target as SharingGroupRow | null;
    if (!group || group.host_license_id !== auth.license.id) {
      return json({ error: "Only the host can renew this Group Sharing group." }, 403);
    }
    if (!canRenewGroup(group)) {
      return json({ error: "This group can no longer be renewed. Start a new Group Sharing group instead." }, 400);
    }
    if (open.some((row) => row.id !== group.id)) {
      return json({ error: "You already host another active Group Sharing group." }, 409);
    }
    if (plan.devices !== group.max_devices) {
      return json({ error: `Renewal keeps your group size (${group.max_devices} devices).` }, 400);
    }
  } else {
    if (open.length) {
      const active = open.some((row) => row.status === "active");
      return json({
        error: active
          ? "You already host an active Group Sharing group. Use Renew on the Group Sharing page to add time."
          : "You already have a Group Sharing purchase waiting for setup. Open Group Sharing to name your group.",
      }, 409);
    }
    const membership = await activeMembershipElsewhere(opts.admin, auth.license.id, null);
    if (membership) {
      return json({ error: "You're a member of another active group. Leave it before hosting your own." }, 409);
    }
  }

  const priceId = await stripePriceId(lookup);
  const successUrl = `${opts.appUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}&kind=group${renewGroupId ? "&renew=1" : ""}`;

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

  const renewGroupId = String(session.metadata?.renew_group_id || "").trim();
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

  if (renewGroupId) {
    const renewed = await renewGroup(admin, renewGroupId, host, days, session);
    if (!renewed.ok) return renewed;
    return {
      ok: true,
      alreadyProcessed: renewed.alreadyProcessed,
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

/**
 * Renewal extends the same group (same members, same size). The payment row for the renewal session is
 * claimed first, so a webhook and the thank-you page can never add the time twice.
 */
async function renewGroup(
  admin: Admin,
  groupId: string,
  host: LicenseRow,
  durationDays: number,
  session: { id: string; amount_total?: number | null },
): Promise<{ ok: true; groupId: string; alreadyProcessed: boolean } | { ok: false; status: number; error: string }> {
  const { data: group } = await admin.from("sharing_groups").select("*").eq("id", groupId).maybeSingle();
  if (!group) return { ok: false, status: 404, error: "Group not found for renewal." };
  const row = group as SharingGroupRow;
  if (row.host_license_id !== host.id) {
    return { ok: false, status: 403, error: "Only the host can renew Group Sharing." };
  }

  const claimed = await admin.from("license_payments").select("id").eq("license_id", host.id).eq(
    "stripe_session_id",
    session.id,
  ).maybeSingle();
  if (claimed.data) return { ok: true, groupId, alreadyProcessed: true };
  if (row.status === "pending_setup") {
    return { ok: false, status: 409, error: "Finish Group Sharing setup before renewing." };
  }

  const { data: otherOpen } = await admin
    .from("sharing_groups")
    .select("id")
    .eq("host_license_id", host.id)
    .in("status", ["pending_setup", "active"])
    .neq("id", groupId);
  if ((otherOpen || []).length) {
    return { ok: false, status: 409, error: "Another Group Sharing group is already active for this license." };
  }

  const claim = await admin.from("license_payments").insert({
    license_id: host.id,
    stripe_session_id: session.id,
    checkout_product: "group_sharing",
    description: `Group Sharing renewal · ${row.max_devices} devices · ${durationDays} days`,
    amount_cents: typeof session.amount_total === "number" ? session.amount_total : 0,
    currency: "usd",
    paid_at: new Date().toISOString(),
  });
  if (claim.error) {
    if ((claim.error as { code?: string }).code === "23505") return { ok: true, groupId, alreadyProcessed: true };
    console.error(claim.error);
    return { ok: false, status: 500, error: "Could not record the Group Sharing renewal." };
  }

  const wasExpired = row.status !== "active";
  const updated = await admin
    .from("sharing_groups")
    .update({
      status: "active",
      expires_at: renewedExpiry(row.status === "active" ? row.expires_at : null, durationDays),
      ended_at: null,
    })
    .eq("id", groupId)
    .select("id")
    .maybeSingle();
  if (!updated.data) return { ok: false, status: 500, error: "Could not renew Group Sharing." };

  if (wasExpired) {
    // Members who joined another group while this one was expired stay with that group.
    const { data: members } = await admin
      .from("sharing_group_members")
      .select("id, license_id, role")
      .eq("group_id", groupId)
      .eq("invite_status", "accepted");
    for (const member of (members || []) as Array<{ id: string; license_id: string | null; role: string }>) {
      if (member.role === "host" || !member.license_id) continue;
      if (await activeMembershipElsewhere(admin, member.license_id, groupId)) {
        await admin.from("sharing_group_members").update({ invite_status: "expired" }).eq("id", member.id);
      }
    }
  }
  return { ok: true, groupId, alreadyProcessed: false };
}

/** The open group (hosted or joined) a license already belongs to, other than `exceptGroupId`. */
export async function activeMembershipElsewhere(admin: Admin, licenseId: string, exceptGroupId: string | null) {
  const { data: rows } = await admin
    .from("sharing_group_members")
    .select("group_id")
    .eq("license_id", licenseId)
    .eq("invite_status", "accepted");
  const groupIds = ((rows || []) as Array<{ group_id: string }>)
    .map((row) => row.group_id)
    .filter((id) => id !== exceptGroupId);
  if (!groupIds.length) return null;
  const { data: open } = await admin
    .from("sharing_groups")
    .select("id")
    .in("id", groupIds)
    .in("status", ["pending_setup", "active"])
    .limit(1)
    .maybeSingle();
  return (open as { id: string } | null)?.id || null;
}

export function groupSeats(members: SharingMemberRow[], maxDevices: number) {
  return seatSummary(members, maxDevices);
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
  link: string;
}) {
  const link = opts.link;
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
      <p style="font-size:13px;line-height:1.5;color:#4D5348;">If this is the email on your license, the invitation also waits for you under Group Sharing in the app on that device.</p>
    </div>
  </div>`;
  const text = `${opts.hostName} invited you to ${opts.groupName || "Group Sharing"} (${permission}).\n\nOpen this link on the device where your license is activated:\n${link}\n\nAccepting is not automatic — you must confirm on that device.\n\nIf this is the email on your license, the invitation also waits for you under Group Sharing in the app on that device.`;
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
