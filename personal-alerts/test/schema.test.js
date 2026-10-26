import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAlert, normalizeSubscriptions, notificationId } from "../src/schema.js";

test("normalizes subscriptions to the supported categories", () => {
  assert.deepEqual(normalizeSubscriptions({ garage: true, pogo: 1, other: true }), {
    garage: true, nrl: false, nrlw: false, pogo: true, system: false,
  });
});

test("normalizes a publishable alert", () => {
  const alert = normalizeAlert({
    id: "nrl:42", category: "nrl", title: "Change tip", body: "A to B",
    url: "https://example.com/ELO/2027/", priority: "high", sticky: true,
  }, "nrl-elo");
  assert.equal(alert.action, "upsert");
  assert.equal(alert.source, "nrl-elo");
  assert.equal(alert.priority, "high");
  assert.equal(alert.sticky, true);
});

test("rejects unsupported categories and unsafe URLs", () => {
  assert.throws(() => normalizeAlert({ id: "x", category: "email", title: "x" }, "test"));
  assert.equal(normalizeAlert({ id: "x", category: "system", title: "x", url: "javascript:alert(1)" }, "test").url, "");
});

test("notification IDs are stable", () => {
  assert.equal(notificationId("garage:main"), notificationId("garage:main"));
  assert.notEqual(notificationId("garage:main"), notificationId("nrl:42"));
});
