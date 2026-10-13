export type TicketDepartment = "sales" | "support";

type Department = { department_id?: string; id?: string; name?: string };

const DEFAULT_URL = "https://safetypreplist.ladesk.com";
let departmentCache: Department[] | null = null;

function settings() {
  return {
    apiKey: Deno.env.get("LIVEAGENT_API_KEY")?.trim() || "",
    baseUrl: (Deno.env.get("LIVEAGENT_URL")?.trim() || DEFAULT_URL).replace(/\/+$/, ""),
    mailbox: Deno.env.get("LIVEAGENT_MAILBOX")?.trim() || "",
    sales: Deno.env.get("LIVEAGENT_SALES_DEPARTMENT_ID")?.trim() || "",
    support: Deno.env.get("LIVEAGENT_SUPPORT_DEPARTMENT_ID")?.trim() || "",
  };
}

export function liveAgentConfigured() {
  const { apiKey, mailbox } = settings();
  return Boolean(apiKey && mailbox);
}

async function request(path: string, init: RequestInit = {}) {
  const { apiKey, baseUrl } = settings();
  return await fetch(`${baseUrl}/api/v3${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function departments() {
  if (departmentCache) return departmentCache;
  const res = await request("/departments");
  if (!res.ok) throw new Error(`LiveAgent departments ${res.status}`);
  departmentCache = (await res.json()) as Department[];
  return departmentCache;
}

/**
 * Uses the configured department ID, or finds a department whose name mentions sales/support.
 * Falls back to LiveAgent's built-in "default" department, since every ticket needs one.
 */
async function departmentId(kind: TicketDepartment) {
  const configured = settings();
  if (configured[kind]) return configured[kind];
  try {
    const list = await departments();
    const idOf = (dept?: Department) => dept?.department_id || dept?.id || "";
    const match = list.find((dept) => (dept.name || "").toLowerCase().includes(kind));
    return idOf(match) || "default";
  } catch {
    return "default";
  }
}

export async function createLiveAgentTicket(ticket: {
  email: string;
  name?: string;
  subject: string;
  message: string;
  department: TicketDepartment;
}): Promise<{ ok: true; code: string | null } | { ok: false; error: string }> {
  if (!liveAgentConfigured()) return { ok: false, error: "LiveAgent is not configured" };
  try {
    const departmentid = await departmentId(ticket.department);
    const res = await request("/tickets", {
      method: "POST",
      body: JSON.stringify({
        useridentifier: ticket.email,
        recipient: settings().mailbox,
        departmentid,
        subject: ticket.subject.slice(0, 250),
        message: ticket.message,
        status: "N",
      }),
    });
    const payload = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (!res.ok) {
      console.error("LiveAgent ticket failed", res.status, payload);
      return { ok: false, error: payload?.message || `LiveAgent returned ${res.status}` };
    }
    return { ok: true, code: payload?.code ?? null };
  } catch (error) {
    console.error("LiveAgent ticket error", error);
    return { ok: false, error: error instanceof Error ? error.message : "LiveAgent request failed" };
  }
}
