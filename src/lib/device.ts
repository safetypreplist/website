const STORAGE_KEY = "spl.device.token.v1";

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateDeviceToken() {
  let token = localStorage.getItem(STORAGE_KEY);
  if (!token) {
    token = randomToken();
    localStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}

export async function hashDeviceToken(token: string) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function guessDeviceDescription() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua) && /Mobile/.test(ua)) return "Android phone";
  if (/Android/.test(ua)) return "Android tablet";
  if (/Mac OS X/.test(ua) && !/Mobile/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux computer";
  return "Browser";
}

export function suggestedNickname() {
  const desc = guessDeviceDescription();
  return desc.includes("phone") || desc === "iPhone" ? "My Phone" : `My ${desc}`;
}
