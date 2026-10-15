// The welcome celebration is for a brand-new account, once. Two markers per user id:
//  - "new":  set the moment the account is created in this browser
//  - "done": set when the celebration has played, so refreshes and later logins never repeat it
const NEW_KEY = "spl.welcome.new.v1.";
const DONE_KEY = "spl.welcome.burst.v1.";
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage can be blocked; the celebration then simply does not repeat-guard. */
  }
}

export function markNewAccount(userId?: string | null) {
  if (userId) write(NEW_KEY + userId, "1");
}

/** True only for an account created in this browser (or within the last day) whose celebration has not played yet. */
export function shouldCelebrate(userId?: string | null, createdAt?: string | null) {
  if (!userId) return false;
  if (read(DONE_KEY + userId)) return false;
  if (read(NEW_KEY + userId) === "1") return true;
  const created = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(created) && Date.now() - created < FRESH_WINDOW_MS;
}

export function markCelebrated(userId?: string | null) {
  if (userId) write(DONE_KEY + userId, "1");
}
