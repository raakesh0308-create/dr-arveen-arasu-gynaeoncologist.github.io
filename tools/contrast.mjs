// WCAG colour-contrast check for the DR ARVEEN theme tokens, in light and dark mode.
// Usage: node tools/contrast.mjs   (exits 1 if any pair fails)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "style.css"), "utf8");
const block = re => { const m = css.match(re); if (!m) throw new Error("token block not found: " + re); return Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(x => [x[1], x[2]])); };
const light = block(/^:root\s*\{([\s\S]*?)\}/m);
const dark = { ...light, ...block(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/) };

const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum, where it is used]
const pairs = [
  ["fg", "bg", 4.5, "body text"], ["fg", "surface", 4.5, "text on cards"], ["muted", "bg", 4.5, "secondary text"], ["muted", "surface", 4.5, "secondary text on cards"],
  ["teal", "bg", 4.5, "links"], ["teal", "surface", 4.5, "links on cards"], ["on-accent", "teal", 4.5, "primary buttons"],
  ["lav", "bg", 4.5, "section labels"], ["lav", "surface", 4.5, "section labels on cards"],
  ["mast-fg", "navy", 4.5, "header text"], ["mast-muted", "navy", 4.5, "header menu"], ["mast-fg", "navy-2", 4.5, "header search and buttons"],
  ["ok", "ok-bg", 4.5, "verified pills"], ["warn", "warn-bg", 4.5, "warning pills and banners"], ["bad", "bad-bg", 4.5, "alert pills and banners"],
  ["fg", "info-bg", 4.5, "info banners"], ["fg", "teal-soft", 4.5, "selected chips"], ["fg", "lav-soft", 4.5, "selected filter chips"],
  ["field", "surface", 3.0, "form field borders"], ["field", "bg", 3.0, "form field borders on page"],
  ["line", "surface", 1.0, "decorative borders (no minimum)"], ["teal", "surface", 3.0, "focus ring and control borders"]
];
let failed = 0;
for (const [mode, t] of [["light", light], ["dark", dark]]) {
  console.log(`\n${mode} mode`);
  for (const [f, b, min, use] of pairs) {
    if (!t[f] || !t[b]) { console.log(`  ?  ${f} on ${b}: token missing`); continue; }
    const r = ratio(t[f], t[b]); const ok = r >= min; if (!ok) failed++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(5)}:1 (needs ${min}) ${f} on ${b} — ${use}`);
  }
}
console.log(failed ? `\n${failed} pair(s) below WCAG AA` : "\nAll pairs meet WCAG AA");
process.exit(failed ? 1 : 0);
