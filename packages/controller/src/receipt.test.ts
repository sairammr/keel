import { expect, test } from "bun:test";
import { signReceipt, recoverReceiptSigner } from "./receipt";
import { commitmentOf } from "./commitment";
import { DEFAULT_POLICY } from "./fixture";
import type { Receipt } from "./types";

const codeHash = ("0x" + "ab".repeat(32)) as `0x${string}`;
const salt = ("0x" + "11".repeat(32)) as `0x${string}`;
const verifyingContract = "0x1111111111111111111111111111111111111111" as `0x${string}`;

test("sign → recover round-trips to commitment signer", async () => {
  const { commit, receiptKey, signer } = commitmentOf(DEFAULT_POLICY, salt, codeHash);
  const receipt: Receipt = {
    commit,
    round: 3n,
    blockObserved: 123456n,
    price: 190000n,
    hfBp: 10585n,
    action: 1,
    amount: 13889n,
    actionNonce: 1n,
  };
  const sig = await signReceipt(receipt, receiptKey, verifyingContract);
  const recovered = await recoverReceiptSigner(receipt, sig, verifyingContract);
  expect(recovered).toBe(signer);
});
