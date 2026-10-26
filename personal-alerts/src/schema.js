export const CATEGORIES = ["garage", "nrl", "nrlw", "pogo", "system"];

export function normalizeSubscriptions(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(CATEGORIES.map(category => [category, Boolean(source[category])]));
}

export function normalizeAlert(input, source) {
  if (!input || typeof input !== "object") throw new Error("Alert body is required");
  const id = clean(input.id, 180);
  const category = clean(input.category, 30).toLowerCase();
  const title = clean(input.title, 160);
  const body = clean(input.body, 500);
  if (!id || !category || !title) throw new Error("id, category and title are required");
  if (!CATEGORIES.includes(category)) throw new Error(`Unsupported category: ${category}`);
  const action = String(input.action || "upsert").toLowerCase();
  if (!new Set(["upsert", "resolve"]).has(action)) throw new Error("action must be upsert or resolve");
  const priority = String(input.priority || "normal").toLowerCase() === "high" ? "high" : "normal";
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("expiresAt must be an ISO date");
  return {
    id,
    source,
    category,
    title,
    body,
    url: safeUrl(input.url),
    action,
    priority,
    sticky: Boolean(input.sticky),
    expiresAt: expiresAt?.toISOString() || null,
    data: input.data && typeof input.data === "object" ? input.data : {},
  };
}

export function notificationId(value) {
  let hash = 0;
  for (const character of String(value)) hash = ((hash * 31) + character.charCodeAt(0)) | 0;
  return Math.abs(hash || 1);
}

function clean(value, length) {
  return String(value || "").trim().slice(0, length);
}

function safeUrl(value) {
  const raw = clean(value, 1000);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}
