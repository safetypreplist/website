import { json } from "./http.ts";
import { serviceClient } from "./supabase.ts";

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

/** Returns a 429 response when the key is over the limit, or null to continue. Database errors fail open. */
export async function rateLimitBlock(key: string, limit: number, windowSeconds: number): Promise<Response | null> {
  try {
    const { data, error } = await serviceClient().rpc("hit_rate_limit", {
      p_key: key.slice(0, 200),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("Rate limit check failed", error);
      return null;
    }
    if (data === true) return null;
    return json({ error: "Please wait a moment and try again." }, 429);
  } catch (err) {
    console.error("Rate limit check failed", err);
    return null;
  }
}
