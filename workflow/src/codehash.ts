// `bun run codehash [--check]` — reproducible keccak256 of the controller SOURCE tree.
//
// This hash goes into the committed policyBytes (config.controllerCodeHash), is revealed at reveal
// time, and binds the algorithm the enclave ran. It MUST be reproducible with nothing but keccak:
// hashing a Bun-minified bundle is not (it changes across Bun versions), so we hash the source.
//
//   controllerCodeHash = keccak256( ‖ over sorted files f in packages/controller/src/*.ts,
//                                    excluding *.test.ts and fixture.ts,
//                                    of utf8(relPath) ‖ 0x00 ‖ utf8(content) ‖ 0x00 )
//
// relPath is POSIX-relative to packages/controller (e.g. "src/decide.ts") so it is machine-stable.
import { readdirSync, readFileSync } from "node:fs";
import { keccak256, type Hex } from "viem";

const CONTROLLER_DIR = new URL("../../packages/controller", import.meta.url).pathname;

/** Sorted source files that define the controller algorithm (no tests, no fixtures). */
export function controllerSourceFiles(controllerDir = CONTROLLER_DIR): string[] {
  return readdirSync(`${controllerDir}/src`)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "fixture.ts")
    .sort()
    .map((f) => `src/${f}`);
}

export function controllerCodeHash(controllerDir = CONTROLLER_DIR): Hex {
  const enc = new TextEncoder();
  const NUL = new Uint8Array([0]);
  const parts: Uint8Array[] = [];
  for (const rel of controllerSourceFiles(controllerDir)) {
    parts.push(enc.encode(rel), NUL, enc.encode(readFileSync(`${controllerDir}/${rel}`, "utf8")), NUL);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return keccak256(buf);
}

if (import.meta.main) {
  const hash = controllerCodeHash();
  if (!process.argv.includes("--check")) {
    console.log(hash);
    process.exit(0);
  }
  // --check: every committed controllerCodeHash must equal the source-tree hash.
  const root = new URL("..", import.meta.url).pathname; // workflow/
  const repo = new URL("../..", import.meta.url).pathname;
  let ok = true;
  const eq = (label: string, val?: string) => {
    const match = val?.toLowerCase() === hash.toLowerCase();
    console.log(`${match ? "OK  " : "FAIL"} ${label}: ${val}`);
    if (!match) ok = false;
  };
  for (const c of readdirSync(root).filter((f) => /^config\..*\.json$/.test(f))) {
    const cfg = JSON.parse(readFileSync(`${root}/${c}`, "utf8")) as { controllerCodeHash?: string };
    eq(`workflow/${c}`, cfg.controllerCodeHash);
  }
  // app constant (client bundle can't run fs-hash, so it holds a literal we verify here)
  const appPolicy = readFileSync(`${repo}/app/lib/policy.ts`, "utf8");
  eq("app/lib/policy.ts CONTROLLER_CODE_HASH", appPolicy.match(/CONTROLLER_CODE_HASH\s*=\s*"(0x[0-9a-fA-F]+)"/)?.[1]);
  console.log(`source-tree hash: ${hash}`);
  process.exit(ok ? 0 : 1);
}
