import {
  activeMembershipElsewhere,
  endGroup,
  expireDueGroups,
  groupSeats,
  inviteTokenFor,
  inviteUrlFor,
  loadGroupBundle,
  safeAppOrigin,
  sendGroupInviteEmail,
  sha256Hex,
  type GroupPermission,
  type SharingGroupRow,
  type SharingMemberRow,
} from "../_shared/groupSharing.ts";
import {
  canEditChecklist,
  canRenewGroup,
  displayNameFor,
  inviteMatchesLicense,
  normalizeEmail,
} from "../_shared/groupRules.ts";
import { json, preflight } from "../_shared/http.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose, type LicenseRow } from "../_shared/licenses.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";

type Admin = ReturnType<typeof serviceClient>;
type LicenseMap = Record<string, { license_key: string; email: string | null; product: string }>;

async function requireDeviceLicense(admin: Admin, licenseKey: string, deviceId: string) {
  const key = normalizeLicenseKeyLoose(licenseKey);
  if (!key.startsWith("SPL-") || !deviceId || deviceId.length > 128) {
    return { error: "License key and activated device are required.", status: 400 as const };
  }
  const license = await findLicenseByKey(admin, key);
  if (!license || license.status !== "active") {
    return { error: "That license key is not active.", status: 403 as const };
  }
  const device = await admin
    .from("license_devices")
    .select("device_id")
    .eq("license_id", license.id)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!device.data) {
    return {
      error: "Device verification required. Open this on the device where your license is activated.",
      status: 403 as const,
      code: "wrong_device" as const,
    };
  }
  return { license };
}

function cleanName(raw: unknown) {
  return String(raw || "").trim().slice(0, 80);
}

function publicMember(member: SharingMemberRow, licenses: LicenseMap, viewerLicenseId: string, viewerIsHost: boolean) {
  const lic = member.license_id ? licenses[member.license_id] : null;
  const isYou = Boolean(member.license_id && member.license_id === viewerLicenseId);
  return {
    id: member.id,
    role: member.role,
    permission: member.permission,
    permissionAccepted: member.permission_accepted,
    inviteStatus: member.invite_status,
    displayName: displayNameFor(member, lic?.email),
    isYou,
    invitedEmail: viewerIsHost || isYou ? member.invited_email : null,
    invitedLicenseKey: member.invited_license_key
      ? viewerIsHost
        ? member.invited_license_key
        : `${member.invited_license_key.slice(0, 8)}…`
      : null,
    licenseProduct: lic?.product || null,
    licenseId: member.license_id,
    inviteSentAt: member.invite_sent_at,
    respondedAt: member.responded_at,
    emailStatus: viewerIsHost && member.invite_status === "pending" ? member.invite_email_status ?? null : null,
  };
}

function publicGroup(group: SharingGroupRow, members: SharingMemberRow[], licenses: LicenseMap, viewerLicenseId: string) {
  const remainingMs = group.expires_at ? Math.max(0, Date.parse(group.expires_at) - Date.now()) : null;
  const viewerIsHost = group.host_license_id === viewerLicenseId;
  const acceptedOthers = members.filter(
    (m) => m.invite_status === "accepted" && m.license_id && m.license_id !== viewerLicenseId,
  ).length;
  const me = members.find((m) => m.license_id === viewerLicenseId && m.invite_status === "accepted") || null;
  return {
    id: group.id,
    name: group.name,
    status: group.status,
    maxDevices: group.max_devices,
    durationDays: group.duration_days,
    expiresAt: group.expires_at,
    remainingMs,
    hostLicenseId: group.host_license_id,
    isHost: viewerIsHost,
    memberCount: members.filter((m) => m.invite_status === "accepted").length,
    otherActiveMembers: acceptedOthers,
    seats: groupSeats(members, group.max_devices),
    me: me
      ? {
        memberId: me.id,
        licenseId: viewerLicenseId,
        role: me.role,
        permission: me.permission,
        permissionAccepted: me.permission_accepted,
      }
      : null,
    members: members.map((m) => publicMember(m, licenses, viewerLicenseId, viewerIsHost)),
  };
}

async function findViewerGroup(admin: Admin, licenseId: string) {
  await expireDueGroups(admin);
  const { data: memberships } = await admin
    .from("sharing_group_members")
    .select("group_id")
    .eq("license_id", licenseId)
    .eq("invite_status", "accepted");
  for (const row of memberships || []) {
    const bundle = await loadGroupBundle(admin, (row as { group_id: string }).group_id);
    if (!bundle) continue;
    if (bundle.group.status === "pending_setup" || bundle.group.status === "active") return bundle;
  }
  const hosted = await admin
    .from("sharing_groups")
    .select("id")
    .eq("host_license_id", licenseId)
    .in("status", ["pending_setup", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (hosted.data) return loadGroupBundle(admin, (hosted.data as { id: string }).id);
  return null;
}

/** Pending invites addressed to this verified license (by its purchase email or its key). */
async function pendingInvitesFor(admin: Admin, license: LicenseRow) {
  const rows: SharingMemberRow[] = [];
  const email = normalizeEmail(license.email);
  if (email) {
    const { data } = await admin
      .from("sharing_group_members")
      .select("*")
      .eq("invite_status", "pending")
      .eq("role", "member")
      .eq("invited_email", email);
    rows.push(...((data || []) as SharingMemberRow[]));
  }
  const { data: byKey } = await admin
    .from("sharing_group_members")
    .select("*")
    .eq("invite_status", "pending")
    .eq("role", "member")
    .eq("invited_license_key", license.license_key);
  for (const row of (byKey || []) as SharingMemberRow[]) {
    if (!rows.some((r) => r.id === row.id)) rows.push(row);
  }

  const invites = [];
  for (const row of rows) {
    if (!inviteMatchesLicense(row, license)) continue;
    const bundle = await loadGroupBundle(admin, row.group_id);
    if (!bundle || bundle.group.status !== "active") continue;
    if (bundle.group.host_license_id === license.id) continue;
    const host = bundle.members.find((m) => m.role === "host");
    invites.push({
      id: row.id,
      groupId: bundle.group.id,
      groupName: bundle.group.name || "Group Sharing",
      hostName: host ? displayNameFor(host, host.license_id ? bundle.licenses[host.license_id]?.email : null) : "Host",
      permission: row.permission,
      expiresAt: bundle.group.expires_at,
      invitedAt: row.invite_sent_at || row.created_at,
    });
  }
  return invites;
}

/** Most recent expired group this license hosted that can still be renewed. */
async function renewableGroupFor(admin: Admin, licenseId: string) {
  const { data } = await admin
    .from("sharing_groups")
    .select("*")
    .eq("host_license_id", licenseId)
    .eq("status", "expired")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const group = data as SharingGroupRow | null;
  if (!group || !canRenewGroup(group)) return null;
  return {
    id: group.id,
    name: group.name,
    maxDevices: group.max_devices,
    durationDays: group.duration_days,
    expiredAt: group.expires_at,
  };
}

async function respondToInvite(
  admin: Admin,
  license: LicenseRow,
  member: SharingMemberRow,
  accept: boolean,
  myName: string,
  via: "link" | "app",
) {
  const bundle = await loadGroupBundle(admin, member.group_id);
  if (!bundle || bundle.group.status !== "active") {
    return json({ error: "That Group Sharing session is not active.", inviteStatus: "expired" }, 410);
  }
  if (member.invite_status !== "pending") {
    return json({ error: `This invitation is already ${member.invite_status}.`, inviteStatus: member.invite_status }, 409);
  }

  if (via === "app") {
    if (!inviteMatchesLicense(member, license)) {
      return json({ error: "That invitation was not sent to this license." }, 403);
    }
  } else if (member.invited_license_key) {
    if (normalizeLicenseKeyLoose(member.invited_license_key) !== license.license_key) {
      return json({
        error: "Device verification required. Open this invitation on the device with the license that was invited.",
        code: "wrong_device",
      }, 403);
    }
  } else if (member.invited_email) {
    const purchaseEmail = normalizeEmail(license.email);
    if (purchaseEmail && purchaseEmail !== normalizeEmail(member.invited_email)) {
      return json({
        error:
          "Device verification required. This invitation was sent to a different purchase email — open it on the licensed device tied to that email.",
        code: "wrong_device",
      }, 403);
    }
  }

  if (!accept) {
    await admin
      .from("sharing_group_members")
      .update({ invite_status: "declined", responded_at: new Date().toISOString() })
      .eq("id", member.id)
      .eq("invite_status", "pending");
    return json({ inviteStatus: "declined" });
  }

  if (bundle.group.host_license_id === license.id) {
    return json({ error: "You are the host of this group." }, 400);
  }
  if (bundle.members.some((m) => m.license_id === license.id && m.invite_status === "accepted")) {
    return json({ error: "You are already in this group." }, 409);
  }
  if (await activeMembershipElsewhere(admin, license.id, member.group_id)) {
    return json({
      error: "You're already in another active Group Sharing group. Leave it (or end it if you host it) first.",
    }, 409);
  }
  const accepted = bundle.members.filter((m) => m.invite_status === "accepted").length;
  if (accepted >= bundle.group.max_devices) {
    return json({ error: "This group is full." }, 400);
  }

  const updated = await admin
    .from("sharing_group_members")
    .update({
      invite_status: "accepted",
      license_id: license.id,
      permission_accepted: true,
      responded_at: new Date().toISOString(),
      ...(myName ? { display_name: myName } : {}),
    })
    .eq("id", member.id)
    .eq("invite_status", "pending")
    .select("id")
    .maybeSingle();
  if (!updated.data) return json({ error: "That invitation was already answered." }, 409);

  const next = await loadGroupBundle(admin, member.group_id);
  return json({
    inviteStatus: "accepted",
    group: next ? publicGroup(next.group, next.members, next.licenses, license.id) : null,
  });
}

async function hasActiveLicenseEmail(admin: Admin, email: string) {
  const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await admin
    .from("licenses")
    .select("id")
    .ilike("email", pattern)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function recordEmailStatus(admin: Admin, memberId: string, status: "sent" | "failed" | "not_sent", error: string | null) {
  // Columns come from migration 0056; older schemas simply skip this.
  const res = await admin
    .from("sharing_group_members")
    .update({ invite_email_status: status, invite_email_error: error ? error.slice(0, 300) : null })
    .eq("id", memberId);
  if (res.error) console.warn("invite email status not stored", res.error.message);
}

/** Makes sure the stored hash matches the derivable link for this invite, and returns that link. */
async function inviteLinkFor(admin: Admin, member: SharingMemberRow, origin?: string) {
  let sentAt = member.invite_sent_at;
  if (!sentAt) {
    sentAt = new Date().toISOString();
    await admin.from("sharing_group_members").update({ invite_sent_at: sentAt }).eq("id", member.id);
  }
  const token = await inviteTokenFor(member.id, sentAt);
  const hash = await sha256Hex(token);
  if (hash !== member.invite_token_hash) {
    await admin.from("sharing_group_members").update({ invite_token_hash: hash }).eq("id", member.id);
  }
  return inviteUrlFor(token, origin);
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const limited = await rateLimitBlock(`group-sharing:${clientIp(req)}`, 300, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "status").trim();
    const admin = serviceClient();
    const origin = safeAppOrigin(body.origin);
    const myName = cleanName(body.myName);

    if (action === "invite_preview") {
      const token = String(body.token || "").trim();
      if (!token) return json({ error: "Missing invitation token." }, 400);
      const hash = await sha256Hex(token);
      const { data: member } = await admin
        .from("sharing_group_members")
        .select("*")
        .eq("invite_token_hash", hash)
        .maybeSingle();
      if (!member) return json({ error: "That invitation is not valid." }, 404);
      const m = member as SharingMemberRow;
      const bundle = await loadGroupBundle(admin, m.group_id);
      if (!bundle) return json({ error: "That group is no longer available." }, 404);
      const host = bundle.members.find((row) => row.role === "host");
      const hostName = host ? displayNameFor(host, host.license_id ? bundle.licenses[host.license_id]?.email : null) : "Host";
      if (bundle.group.status !== "active") {
        return json({
          inviteStatus: m.invite_status === "pending" ? "expired" : m.invite_status,
          groupName: bundle.group.name || "Group Sharing",
          hostName,
          permission: m.permission,
          groupStatus: bundle.group.status,
        });
      }
      return json({
        inviteStatus: m.invite_status,
        groupName: bundle.group.name || "Group Sharing",
        hostName,
        permission: m.permission,
        expiresAt: bundle.group.expires_at,
        groupStatus: bundle.group.status,
        requiresDevice: true,
      });
    }

    const auth = await requireDeviceLicense(admin, String(body.licenseKey || ""), String(body.deviceId || ""));
    if ("error" in auth) {
      return json({ error: auth.error, code: "code" in auth ? auth.code : undefined }, auth.status);
    }
    const license = auth.license;
    const licenseLimited = await rateLimitBlock(`group-sharing-license:${license.id}`, 200, 600);
    if (licenseLimited) return licenseLimited;

    if (action === "status") {
      const [bundle, pendingInvites] = await Promise.all([
        findViewerGroup(admin, license.id),
        pendingInvitesFor(admin, license),
      ]);
      if (bundle && myName) {
        const mine = bundle.members.find((m) => m.license_id === license.id && m.invite_status === "accepted");
        if (mine && mine.display_name !== myName) {
          await admin.from("sharing_group_members").update({ display_name: myName }).eq("id", mine.id);
          mine.display_name = myName;
        }
      }
      return json({
        group: bundle ? publicGroup(bundle.group, bundle.members, bundle.licenses, license.id) : null,
        pendingInvites,
        renewable: bundle ? null : await renewableGroupFor(admin, license.id),
        pricing: GROUP_PRICING,
      });
    }

    if (action === "setup") {
      const groupId = String(body.groupId || "").trim();
      const name = String(body.name || "").trim().slice(0, 80);
      if (!groupId || name.length < 2) return json({ error: "Enter a group name (at least 2 characters)." }, 400);
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle || bundle.group.host_license_id !== license.id) {
        return json({ error: "Only the host can finish Group Sharing setup." }, 403);
      }
      if (bundle.group.status !== "pending_setup" && bundle.group.status !== "active") {
        return json({ error: "This group cannot be set up." }, 400);
      }
      const expires = new Date();
      expires.setUTCDate(expires.getUTCDate() + bundle.group.duration_days);
      const updated = await admin
        .from("sharing_groups")
        .update({
          name,
          status: "active",
          expires_at: bundle.group.expires_at || expires.toISOString(),
        })
        .eq("id", groupId)
        .select("*")
        .maybeSingle();
      if (!updated.data) return json({ error: "Could not save group setup." }, 500);
      if (myName) {
        await admin
          .from("sharing_group_members")
          .update({ display_name: myName })
          .eq("group_id", groupId)
          .eq("role", "host");
      }
      const next = await loadGroupBundle(admin, groupId);
      return json({ group: next ? publicGroup(next.group, next.members, next.licenses, license.id) : null });
    }

    if (action === "invite" || action === "resend") {
      const groupId = String(body.groupId || "").trim();
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle || bundle.group.host_license_id !== license.id) {
        return json({ error: "Only the host can send invitations." }, 403);
      }
      if (bundle.group.status !== "active") {
        return json({ error: "Finish group setup before inviting members." }, 400);
      }

      let member: SharingMemberRow | null = null;
      let inviteeLicensed: boolean | null = null;
      let to: string | null = null;
      if (action === "resend") {
        const memberId = String(body.memberId || "").trim();
        member = bundle.members.find((m) => m.id === memberId) || null;
        if (!member || member.invite_status !== "pending") {
          return json({ error: "That invitation cannot be resent." }, 400);
        }
      } else {
        const seats = groupSeats(bundle.members, bundle.group.max_devices);
        if (seats.full) {
          return json({
            error: `This group is full (${seats.max} of ${seats.max} seats used, including you and pending invites). Revoke a pending invite or remove a member to free a seat.`,
            code: "group_full",
          }, 400);
        }
        const email = normalizeEmail(String(body.email || ""));
        const inviteKey = normalizeLicenseKeyLoose(String(body.inviteLicenseKey || body.licenseId || ""));
        const permission: GroupPermission = body.permission === "edit" ? "edit" : "view";
        const displayName = cleanName(body.displayName) || null;
        if (!email && !inviteKey.startsWith("SPL-")) {
          return json({ error: "Invite by license-associated email or license key." }, 400);
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return json({ error: "Enter a valid email address." }, 400);
        }
        const hostLic = bundle.licenses[license.id];
        if (email && !inviteKey.startsWith("SPL-") && email === normalizeEmail(hostLic?.email || license.email)) {
          return json({ error: "That's your own license email. Invite someone else's license." }, 400);
        }
        if (inviteKey.startsWith("SPL-")) {
          const invited = await findLicenseByKey(admin, inviteKey);
          if (!invited || invited.status !== "active") {
            return json({ error: "That license key is not an active Safety Prep List license." }, 400);
          }
          if (invited.id === license.id) {
            return json({ error: "You are already the host of this group." }, 400);
          }
          const already = bundle.members.find(
            (m) =>
              (m.invite_status === "accepted" || m.invite_status === "pending") &&
              (m.license_id === invited.id || normalizeLicenseKeyLoose(m.invited_license_key || "") === invited.license_key),
          );
          if (already) return json({ error: "That license is already invited to this group." }, 409);
          inviteeLicensed = true;
          to = email || invited.email || null;
        } else {
          const already = bundle.members.find(
            (m) =>
              (m.invite_status === "accepted" || m.invite_status === "pending") &&
              normalizeEmail(m.invited_email) === email,
          );
          if (already) return json({ error: "That email is already invited to this group." }, 409);
          inviteeLicensed = await hasActiveLicenseEmail(admin, email);
          to = email;
        }
        const inserted = await admin
          .from("sharing_group_members")
          .insert({
            group_id: groupId,
            license_id: null,
            role: "member",
            permission,
            permission_accepted: false,
            invite_status: "pending",
            invited_email: email || null,
            invited_license_key: inviteKey.startsWith("SPL-") ? inviteKey : null,
            display_name: displayName,
          })
          .select("*")
          .single();
        if (inserted.error) {
          console.error(inserted.error);
          return json({ error: "Could not create invitation." }, 500);
        }
        member = inserted.data as SharingMemberRow;
      }

      if (!member) return json({ error: "Invitation not found." }, 404);
      const sentAt = new Date().toISOString();
      const token = await inviteTokenFor(member.id, sentAt);
      await admin
        .from("sharing_group_members")
        .update({ invite_token_hash: await sha256Hex(token), invite_sent_at: sentAt })
        .eq("id", member.id);
      const inviteUrl = inviteUrlFor(token, origin);

      if (action === "resend") {
        to = member.invited_email || (member.invited_license_key
          ? (await findLicenseByKey(admin, member.invited_license_key))?.email || null
          : null);
      }

      let emailSent = false;
      let emailError: string | null = null;
      let emailStatus: "sent" | "failed" | "not_sent";
      if (!to) {
        emailStatus = "not_sent";
        emailError = "There's no email on file for that license. Copy the invite link and send it yourself.";
      } else {
        const host = bundle.members.find((m) => m.role === "host");
        const emailResult = await sendGroupInviteEmail({
          to,
          hostName: host ? displayNameFor(host, bundle.licenses[license.id]?.email) : "Host",
          groupName: bundle.group.name || "Group Sharing",
          permission: member.permission,
          link: inviteUrl,
        });
        emailSent = emailResult.ok;
        emailStatus = emailResult.ok ? "sent" : emailResult.provider ? "failed" : "not_sent";
        if (!emailResult.ok) {
          emailError = emailResult.provider
            ? "The invitation email could not be sent. Copy the invite link and send it yourself."
            : "Invitation emails aren't set up yet. Copy the invite link and send it yourself.";
        }
      }
      await recordEmailStatus(admin, member.id, emailStatus, emailSent ? null : emailError);

      const next = await loadGroupBundle(admin, groupId);
      return json({
        emailSent,
        emailStatus,
        emailError,
        inviteUrl,
        inviteeLicensed,
        memberId: member.id,
        group: next ? publicGroup(next.group, next.members, next.licenses, license.id) : null,
      });
    }

    if (action === "invite_link") {
      const groupId = String(body.groupId || "").trim();
      const memberId = String(body.memberId || "").trim();
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle || bundle.group.host_license_id !== license.id) {
        return json({ error: "Only the host can copy invite links." }, 403);
      }
      if (bundle.group.status !== "active") return json({ error: "This group is not active." }, 400);
      const target = bundle.members.find((m) => m.id === memberId);
      if (!target || target.role === "host" || target.invite_status !== "pending") {
        return json({ error: "That invitation is no longer pending." }, 400);
      }
      return json({ inviteUrl: await inviteLinkFor(admin, target, origin) });
    }

    if (action === "revoke") {
      const groupId = String(body.groupId || "").trim();
      const memberId = String(body.memberId || "").trim();
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle || bundle.group.host_license_id !== license.id) {
        return json({ error: "Only the host can revoke invitations." }, 403);
      }
      const target = bundle.members.find((m) => m.id === memberId);
      if (!target || target.role === "host") return json({ error: "That member cannot be revoked." }, 400);
      await admin
        .from("sharing_group_members")
        .update({ invite_status: "revoked", responded_at: new Date().toISOString() })
        .eq("id", memberId);
      if (target.license_id) {
        await admin.from("sharing_group_items").delete().eq("group_id", groupId).eq("owner_license_id", target.license_id);
        await admin
          .from("sharing_group_custom_items")
          .delete()
          .eq("group_id", groupId)
          .eq("owner_license_id", target.license_id);
      }
      const next = await loadGroupBundle(admin, groupId);
      return json({ group: next ? publicGroup(next.group, next.members, next.licenses, license.id) : null });
    }

    if (action === "set_permission") {
      const groupId = String(body.groupId || "").trim();
      const memberId = String(body.memberId || "").trim();
      const permission: GroupPermission = body.permission === "edit" ? "edit" : "view";
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle || bundle.group.host_license_id !== license.id) {
        return json({ error: "Only the host can change permissions." }, 403);
      }
      const target = bundle.members.find((m) => m.id === memberId);
      if (!target || target.role === "host") return json({ error: "Host permissions cannot be changed." }, 400);
      if (target.invite_status !== "accepted" && target.invite_status !== "pending") {
        return json({ error: "That invitation is no longer active." }, 400);
      }
      // Pending invites carry the new permission into the consent step. Accepted members must approve Edit;
      // dropping to View only takes effect immediately.
      const permissionAccepted = target.invite_status === "accepted" && permission === "view";
      await admin
        .from("sharing_group_members")
        .update({ permission, permission_accepted: permissionAccepted })
        .eq("id", memberId);
      const next = await loadGroupBundle(admin, groupId);
      return json({ group: next ? publicGroup(next.group, next.members, next.licenses, license.id) : null });
    }

    if (action === "accept_permission") {
      const groupId = String(body.groupId || "").trim();
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle) return json({ error: "Group not found." }, 404);
      const me = bundle.members.find((m) => m.license_id === license.id && m.invite_status === "accepted");
      if (!me) return json({ error: "You are not an accepted member of this group." }, 403);
      await admin.from("sharing_group_members").update({ permission_accepted: true }).eq("id", me.id);
      const next = await loadGroupBundle(admin, groupId);
      return json({ group: next ? publicGroup(next.group, next.members, next.licenses, license.id) : null });
    }

    if (action === "accept" || action === "decline") {
      const token = String(body.token || "").trim();
      if (!token) return json({ error: "Missing invitation token." }, 400);
      const hash = await sha256Hex(token);
      const { data: member } = await admin
        .from("sharing_group_members")
        .select("*")
        .eq("invite_token_hash", hash)
        .maybeSingle();
      if (!member) return json({ error: "That invitation is not valid." }, 404);
      return respondToInvite(admin, license, member as SharingMemberRow, action === "accept", myName, "link");
    }

    if (action === "accept_invite" || action === "decline_invite") {
      const memberId = String(body.memberId || "").trim();
      if (!memberId) return json({ error: "Missing invitation." }, 400);
      const { data: member } = await admin.from("sharing_group_members").select("*").eq("id", memberId).maybeSingle();
      if (!member) return json({ error: "That invitation is not valid." }, 404);
      return respondToInvite(admin, license, member as SharingMemberRow, action === "accept_invite", myName, "app");
    }

    if (action === "leave") {
      const groupId = String(body.groupId || "").trim();
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle) return json({ error: "Group not found." }, 404);
      const me = bundle.members.find((m) => m.license_id === license.id && m.invite_status === "accepted");
      if (!me) return json({ error: "You are not in this group." }, 403);
      if (me.role === "host") return json({ error: "Hosts should end the group instead of leaving." }, 400);
      await admin
        .from("sharing_group_members")
        .update({ invite_status: "revoked", responded_at: new Date().toISOString() })
        .eq("id", me.id);
      await admin.from("sharing_group_items").delete().eq("group_id", groupId).eq("owner_license_id", license.id);
      await admin.from("sharing_group_custom_items").delete().eq("group_id", groupId).eq("owner_license_id", license.id);
      return json({ left: true });
    }

    if (action === "end") {
      const groupId = String(body.groupId || "").trim();
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle || bundle.group.host_license_id !== license.id) {
        return json({ error: "Only the host can end Group Sharing." }, 403);
      }
      await endGroup(admin, groupId, "ended");
      return json({ ended: true });
    }

    if (action === "pull") {
      const groupId = String(body.groupId || "").trim();
      const ownerLicenseId = String(body.ownerLicenseId || "").trim();
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle || bundle.group.status !== "active") return json({ error: "Group is not active." }, 400);
      const me = bundle.members.find((m) => m.license_id === license.id && m.invite_status === "accepted");
      if (!me) return json({ error: "You are not an accepted member of this group." }, 403);
      const owner = bundle.members.find((m) => m.license_id === ownerLicenseId && m.invite_status === "accepted");
      if (!owner) return json({ error: "That member is not in this group." }, 404);
      const { data: items } = await admin
        .from("sharing_group_items")
        .select("checklist_item_id, checked, note, updated_at")
        .eq("group_id", groupId)
        .eq("owner_license_id", ownerLicenseId);
      const { data: customs } = await admin
        .from("sharing_group_custom_items")
        .select("*")
        .eq("group_id", groupId)
        .eq("owner_license_id", ownerLicenseId);
      const isOwn = ownerLicenseId === license.id;
      return json({
        ownerLicenseId,
        ownerName: displayNameFor(owner, bundle.licenses[ownerLicenseId]?.email),
        permission: isOwn ? "own" : me.permission_accepted ? me.permission : "view",
        canEdit: canEditChecklist(me, ownerLicenseId),
        items: items || [],
        customItems: ((customs || []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.client_item_id || row.id),
          section_id: row.section_id,
          text: row.text,
          description: row.description ?? null,
          sort_order: row.sort_order ?? 0,
          checked: Boolean(row.checked),
          note: String(row.note || ""),
          updated_at: row.updated_at,
        })),
      });
    }

    if (action === "push") {
      const groupId = String(body.groupId || "").trim();
      const ownerLicenseId = String(body.ownerLicenseId || license.id).trim();
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle || bundle.group.status !== "active") return json({ error: "Group is not active." }, 400);
      const me = bundle.members.find((m) => m.license_id === license.id && m.invite_status === "accepted");
      if (!me) return json({ error: "You are not an accepted member of this group." }, 403);
      const owner = bundle.members.find((m) => m.license_id === ownerLicenseId && m.invite_status === "accepted");
      if (!owner) return json({ error: "That member is not in this group." }, 404);
      if (!canEditChecklist(me, ownerLicenseId)) {
        return json({ error: "View only — edits are not allowed for this checklist." }, 403);
      }

      const now = new Date().toISOString();
      const rows = [];
      const items = Array.isArray(body.items) ? body.items : [];
      for (const raw of items.slice(0, 2000)) {
        const row = raw as { checklistItemId?: string; checked?: boolean; note?: string };
        const itemId = String(row.checklistItemId || "").trim();
        if (!itemId || itemId.length > 200) continue;
        rows.push({
          group_id: groupId,
          owner_license_id: ownerLicenseId,
          checklist_item_id: itemId,
          checked: Boolean(row.checked),
          note: String(row.note || "").slice(0, 100),
          updated_at: now,
        });
      }
      if (rows.length) {
        const saved = await admin
          .from("sharing_group_items")
          .upsert(rows, { onConflict: "group_id,owner_license_id,checklist_item_id" });
        if (saved.error) {
          console.error(saved.error);
          return json({ error: "Could not save shared checklist changes." }, 500);
        }
      }

      // Only the owner publishes the list of their own custom items.
      if (ownerLicenseId === license.id && Array.isArray(body.customItems)) {
        const customs = [];
        for (const raw of body.customItems.slice(0, 500)) {
          const row = raw as { id?: string; sectionId?: string; text?: string; description?: string | null; sortOrder?: number };
          const clientId = String(row.id || "").trim().slice(0, 200);
          const sectionId = String(row.sectionId || "").trim().slice(0, 200);
          const text = String(row.text || "").trim().slice(0, 200);
          if (!clientId || !sectionId || !text) continue;
          customs.push({
            group_id: groupId,
            owner_license_id: license.id,
            client_item_id: clientId,
            section_id: sectionId,
            text,
            description: row.description ? String(row.description).slice(0, 500) : null,
            sort_order: Number.isFinite(Number(row.sortOrder)) ? Math.trunc(Number(row.sortOrder)) : 0,
            updated_at: now,
          });
        }
        await admin.from("sharing_group_custom_items").delete().eq("group_id", groupId).eq("owner_license_id", license.id);
        if (customs.length) {
          const savedCustoms = await admin.from("sharing_group_custom_items").insert(customs);
          if (savedCustoms.error) console.warn("custom items not published", savedCustoms.error.message);
        }
      }
      return json({ ok: true, updatedAt: now });
    }

    return json({ error: "Unknown Group Sharing action." }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "Group Sharing request failed." }, 500);
  }
});

const GROUP_PRICING = [
  { devices: 2, durationDays: 7, cents: 599, lookup: "spl_group_2_7d" },
  { devices: 2, durationDays: 14, cents: 999, lookup: "spl_group_2_14d" },
  { devices: 2, durationDays: 30, cents: 1499, lookup: "spl_group_2_30d" },
  { devices: 3, durationDays: 7, cents: 799, lookup: "spl_group_3_7d" },
  { devices: 3, durationDays: 14, cents: 1299, lookup: "spl_group_3_14d" },
  { devices: 3, durationDays: 30, cents: 1799, lookup: "spl_group_3_30d" },
  { devices: 4, durationDays: 7, cents: 999, lookup: "spl_group_4_7d" },
  { devices: 4, durationDays: 14, cents: 1499, lookup: "spl_group_4_14d" },
  { devices: 4, durationDays: 30, cents: 1999, lookup: "spl_group_4_30d" },
];
