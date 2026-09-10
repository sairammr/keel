import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // keel-controller ships TypeScript source. Turbopack compiles TS natively, so alias the
  // package name straight to its entry file (bun's per-file symlinks confuse bare-specifier
  // resolution of the `exports: "./src/index.ts"` field).
  turbopack: {
    root: path.resolve(__dirname, ".."),
    resolveAlias: {
      // relative to the app dir. Turbopack compiles the TS source directly; deps
      // (viem, @noble/*) resolve from app/node_modules, cross-package imports from root.
      "keel-controller": "../packages/controller/src/index.ts",
      "keel-scenario": "../packages/scenario/src/index.ts",
      "keel-hunter": "../packages/hunter/src/index.ts",
    },
  },
};

export default nextConfig;
