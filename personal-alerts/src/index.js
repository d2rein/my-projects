import { CATEGORIES, normalizeAlert, normalizeSubscriptions } from "./schema.js";
import { sendFirebaseMessage } from "./firebase.js";
import { runPogoMonitor } from "./pogo.js";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (path === "/health" && request.method === "GET") return health(env);
      if (path === "/pair" && request.method === "GET") return pairingLanding(url);
      if (path === "/api/devices/claim" && request.method === "POST") return claimDevice(request, env);
      if (path === "/api/devices/token" && request.method === "PUT") return updateDeviceToken(request, env);
      if (path === "/api/devices/config" && request.method === "GET") return deviceConfig(request, env);
      if (path === "/api/devices/config" && request.method === "PUT") return updateOwnSubscriptions(request, env);
      if (path === "/api/devices/ack" && request.method === "POST") return acknowledge(request, env);
      if (path === "/api/devices/active" && request.method === "GET") return activeAlerts(request, env);
      if (path === "/api/admin/pairings" && request.method === "POST") return createPairing(request, env);
      if (path === "/api/admin/devices" && request.method === "GET") return listDevices(request, env);
      if (path === "/api/admin/alerts" && request.method === "GET") return listAlerts(request, env);
      if (path === "/api/admin/test" && request.method === "POST") return sendTestAlert(request, env, ctx);
      const deviceMatch = path.match(/^\/api\/admin\/devices\/([^/]+)$/);
      if (deviceMatch && request.method === "PUT") return updateAdminDevice(request, env, decodeURIComponent(deviceMatch[1]));
      if (deviceMatch && request.method === "DELETE") return removeDevice(request, env, decodeURIComponent(deviceMatch[1]));
      if (path === "/api/alerts" && request.method === "POST") return publishAlert(request, env, ctx);
      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: error.message || error.constructor?.name || "Internal error" }, error.status || 500);
    }
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil((async () => {
      await runMaintenance(env);
      await runPogoMonitor(env, body => storeAlert(normalizeAlert(body, "pogo"), env, ctx));
    })());
  },
};

async function health(env) {
  const row = await env.ALERTS_DB.prepare("SELECT COUNT(*) AS count FROM devices WHERE enabled=1").first();
  return json({ ok: true, enabledDevices: Number(row?.count || 0), now: new Date().toISOString() });
}

async function createPairing(request, env) {
  requireAdmin(request, env);
  const body = await request.json().catch(() => ({}));
  const token = randomSecret();
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const id = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 60_000);
  const subscriptions = normalizeSubscriptions(body.subscriptions || Object.fromEntries(CATEGORIES.map(value => [value, true])));
  await env.ALERTS_DB.prepare(`INSERT INTO pairings
    (id,token_hash,code_hash,suggested_name,subscriptions_json,created_at,expires_at)
    VALUES (?,?,?,?,?,?,?)`).bind(
      id, await sha256(token), await sha256(code), String(body.name || "").slice(0, 80),
      JSON.stringify(subscriptions), now.toISOString(), expires.toISOString(),
    ).run();
  const base = String(env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
  return json({ id, token, code, expiresAt: expires.toISOString(), pairingUrl: `${base}/pair?token=${encodeURIComponent(token)}` });
}

async function claimDevice(request, env) {
  const body = await request.json();
  const token = String(body.token || "").trim();
  const code = String(body.code || "").trim();
  const fcmToken = String(body.fcmToken || "").trim();
  if (!fcmToken || (!token && !/^\d{6}$/.test(code))) return json({ error: "Pairing token/code and Firebase token are required" }, 400);
  const hash = await sha256(token || code);
  const column = token ? "token_hash" : "code_hash";
  const pairing = await env.ALERTS_DB.prepare(`SELECT * FROM pairings WHERE ${column}=? AND consumed_at IS NULL AND expires_at>?`)
    .bind(hash, new Date().toISOString()).first();
  if (!pairing) return json({ error: "Pairing code is invalid or expired" }, 401);
  const existingDevice = await env.ALERTS_DB.prepare("SELECT id FROM devices WHERE fcm_token=?").bind(fcmToken).first();
  const deviceId = existingDevice?.id || crypto.randomUUID();
  const secret = randomSecret();
  const now = new Date().toISOString();
  const name = String(body.name || pairing.suggested_name || "Android phone").trim().slice(0, 80);
  const subscriptions = normalizeSubscriptions(JSON.parse(pairing.subscriptions_json || "{}"));
  const statements = [
    env.ALERTS_DB.prepare(`INSERT INTO devices
      (id,name,fcm_token,auth_hash,enabled,app_version,created_at,last_seen_at)
      VALUES (?,?,?,?,1,?,?,?) ON CONFLICT(fcm_token) DO UPDATE SET
      name=excluded.name,auth_hash=excluded.auth_hash,enabled=1,app_version=excluded.app_version,last_seen_at=excluded.last_seen_at`)
      .bind(deviceId, name, fcmToken, await sha256(secret), String(body.appVersion || "").slice(0, 30), now, now),
    env.ALERTS_DB.prepare("UPDATE pairings SET consumed_at=? WHERE id=?").bind(now, pairing.id),
  ];
  for (const [category, enabled] of Object.entries(subscriptions)) {
    statements.push(env.ALERTS_DB.prepare(`INSERT INTO device_subscriptions(device_id,category,enabled)
      VALUES (?,?,?) ON CONFLICT(device_id,category) DO UPDATE SET enabled=excluded.enabled`)
      .bind(deviceId, category, enabled ? 1 : 0));
  }
  await env.ALERTS_DB.batch(statements);
  return json({ ok: true, deviceId, deviceSecret: secret, name, subscriptions });
}

async function updateDeviceToken(request, env) {
  const device = await requireDevice(request, env);
  const body = await request.json();
  const token = String(body.fcmToken || "").trim();
  if (!token) return json({ error: "fcmToken is required" }, 400);
  await env.ALERTS_DB.prepare("UPDATE devices SET fcm_token=?,app_version=?,last_seen_at=?,last_error=NULL WHERE id=?")
    .bind(token, String(body.appVersion || "").slice(0, 30), new Date().toISOString(), device.id).run();
  return json({ ok: true });
}

async function deviceConfig(request, env) {
  const device = await requireDevice(request, env);
  return json(await hydratedDevice(env, device));
}

async function updateOwnSubscriptions(request, env) {
  const device = await requireDevice(request, env);
  const body = await request.json();
  await saveSubscriptions(env, device.id, body.subscriptions);
  return json(await hydratedDevice(env, device));
}

async function acknowledge(request, env) {
  const device = await requireDevice(request, env);
  const body = await request.json();
  const alertId = String(body.alertId || "").slice(0, 180);
  const action = String(body.action || "dismiss").slice(0, 30);
  if (!alertId) return json({ error: "alertId is required" }, 400);
  await env.ALERTS_DB.prepare(`INSERT INTO acknowledgements(alert_id,device_id,action,acknowledged_at)
    VALUES (?,?,?,?) ON CONFLICT(alert_id,device_id,action) DO UPDATE SET acknowledged_at=excluded.acknowledged_at`)
    .bind(alertId, device.id, action, new Date().toISOString()).run();
  return json({ ok: true });
}

async function activeAlerts(request, env) {
  const device = await requireDevice(request, env);
  const { results } = await env.ALERTS_DB.prepare(`SELECT a.* FROM alerts a
    JOIN device_subscriptions s ON s.category=a.category AND s.device_id=? AND s.enabled=1
    LEFT JOIN acknowledgements k ON k.alert_id=a.id AND k.device_id=? AND k.action='dismiss'
    WHERE a.state='active' AND (a.expires_at IS NULL OR a.expires_at>?)
      AND (k.acknowledged_at IS NULL OR k.acknowledged_at<a.updated_at)
    ORDER BY a.updated_at DESC LIMIT 100`)
    .bind(device.id, device.id, new Date().toISOString()).all();
  return json({ alerts: (results || []).map(publicAlert) });
}

async function listDevices(request, env) {
  requireAdmin(request, env);
  const { results } = await env.ALERTS_DB.prepare("SELECT * FROM devices ORDER BY created_at").all();
  const devices = [];
  for (const row of results || []) devices.push(await hydratedDevice(env, row));
  return json({ devices, categories: CATEGORIES });
}

async function updateAdminDevice(request, env, deviceId) {
  requireAdmin(request, env);
  const body = await request.json();
  await env.ALERTS_DB.prepare("UPDATE devices SET name=COALESCE(?,name),enabled=COALESCE(?,enabled) WHERE id=?")
    .bind(body.name == null ? null : String(body.name).slice(0, 80), body.enabled == null ? null : (body.enabled ? 1 : 0), deviceId).run();
  if (body.subscriptions) await saveSubscriptions(env, deviceId, body.subscriptions);
  const row = await env.ALERTS_DB.prepare("SELECT * FROM devices WHERE id=?").bind(deviceId).first();
  return row ? json(await hydratedDevice(env, row)) : json({ error: "Device not found" }, 404);
}

async function removeDevice(request, env, deviceId) {
  requireAdmin(request, env);
  await env.ALERTS_DB.prepare("DELETE FROM devices WHERE id=?").bind(deviceId).run();
  return json({ ok: true });
}

async function listAlerts(request, env) {
  requireAdmin(request, env);
  const { results } = await env.ALERTS_DB.prepare("SELECT * FROM alerts ORDER BY updated_at DESC LIMIT 100").all();
  return json({ alerts: (results || []).map(publicAlert) });
}

async function sendTestAlert(request, env, ctx) {
  requireAdmin(request, env);
  const now = new Date();
  const result = await storeAlert(normalizeAlert({
    id: `system:test:${crypto.randomUUID()}`,
    category: "system",
    action: "upsert",
    title: "Drein Alerts test",
    body: "This phone is connected to the private alert broker.",
    priority: "normal",
    sticky: false,
    expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
    data: { sentAt: now.toISOString() },
  }, "admin"), env, ctx);
  return json(result, 202);
}

async function publishAlert(request, env, ctx) {
  const source = requireProducer(request, env);
  let alert;
  try {
    alert = normalizeAlert(await request.json(), source);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  try {
    const result = await storeAlert(alert, env, ctx);
    return json(result, 202);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    throw error;
  }
}

async function storeAlert(alert, env, ctx) {
  const previous = await env.ALERTS_DB.prepare("SELECT * FROM alerts WHERE id=?").bind(alert.id).first();
  if (previous && previous.source !== alert.source) throw new HttpError(409, "Alert ID belongs to another source");
  const revision = Number(previous?.revision || 0) + 1;
  const now = new Date().toISOString();
  const state = alert.action === "resolve" ? "resolved" : "active";
  await env.ALERTS_DB.prepare(`INSERT INTO alerts
    (id,source,category,title,body,url,priority,sticky,revision,state,expires_at,payload_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
    category=excluded.category,title=excluded.title,body=excluded.body,url=excluded.url,
    priority=excluded.priority,sticky=excluded.sticky,revision=excluded.revision,state=excluded.state,
    expires_at=excluded.expires_at,payload_json=excluded.payload_json,updated_at=excluded.updated_at`)
    .bind(alert.id, alert.source, alert.category, alert.title, alert.body, alert.url, alert.priority,
      alert.sticky ? 1 : 0, revision, state, alert.expiresAt, JSON.stringify(alert.data), previous?.created_at || now, now).run();
  const { results: devices } = await env.ALERTS_DB.prepare(`SELECT d.id FROM devices d
    JOIN device_subscriptions s ON s.device_id=d.id AND s.category=? AND s.enabled=1
    WHERE d.enabled=1`).bind(alert.category).all();
  const statements = (devices || []).map(device => env.ALERTS_DB.prepare(`INSERT OR IGNORE INTO deliveries
    (alert_id,device_id,revision,action,status,attempts,next_attempt_at) VALUES (?,?,?,?,'pending',0,?)`)
    .bind(alert.id, device.id, revision, alert.action, now));
  if (statements.length) await env.ALERTS_DB.batch(statements);
  ctx.waitUntil(dispatchDue(env));
  return { ok: true, alertId: alert.id, revision, action: alert.action, targetedDevices: statements.length };
}

async function runMaintenance(env) {
  const now = new Date().toISOString();
  const { results: expired } = await env.ALERTS_DB.prepare(
    "SELECT * FROM alerts WHERE state='active' AND expires_at IS NOT NULL AND expires_at<=? LIMIT 100",
  ).bind(now).all();
  for (const alert of expired || []) {
    const revision = Number(alert.revision) + 1;
    await env.ALERTS_DB.prepare("UPDATE alerts SET state='resolved',revision=?,updated_at=? WHERE id=?")
      .bind(revision, now, alert.id).run();
    const { results: devices } = await env.ALERTS_DB.prepare(`SELECT d.id FROM devices d
      JOIN device_subscriptions s ON s.device_id=d.id AND s.category=? AND s.enabled=1 WHERE d.enabled=1`)
      .bind(alert.category).all();
    const statements = (devices || []).map(device => env.ALERTS_DB.prepare(`INSERT OR IGNORE INTO deliveries
      (alert_id,device_id,revision,action,status,attempts,next_attempt_at) VALUES (?,?,?,'resolve','pending',0,?)`)
      .bind(alert.id, device.id, revision, now));
    if (statements.length) await env.ALERTS_DB.batch(statements);
  }
  await env.ALERTS_DB.prepare("DELETE FROM pairings WHERE expires_at<?").bind(new Date(Date.now() - 86_400_000).toISOString()).run();
  await dispatchDue(env);
}

async function dispatchDue(env) {
  const { results } = await env.ALERTS_DB.prepare(`SELECT x.*,d.fcm_token,a.category,a.title,a.body,a.url,a.priority,a.sticky,a.expires_at,a.payload_json
    FROM deliveries x JOIN devices d ON d.id=x.device_id JOIN alerts a ON a.id=x.alert_id
    WHERE d.enabled=1 AND x.status IN ('pending','retry') AND x.next_attempt_at<=?
    ORDER BY x.id LIMIT 50`).bind(new Date().toISOString()).all();
  for (const row of results || []) {
    let result;
    try {
      result = await sendFirebaseMessage(env, row.fcm_token, {
        kind: "personal-alert",
        action: row.action,
        alertId: row.alert_id,
        revision: row.revision,
        category: row.category,
        title: row.title,
        body: row.body,
        url: row.url,
        sticky: row.sticky ? "true" : "false",
        expiresAt: row.expires_at || "",
        data: row.payload_json || "{}",
      }, {
        priority: row.priority,
        collapseKey: `alert-${row.alert_id}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
        ttl: "86400s",
      });
    } catch (error) {
      result = { ok: false, stale: false, error: error.message || error.constructor?.name };
    }
    if (result.ok) {
      await env.ALERTS_DB.prepare("UPDATE deliveries SET status='sent',attempts=attempts+1,sent_at=?,last_error=NULL WHERE id=?")
        .bind(new Date().toISOString(), row.id).run();
    } else if (result.stale) {
      await env.ALERTS_DB.batch([
        env.ALERTS_DB.prepare("UPDATE deliveries SET status='failed',attempts=attempts+1,last_error=? WHERE id=?").bind(result.error || "Stale token", row.id),
        env.ALERTS_DB.prepare("UPDATE devices SET enabled=0,last_error='Firebase token is stale' WHERE id=?").bind(row.device_id),
      ]);
    } else {
      const attempts = Number(row.attempts || 0) + 1;
      const delayMinutes = Math.min(360, 2 ** Math.min(attempts, 8));
      const next = new Date(Date.now() + delayMinutes * 60_000).toISOString();
      await env.ALERTS_DB.prepare("UPDATE deliveries SET status='retry',attempts=?,next_attempt_at=?,last_error=? WHERE id=?")
        .bind(attempts, next, String(result.error || `FCM HTTP ${result.status || "error"}`).slice(0, 800), row.id).run();
    }
  }
}

async function requireDevice(request, env) {
  const deviceId = request.headers.get("X-Device-ID") || "";
  const secret = bearer(request);
  if (!deviceId || !secret) throw new HttpError(401, "Device credentials required");
  const row = await env.ALERTS_DB.prepare("SELECT * FROM devices WHERE id=? AND enabled=1").bind(deviceId).first();
  if (!row || row.auth_hash !== await sha256(secret)) throw new HttpError(401, "Invalid device credentials");
  await env.ALERTS_DB.prepare("UPDATE devices SET last_seen_at=? WHERE id=?").bind(new Date().toISOString(), row.id).run();
  return row;
}

function requireAdmin(request, env) {
  if (!env.ALERT_ADMIN_KEY || bearer(request) !== env.ALERT_ADMIN_KEY) throw new HttpError(401, "Admin credentials required");
}

function requireProducer(request, env) {
  let keys = {};
  try { keys = JSON.parse(env.ALERT_PRODUCER_KEYS || "{}"); } catch { throw new HttpError(500, "Producer keys are misconfigured"); }
  const supplied = bearer(request);
  const match = Object.entries(keys).find(([, key]) => key && key === supplied);
  if (!match) throw new HttpError(401, "Producer credentials required");
  return match[0];
}

async function hydratedDevice(env, row) {
  const { results } = await env.ALERTS_DB.prepare("SELECT category,enabled FROM device_subscriptions WHERE device_id=?")
    .bind(row.id).all();
  const subscriptions = normalizeSubscriptions(Object.fromEntries((results || []).map(value => [value.category, Boolean(value.enabled)])));
  return { id: row.id, name: row.name, enabled: Boolean(row.enabled), appVersion: row.app_version,
    createdAt: row.created_at, lastSeenAt: row.last_seen_at, lastError: row.last_error, subscriptions };
}

async function saveSubscriptions(env, deviceId, input) {
  const subscriptions = normalizeSubscriptions(input);
  await env.ALERTS_DB.batch(Object.entries(subscriptions).map(([category, enabled]) =>
    env.ALERTS_DB.prepare(`INSERT INTO device_subscriptions(device_id,category,enabled) VALUES (?,?,?)
      ON CONFLICT(device_id,category) DO UPDATE SET enabled=excluded.enabled`).bind(deviceId, category, enabled ? 1 : 0)));
}

function publicAlert(row) {
  return { id: row.id, source: row.source, category: row.category, title: row.title, body: row.body,
    url: row.url, priority: row.priority, sticky: Boolean(row.sticky), revision: row.revision,
    state: row.state, expiresAt: row.expires_at, createdAt: row.created_at, updatedAt: row.updated_at,
    data: safeJson(row.payload_json) };
}

function pairingLanding(url) {
  const token = url.searchParams.get("token") || "";
  const deepLink = `dreinalerts://pair?token=${encodeURIComponent(token)}`;
  const html = `<!doctype html><meta name="viewport" content="width=device-width"><title>Pair Drein Alerts</title>
  <style>body{font:16px system-ui;background:#111827;color:#f9fafb;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:32rem;padding:2rem;background:#1f2937;border-radius:1rem}a{display:inline-block;padding:.8rem 1rem;background:#2563eb;color:white;border-radius:.6rem;text-decoration:none}</style>
  <main class="card"><h1>Pair this phone</h1><p>Open the installed Drein Alerts app to finish pairing.</p><a href="${escapeHtml(deepLink)}">Open Drein Alerts</a></main>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function bearer(request) {
  const value = request.headers.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function safeJson(value) { try { return JSON.parse(value || "{}"); } catch { return {}; } }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }
function corsHeaders() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Device-ID", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" }; }
function json(payload, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...JSON_HEADERS, ...corsHeaders() } }); }
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
