# Arc Guardrails V2 Upgrade Plan

V2 is a future platform direction. It is intentionally not implemented in the V1参赛主线. V1 remains a single-owner, single-agent vault with a small attack surface and a clear Microgrant demo.

## 1. Product evolution

### V1

One user or team controls one immutable vault. The owner funds it, selects one Agent, defines a policy, and watches payments.

### V2

Arc Guardrails becomes a multi-tenant platform where each user can create and manage multiple isolated vaults for different projects, teams, and Agents. The platform owns orchestration and observability; users retain wallet ownership and vault authority.

V2 should preserve V1's core promise: the model and provider may change, but the user's USDC policy is enforced onchain.

## 2. Contract architecture

### VaultFactory

- Deploys a minimal-proxy or deterministic clone of the audited `ArcGuardVault` implementation.
- Constructor data sets the initial owner, Agent, policy, and USDC address.
- Emits `VaultCreated(owner, vault, projectId, salt)`.
- Rejects unsupported token addresses and duplicate salts per owner.
- Supports deterministic address previews so the UI can show the future Vault before deployment.
- Factory owner controls only implementation version registration and emergency pause policy; it cannot withdraw user funds.

### VaultRegistry

- Records Vault address, owner, project identifier, deployment chain, implementation version, and lifecycle state.
- Registry writes are append-only for auditability; user metadata stays offchain.
- A Vault can be marked archived without changing its funds or ownership.
- Registry events are the canonical indexer input.

### Per-user isolation

- Every Vault has its own owner, Agent set, policy, allowlist, expiry, and USDC balance.
- No shared omnibus balance and no cross-tenant withdrawal path.
- Platform operators cannot impersonate user owners.
- Any future platform fee must be explicit, bounded, and paid from an application fee path, never from Vault balances implicitly.

## 3. Registration and wallet authentication

V2 should support both self-custody and optional managed Agent wallets.

### User identity

- Email or social onboarding may create a platform account, but it is not the authority for funds.
- Wallet ownership is proven with SIWE-style chain-specific signatures and a nonce stored server-side.
- Nonces are single-use, expire quickly, and include the domain, chain ID, origin, and statement.
- Sessions use short-lived access tokens plus rotating refresh tokens stored in secure, HttpOnly cookies.
- A user may attach multiple wallets, but only explicitly verified wallets can own or administer Vaults.

### Agent identity

- Agent wallets are separate from user owner wallets.
- An Agent is registered with a public address, name, project, policy scope, and status.
- Private keys never enter browser bundles or the primary database.
- Circle Developer-Controlled Wallets, Modular Wallets, EOA keys, or external Agent providers can implement the Agent adapter behind the same interface.

## 4. Multi-tenant Agent API

Replace the V1 global `AGENT_PRIVATE_KEY` with an authenticated, scoped execution service.

- Every request carries `tenantId`, `vaultId`, `agentId`, `recipient`, `amount`, and an idempotency key.
- API authorization verifies that the session or service token can operate that Vault and Agent.
- A policy cache is advisory only; the contract remains authoritative.
- Idempotency keys are unique per Vault and are persisted before broadcasting.
- Request signing and transaction broadcasting happen in a worker, never in a browser request.
- Per-tenant and per-Agent rate limits, daily request quotas, replay detection, and circuit breakers are mandatory.
- The worker records simulation result, submitted hash, receipt, revert reason, gas cost, and final indexed event.
- Queue retries must be safe: the same idempotency key must never create a second payment.

## 5. Event indexing and data model

Start with an Arc RPC log indexer and move to a managed indexer when usage requires it.

### Core tables

- `users`: internal ID, status, created time, risk flags.
- `wallets`: user ID, checksum address, chain ID, verification timestamp, label.
- `projects`: user ID, name, slug, status.
- `vaults`: project ID, chain ID, address, implementation version, owner, status.
- `agents`: vault ID, address, provider, status, last activity.
- `policies`: vault ID, limits, expiry, allowlist version, source transaction.
- `recipients`: vault ID, address, label, active state.
- `payment_intents`: vault ID, idempotency key, recipient, amount, payment ID, status.
- `transactions`: hash, chain ID, block, status, gas, receipt, error.
- `vault_events`: decoded event name, block/log index, raw data, indexed timestamp.

### Indexing requirements

- Store `(chainId, transactionHash, logIndex)` as a unique event key.
- Treat Arc's native and ERC-20 USDC interfaces as one underlying balance; never double-count native and ERC-20 Transfer events.
- Reorg handling can be minimal on Arc because committed transactions have deterministic finality, but RPC retries and provider outages still need reconciliation.
- Backfill a bounded deployment-to-head range before marking a Vault healthy.

## 6. Multiple Agents and projects

- A project can own many Vaults; a Vault can have one or more Agents.
- V2 should begin with one primary Agent plus optional read-only observers, then add multiple spenders only after a role model is audited.
- Agent roles should be explicit: `SPENDER`, `POLICY_PROPOSER`, `OBSERVER`, `RECOVERY_OPERATOR`.
- Policy changes remain owner-approved; Agents cannot grant themselves recipients, raise limits, or transfer ownership.
- Project-level budgets are reporting aggregates, not shared withdrawal authority.

## 7. Gas and funds management

- Display ERC-20 USDC amounts with 6 decimals. Use native 18-decimal units only for raw gas and `msg.value` operations.
- Each Agent needs a separate gas buffer or a supported Circle gas sponsorship path.
- V2 should monitor gas balance and send an alert before the Agent can no longer submit transactions.
- Owner deposits and withdrawals remain direct USDC transfers to the Vault.
- Optional funding helpers can use CCTP or Gateway, but bridging must be an explicit user action with destination-chain confirmation.
- Mainnet transactions require a separate confirmation path and should never fall back from testnet silently.

## 8. Security model

- Threat model user wallet compromise, Agent key compromise, malicious recipient, replay, API abuse, RPC equivocation, database tampering, and insider abuse.
- Use audited OpenZeppelin primitives, immutable implementations where possible, and a formal upgrade delay if upgrades become necessary.
- Factory upgrades require a timelock, announced implementation hash, migration tests, and an emergency pause that cannot withdraw user funds.
- Use separate keys for deployment, factory administration, relayer, and treasury operations.
- Add per-tenant spend velocity limits at the API layer in addition to per-Vault contract limits.
- Require two-person review for production contract upgrades and mainnet deployment.
- Publish verified source, deployment hashes, threat model, incident contact, and rollback/pausing runbook.

## 9. Database and frontend modules

### Backend modules

- Identity and wallet verification
- Tenant/project/Vault service
- Factory deployment service
- Agent registry and provider adapters
- Policy snapshot service
- Payment intent and idempotency service
- Transaction relayer/worker
- RPC/indexer ingestion
- Notifications and risk alerts
- Audit log and admin review

### Frontend modules

- Account and wallet connection
- Project switcher
- Vault creation wizard with deterministic preview
- Vault dashboard and owner/Agent roles
- Policy editor with human-readable simulation
- Recipient and Agent management
- Payment intent review and history
- Gas buffer and health monitoring
- Chain/network safety banner
- Team member and session management

## 10. Migration strategy

1. Keep V1 Vaults immutable and supported indefinitely.
2. Deploy V2 Factory and Registry separately; do not change V1 bytecode.
3. Let a user create a new V2 Vault and verify ownership with a wallet signature.
4. Owner manually transfers funds from V1 to V2 after comparing policy and recipient state.
5. Provide an export tool that copies V1 policy and allowlist into a reviewable V2 deployment transaction, but require the owner to approve it.
6. Keep V1 event history linked to the new V2 Vault in the database without rewriting onchain history.
7. Add a visible “legacy V1” badge and disable new features for V1 rather than silently changing behavior.
8. After a long observation period, the owner may pause V1 and transfer any remaining funds to V2. There is no forced migration.

## 11. V2 non-goals for now

- No Factory or Registry implementation in the V1 branch.
- No database, account system, or global relayer in the V1 submission.
- No upgradeability added to the V1 Vault.
- No arbitrary token support before USDC accounting, event indexing, and security review are mature.
