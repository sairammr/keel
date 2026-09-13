# CRE deploy Early-Access request (P0.1)

- **Org:** `org_0NhyfJ57VzhSh1D8` ("My Org"), account `sairam1203mr@gmail.com`
- **Command:** `cre account access`
- **Status at request time:** `Deploy Access: Not enabled`
- **Result:** `✓ Access request submitted successfully!` — Chainlink reviews and contacts by email if approved.
- **Use case submitted:**

  > Automated liquidation-protection confidential workflow for the ETHOnline 2026 Chainlink
  > challenge. Commits a policy hash to Sepolia before the scenario starts and posts EIP-712 action
  > receipts from inside the enclave; defends a lending position against a price-crash scenario
  > without revealing the health-factor policy to node operators.

Until approved, `cre workflow deploy` is gated; `cre workflow simulate` works without it (verified —
the KEEL workflow returns a status under the CRE runtime). Re-check with `cre account access` or
`cre whoami` (→ `Deploy Access: Enabled`).
