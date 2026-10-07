import { json, preflight } from "../_shared/http.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";

const CONTEXTS = new Set(["checkout", "signup", "email_signup", "in_app_ack", "terms_update"]);

function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const context = String(body.context || "");
  const termsVersion = String(body.termsVersion || "");
  const privacyVersion = String(body.privacyVersion || "");
  const refundVersion = String(body.refundVersion || "");
  const email = String(body.email || "").trim().toLowerCase() || null;

  if (!CONTEXTS.has(context) || !termsVersion || !privacyVersion || !refundVersion) {
    return json({ error: "Agreement details are incomplete." }, 400);
  }

  const { user } = await requireUser(req);
  const admin = serviceClient();
  const { error } = await admin.from("terms_acceptances").insert({
    user_id: user?.id ?? null,
    email: email || user?.email || null,
    terms_version: termsVersion,
    privacy_version: privacyVersion,
    refund_version: refundVersion,
    ip_address: clientIp(req),
    user_agent: req.headers.get("user-agent"),
    context,
  });
  if (error) {
    console.error(error);
    return json({ error: "Could not record agreement." }, 500);
  }
  return json({ ok: true });
});
