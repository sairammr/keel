// `bun run codehash` — keccak256 of the controller bundle.
// This hash goes into the committed policyBytes (config.controllerCodeHash) and is revealed at
// reveal time; it binds the algorithm the enclave ran, not just the numbers.
//
// ponytail: hash of a Bun-bundled single file. Reproducible for a given Bun version + controller
// source; re-run this whenever the controller changes and update config.*.json.
import { keccak256, toHex } from "viem";

const ENTRY = new URL("../../packages/controller/src/index.ts", import.meta.url).pathname;

const built = await Bun.build({ entrypoints: [ENTRY], minify: true, target: "browser" });
if (!built.success) {
  console.error(built.logs.join("\n"));
  throw new Error("controller bundle failed");
}
const bundle = await built.outputs[0]!.text();
const hash = keccak256(toHex(bundle));
console.log(hash);
