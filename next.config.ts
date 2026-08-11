import type { NextConfig } from "next";
import path from "path";
import { execSync } from "child_process";

let gitHash = "b3518e6";
try {
  gitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // fallback if git command fails
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
