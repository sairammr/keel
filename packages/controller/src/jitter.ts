import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";

// One deterministic upward draw per price level.
// u = HMAC-SHA256(salt, tag ++ uint32be(round)); frac = u64/2^64; jitterBp = floor(frac·jmax) ∈ [0,jmax).
function drawBp(salt: Uint8Array, tag: string, round: number, jmax: number): number {
  if (jmax <= 0) return 0;
  const prefix = new TextEncoder().encode(tag);
  const msg = new Uint8Array(prefix.length + 4);
  msg.set(prefix, 0);
  new DataView(msg.buffer).setUint32(prefix.length, round >>> 0, false); // big-endian
  const u = hmac(sha256, salt, msg);
  let u64 = 0n;
  for (let i = 0; i < 8; i++) u64 = (u64 << 8n) | BigInt(u[i]!);
  return Number((u64 * BigInt(jmax)) >> 64n); // floor(frac·jmax)
}

export function jitterBpOf(salt: Uint8Array, round: number, jmax: number): number {
  return drawBp(salt, "keel/jitter/v1", round, jmax);
}

// Independent draw for the restore target — different domain tag, so post-action HF
// no longer deterministically reveals arm+buffer.
export function tjitterBpOf(salt: Uint8Array, round: number, jmax: number): number {
  return drawBp(salt, "keel/tjitter/v1", round, jmax);
}
