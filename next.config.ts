import type { NextConfig } from "next";
import path from "path";
import { execSync } from "child_process";

let gitHash = process.env.NEXT_PUBLIC_GIT_HASH?.trim() ?? "";
if (!gitHash) {
  try {
    gitHash = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    gitHash = "unknown";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_HASH: gitHash,
  },
  serverExternalPackages: ["better-sqlite3"],
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  devIndicators: false,
};

export default nextConfig;
