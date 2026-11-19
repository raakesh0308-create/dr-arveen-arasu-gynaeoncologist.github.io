// Loads the helper functions marked "// @test:<name> … // @end" in assets/app.js so they can be tested in Node
// without a browser. Run all tests with:  npm test
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");

export function loadHelpers(...names) {
  const blocks = [...appSource.matchAll(/\/\/ @test:([\w,]+)[^\n]*\n([\s\S]*?)\/\/ @end/g)];
  const code = blocks.map(m => m[2]).join("\n");
  const ctx = vm.createContext({ console });
  vm.runInContext(code + `\n;globalThis.__out = { ${names.join(", ")} };`, ctx);
  return ctx.__out;
}
