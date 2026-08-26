import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import type { NextConfig } from "next";

loadEnv({ path: resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  // React 19's Strict Mode intentionally double-invokes effects in dev (mount → cleanup →
  // mount) to surface unsafe effects. maplibre-gl's Map isn't safe under that: its worker
  // pool/dispatcher hold module-level state, and two Map instances racing to construct
  // against the same container corrupts that state — every render frame afterward throws
  // "Cannot read properties of undefined (reading 'height')" from inside maplibre-gl.mjs,
  // and the map never draws anything. Confirmed by toggling this flag with everything else
  // (deck.gl overlay, globe projection) held constant — the crash tracks Strict Mode, not
  // our code. Off for the whole app, not just Explore, so the effect's cleanup path stays
  // exercised in dev the same way it runs in prod.
  reactStrictMode: false,
  transpilePackages: [
    "@aethera/ui",
    "@aethera/types",
    "@aethera/validation",
    "@aethera/flight-engine",
    "@aethera/anomaly-engine",
  ],
};

/**
 * `next build` and `next dev` both write to `.next` by default, so running a production
 * build while the dev server is up overwrites the chunks that server is still serving.
 * The browser then dies with "__webpack_modules__[moduleId] is not a function" or 404s on
 * chunk requests, and the only cure is deleting `.next` and restarting — which presents
 * as a mysterious corruption rather than as the two commands colliding.
 *
 * Sending production builds to their own directory makes the two safe to run together.
 */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    return { ...nextConfig, distDir: ".next-build" };
  }
  return nextConfig;
}
