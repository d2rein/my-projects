const SESSION_COOKIE = "my_projects_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const STATE_KEY = "site-account-state:owner";

export function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

export function getStore(env) {
  return env?.POGO_TRACKER_KV || null;
}

export function getOwnerUsername(env) {
  return String(env?.SITE_OWNER_USERNAME || "owner").trim();
}

export function getOwnerPasswordHash(env) {
  return String(env?.SITE_OWNER_PASSWORD_HASH || "").trim().toLowerCase();
}

export function isAuthConfigured(env) {
  return !!getStore(env) && !!getOwnerPasswordHash(env);
}

export async function sha256(text) {
  const data = new TextEncoder().encode(String(text || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function readCookie(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function buildSessionCookie(sessionId, maxAge = SESSION_TTL_SECONDS) {
  const segments = [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Number(maxAge) || 0)}`
  ];
  return segments.join("; ");
}

export function clearSessionCookie() {
  return buildSessionCookie("", 0);
}

export async function createSession(store, username) {
  const sessionId = crypto.randomUUID();
  const record = {
    sessionId,
    username,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };
  await store.put(sessionKey(sessionId), JSON.stringify(record), {
    expirationTtl: SESSION_TTL_SECONDS
  });
  return record;
}

export async function readSession(store, request) {
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (!sessionId) return null;
  const raw = await store.get(sessionKey(sessionId));
  if (!raw) return null;
  const record = JSON.parse(raw);
  record.lastSeenAt = new Date().toISOString();
  await store.put(sessionKey(sessionId), JSON.stringify(record), {
    expirationTtl: SESSION_TTL_SECONDS
  });
  return record;
}

export async function destroySession(store, request) {
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (!sessionId) return;
  await store.delete(sessionKey(sessionId));
}

export async function requireSession(context) {
  const store = getStore(context.env);
  if (!store) {
    return { ok: false, response: json({ error: "Cloud storage binding is not configured." }, 500) };
  }
  if (!isAuthConfigured(context.env)) {
    return { ok: false, response: json({ error: "Site login is not configured yet." }, 503) };
  }
  const session = await readSession(store, context.request);
  if (!session) {
    return { ok: false, response: json({ error: "Not signed in." }, 401) };
  }
  return { ok: true, store, session };
}

export function getStateKey() {
  return STATE_KEY;
}

function sessionKey(sessionId) {
  return `site-auth-session:${sessionId}`;
}
