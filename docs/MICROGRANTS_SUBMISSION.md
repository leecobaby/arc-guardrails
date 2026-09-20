# Arc Microgrants submission draft

## Project

**Name:** Arc Guardrails

**One-line summary:** A non-custodial Arc USDC vault that lets people fund autonomous agents without giving them unrestricted access to a hot wallet.

## Short description

Autonomous agents need to pay for APIs, data, storage, and other services, but a normal hot wallet gives the agent broad authority over every dollar. Arc Guardrails puts an immutable policy boundary between an owner's USDC and an agent wallet. Owners configure an allowlist, per-payment cap, UTC daily budget, and expiry. Agents submit payments with unique invoice IDs; the Arc contract enforces every rule and publishes an auditable event trail. Owners can pause, recover funds, rotate the agent, and transfer control through a two-step handoff.

Arc is core to the product: USDC pays both application value and gas, deterministic finality makes payments immediately auditable, and the canonical USDC interface keeps treasury accounting in dollars. The included operations console and authenticated agent endpoint demonstrate the complete flow.

## Why it is worth taking further

- Converts agent spending limits from an application promise into a contract invariant.
- Works with injected wallets, Circle Agent Stack, or any EVM agent wallet.
- Gives merchants final USDC settlement and gives owners replay-safe invoices and a public ledger.
- Keeps the first deployment deliberately small, immutable, and auditable.

## Submission fields

- Live application: `TBD`
- Public repository: `TBD`
- Arc mainnet contract: `TBD`
- Example mainnet transaction: `TBD`
- Arc testnet contract (development only): `0xA87Dc3978dB533daCfBD8aA85b9e3c77aFFdf1D7`
- Arc testnet payment (development only): `0xca34972b022d5c7983a9982e4e39c05233afdd8c25d46244381014ea1f19328f`
- Public builder profile: `TBD`
- Payout wallet on Arc: `TBD`

## Eligibility checklist

- [x] New project created for this program
- [x] Working application and public-source-ready repository
- [x] Arc-specific contract and USDC integration
- [x] Test suite, security notes, and two-step ownership handoff
- [x] Testnet Vault configured and real restricted payment verified
- [ ] Deploy contract on Arc mainnet
- [ ] Execute and link a small real Arc USDC transaction
- [ ] Publish repository
- [ ] Publish live application
- [ ] Add an authorized public builder profile
- [ ] Submit before October 14, 2026 at 23:59 ET

Testnet-only projects are not eligible. The current project must not be submitted until the mainnet contract, live URL, public repository, and builder profile fields are complete.

## Official rules

[Arc Microgrants](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq): twenty non-dilutive grants of 500 USDC, rolling review, open to individuals and teams subject to jurisdiction screening. Submissions require a working Arc mainnet deployment, live link, public repository, short description, and public builder profile.
