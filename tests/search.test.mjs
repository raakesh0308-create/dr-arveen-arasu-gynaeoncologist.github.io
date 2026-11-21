// Stage 1 search: normalisation, abbreviations and Malay terms, whole-word matching for short terms, typo tolerance.
import test from "node:test";
import assert from "node:assert/strict";
import { loadHelpers } from "./helpers.mjs";

const { normQ, expandQuery, editDistance, nearestWord, altRe } = loadHelpers("normQ", "expandQuery", "editDistance", "nearestWord", "altRe");
const alts = q => expandQuery(q).map(t => t.alts);

test("normalises case, accents, dashes and quotes", () => {
  assert.equal(normQ("  Müllerian  “CA‑125”  "), "mullerian ca-125");
});

test("expands clinical abbreviations", () => {
  assert.ok(alts("SLN")[0].includes("sentinel"));
  assert.ok(alts("PDS")[0].includes("primary cytoreductive"));
  assert.ok(alts("LVSI")[0].includes("lymphovascular"));
  assert.ok(alts("HRD")[0].includes("homologous recombination"));
  assert.ok(alts("pd1")[0].includes("pembrolizumab"));
});

test("understands Malay terms and phrases", () => {
  assert.ok(alts("kanser serviks")[0].includes("cervical"));
  assert.ok(alts("rahim")[0].includes("endometrial"));
  assert.ok(alts("kemoterapi")[0].includes("chemotherapy"));
});

test("drops filler words and keeps multi-word phrases together", () => {
  assert.equal(JSON.stringify(expandQuery("the management of sentinel node").map(t => t.raw)), JSON.stringify(["management", "sentinel node"]));
});

test("short terms match whole words only", () => {
  const rt = altRe("rt");
  assert.ok(rt.test("adjuvant rt after surgery"));
  assert.ok(!rt.test("start of treatment"));
  assert.ok(!altRe("ct").test("effect size"));
  assert.ok(!altRe("rt").test("confirmed by rt-pcr"));
  assert.ok(altRe("ct").test("staging ct scan"));
  assert.ok(altRe("carboplatin").test("weekly carboplatin"));
});

test("typo tolerance picks the nearest indexed word", () => {
  const vocab = new Map([["carboplatin", 40], ["cisplatin", 30], ["paclitaxel", 35], ["trachelectomy", 8], ["brachytherapy", 20]]);
  assert.equal(nearestWord("carboplatn", vocab), "carboplatin");
  assert.equal(nearestWord("paclitaxl", vocab), "paclitaxel");
  assert.equal(nearestWord("brachytherpy", vocab), "brachytherapy");
  assert.equal(nearestWord("trachelctomy", vocab), "trachelectomy");
  assert.equal(nearestWord("zzzzzz", vocab), null);
  assert.equal(nearestWord("ct", vocab), null);
  assert.equal(editDistance("teh", "the", 2), 1); // transposition counts as one edit
});
