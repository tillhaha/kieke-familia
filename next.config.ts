import type { NextConfig } from "next";
import { execSync } from "child_process";

function getLastReleaseTime(): string {
  try {
    return execSync("git log -1 --format=%cI", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["node-ical"],
  env: {
    NEXT_PUBLIC_RELEASE_TIME: getLastReleaseTime(),
  },
};

export default nextConfig;
