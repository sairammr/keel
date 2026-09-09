import { expect, test } from "bun:test";
import { commitmentOf } from "./commitment";
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
