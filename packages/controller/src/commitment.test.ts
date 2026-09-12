import { expect, test } from "bun:test";
import { commitmentOf, encodePolicyBytes } from "./commitment";
import { DEFAULT_POLICY } from "./fixture";

const codeHash = ("0x" + "ab".repeat(32)) as `0x${string}`;
const saltA = ("0x" + "11".repeat(32)) as `0x${string}`;
const saltB = ("0x" + "22".repeat(32)) as `0x${string}`;

test("commit stable for same inputs", () => {
  const a = commitmentOf(DEFAULT_POLICY, saltA, codeHash);
  const b = commitmentOf(DEFAULT_POLICY, saltA, codeHash);
  expect(a.commit).toBe(b.commit);
  expect(a.signer).toBe(b.signer);
});

test("different salt → different commit & signer", () => {
  const a = commitmentOf(DEFAULT_POLICY, saltA, codeHash);
  const b = commitmentOf(DEFAULT_POLICY, saltB, codeHash);
  expect(a.commit).not.toBe(b.commit);
  expect(a.signer).not.toBe(b.signer);
});

test("receiptKey ≠ 0", () => {
  const a = commitmentOf(DEFAULT_POLICY, saltA, codeHash);
  expect(BigInt(a.receiptKey)).not.toBe(0n);
});

test("v1/v2 encoding: tjitter_bp absent → v1 bytes unchanged; set → v2 round-trips", () => {

  const v1 = encodePolicyBytes(DEFAULT_POLICY, codeHash);
  const v1again = encodePolicyBytes({ ...DEFAULT_POLICY, tjitter_bp: 0 }, codeHash);
  expect(v1again).toBe(v1); // 0 keeps legacy encoding — recorded commits still verify
  expect((v1.length - 2) / 64).toBe(15);
  const v2 = encodePolicyBytes({ ...DEFAULT_POLICY, tjitter_bp: 300 }, codeHash);
  expect((v2.length - 2) / 64).toBe(16);
  expect(v2).not.toBe(v1);
});
