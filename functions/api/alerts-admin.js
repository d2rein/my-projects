import { json, requireSession } from "../_lib/site-auth.js";

export async function onRequestGet(context) {
  const auth = await requireSession(context);
  if (!auth.ok) return auth.response;
  const action = new URL(context.request.url).searchParams.get("action") || "devices";
  if (action === "devices") return proxy(context.env, "/api/admin/devices", "GET");
  if (action === "alerts") return proxy(context.env, "/api/admin/alerts", "GET");
  return json({ error: "Unknown action" }, 400);
}

export async function onRequestPost(context) {
  const auth = await requireSession(context);
  if (!auth.ok) return auth.response;
  const body = await context.request.json().catch(() => ({}));
  if (body.action === "createPairing") {
    return proxy(context.env, "/api/admin/pairings", "POST", {
      name: body.name,
      subscriptions: body.subscriptions,
    });
  }
  if (body.action === "sendTest") {
    return proxy(context.env, "/api/admin/test", "POST", {});
  }
  if (body.action === "updateDevice" && body.deviceId) {
    return proxy(context.env, `/api/admin/devices/${encodeURIComponent(body.deviceId)}`, "PUT", {
      name: body.name,
      enabled: body.enabled,
      subscriptions: body.subscriptions,
    });
  }
  if (body.action === "removeDevice" && body.deviceId) {
    return proxy(context.env, `/api/admin/devices/${encodeURIComponent(body.deviceId)}`, "DELETE");
  }
  return json({ error: "Unknown action" }, 400);
}

async function proxy(env, path, method, body) {
  const base = String(env.ALERT_BROKER_URL || "").replace(/\/$/, "");
  const key = String(env.ALERT_ADMIN_KEY || "");
  if (!base || !key) return json({ error: "Alert broker is not configured yet." }, 503);
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" },
  });
}
