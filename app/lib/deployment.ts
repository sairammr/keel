// Live KEEL staging deployment on Sepolia (see docs/deployment/addresses.md). Public data — safe in
// the client bundle. NEXT_PUBLIC_* env vars override, so a different deployment can be pointed at
// without a code change.
export const DEPLOYMENT = {
  chainId: 11155111,
  rpc: process.env.NEXT_PUBLIC_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
  lending: (process.env.NEXT_PUBLIC_LENDING_ADDR ?? "0xbc655f2febC8C9642C69BB746568050f53AAAc18") as `0x${string}`,
  policyCommit: (process.env.NEXT_PUBLIC_POLICYCOMMIT_ADDR ?? "0xE0e3C43Cc464e08b35Eb28Ff235c437166AFAc71") as `0x${string}`,
  receipts: (process.env.NEXT_PUBLIC_RECEIPTS_ADDR ?? "0xf8A66135642a0DeA582e874531Ef45FB2Dd01ee6") as `0x${string}`,
  // the participant whose commit + receipts were posted on-chain by the live scenario run
  participant: (process.env.NEXT_PUBLIC_PARTICIPANT_ADDR ?? "0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4") as `0x${string}`,
  // block to scan events from (the fresh staging stack's deploy block)
  fromBlock: BigInt(process.env.NEXT_PUBLIC_FROM_BLOCK ?? "11682850"),
  explorer: "https://sepolia.etherscan.io",
} as const;

export const etherscanTx = (h: string) => `${DEPLOYMENT.explorer}/tx/${h}`;
export const etherscanAddr = (a: string) => `${DEPLOYMENT.explorer}/address/${a}`;
