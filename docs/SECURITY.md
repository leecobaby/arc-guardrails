# Security notes

Arc Guardrails is a prototype handling digital assets. It has not received an external audit.

## Contract controls

- The vault is non-upgradeable and has no proxy, delegate call, or arbitrary external call.
- Only the configured agent can call `spend`.
- Each nonzero payment ID can be used once.
- A payment must satisfy policy expiry, recipient allowlist, per-transaction limit, and UTC daily limit.
- State is updated before the USDC transfer and all value-moving functions are non-reentrant.
- The owner can pause agent spending and withdraw funds even while paused.
- Ownership transfer requires acceptance by the nominated address.
- Ownership renunciation is disabled to avoid permanently stranded funds.

## Key handling

- Never use a valuable personal wallet as the automated agent.
- Keep the deployer and agent keys in `.env.local` or a managed secret store.
- `NEXT_PUBLIC_` variables are public. They must contain addresses only, never private keys or API secrets.
- Protect `/api/agent/pay` with a high-entropy API key and network-level rate limiting in production.
- Fund the agent only with the minimum native USDC required for gas.

## Arc-specific considerations

Arc exposes one USDC balance through two interfaces:

- Native USDC uses 18 decimals for gas and `msg.value`.
- ERC-20 USDC uses 6 decimals at `0x3600000000000000000000000000000000000000`.

The vault uses only the ERC-20 interface and all limits are six-decimal amounts. Indexers must not count native and ERC-20 representations as separate assets. Arc can reject transfers involving blocklisted addresses, and those transactions may still consume gas.

## Residual risks

- USDC issuer controls and address blocking still apply.
- A compromised owner can change policy, rotate the agent, or withdraw funds.
- A compromised agent can spend up to the configured limits at approved recipients.
- Allowlisted recipient contracts or services may be malicious or unavailable.
- The API authentication shown here is suitable for a prototype, not a substitute for production identity, rate limiting, monitoring, and hardware-backed keys.
