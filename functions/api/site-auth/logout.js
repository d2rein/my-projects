import { clearSessionCookie, destroySession, getStore, json } from "../../_lib/site-auth.js";

export async function onRequestPost(context) {
  const store = getStore(context.env);
  if (store) {
    await destroySession(store, context.request);
  }
  return json({ ok: true }, 200, {
    "Set-Cookie": clearSessionCookie()
  });
}
