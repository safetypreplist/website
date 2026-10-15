import { isValidEmail, normalizeEmail } from "../_shared/brevo.ts";
import { escapeHtml, sendEmail } from "../_shared/email.ts";
import { json, preflight } from "../_shared/http.ts";
import { rateLimitBlock } from "../_shared/rateLimit.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";

const INVITE_DAYS = 30;

type Seat = {
  id: string;
  purchased_by_user_id: string | null;
  owner_user_id: string | null;
  status: string;
  invited_first_name: string | null;
  invited_last_name: string | null;
  invited_email: string | null;
  created_at: string;
};

function configuredBase() {
  return (Deno.env.get("APP_URL")?.trim() || "https://safetypreplist.com").replace(/\/+$/, "");
}

function appBase(req: Request) {
  const configured = configuredBase();
  const origin = req.headers.get("origin") || "";
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  try {
    if (origin && new URL(origin).host === new URL(configured).host) return origin;
  } catch {
    /* fall through */
  }
  return configured;
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function inviteEmail(opts: { firstName: string; inviterName: string; link: string }) {
  const first = escapeHtml(opts.firstName || "there");
  const inviter = escapeHtml(opts.inviterName);
  const link = escapeHtml(opts.link);
  const logo = escapeHtml(`${configuredBase()}/brand/logo.png`);
  const html = `
  <div style="background:#F4F0E5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1E2A1F;">
    <div style="max-width:560px;margin:0 auto;background:#FBF8F1;border:1px solid #E6E2D6;border-radius:14px;padding:32px;">
      <p style="margin:0 0 18px;text-align:center;">
        <img src="${logo}" width="64" height="79" alt="Safety Prep List" style="display:inline-block;width:64px;height:auto;border:0;">
      </p>
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#556B2F;font-weight:bold;">Safety Prep List</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;">${inviter} added you to their Family Plan</h1>
      <p style="font-size:16px;line-height:1.5;">Hi ${first},</p>
      <p style="font-size:16px;line-height:1.5;">${inviter} set up a personal Safety Prep Checklist for you. It’s already paid for. Create your account to start checking things off and keeping your own notes.</p>
      <p style="margin:28px 0;text-align:center;">
        <a href="${link}" style="display:inline-block;background:#C75A2B;color:#FBF8F1;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px;">Create my account</a>
      </p>
      <p style="font-size:13px;line-height:1.5;color:#4D5348;">This link is just for you and expires in ${INVITE_DAYS} days. If the button doesn’t work, copy this address into your browser:<br><span style="word-break:break-all;color:#556B2F;">${link}</span></p>
      <p style="margin-top:24px;font-size:12px;line-height:1.5;color:#6A6F63;">You’re getting this email because ${inviter} entered your address. If you weren’t expecting it, you can ignore it.</p>
    </div>
  </div>`;
  const text = `Hi ${opts.firstName || "there"},\n\n${opts.inviterName} set up a personal Safety Prep Checklist for you. It's already paid for. Create your account here:\n\n${opts.link}\n\nThis link is just for you and expires in ${INVITE_DAYS} days.`;
  return { html, text };
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user } = await requireUser(req);
    if (!user) return json({ error: "Sign in to manage your family plan." }, 401);
    const limited = await rateLimitBlock(`invite:${user.id}`, 8, 600);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      checklistId?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      permission?: string;
    };
    const action = body.action === "resend" || body.action === "cancel" ? body.action : "send";
    const permission = body.permission === "edit" || body.permission === "view" ? body.permission : null;
    const admin = serviceClient();

    const seatQuery = admin
      .from("personal_checklists")
      .select("id, purchased_by_user_id, owner_user_id, status, invited_first_name, invited_last_name, invited_email, created_at")
      .eq("purchased_by_user_id", user.id)
      .eq("status", "pending_claim")
      .is("owner_user_id", null);

    let seat: Seat | null = null;
    if (body.checklistId) {
      const { data } = await seatQuery.eq("id", body.checklistId).maybeSingle();
      seat = data as Seat | null;
    } else if (action === "send") {
      const { data } = await seatQuery.is("invited_email", null).order("created_at").limit(1).maybeSingle();
      seat = data as Seat | null;
    }
    if (!seat) {
      return json({ error: action === "send" ? "There’s no open family seat to fill. Add another checklist first." : "That invitation could not be found." }, 404);
    }

    if (action === "cancel") {
      await admin.from("checklist_invitations").update({ status: "cancelled" }).eq("checklist_id", seat.id).eq("status", "pending");
      await admin
        .from("personal_checklists")
        .update({ invited_first_name: null, invited_last_name: null, invited_email: null })
        .eq("id", seat.id);
      await admin.from("checklist_seat_grants").delete().eq("grantee_checklist_id", seat.id);
      await admin.from("checklist_seat_grants").delete().eq("checklist_id", seat.id);
      return json({ ok: true });
    }

    let firstName = seat.invited_first_name || "";
    let lastName = seat.invited_last_name || "";
    let email = seat.invited_email || "";

    if (action === "send") {
      firstName = String(body.firstName || "").trim().slice(0, 60);
      lastName = String(body.lastName || "").trim().slice(0, 60);
      email = normalizeEmail(body.email);
      if (!firstName) return json({ error: "Enter their first name." }, 400);
      if (!isValidEmail(email)) return json({ error: "Enter a valid email address." }, 400);
      if (email === normalizeEmail(user.email)) {
        return json({ error: "Use your family member’s email, not your own." }, 400);
      }

      const { data: dupes } = await admin
        .from("personal_checklists")
        .select("id")
        .eq("purchased_by_user_id", user.id)
        .eq("status", "pending_claim")
        .eq("invited_email", email)
        .neq("id", seat.id)
        .limit(1);
      if (dupes?.length) return json({ error: "You’ve already sent an invitation to that email." }, 400);

      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`))
        .limit(1)
        .maybeSingle();
      if (existing) {
        const { data: owned } = await admin
          .from("personal_checklists")
          .select("id")
          .eq("owner_user_id", (existing as { id: string }).id)
          .eq("status", "active")
          .limit(1);
        if (owned?.length) {
          return json({ error: "That email already has its own Safety Prep List checklist. Use a different email." }, 400);
        }
      }

      const { error: updateError } = await admin
        .from("personal_checklists")
        .update({ invited_first_name: firstName, invited_last_name: lastName || null, invited_email: email })
        .eq("id", seat.id);
      if (updateError) throw updateError;
      if (permission) {
        const { error: grantError } = await admin.rpc("save_family_grants", {
          p_user_id: user.id,
          p_grants: [{ checklistId: seat.id, permission }],
        });
        if (grantError) console.error("save_family_grants failed", grantError);
      }
    } else if (!email) {
      return json({ error: "Add an email for this seat first." }, 400);
    }

    const { data: member } = await admin
      .from("plan_group_members")
      .select("group_id")
      .eq("checklist_id", seat.id)
      .limit(1)
      .maybeSingle();

    await admin.from("checklist_invitations").update({ status: "cancelled" }).eq("checklist_id", seat.id).eq("status", "pending");

    const token = newToken();
    const { error: inviteError } = await admin.from("checklist_invitations").insert({
      group_id: (member as { group_id: string } | null)?.group_id ?? null,
      checklist_id: seat.id,
      invited_email: email,
      invited_name: [firstName, lastName].filter(Boolean).join(" ") || null,
      token_hash: await sha256Hex(token),
      invited_by_user_id: user.id,
      kind: "purchase",
      status: "pending",
      expires_at: new Date(Date.now() + INVITE_DAYS * 86400000).toISOString(),
    });
    if (inviteError) throw inviteError;

    const { data: inviter } = await admin
      .from("profiles")
      .select("first_name, last_name, display_name, full_name")
      .eq("id", user.id)
      .maybeSingle();
    const p = (inviter || {}) as Record<string, string | null>;
    const inviterName =
      [p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_name || p.full_name || "A family member";

    const link = `${appBase(req)}/join?invite=${encodeURIComponent(token)}`;
    const content = inviteEmail({ firstName, inviterName, link });
    const sent = await sendEmail({
      to: email,
      toName: [firstName, lastName].filter(Boolean).join(" ") || undefined,
      subject: `${inviterName} added you to their Safety Prep List Family Plan`,
      html: content.html,
      text: content.text,
    });

    return json({
      ok: true,
      checklistId: seat.id,
      email,
      firstName,
      emailSent: sent.ok,
      emailError: sent.ok ? undefined : sent.provider ? "The email service rejected the message." : "Email sending is not set up yet.",
      inviteUrl: link,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not send the invitation. Please try again." }, 500);
  }
});
