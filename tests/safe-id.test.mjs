// M1: record ids end up inside links and HTML attributes, so only safe characters are allowed.
import test from "node:test";
import assert from "node:assert/strict";
import { loadHelpers } from "./helpers.mjs";

const { SAFE_ID } = loadHelpers("SAFE_ID");

test("real ids are accepted", () => {
  for (const id of ["carboplatin", "R-EN-A01", "G-ESGO-FS-EN-2023", "FIGO2023-EN", "A-OV-SUSPECT", "PIL-TX-CHEMO", "uterine", "T-ICON9"]) assert.ok(SAFE_ID.test(id), id);
});

test("ids that could break out of HTML are rejected", () => {
  for (const id of ['x"><img src=x onerror=alert(1)>', "a b", "<script>", "javascript:alert(1)//'", "a&b", "", "x".repeat(121)]) assert.ok(!SAFE_ID.test(id), id);
});
