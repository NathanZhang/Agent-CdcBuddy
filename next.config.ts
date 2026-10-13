import type { NextConfig } from "next";
import path from "path";
import { version } from "./package.json";
import { execSync } from "child_process";

let gitHash = process.env.NEXT_PUBLIC_GIT_HASH?.trim() ?? "";
if (!gitHash) {
  try {
    gitHash = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    gitHash = "unknown";
  }
}

const domain = process.env.NEXT_PUBLIC_AGENT_DOMAIN || process.env.AGENT_DOMAIN;
const distDir = process.env.NEXT_BUILD_DIR ?? (process.env.NODE_ENV!=="production"&&domain?`.next_${domain}`:".next");

const nextConfig: NextConfig = {
  distDir,
  env: {
    NEXT_PUBLIC_GIT_HASH: gitHash,
    NEXT_PUBLIC_APP_VERSION: version,
  },
  serverExternalPackages: ["better-sqlite3"],
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  devIndicators: false,
};

export default nextConfig;
