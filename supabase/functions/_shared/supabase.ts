import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service credentials missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function userClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new Error("Supabase anon credentials missing");
  const auth = req.headers.get("Authorization") ?? "";
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

export async function requireUser(req: Request) {
  const supabase = userClient(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { user: null, supabase };
  return { user: data.user, supabase };
}

export async function productBySlug(slug: string) {
  const admin = serviceClient();
  const { data, error } = await admin
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data as {
    slug: string;
    name: string;
    amount_cents: number;
    currency: string;
    kind: string;
    grants_plan: string | null;
    device_slots: number;
  } | null;
}

export async function sendPurchaseEmail(opts: {
  to: string;
  planName: string;
  productCode: string;
  deviceAllowance: string;
}) {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") || "Safety Prep List <noreply@example.com>";
  const appUrl = Deno.env.get("APP_URL") || "https://example.com";
  const support = Deno.env.get("SUPPORT_EMAIL") || "support@example.com";
  if (!key || !opts.to) return { skipped: true };

  const html = `
  <div style="background:#F4F0E5;padding:32px 16px;font-family:Georgia,serif;color:#1E2A1F;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E6E2D6;padding:32px;">
      <h1 style="font-family:Arial,sans-serif;font-size:28px;margin:0 0 16px;">Safety Prep List</h1>
      <p>Thank you for your purchase.</p>
      <p><strong>Plan purchased:</strong> ${opts.planName}</p>
      <p><strong>Product ID:</strong> ${opts.productCode}</p>
      <p><strong>Login:</strong> <a href="${appUrl}/signin">${appUrl}/signin</a></p>
      <p>Create your account with the same email if you have not already. Your Product ID is already linked to this purchase — you should not need to re-enter it.</p>
      <p><strong>Device allowance:</strong> ${opts.deviceAllowance}</p>
      <p>Open Safety Prep List, check off what you have, and keep short notes as you pack. Your progress syncs across registered household devices.</p>
      <p style="margin-top:28px;font-size:13px;color:#556B2F;">Support: ${support}</p>
    </div>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: "Your Safety Prep List Product ID",
      html,
    }),
  });
  return { skipped: false, ok: res.ok, status: res.status };
}
