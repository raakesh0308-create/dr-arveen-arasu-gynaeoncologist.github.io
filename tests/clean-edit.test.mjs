// H3 (browser side): online edits are stripped of ids, raw HTML and sign-off fields before they are shown.
import test from "node:test";
import assert from "node:assert/strict";
import { loadHelpers } from "./helpers.mjs";

const { cleanEdit } = loadHelpers("cleanEdit");

test("keeps ordinary fields", () => {
  const d = { monitoring: "FBC before each cycle", image: { url: "https://x/y.jpg", alt: "a" }, doses: [{ dose: "AUC 5" }] };
  assert.deepEqual(JSON.parse(JSON.stringify(cleanEdit(d))), d);
});

test("drops forged sign-offs, ids and HTML", () => {
  const forged = { status: "APPROVED", doseStatus: "PHARMACIST VERIFIED", reviewer: "Someone", verifiedOn: "2026-01-01", reviewStatus: "PHARMACIST VERIFIED",
    id: "x\"><img src=x onerror=alert(1)>", html: "<script>alert(1)</script>", refReview: {}, monitoring: "ok" };
  assert.deepEqual(Object.keys(cleanEdit(forged)), ["monitoring"]);
});

test("ignores prototype tricks and non-objects", () => {
  const evil = JSON.parse('{"__proto__":{"polluted":1},"constructor":{"x":1},"title":"t"}');
  const out = cleanEdit(evil);
  assert.deepEqual(Object.keys(out), ["title"]);
  assert.equal(({}).polluted, undefined);
  for (const bad of [null, undefined, "str", 5, [1, 2]]) assert.deepEqual(Object.keys(cleanEdit(bad)), []);
});
