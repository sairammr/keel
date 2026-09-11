// Live KEEL staging deployment on Sepolia (see docs/deployment/addresses.md). Public data — safe in
// the client bundle. NEXT_PUBLIC_* env vars override, so a different deployment can be pointed at
// without a code change.
export const DEPLOYMENT = {
  chainId: 11155111,
  rpc: process.env.NEXT_PUBLIC_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
  lending: (process.env.NEXT_PUBLIC_LENDING_ADDR ?? "0x0DCC9ca6262b658E8cbD29bdCe18b5ca370e3949") as `0x${string}`,
  policyCommit: (process.env.NEXT_PUBLIC_POLICYCOMMIT_ADDR ?? "0xACbf2d364817AB8c42C6573C748702BE0f7aAA6b") as `0x${string}`,
  receipts: (process.env.NEXT_PUBLIC_RECEIPTS_ADDR ?? "0x726717FBe26e1502c5575647d1D46E618e912Aee") as `0x${string}`,
  // the participant whose commit + receipts were posted on-chain by the live scenario run
  participant: (process.env.NEXT_PUBLIC_PARTICIPANT_ADDR ?? "0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4") as `0x${string}`,
  explorer: "https://sepolia.etherscan.io",
} as const;

export const etherscanTx = (h: string) => `${DEPLOYMENT.explorer}/tx/${h}`;
export const etherscanAddr = (a: string) => `${DEPLOYMENT.explorer}/address/${a}`;
