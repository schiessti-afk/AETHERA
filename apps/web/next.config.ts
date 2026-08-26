import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import type { NextConfig } from "next";

loadEnv({ path: resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: [
    "@aethera/ui",
    "@aethera/types",
    "@aethera/validation",
    "@aethera/flight-engine",
  ],
};

export default nextConfig;
