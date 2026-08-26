// maplibre-gl v6 ships its tile-parsing worker as an ES module and resolves its own
// URL via `import.meta.url` at runtime. Once webpack rebundles that code into a Next.js
// chunk, that computed URL points nowhere real — Next's dev/prod server falls back to
// serving the app shell (text/html) for it, the browser rejects the MIME type for a
// `type: "module"` Worker, and the map hangs forever in "loading" with the canvas blank
// (style fetches, but no worker ever comes up to parse tiles).
//
// The fix: copy the worker as a stable static asset and point maplibre at it explicitly
// via `setWorkerUrl()` (see components/map-viewport.tsx), bypassing the broken
// import.meta.url resolution entirely. The worker itself does `import "./maplibre-gl-shared.mjs"`
// as a *relative* import baked into its compiled source, so that sibling chunk has to be
// copied alongside it, at the same path depth, under its exact original filename — copying
// only the worker (as an earlier version of this script did) leaves that import 404ing.
// Runs before dev/build so a version bump or a fresh install can't leave this stale.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Resolve through Node's own module resolution (not a hardcoded pnpm store path) so
// this survives version bumps and doesn't assume pnpm's on-disk layout.
const entry = fileURLToPath(import.meta.resolve("maplibre-gl"));
const distDir = dirname(entry);
const destDir = resolve(here, "../public");
mkdirSync(destDir, { recursive: true });

const files = [
  ["maplibre-gl-worker.mjs", "maplibre-gl-worker.js"],
  // Must keep this exact filename — the worker's compiled source imports it literally
  // as "./maplibre-gl-shared.mjs", not through any resolvable module specifier.
  ["maplibre-gl-shared.mjs", "maplibre-gl-shared.mjs"],
];

for (const [sourceName, destName] of files) {
  const dest = resolve(destDir, destName);
  copyFileSync(resolve(distDir, sourceName), dest);
  console.log(`synced maplibre-gl asset -> ${dest}`);
}
