// H2: the "next" address after sign-in must only ever be a page of this site.
import test from "node:test";
import assert from "node:assert/strict";
import { loadHelpers } from "./helpers.mjs";

const { safeNext } = loadHelpers("safeNext");

test("accepts pages of this site", () => {
  for (const ok of ["professional.html", "content-editor.html?id=edit%3Adrugs%3Acarboplatin", "recommendations.html#dg-cervical", "drug.html?id=carboplatin&x=1"])
    assert.equal(safeNext(ok, "D"), ok);
});

test("rejects script, other websites and parser tricks", () => {
  const bad = [
    "javascript:alert(1)", "JavaScript:alert(1)", "  javascript:alert(1)", "java\tscript:alert(1)", "\njavascript:alert(1)",
    "data:text/html,<script>alert(1)</script>", "vbscript:x",
    "https://evil.example/", "//evil.example/", "/\\evil.example/", "\\\\evil.example/", "/professional.html",
    "professional.html\"><script>", "professional.html?x=<script>", "../professional.html", "", null, undefined, 42
  ];
  for (const b of bad) assert.equal(safeNext(b, "D"), "D", `should reject ${JSON.stringify(b)}`);
});

test("every accepted value resolves to the same site", () => {
  const base = "https://site.example/app/two-step.html";
  for (const ok of ["professional.html", "drug.html?id=a#b"]) assert.equal(new URL(safeNext(ok, "D"), base).origin, "https://site.example");
});
