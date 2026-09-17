import { chmod, writeFile } from "node:fs/promises";

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const deployerKey = generatePrivateKey();
const agentKey = generatePrivateKey();
const deployer = privateKeyToAccount(deployerKey);
const agent = privateKeyToAccount(agentKey);

const contents = `ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io
ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
DEPLOYER_PRIVATE_KEY=${deployerKey}
AGENT_PRIVATE_KEY=${agentKey}
INITIAL_OWNER_ADDRESS=${deployer.address}
USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_TESTNET_VAULT_ADDRESS=
NEXT_PUBLIC_MAINNET_VAULT_ADDRESS=
`;

await writeFile(".env.local", contents, {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600,
});
await chmod(".env.local", 0o600);

console.log(`Temporary deployer: ${deployer.address}`);
console.log(`Temporary agent:    ${agent.address}`);
console.log("Secrets written to .env.local with mode 0600; the file is git-ignored.");
