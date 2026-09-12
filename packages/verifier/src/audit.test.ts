import { test, expect } from "bun:test";
import { encodePolicyBytes, type Policy } from "keel-controller";
import { decodePolicyBytes } from "./audit.ts";

test("decodePolicyBytes: v2 round-trips tjitter_bp; v1 leaves it undefined", () => {
  const base: Policy = {
    base_bp: 10700, kvol_bp: 10000, volcap_bp: 200, jitter_bp: 300, tmax_bp: 11100,
    emerg_bp: 10300, buffer_bp: 500, target_cap_bp: 12500, halflife: 4, cooldown: 1,
    max_repay_bp: 3000, max_deposit: 250, t_est_s: 10800,
  };
  const ch = ("0x" + "ab".repeat(32)) as `0x${string}`;
  const v1 = decodePolicyBytes(encodePolicyBytes(base, ch));
  expect(v1.policy.tjitter_bp).toBeUndefined();
  expect(v1.controllerCodeHash).toBe(ch);
  const v2 = decodePolicyBytes(encodePolicyBytes({ ...base, tjitter_bp: 300 }, ch));
  expect(v2.policy.tjitter_bp).toBe(300);
  expect(v2.policy.base_bp).toBe(10700);
  expect(v2.controllerCodeHash).toBe(ch);
});
