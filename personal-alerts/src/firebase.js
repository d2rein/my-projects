let cachedToken = null;
let cachedUntil = 0;

export async function sendFirebaseMessage(env, token, data, options = {}) {
  const accessToken = await firebaseAccessToken(env);
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value ?? "")])),
          android: {
            priority: options.priority === "high" ? "HIGH" : "NORMAL",
            ttl: options.ttl || "86400s",
            collapse_key: options.collapseKey || undefined,
          },
        },
      }),
    },
  );
  if (response.ok) return { ok: true };
  const detail = await response.text();
  const stale = response.status === 404 || response.status === 410 || detail.includes("UNREGISTERED");
  return { ok: false, stale, status: response.status, error: detail.slice(0, 800) };
}

async function firebaseAccessToken(env) {
  if (cachedToken && Date.now() < cachedUntil - 60_000) return cachedToken;
  for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]) {
    if (!env[key]) throw new Error(`${key} is not configured`);
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: env.FIREBASE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    env.FIREBASE_PRIVATE_KEY,
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(`Firebase OAuth failed: ${JSON.stringify(payload).slice(0, 500)}`);
  cachedToken = payload.access_token;
  cachedUntil = Date.now() + (Number(payload.expires_in) || 3600) * 1000;
  return cachedToken;
}

async function signJwt(header, claims, pem) {
  const encodedHeader = base64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedClaims = base64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuffer(String(pem).replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

function pemToBuffer(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, character => character.charCodeAt(0)).buffer;
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
