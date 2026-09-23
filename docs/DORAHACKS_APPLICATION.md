# Arc Guardrails — DoraHacks application

Prepared and submitted September 23, 2026 for Arc Microgrants. Public BUIDL: https://dorahacks.io/buidl/49084. The [submission record](MICROGRANTS_SUBMISSION.md) captures the portal confirmation and Under Review status.

## Brand asset

- Submission logo: [480 x 480 PNG](../public/arc-guardrails-logo.png), generated with the built-in image generation tool.
- Direction: deep forest green background, an ivory two-part shield surrounding a mint budget square; no third-party brand mark.
- Final refinement prompt: "Preserve the centered two-piece ivory shield silhouette and its mint square; remove glow, shadows and transparency; use a solid deep forest green background with clean edges and generous margins. No text. Premium minimal brand avatar."

## Name

Arc Guardrails

## Tagline

Give AI agents a USDC budget with spending limits enforced on Arc.

## Description

AI agents can automate work, but funding a hot wallet gives them broad control over its balance. Arc Guardrails gives an agent a defined USDC budget inside a vault whose rules are enforced by a smart contract.

An Owner funds the vault, appoints an Agent, and configures approved recipients, a per-payment limit, a UTC daily budget, and an expiration time. Each payment has a unique ID to prevent replay. The Agent can execute permitted payments but cannot raise its own limits, change the allowlist, or take ownership. The Owner can pause spending, withdraw funds, rotate the Agent, and transfer control through a two-step handoff.

The working V1 includes a Solidity vault, a Next.js operations console, and an authenticated Agent payment API. Console payments use a short-lived Owner signature to authorize a payment; the server-side Agent then submits the onchain transaction. External automation uses an API key. Both paths remain subject to the same contract policy, and private keys stay on the server.

Arc is the settlement layer: payments are denominated in USDC, and the Agent also pays transaction fees in USDC. This makes small automated payments easier to budget without maintaining a separate volatile gas asset. The console displays public payment events using Blockscout indexing.

The mainnet deployment has completed a 0.01 USDC payment from the configured Agent to the Owner's allowlisted address. This is a working settlement and authorization demonstration, not claimed commercial usage. The repository is public under the MIT license, and source verification is available on Sourcify.

V1 deliberately serves one Owner/team and one Agent per vault. Future work will evaluate independent vault creation, tenant-scoped Agent APIs, and managed wallet integrations based on feedback. Those features are documented as a V2 plan and are not part of the current release. This prototype has not received an external security audit.

## Review links

- Live console: https://arc-guardrails.vercel.app — select Mainnet; reading does not require a wallet.
- Public repository: https://github.com/leecobaby/arc-guardrails (stable branch: v1).
- Builder: https://github.com/leecobaby
- Mainnet contract: https://explorer.arc.io/address/0xA87Dc3978dB533daCfBD8aA85b9e3c77aFFdf1D7
- Mainnet deployment: https://explorer.arc.io/tx/0x2b59e2895871faad8a73dfe044b406ede9f6719b872847a05874200603c9837a
- Mainnet payment: https://explorer.arc.io/tx/0x8d43557cf6da9b5dae9e5dab81951557333e700ce5c8354f10c44556bf59e718
- Sourcify: https://sourcify.dev/server/repo-ui/5042/0xA87Dc3978dB533daCfBD8aA85b9e3c77aFFdf1D7

## Builder introduction

Arc Guardrails is built by Leeco (GitHub: https://github.com/leecobaby), an independent full-stack developer exploring practical AI-agent and stablecoin applications. I developed the Solidity policy vault, Next.js console, Agent payment API, tests, and deployment workflow, using AI coding assistance throughout development. V1 is deployed on Arc mainnet and testnet and has completed a real 0.01 USDC mainnet demonstration payment. I am submitting as an individual builder and welcome technical feedback and collaboration from the Arc community.

## Next milestone / use of grant

Improve the reliability of payment execution and indexing, add stronger API abuse controls, and run more failure-path tests before expanding the prototype. A microgrant would support hosting, small onchain experiments, and documentation while I gather feedback from other Arc builders. A multi-user platform would be a later milestone rather than a claim about today's product.

## Event-specific answers

### In two sentences, what does your project do?

Arc Guardrails lets an owner give an AI agent a USDC budget inside a vault that enforces approved recipients, per-payment and daily limits, expiry, and replay protection onchain. A working console and authenticated Agent API execute permitted payments on Arc mainnet while the owner retains control to pause spending, withdraw funds, and rotate the agent.

### What does it use Arc for?

Arc is the execution and settlement layer for the Solidity vault: it holds USDC, enforces spending policy, and publishes a Spent event for each permitted payment. The Agent uses USDC to pay gas as well as settlement value, keeping operational budgeting in one currency, and the console reads Arc contract state and indexed payment history. V1 has completed a real 0.01 USDC mainnet demonstration payment to the Owner's allowlisted address.

### Applicant-confirmed eligibility answers

- Deployed to Arc before this project: No.
- Circle/Arc grant, bounty, or prize previously received for this project: No.
- Team recruitment requested: No.
- Track: All BUIDLs; category: Crypto / Web3; L1: Arc.
