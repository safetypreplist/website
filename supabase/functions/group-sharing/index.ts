import {
  endGroup,
  expireDueGroups,
  loadGroupBundle,
  newInviteToken,
  sendGroupInviteEmail,
  sha256Hex,
  type GroupPermission,
  type SharingGroupRow,
  type SharingMemberRow,
} from "../_shared/groupSharing.ts";
import { json, preflight } from "../_shared/http.ts";
import { findLicenseByKey, normalizeLicenseKeyLoose } from "../_shared/licenses.ts";
import { clientIp, rateLimitBlock } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";

type Admin = ReturnType<typeof serviceClient>;

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
      error: "This invitation must be opened on the device where your license is activated.",
      status: 403 as const,
      code: "wrong_device" as const,
    };
  }
  return { license };
}

function publicMember(
  member: SharingMemberRow,
  licenses: Record<string, { license_key: string; email: string | null; product: string }>,
  includeKey = false,
) {
  const lic = member.license_id ? licenses[member.license_id] : null;
  return {
    id: member.id,
    role: member.role,
    permission: member.permission,
    permissionAccepted: member.permission_accepted,
    inviteStatus: member.invite_status,
    displayName: member.display_name || lic?.email?.split("@")[0] || (member.role === "host" ? "Host" : "Member"),
    invitedEmail: member.invited_email,
    invitedLicenseKey: includeKey ? member.invited_license_key : member.invited_license_key
      ? `${member.invited_license_key.slice(0, 8)}…`
      : null,
    licenseProduct: lic?.product || null,
    licenseId: member.license_id,
    inviteSentAt: member.invite_sent_at,
    respondedAt: member.responded_at,
  };
}

function publicGroup(
  group: SharingGroupRow,
  members: SharingMemberRow[],
  licenses: Record<string, { license_key: string; email: string | null; product: string }>,
  viewerLicenseId: string,
) {
  const remainingMs = group.expires_at ? Math.max(0, Date.parse(group.expires_at) - Date.now()) : null;
  const acceptedOthers = members.filter(
    (m) => m.invite_status === "accepted" && m.license_id && m.license_id !== viewerLicenseId,
  ).length;
  return {
    id: group.id,
    name: group.name,
    status: group.status,
    maxDevices: group.max_devices,
    durationDays: group.duration_days,
    expiresAt: group.expires_at,
    remainingMs,
    hostLicenseId: group.host_license_id,
    isHost: group.host_license_id === viewerLicenseId,
    memberCount: members.filter((m) => m.invite_status === "accepted").length,
    otherActiveMembers: acceptedOthers,
    members: members.map((m) => publicMember(m, licenses, group.host_license_id === viewerLicenseId)),
  };
}

async function findViewerGroup(admin: Admin, licenseId: string) {
  await expireDueGroups(admin);
  const { data: memberships } = await admin
    .from("sharing_group_members")
    .select("group_id, invite_status")
    .eq("license_id", licenseId)
    .in("invite_status", ["accepted", "pending"]);
  for (const row of memberships || []) {
    const m = row as { group_id: string; invite_status: string };
    const bundle = await loadGroupBundle(admin, m.group_id);
    if (!bundle) continue;
    if (bundle.group.status === "pending_setup" || bundle.group.status === "active") {
      return bundle;
    }
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

async function acceptedCapacity(admin: Admin, groupId: string) {
  const { count } = await admin
    .from("sharing_group_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .in("invite_status", ["accepted", "pending"]);
  return count ?? 0;
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const limited = await rateLimitBlock(`group-sharing:${clientIp(req)}`, 40, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "status").trim();
    const admin = serviceClient();

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
      if (bundle.group.status !== "active" && bundle.group.status !== "pending_setup") {
        return json({ error: "That Group Sharing session has ended.", status: bundle.group.status }, 410);
      }
      if (m.invite_status !== "pending") {
        return json({
          inviteStatus: m.invite_status,
          groupName: bundle.group.name,
          permission: m.permission,
        });
      }
      const host = bundle.members.find((row) => row.role === "host");
      const hostLic = host?.license_id ? bundle.licenses[host.license_id] : null;
      return json({
        inviteStatus: "pending",
        groupName: bundle.group.name || "Group Sharing",
        hostName: host?.display_name || hostLic?.email?.split("@")[0] || "Host",
        permission: m.permission,
        expiresAt: bundle.group.expires_at,
        requiresDevice: true,
      });
    }

    const auth = await requireDeviceLicense(admin, String(body.licenseKey || ""), String(body.deviceId || ""));
    if ("error" in auth) {
      return json({ error: auth.error, code: "code" in auth ? auth.code : undefined }, auth.status);
    }
    const license = auth.license;

    if (action === "status") {
      const bundle = await findViewerGroup(admin, license.id);
      if (!bundle) return json({ group: null, pricing: GROUP_PRICING });
      return json({
        group: publicGroup(bundle.group, bundle.members, bundle.licenses, license.id),
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
      if (action === "resend") {
        const memberId = String(body.memberId || "").trim();
        member = bundle.members.find((m) => m.id === memberId) || null;
        if (!member || member.invite_status !== "pending") {
          return json({ error: "That invitation cannot be resent." }, 400);
        }
      } else {
        const used = await acceptedCapacity(admin, groupId);
        if (used >= bundle.group.max_devices) {
          return json({ error: `This group is full (${bundle.group.max_devices} licensed devices max).` }, 400);
        }
        const email = String(body.email || "").trim().toLowerCase();
        const inviteKey = normalizeLicenseKeyLoose(String(body.inviteLicenseKey || body.licenseId || ""));
        const permission: GroupPermission = body.permission === "edit" ? "edit" : "view";
        const displayName = String(body.displayName || "").trim().slice(0, 80) || null;
        if (!email && !inviteKey.startsWith("SPL-")) {
          return json({ error: "Invite by license-associated email or license key." }, 400);
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
            (m) => m.license_id === invited.id && (m.invite_status === "accepted" || m.invite_status === "pending"),
          );
          if (already) return json({ error: "That license is already invited to this group." }, 409);
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
      const token = newInviteToken();
      const hash = await sha256Hex(token);
      await admin
        .from("sharing_group_members")
        .update({ invite_token_hash: hash, invite_sent_at: new Date().toISOString() })
        .eq("id", member.id);

      const to = member.invited_email || (member.invited_license_key
        ? (await findLicenseByKey(admin, member.invited_license_key))?.email
        : null);
      if (!to) {
        return json({
          error: "No email is available for that invite. Add an email or use a license that has a purchase email.",
          memberId: member.id,
        }, 400);
      }
      const hostName = bundle.members.find((m) => m.role === "host")?.display_name || "Host";
      const emailResult = await sendGroupInviteEmail({
        to,
        hostName,
        groupName: bundle.group.name || "Group Sharing",
        permission: member.permission,
        token,
        appUrl: String(body.origin || "") || undefined,
      });
      const next = await loadGroupBundle(admin, groupId);
      return json({
        emailSent: emailResult.ok,
        emailError: emailResult.error,
        group: next ? publicGroup(next.group, next.members, next.licenses, license.id) : null,
      });
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
      // Changing permission requires invitee re-consent when upgrading to edit, or immediate when downgrading to view.
      const permissionAccepted = permission === "view" ? true : false;
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
      const m = member as SharingMemberRow;
      const bundle = await loadGroupBundle(admin, m.group_id);
      if (!bundle || (bundle.group.status !== "active" && bundle.group.status !== "pending_setup")) {
        return json({ error: "That Group Sharing session is not active." }, 410);
      }
      if (m.invite_status !== "pending") {
        return json({ error: `This invitation is already ${m.invite_status}.` }, 409);
      }

      if (action === "decline") {
        await admin
          .from("sharing_group_members")
          .update({ invite_status: "declined", responded_at: new Date().toISOString() })
          .eq("id", m.id);
        return json({ inviteStatus: "declined" });
      }

      // Accept: device already verified via requireDeviceLicense above.
      if (m.invited_license_key) {
        const expected = normalizeLicenseKeyLoose(m.invited_license_key);
        if (expected !== license.license_key) {
          return json({
            error: "Open this invitation on the device with the license that was invited.",
            code: "wrong_device",
          }, 403);
        }
      } else if (m.invited_email) {
        const purchaseEmail = (license.email || "").trim().toLowerCase();
        if (purchaseEmail && purchaseEmail !== m.invited_email.trim().toLowerCase()) {
          return json({
            error:
              "This invitation was sent to a different purchase email. Open it on the licensed device tied to that email.",
            code: "wrong_device",
          }, 403);
        }
      }

      const used = await acceptedCapacity(admin, m.group_id);
      // pending slot already counted for this invite; accepted others + this one must fit.
      const accepted = bundle.members.filter((row) => row.invite_status === "accepted").length;
      if (accepted >= bundle.group.max_devices) {
        return json({ error: "This group is full." }, 400);
      }
      void used;

      await admin
        .from("sharing_group_members")
        .update({
          invite_status: "accepted",
          license_id: license.id,
          permission_accepted: true,
          responded_at: new Date().toISOString(),
        })
        .eq("id", m.id);

      const next = await loadGroupBundle(admin, m.group_id);
      return json({
        inviteStatus: "accepted",
        group: next ? publicGroup(next.group, next.members, next.licenses, license.id) : null,
      });
    }

    if (action === "leave") {
      const groupId = String(body.groupId || "").trim();
      const bundle = await loadGroupBundle(admin, groupId);
      if (!bundle) return json({ error: "Group not found." }, 404);
      const me = bundle.members.find((m) => m.license_id === license.id);
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
        .select("id, section_id, text, description, sort_order, checked, note, updated_at")
        .eq("group_id", groupId)
        .eq("owner_license_id", ownerLicenseId);
      const canEdit =
        ownerLicenseId === license.id ||
        (me.role === "host" && owner.permission === "edit" && owner.permission_accepted) ||
        (me.license_id === owner.license_id);
      // Viewer can edit owner's list only when owner granted edit and accepted, and viewer is not merely view-only on their own membership when viewing others...
      // Spec: Host sets permission on invite; invitee approves. Permission is what others may do TO the invitee's checklist.
      const effectiveCanEdit =
        ownerLicenseId === license.id
          ? true
          : owner.permission === "edit" && owner.permission_accepted;
      return json({
        ownerLicenseId,
        ownerName: owner.display_name || "Member",
        permission: ownerLicenseId === license.id ? "own" : owner.permission,
        canEdit: effectiveCanEdit,
        items: items || [],
        customItems: customs || [],
        unused: canEdit,
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
      const canEdit =
        ownerLicenseId === license.id || (owner.permission === "edit" && owner.permission_accepted);
      if (!canEdit) return json({ error: "View only — edits are not allowed for this checklist." }, 403);

      const items = Array.isArray(body.items) ? body.items : [];
      const now = new Date().toISOString();
      for (const raw of items.slice(0, 2000)) {
        const row = raw as { checklistItemId?: string; checked?: boolean; note?: string };
        const itemId = String(row.checklistItemId || "").trim();
        if (!itemId || itemId.length > 200) continue;
        await admin.from("sharing_group_items").upsert(
          {
            group_id: groupId,
            owner_license_id: ownerLicenseId,
            checklist_item_id: itemId,
            checked: Boolean(row.checked),
            note: String(row.note || "").slice(0, 100),
            updated_at: now,
          },
          { onConflict: "group_id,owner_license_id,checklist_item_id" },
        );
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
