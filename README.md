# Arc Guardrails

Arc Guardrails is an onchain USDC policy vault for autonomous agents. An owner funds a vault, assigns one agent wallet, approves recipients, and sets per-transaction, daily, and time limits. The contract enforces every payment independently of the model or wallet provider.

The project targets the [Arc Microgrants program](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq). It is new work, open source, and designed for a small real Arc mainnet deployment.

Live testnet console: [arc-guardrails.vercel.app](https://arc-guardrails.vercel.app)  
Source repository: [github.com/leecobaby/arc-guardrails](https://github.com/leecobaby/arc-guardrails)

## Why Arc

- Arc uses USDC for gas, so owners and agents do not need a separate volatile gas token.
- The canonical USDC balance is available through the six-decimal ERC-20 interface at `0x3600000000000000000000000000000000000000`.
- Deterministic sub-second finality makes API-scale agent payments auditable immediately.
- Arc's EVM compatibility lets the same immutable policy contract work with injected wallets and Circle Agent Stack wallets.

## What ships

- `ArcGuardVault`: non-upgradeable USDC vault with an allowlist, per-transaction limit, UTC daily limit, policy expiry, replay-safe payment IDs, pause/recovery, agent rotation, and two-step ownership transfer.
- Operations console: Arc testnet/mainnet switching, MetaMask and other injected-wallet selection, vault funding, policy and recipient controls, agent payments, indexed activity history, pausing, and ownership transfer.
- Authenticated agent endpoint: `POST /api/agent/pay` signs with a server-only agent key and lets the contract accept or reject the payment.
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

The endpoint requires `x-agent-api-key`. The private key never enters the browser bundle.

```bash
curl -X POST http://localhost:3000/api/agent/pay \
  -H "content-type: application/json" \
  -H "x-agent-api-key: $AGENT_API_KEY" \
  -d '{"recipient":"0x...","amount":"0.10","invoice":"research-api-042"}'
```

The agent must already be configured in the vault and hold enough native Arc USDC for gas. The recipient, amount, expiry, daily budget, and replay-safe invoice hash are still enforced by the contract.

## Ownership handoff

The contract inherits OpenZeppelin `Ownable2Step`:

1. The current owner calls `transferOwnership(newOwner)` from the Owner tab.
2. `pendingOwner` updates, but the current owner retains control.
3. The specified address calls `acceptOwnership()`.

The V1 testnet transfer is currently pending for the designated wallet. Open the verified contract in the [Arc Testnet Explorer](https://explorer.testnet.arc.io/address/0xA87Dc3978dB533daCfBD8aA85b9e3c77aFFdf1D7?tab=contract), connect the designated wallet, and call `acceptOwnership()` once. The current owner remains the deployer until that transaction confirms.

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
