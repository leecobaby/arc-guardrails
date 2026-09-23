# Arc Guardrails

Arc Guardrails is an onchain USDC policy vault for autonomous agents. An owner funds a vault, assigns one agent wallet, approves recipients, and sets per-transaction, daily, and time limits. The contract enforces every payment independently of the model or wallet provider.

The project targets the [Arc Microgrants program](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq). V1 is an MIT-licensed prototype deployed on Arc mainnet and testnet, with a completed mainnet USDC payment.

Live mainnet/testnet console: [arc-guardrails.vercel.app](https://arc-guardrails.vercel.app) — select **Mainnet** to inspect the mainnet deployment. No wallet is needed to view activity.

Source repository: [github.com/leecobaby/arc-guardrails](https://github.com/leecobaby/arc-guardrails)

Arc Microgrants application: [DoraHacks BUIDL #49084](https://dorahacks.io/buidl/49084), submitted September 23, 2026. Submission status and evidence are recorded in [the application record](docs/MICROGRANTS_SUBMISSION.md).

## Mainnet proof

- Network: Arc, chain ID `5042`.
- Vault: [`0xA87Dc3978dB533daCfBD8aA85b9e3c77aFFdf1D7`](https://explorer.arc.io/address/0xA87Dc3978dB533daCfBD8aA85b9e3c77aFFdf1D7).
- [Deployment transaction](https://explorer.arc.io/tx/0x2b59e2895871faad8a73dfe044b406ede9f6719b872847a05874200603c9837a), September 22, 2026.
- [Successful Agent payment of 0.01 USDC](https://explorer.arc.io/tx/0x8d43557cf6da9b5dae9e5dab81951557333e700ce5c8354f10c44556bf59e718), block `22145955`. This was a demonstration payment to the Owner's address, not a third-party commercial purchase.
- [Source verified on Sourcify](https://sourcify.dev/server/repo-ui/5042/0xA87Dc3978dB533daCfBD8aA85b9e3c77aFFdf1D7). Blockscout verification is separate and has not yet been confirmed.

Mainnet and testnet deployments happen to share an address; balances, permissions, and payment history are independent. This V1 demo uses one Owner and one Agent per Vault. Multi-user Factory/Registry support is a [V2 plan](docs/V2_UPGRADE_PLAN.md), not a shipped feature. The contracts have not received an external audit.

## Why Arc

- Arc uses USDC for gas, so owners and agents do not need a separate volatile gas token.
- The canonical USDC balance is available through the six-decimal ERC-20 interface at `0x3600000000000000000000000000000000000000`.
- Deterministic sub-second finality makes API-scale agent payments auditable immediately.
- Arc's EVM compatibility supports the Solidity vault and standard EVM wallet integrations. V1 uses MetaMask and a server-side EOA; Circle wallet integrations are future work.

## What ships

- `ArcGuardVault`: non-upgradeable USDC vault with an allowlist, per-transaction limit, UTC daily limit, policy expiry, replay-safe payment IDs, pause/recovery, agent rotation, and two-step ownership transfer.
- Operations console: Arc testnet/mainnet switching, MetaMask and other injected-wallet selection, vault funding, policy and recipient controls, agent payments, indexed activity history, pausing, and ownership transfer.
- Agent payment endpoint: `POST /api/agent/pay` signs with a server-only Agent key. The console signs a short-lived Owner authorization message, then submits the payment through this endpoint; the contract still enforces every policy.
- Contract tests for authorization, allowlists, replay protection, limits, day rollover, expiry, emergency withdrawal, agent rotation, and ownership transfer.

## Architecture

```text
Owner wallet ---- approve/deposit USDC ----> ArcGuardVault
      |                                       |
      +-- policy, allowlist, pause ------------+
                                              |
Agent wallet/API ---- spend(invoice id) ------+---- USDC ----> approved merchant
                                              |
                                contract checks every rule
```

Circle Agent Stack can add wallet-level controls. Arc Guardrails is a separate provider-independent contract boundary around the owner's funds, so the policy and audit trail remain onchain even if the agent wallet implementation changes.

## Requirements

- Node.js 22 or newer (`.nvmrc` is included)
- An injected EVM wallet for browser operations
- A dedicated deployer wallet funded with test USDC or a small amount of real Arc USDC

Hardhat 3 requires Node 22+. Next.js also runs on that version.

## Local setup

```bash
nvm use
npm install
cp .env.example .env.local
npm run contract:build
npm run contract:test
npm run dev
```

For disposable test-only wallets, run:

```bash
node scripts/create-temp-wallets.mjs
```

The script refuses to overwrite an existing `.env.local`, writes secrets with mode `0600`, and prints only public addresses. All `.env*` files except `.env.example` are Git-ignored.

For the activity ledger, set `BLOCKSCOUT_PRO_API_KEY` in `.env.local` and in your hosting provider's server-side environment. The key is sent only from `/api/activity` to Blockscout MCP, never bundled into the browser. The ledger reads the latest 12 `Spent` events from Blockscout's full indexed contract history, so it is not limited by the public RPC's recent-block log window. Do not prefix this variable with `NEXT_PUBLIC_`.

Activity data is shared through the Next/Vercel data cache for 120 seconds, so ordinary visitors read the same cached snapshot instead of generating one Blockscout request each. After a confirmed Agent payment, the paying browser polls for that transaction for up to two minutes; once the event is indexed, the shared cache is invalidated and polling stops. A payment receipt is shown immediately while the indexer catches up.

## Networks

| Network | Chain ID | RPC | Explorer |
| --- | ---: | --- | --- |
| Arc Testnet | `5042002` | `https://rpc.testnet.arc.io` | `https://explorer.testnet.arc.io` |
| Arc Mainnet | `5042` | `https://rpc.mainnet.arc.io` | `https://explorer.arc.io` |

Get test USDC from the [Circle Faucet](https://faucet.circle.com). Test assets have no monetary value.

## Deploy

Deploy and write a public deployment record to `deployments/<network>.json`:

```bash
npm run deploy:testnet
npm run deploy:mainnet
```

After a testnet deployment, initialize the single-tenant V1 demo and send one restricted payment:

```bash
npm run testnet:merchant
npm run testnet:configure
npm run testnet:payment
```

`testnet:configure` transfers a small Agent gas buffer, deposits 5 test USDC, sets a 1 USDC per-payment cap, a 5 USDC daily cap, a seven-day expiry, and one merchant allowlist entry. It is for testnet validation only.

After deployment, set the matching browser-visible address:

```dotenv
NEXT_PUBLIC_TESTNET_VAULT_ADDRESS=0x...
NEXT_PUBLIC_MAINNET_VAULT_ADDRESS=0x...
```

Rebuild the frontend after changing a `NEXT_PUBLIC_` value. Mainnet deployment consumes real USDC and is irreversible; use a dedicated minimally funded deployer.

## Agent payment API

The private key never enters the browser bundle. Console payments use a short-lived, offchain signature from the current Owner wallet; external automation must provide `x-agent-api-key`. The same `AGENT_PRIVATE_KEY` can be used on both Arc networks, while each request selects the target vault with `chainId`.

```bash
curl -X POST http://localhost:3000/api/agent/pay \
  -H "content-type: application/json" \
  -H "x-agent-api-key: $AGENT_API_KEY" \
  -d '{"chainId":5042002,"recipient":"0x...","amount":"0.10","invoice":"research-api-042"}'
```

The Agent must already be configured in the selected vault and hold enough native Arc USDC for gas on that network. The recipient, amount, expiry, daily budget, and replay-safe invoice hash are still enforced by the contract. Deploy the same Agent EOA to both networks by funding the same private key separately on testnet and mainnet.

## Ownership handoff

The contract inherits OpenZeppelin `Ownable2Step`:

1. The current owner calls `transferOwnership(newOwner)` from the Owner tab.
2. `pendingOwner` updates, but the current owner retains control.
3. The specified address calls `acceptOwnership()`.

The testnet handoff to `0xE3608F65BD6D8b4f88b889a778D97a3F02e23d1A` completed in [this acceptance transaction](https://explorer.testnet.arc.io/tx/0x8ac4d2511c3b9d3d89d283b0e74296de75484f9b1da5da085405730485871b60). The mainnet vault was deployed with that address as its initial Owner, so no mainnet handoff is required.

Renouncing ownership is intentionally disabled so funds cannot be stranded. The initial temporary owner can therefore be replaced by the user's permanent address after review.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run contract:test
```

See [Security](docs/SECURITY.md) for the threat model and [Microgrants submission](docs/MICROGRANTS_SUBMISSION.md) for the remaining eligibility checklist.

## License

MIT
