import { buildSessionCookie, clearSessionCookie, getOwnerUsername, getStore, isAuthConfigured, json, readSession } from "../../_lib/site-auth.js";

export async function onRequestGet(context) {
  const store = getStore(context.env);
  if (!store) {
    return json({ loggedIn: false, configured: false, error: "Cloud storage binding is not configured." }, 500);
  }

  if (!isAuthConfigured(context.env)) {
    return json({ loggedIn: false, configured: false, username: getOwnerUsername(context.env) });
  }

  const session = await readSession(store, context.request);
  if (!session) {
    return json({ loggedIn: false, configured: true, username: getOwnerUsername(context.env) }, 401, {
      "Set-Cookie": clearSessionCookie()
    });
  }

  return json({ loggedIn: true, configured: true, username: session.username }, 200, {
    "Set-Cookie": buildSessionCookie(session.sessionId)
  });
}
