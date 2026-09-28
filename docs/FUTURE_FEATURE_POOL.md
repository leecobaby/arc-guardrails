# Arc Guardrails Future Feature Pool

This document records promising ideas observed in CRA AGENT (`giupy997/arcagentx402`) and related Arc Agent payment patterns. It is a product backlog, not a commitment to implement every item.

The V1 competition branch remains a single-owner, single-agent Vault. No item in this file should be implemented by expanding V1's contract surface during the Microgrants review period. The contract remains authoritative for funds and spending policy.

## Product Boundary

Arc Guardrails and CRA AGENT can eventually complement each other:

- CRA AGENT is a payment rail that discovers and pays HTTP services through x402, Circle Gateway, and Agent tooling.
- Arc Guardrails is a treasury boundary that limits what an Agent can spend from an owner's Vault.

The useful long-term composition is an execution adapter in front of an onchain Vault. An Agent may use x402, Gateway, a managed wallet, or a server signer, while the Vault still enforces recipient, amount, expiry, replay, and budget rules.

Do not move the final policy decision into an offchain policy engine merely because it is easier to integrate. Offchain policy can provide early rejection, routing, rate limiting, and better UX; the contract must remain the final authority over Vault funds.

## Priority Legend

- **P0**: high value and close to the current product. Candidate for the first post-submission release.
- **P1**: important platform capability. Candidate for V2 after the single-vault flow has more feedback.
- **P2**: exploratory ecosystem expansion. Requires external dependencies, a broader product scope, or additional security review.

## Candidate Features

### P0: Payment Intent and Receipt Lifecycle

Borrow CRA AGENT's explicit states: `quoted`, `rejected`, `authorized`, `submitted`, `confirmed`, `failed`, and `not_charged`.

Apply them to the existing Agent API and console:

- Create a payment intent before broadcasting.
- Persist the Vault, chain, recipient, amount, invoice/payment ID, request ID, and policy snapshot.
- Treat a reverted receipt as failed rather than returning a successful-looking hash.
- Show the submitted transaction immediately, then update to confirmed or failed.
- Keep a signed receipt containing the policy limits and the final transaction hash.
- Make idempotency unique per Vault and invoice.

Why: this closes the biggest gap between a transaction submission and a trustworthy payment history. It also gives users a clear explanation when a failed service call should not be charged.

Acceptance criteria:

- A reverted transaction never produces a `success` API response.
- Retrying the same invoice cannot create a second successful payment.
- The UI distinguishes rejected, failed, pending, confirmed, and not-charged states.

### P0: MCP and CLI Agent Interface

Expose a small, documented interface inspired by CRA AGENT's MCP tools:

- `arc_quote`: read Vault policy, balance, recipient status, and available budget without spending.
- `arc_pay`: create a guarded payment intent and return a receipt.
- `arc_balance`: return Vault balance and Agent gas balance.
- `arc_policy`: return limits, expiry, allowlist, and remaining daily budget.
- `arc_ledger`: return recent intents and confirmed onchain payments.
- `arc_pause` and `arc_withdraw`: owner-only tools with an explicit confirmation boundary.

The CLI should use the same API and receipt schema as the web console. Secrets stay outside the model context and browser bundle.

Why: MCP makes the project usable by Agent clients while preserving the existing contract boundary. This is a distribution upgrade, not a replacement for the Vault.

### P0: Identity-Aware Recipients

Add an optional preflight check for recipient identity, borrowing CRA AGENT's ERC-8004 resolver:

- Resolve whether a recipient owns an ERC-8004 identity or is a declared Agent wallet.
- Display the result before an owner approves a new recipient.
- Let a Vault policy require a verified identity as an additional guard.
- Cache reads briefly and fail closed when a policy explicitly requires identity.

The contract allowlist remains the final control. Identity is evidence about who is receiving funds, not proof that a recipient is honest.

### P0: Gas and Vault Health Monitoring

Add a small health service and dashboard section:

- Agent gas balance and estimated number of remaining payments.
- Vault balance versus daily budget.
- Policy expiry countdown.
- RPC latency, head lag, and last successful index refresh.
- Alerts when the Agent cannot submit another transaction or the indexer is stale.

Why: Arc uses USDC for gas, so gas exhaustion is a direct product failure. The health view should explain whether a failed payment came from policy, funds, gas, RPC, or indexing.

### P1: x402 Quote and Payment Adapter

Add an optional adapter that reads an HTTP 402 response and converts it into a Vault payment intent:

1. Fetch the resource without payment.
2. Parse the seller, network, asset, amount, and expiry from x402 requirements.
3. Check the Vault allowlist, per-payment cap, daily cap, and policy expiry.
4. Require an owner approval or a pre-authorized Agent scope.
5. Call `spend(recipient, amount, paymentId)` and retry the resource with the payment proof.

The first version should support Arc USDC and the existing exact scheme only. Circle Gateway and other schemes need separate adapters because their settlement and receipt semantics differ from a direct Vault transaction.

Why: this connects Arc Guardrails to the growing Agent service economy while keeping the Vault's contract policy in the loop.

### P1: Circle Gateway and Managed Wallet Adapter

Evaluate a Circle Gateway or managed-wallet execution adapter for Agent payments and gas sponsorship.

Required design constraints:

- A Gateway balance must not silently become a second, untracked treasury.
- Every Gateway payment must map to a Vault payment intent or an explicitly separate operating budget.
- The UI must show whether a payment was direct, Gateway-batched, or sponsored.
- Withdrawal, settlement delay, and reconciliation behavior must be visible.
- The Vault remains the source of truth for owner-approved spending capacity.

This should be prototyped after the x402 adapter, because the receipt and reconciliation model needs to be understood first.

### P1: Multi-Agent and Per-Counterparty Budgets

Extend the V2 Factory/Registry plan with ideas from CRA AGENT's per-seller limits:

- Multiple Agents per project with explicit roles: `SPENDER`, `POLICY_PROPOSER`, `OBSERVER`, and `RECOVERY_OPERATOR`.
- Per-recipient or per-service budget caps in addition to Vault-wide limits.
- Rate limits and spend velocity controls at the API layer.
- A shared project cap that is reporting-only unless a future contract role is audited.
- Circuit breakers for repeated failures or abnormal payment velocity.

Start with one primary Agent and read-only observers. Multiple spenders should wait for a role model and security review.

### P1: Public Settlement and Audit Page

Create a public, privacy-preserving status page inspired by CRA AGENT's settlement page:

- Number of confirmed, failed, rejected, and pending payments.
- Total volume and daily volume.
- Direct explorer links for confirmed transactions.
- Clear separation between self-test activity and external activity.
- Indexer freshness, Blockscout/RPC source, and cache age.

Do not publish private owner signatures, API keys, raw request bodies, or sensitive tenant information.

### P1: Dedicated Chain Collector and Event Indexer

Move from a request-time activity reader toward a durable indexer when Vault count or traffic justifies it:

- Backfill deployment-to-head events.
- Store `(chainId, transactionHash, logIndex)` as a unique event key.
- Track provider lag, gaps, retries, and last indexed block.
- Preserve raw event data alongside decoded `Spent` events.
- Treat Arc's native and ERC-20 USDC interfaces as one balance.
- Reconcile indexed events with transaction receipts.

The current Blockscout cache remains adequate for V1. A collector should only be added when it reduces operational risk rather than adding an always-on database prematurely.

### P2: ERC-8183 Job Escrow Rail

Add a job-based escrow path for work that cannot be represented by a single API call:

- Client creates a job and budget.
- Provider submits a deliverable hash.
- Evaluator completes or rejects the job.
- Client claims a refund after expiry where applicable.

This depends on an Arc mainnet deployment of the ERC-8183 contract, verified addresses, clear fee semantics, and a separate audit. The testnet reference contract should not be treated as a mainnet production dependency.

### P2: Service Discovery and Seller Registry

Explore an x402 service directory modeled on CRA AGENT's `arc_search`:

- Search by capability, price, network, and seller identity.
- Show a preview and exact payment requirements before signing.
- Cache catalog data and rate-limit discovery calls.
- Let an owner approve a seller domain or recipient before an Agent can pay it.

This is a broader marketplace direction and should not be added until the Vault payment adapter is stable.

### P2: Reusable USDC Accounting Package

Extract shared fixed-point accounting primitives:

- Branded six-decimal ERC-20 USDC values.
- Eighteen-decimal native gas values.
- Explicit, dust-preserving conversions.
- No floating-point arithmetic.
- Human-readable formatting and validation shared by the contract scripts, API, and UI.

This is a library quality improvement. It should not change the deployed V1 contract's units or behavior.

## Recommended Order After Review

1. Payment intent and receipt lifecycle, including reverted-receipt handling.
2. MCP/CLI interface using the same guarded Agent API.
3. Identity-aware recipient preflight and gas/Vault health monitoring.
4. x402 exact-scheme adapter backed by Vault `spend`.
5. Gateway or managed-wallet adapter after settlement reconciliation is specified.
6. Multi-agent roles, durable indexing, and public audit views.
7. ERC-8183 jobs and service discovery after the preceding security boundaries are mature.

## Non-Goals

- Do not add these features to the V1 submission branch while the grant review is pending.
- Do not replace contract enforcement with a model prompt, API policy, or Gateway setting.
- Do not add upgradeability to the deployed Vault to make future features easier.
- Do not merge multiple users into one shared Vault balance.
- Do not present testnet-only escrow, future wallet integrations, or a planned marketplace as shipped functionality.

## Reference

- CRA AGENT repository: https://github.com/giupy997/arcagentx402
- CRA AGENT live site: https://cra-agent.tech
- Arc Guardrails V2 plan: `docs/V2_UPGRADE_PLAN.md`
- Arc Microgrants submission record: `docs/MICROGRANTS_SUBMISSION.md`
