import { buildSessionCookie, createSession, getOwnerPasswordHash, getOwnerUsername, getStore, isAuthConfigured, json, sha256 } from "../../_lib/site-auth.js";

export async function onRequestPost(context) {
  const store = getStore(context.env);
  if (!store) {
    return json({ error: "Cloud storage binding is not configured." }, 500);
  }
  if (!isAuthConfigured(context.env)) {
    return json({ error: "Site login is not configured yet." }, 503);
  }

  const body = await context.request.json().catch(() => null);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  const expectedUsername = getOwnerUsername(context.env);
  const expectedPasswordHash = getOwnerPasswordHash(context.env);

  if (!username || !password) {
    return json({ error: "Username and password are required." }, 400);
  }

  const providedPasswordHash = await sha256(password);
  if (username !== expectedUsername || providedPasswordHash !== expectedPasswordHash) {
    return json({ error: "Incorrect username or password." }, 403);
  }

  const session = await createSession(store, username);
  return json({ ok: true, username }, 200, {
    "Set-Cookie": buildSessionCookie(session.sessionId)
  });
}
