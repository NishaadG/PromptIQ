import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + data files; load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
