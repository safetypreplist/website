const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return EMAIL_RE.test(value);
}

export async function addBrevoContact(opts: {
  email: string;
  name?: string;
  apiKey: string;
  listId?: number;
}) {
  const attributes: Record<string, string> = {};
  const name = opts.name?.trim();
  if (name) attributes.FIRSTNAME = name.split(/\s+/)[0] || name;

  const payload: Record<string, unknown> = {
    email: opts.email,
    updateEnabled: true,
  };
  if (Object.keys(attributes).length) payload.attributes = attributes;
  if (opts.listId && Number.isFinite(opts.listId)) payload.listIds = [opts.listId];

  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": opts.apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (res.ok || res.status === 204) return;

  const err = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
  if (res.status === 400 && /already exist/i.test(err.message || "")) return;
  throw new Error(err.message || "Could not add this email to the list.");
}
