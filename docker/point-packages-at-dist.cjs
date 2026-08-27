const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

/**
 * Workspace packages export TypeScript source so local `tsx` / Next can transpile
 * them. Production images compile to dist/ and then point package.json at the JS.
 */
for (const dir of process.argv.slice(2)) {
  const path = resolve(dir, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  pkg.main = "./dist/index.js";
  pkg.types = "./dist/index.d.ts";
  pkg.exports = { ".": "./dist/index.js" };
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}
