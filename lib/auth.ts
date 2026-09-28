/**
 * One shared password for the founder (DASHBOARD_PASSWORD). The cookie holds an HMAC of a fixed
 * string keyed by the password, so it can be checked in middleware without a session table.
 * If DASHBOARD_PASSWORD is unset (local dev), the dashboard is open.
 */

export const AUTH_COOKIE = "kargo_session";

export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("kargo-hiring-dashboard:v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Calendar apps can't log in, so the feed URL carries its own token, derived from the dashboard
 * password (changing the password revokes old feed links). Without a password the feed is open.
 */
export async function calendarToken(): Promise<string | null> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return null;
  return (await sessionToken(`${password}:calendar-feed`)).slice(0, 32);
}
