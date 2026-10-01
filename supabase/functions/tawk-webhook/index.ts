import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function signatureFor(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
}

function sameSignature(left: string, right: string) {
  if (!left || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("TAWK_WEBHOOK_SECRET");
  if (!secret) return json({ error: "Webhook is not configured" }, 500);

  const rawBody = await req.text();
  const received = req.headers.get("x-tawk-signature") || "";
  const expected = await signatureFor(rawBody, secret);
  if (!sameSignature(received.toLowerCase(), expected.toLowerCase())) {
    return json({ error: "Invalid webhook signature" }, 401);
  }

  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const event = String(payload.event || "");
    const chatId = text(payload.chatId);
    if (!chatId) return json({ error: "Missing chatId" }, 400);
    const admin = serviceClient();

    if (event === "chat:end") {
      const { error } = await admin.from("active_support_chats").delete().eq("chat_id", chatId);
      if (error) throw error;
      return json({ ok: true, event });
    }

    if (event !== "chat:start") return json({ ok: true, ignored: event });

    const visitor = (payload.visitor as Record<string, unknown> | undefined) || {};
    const property = (payload.property as Record<string, unknown> | undefined) || {};
    const message = (payload.message as Record<string, unknown> | undefined) || {};
    const { error } = await admin.from("active_support_chats").upsert({
      chat_id: chatId,
      property_id: text(property.id) || "6aa2dcbc8bbe9e343f3ea75a",
      property_name: text(property.name),
      visitor_name: text(visitor.name),
      visitor_email: text(visitor.email),
      visitor_city: text(visitor.city),
      visitor_country: text(visitor.country),
      domain: text(payload.domain),
      referrer: text(payload.referrer),
      first_message: text(message.text),
      started_at: String(payload.time || new Date().toISOString()),
      updated_at: new Date().toISOString(),
    }, { onConflict: "chat_id" });
    if (error) throw error;
    return json({ ok: true, event });
  } catch (error) {
    console.error("Tawk webhook error", error);
    return json({ error: "Could not record webhook" }, 500);
  }
});
