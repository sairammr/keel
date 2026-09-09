import { hashTypedData, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Receipt } from "./types";

const TYPES = {
  Receipt: [
    { name: "commit", type: "bytes32" },
    { name: "round", type: "uint64" },
    { name: "blockObserved", type: "uint64" },
    { name: "price", type: "uint256" },
    { name: "hfBp", type: "uint256" },
    { name: "action", type: "uint8" },
    { name: "amount", type: "uint256" },
    { name: "actionNonce", type: "uint64" },
  ],
} as const;

function domainOf(verifyingContract: `0x${string}`) {
  return {
    name: "KeelReceipts",
    version: "1",
    chainId: 11155111,
    verifyingContract,
  } as const;
}

function messageOf(r: Receipt) {
  return {
    commit: r.commit,
    round: r.round,
    blockObserved: r.blockObserved,
    price: r.price,
    hfBp: r.hfBp,
    action: r.action,
    amount: r.amount,
    actionNonce: r.actionNonce,
  };
}

export function receiptDigest(
  receipt: Receipt,
  verifyingContract: `0x${string}`,
): `0x${string}` {
  return hashTypedData({
    domain: domainOf(verifyingContract),
    types: TYPES,
    primaryType: "Receipt",
    message: messageOf(receipt),
  });
}

export function signReceipt(
  receipt: Receipt,
  receiptKey: `0x${string}`,
  verifyingContract: `0x${string}`,
): Promise<`0x${string}`> {
  return privateKeyToAccount(receiptKey).signTypedData({
    domain: domainOf(verifyingContract),
    types: TYPES,
    primaryType: "Receipt",
    message: messageOf(receipt),
  });
}

export function recoverReceiptSigner(
  receipt: Receipt,
  sig: `0x${string}`,
  verifyingContract: `0x${string}`,
): Promise<`0x${string}`> {
  return recoverTypedDataAddress({
    domain: domainOf(verifyingContract),
    types: TYPES,
    primaryType: "Receipt",
    message: messageOf(receipt),
    signature: sig,
  });
}
