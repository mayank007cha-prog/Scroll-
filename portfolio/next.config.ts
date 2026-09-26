import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The repo root has its own package-lock (the ScrollTrigger library),
  // so pin the app root explicitly.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
