import { json, preflight } from "../_shared/http.ts";
import { addBrevoContact, isValidEmail, normalizeEmail } from "../_shared/brevo.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("BREVO_API_KEY")?.trim();
  if (!apiKey) return json({ error: "Email signup is not connected yet." }, 503);

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    company?: string;
  };

  if (body.company) return json({ ok: true });

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return json({ error: "Please enter a valid email." }, 400);

  const listRaw = Deno.env.get("BREVO_LIST_ID")?.trim();
  const listId = listRaw ? Number(listRaw) : undefined;

  try {
    await addBrevoContact({
      email,
      name: String(body.name || "").trim(),
      apiKey,
      listId,
    });
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not join the list. Please try again." }, 502);
  }
});
