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
// Uses Bun's typed fs APIs (Bun.Glob / Bun.file) so it needs no @types/node.
import { keccak256, type Hex } from "viem";

const CONTROLLER_DIR = new URL("../../packages/controller", import.meta.url).pathname;

/** Sorted source files that define the controller algorithm (no tests, no fixtures). */
export function controllerSourceFiles(controllerDir = CONTROLLER_DIR): string[] {
  return Array.from(new Bun.Glob("*.ts").scanSync({ cwd: `${controllerDir}/src`, onlyFiles: true }))
    .filter((f) => !f.endsWith(".test.ts") && f !== "fixture.ts")
    .sort()
    .map((f) => `src/${f}`);
}

export async function controllerCodeHash(controllerDir = CONTROLLER_DIR): Promise<Hex> {
  const enc = new TextEncoder();
  const NUL = new Uint8Array([0]);
  const parts: Uint8Array[] = [];
  for (const rel of controllerSourceFiles(controllerDir)) {
    const content = await Bun.file(`${controllerDir}/${rel}`).text();
    parts.push(enc.encode(rel), NUL, enc.encode(content), NUL);
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
  const hash = await controllerCodeHash();
  if (!process.argv.includes("--check")) {
    console.log(hash);
    process.exit(0);
  }
  // --check: every committed controllerCodeHash must equal the source-tree hash.
  const workflowDir = new URL("..", import.meta.url).pathname;
  const repoDir = new URL("../..", import.meta.url).pathname;
  let ok = true;
  const eq = (label: string, val?: string) => {
    const match = val?.toLowerCase() === hash.toLowerCase();
    console.log(`${match ? "OK  " : "FAIL"} ${label}: ${val}`);
    if (!match) ok = false;
  };
  for (const c of new Bun.Glob("config.*.json").scanSync({ cwd: workflowDir, onlyFiles: true })) {
    const cfg = (await Bun.file(`${workflowDir}/${c}`).json()) as { controllerCodeHash?: string };
    eq(`workflow/${c}`, cfg.controllerCodeHash);
  }
  // app constant (client bundle can't run fs-hash, so it holds a literal we verify here)
  const appPolicy = await Bun.file(`${repoDir}/app/lib/policy.ts`).text();
  eq("app/lib/policy.ts CONTROLLER_CODE_HASH", appPolicy.match(/CONTROLLER_CODE_HASH\s*=\s*"(0x[0-9a-fA-F]+)"/)?.[1]);
  console.log(`source-tree hash: ${hash}`);
  process.exit(ok ? 0 : 1);
}
