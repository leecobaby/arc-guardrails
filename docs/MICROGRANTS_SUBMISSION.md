# Arc Microgrants submission record

## Submission receipt

- Submitted: September 23, 2026, through DoraHacks.
- BUIDL: [Arc Guardrails #49084](https://dorahacks.io/buidl/49084).
- Event: Arc Microgrants | Circle (event ID 2238).
- Status at submission: **Under Review**. This does not mean approved or awarded.
- Confirmation displayed: "BUIDL Submitted!" and "Your BUIDL Arc Guardrails has been submitted to hackathon Arc Microgrants | Circle and is now under review."
- [Event submission status](https://dorahacks.io/hackathon/arc-microgrants/buidl).
- Applicant account: leeco1917; public builder profile: https://github.com/leecobaby.
- The applicant confirmed the organizer disclaimer and final submission agreements. Contact details were supplied privately in DoraHacks and are intentionally not stored in this public repository.

## Project

**Name:** Arc Guardrails

**One-line summary:** A non-custodial Arc USDC vault that lets people fund autonomous agents without giving them unrestricted access to a hot wallet.

## Short description

Autonomous agents need to pay for APIs, data, storage, and other services, but a normal hot wallet gives the agent broad authority over every dollar. Arc Guardrails puts an immutable policy boundary between an owner's USDC and an agent wallet. Owners configure an allowlist, per-payment cap, UTC daily budget, and expiry. Agents submit payments with unique invoice IDs; the Arc contract enforces every rule and publishes an auditable event trail. Owners can pause, recover funds, rotate the agent, and transfer control through a two-step handoff.

Arc is core to the product: USDC pays both application value and gas, deterministic finality makes payments immediately auditable, and the canonical USDC interface keeps treasury accounting in dollars. The included operations console and authenticated agent endpoint demonstrate the complete flow.

## Why it is worth taking further

- Converts agent spending limits from an application promise into a contract invariant.
- V1 uses MetaMask for Owner controls and a server-side EOA for Agent execution; the contract can support other EVM signers. Circle wallet integration is future work.
- Gives merchants final USDC settlement and gives owners replay-safe invoices and a public ledger.
- Keeps the first deployment deliberately small, immutable, and auditable.

## Submission fields

- Live application: https://arc-guardrails.vercel.app
- Public repository: https://github.com/leecobaby/arc-guardrails
- Arc mainnet contract: `0xA87Dc3978dB533daCfBD8aA85b9e3c77aFFdf1D7`
- Arc mainnet source verification: https://sourcify.dev/server/repo-ui/5042/0xA87Dc3978dB533daCfBD8aA85b9e3c77aFFdf1D7
- Example mainnet transaction: https://explorer.arc.io/tx/0x8d43557cf6da9b5dae9e5dab81951557333e700ce5c8354f10c44556bf59e718 (0.01 USDC demonstration payment to the Owner, block 22145955)
- Arc testnet contract (development only): `0xA87Dc3978dB533daCfBD8aA85b9e3c77aFFdf1D7`
- Arc testnet payment (development only): `0xca34972b022d5c7983a9982e4e39c05233afdd8c25d46244381014ea1f19328f`
- Public builder profile: `https://github.com/leecobaby`
- Payout wallet on Arc: to be confirmed by the applicant if requested; the deployed Vault is not a payout wallet.
- Submission portal: https://dorahacks.io/hackathon/arc-microgrants
- Application text: [DORAHACKS_APPLICATION.md](DORAHACKS_APPLICATION.md)

## Eligibility checklist

- [x] New project created for this program
- [x] Working application and public-source-ready repository
- [x] Arc-specific contract and USDC integration
- [x] Test suite, security notes, and two-step ownership handoff
- [x] Testnet Vault configured and real restricted payment verified
- [x] Public repository and live testnet console
- [x] Deploy contract on Arc mainnet
- [x] Execute and link a small real Arc USDC transaction
- [x] Publish repository
- [x] Publish live application
- [x] Add public builder profile: https://github.com/leecobaby
- [x] Submit before October 14, 2026 at 23:59 ET

Both event registration and project submission are complete. The portal confirmation and event listing were checked; the listing displayed Arc Guardrails as "Your BUIDL" with "Under Review" status. No award or payout has been confirmed.

## Official rules

[Arc Microgrants](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq): twenty non-dilutive grants of 500 USDC, rolling review, open to individuals and teams subject to jurisdiction screening. Submissions require a working Arc mainnet deployment, live link, public repository, short description, and public builder profile.
