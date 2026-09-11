import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function handleSubscribe(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    send(res, 503, {
      error: "Add BREVO_API_KEY to .env.local (do not prefix it with VITE_) to collect emails locally.",
    });
    return;
  }

  const body = (await readJson(req).catch(() => ({}))) as {
    email?: string;
    name?: string;
    company?: string;
  };
  if (body.company) {
    send(res, 200, { ok: true });
    return;
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    send(res, 400, { error: "Please enter a valid email." });
    return;
  }

  const listRaw = process.env.BREVO_LIST_ID?.trim();
  const listId = listRaw ? Number(listRaw) : undefined;
  const name = String(body.name || "").trim();
  const attributes: Record<string, string> = {};
  if (name) attributes.FIRSTNAME = name.split(/\s+/)[0] || name;

  const payload: Record<string, unknown> = { email, updateEnabled: true };
  if (Object.keys(attributes).length) payload.attributes = attributes;
  if (listId && Number.isFinite(listId)) payload.listIds = [listId];

  const brevo = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (brevo.ok || brevo.status === 204) {
    send(res, 200, { ok: true });
    return;
  }
  const err = (await brevo.json().catch(() => ({}))) as { message?: string };
  if (brevo.status === 400 && /already exist/i.test(err.message || "")) {
    send(res, 200, { ok: true });
    return;
  }
  console.error("Brevo subscribe failed", brevo.status, err);
  send(res, 502, { error: "Could not join the list. Please try again." });
}

export function subscribeChecklistPlugin(): Plugin {
  return {
    name: "subscribe-checklist",
    configureServer(server) {
      server.middlewares.use("/api/subscribe-checklist", (req, res) => {
        void handleSubscribe(req, res);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/subscribe-checklist", (req, res) => {
        void handleSubscribe(req, res);
      });
    },
  };
}
