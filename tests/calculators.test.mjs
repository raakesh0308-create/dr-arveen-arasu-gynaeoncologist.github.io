// Calculator formulas, checked against hand-worked examples.
import test from "node:test";
import assert from "node:assert/strict";
import { loadHelpers } from "./helpers.mjs";

const { CALC } = loadHelpers("CALC");
const txt = r => typeof r === "string" ? r : r.text;

test("body size", () => {
  assert.match(txt(CALC.bsa({ h: 170, w: 70 })), /Mosteller 1\.82 m²/);
  assert.match(txt(CALC.bmi({ h: 160, w: 64 })), /^25\.0 kg\/m²/);
  const i = txt(CALC.ibw({ sex: "female", h: 160, w: 60 }));
  assert.match(i, /Ideal 52\.4 kg/); assert.match(i, /adjusted 55\.4 kg/);
  assert.match(txt(CALC.ibw({ sex: "male", h: 180, w: 60 })), /adjusted not needed/);
  assert.equal(CALC.ibw({ sex: "female", h: 150, w: 50 }).tone, "warn");
});

test("kidney function and dosing", () => {
  assert.match(txt(CALC.crcl({ age: 60, w: 70, cr: 80, sex: "female" })), /^73 mL\/min/);
  assert.match(txt(CALC.calvert({ auc: 5, gfr: 100 })), /^625 mg/);
  assert.match(txt(CALC.bsadose({ dose: 175, bsa: 1.7 })), /^297\.5 mg/);
  const d = CALC.doxo({ prev: 300, per: 60, n: 3 }); assert.match(d.text, /Cumulative 480 mg\/m²/); assert.equal(d.tone, "warn");
  assert.equal(CALC.doxo({ prev: 500, per: 60, n: 1 }).tone, "bad");
  assert.equal(CALC.doxo({ prev: 0, per: 60, n: 6 }).tone, "ok");
});

test("blood results", () => {
  assert.match(CALC.anc({ wbc: 5, n: 20, b: 0 }).text, /ANC 1\.00 .*grade 2/);
  assert.match(CALC.anc({ wbc: 2, n: 20, b: 0 }).text, /grade 4/);
  assert.equal(CALC.anc({ wbc: 5, n: 90, b: 20 }).tone, "bad");
  assert.match(CALC.ccalc({ ca: 2.2, alb: 30 }).text, /2\.40 mmol\/L/);
  assert.equal(CALC.ccalc({ ca: 2.9, alb: 25 }).tone, "bad");
});

test("tumour markers", () => {
  assert.match(CALC.rmi({ f: 2, meno: "postmenopausal", ca: 100 }).text, /RMI 900 .*refer/);
  assert.match(CALC.rmi({ f: 1, meno: "premenopausal", ca: 100 }).text, /RMI 100 .*below 250/);
  const pre = { he4: 50, ca: 35, meno: "premenopausal" };
  assert.match(CALC.roma({ ...pre, assay: "roche" }).text, /ROMA 7\.8% — low/);
  assert.match(CALC.roma({ ...pre, assay: "abbott" }).text, /ROMA 7\.8% — high/);
  assert.match(CALC.roma({ he4: 100, ca: 200, meno: "postmenopausal", assay: "roche" }).text, /ROMA 64\.1% — high/);
  assert.match(CALC.ca125({ base: 500, now: 200, uln: 35 }).text, /Fall of 60% .*meets/);
  assert.match(CALC.ca125({ base: 50, now: 10, uln: 35 }).text, /cannot be assessed/);
  assert.match(CALC.ca125({ base: 500, now: 300, uln: 35 }).text, /does not meet/);
});

test("Sedlis criteria", () => {
  const s = (lvsi, depth, size) => CALC.sedlis({ lvsi, depth, size }).text.startsWith("Meets");
  assert.equal(s("pos", "deep", 1), true);
  assert.equal(s("pos", "middle", 1.9), false);
  assert.equal(s("pos", "middle", 2), true);
  assert.equal(s("pos", "sup", 4.9), false);
  assert.equal(s("pos", "sup", 5), true);
  assert.equal(s("neg", "deep", 3.9), false);
  assert.equal(s("neg", "middle", 4), true);
  assert.equal(s("neg", "sup", 8), false);
});

test("GTN prognostic score", () => {
  const z = { age: "0", preg: "0", interval: "0", hcg: "0", size: "0", site: "0", nmet: "0", chemo: "0" };
  assert.match(CALC.gtn(z).text, /Score 0 — low risk/);
  assert.match(CALC.gtn({ ...z, age: "1", preg: "2", interval: "4" }).text, /Score 7 — high risk/);
  assert.match(CALC.gtn({ ...z, age: "1", preg: "2", interval: "4", hcg: "4", site: "4" }).text, /Score 15 — ultra-high/);
  assert.match(CALC.gtn({ ...z, hcg: "4", size: "2" }).text, /Score 6 — low risk/);
});
