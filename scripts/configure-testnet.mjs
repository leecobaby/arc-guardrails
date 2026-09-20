import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  getAddress,
  http,
  isAddress,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const chain = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_TESTNET_RPC_URL] } },
  blockExplorers: { default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io" } },
});

const usdcAddress = getAddress(process.env.USDC_ADDRESS);
const vaultAddress = getAddress(process.env.NEXT_PUBLIC_TESTNET_VAULT_ADDRESS);
const agentKey = process.env.AGENT_PRIVATE_KEY;
const merchant = process.env.MERCHANT_ADDRESS;

if (!agentKey || !merchant || !isAddress(merchant)) {
  throw new Error("AGENT_PRIVATE_KEY and MERCHANT_ADDRESS are required");
}

const ownerAccount = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const agentAccount = privateKeyToAccount(agentKey);
const publicClient = createPublicClient({ chain, transport: http() });
const ownerClient = createWalletClient({ account: ownerAccount, chain, transport: http() });
const usdc = [...erc20Abi, { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] }];
const vaultAbi = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "setAgent", stateMutability: "nonpayable", inputs: [{ name: "newAgent", type: "address" }], outputs: [] },
  { type: "function", name: "setRecipient", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "allowed", type: "bool" }], outputs: [] },
  { type: "function", name: "setPolicy", stateMutability: "nonpayable", inputs: [{ name: "maxPerTransaction", type: "uint256" }, { name: "dailyLimit", type: "uint256" }, { name: "expiresAt", type: "uint64" }, { name: "allowlistOnly", type: "bool" }], outputs: [] },
];

async function wait(hash, label) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} failed: ${hash}`);
  console.log(`${label}: ${hash}`);
}

const agentGasHash = await ownerClient.writeContract({ address: usdcAddress, abi: usdc, functionName: "transfer", args: [agentAccount.address, parseUnits("2", 6)] });
await wait(agentGasHash, "Agent gas buffer (2 USDC)");

const approvalHash = await ownerClient.writeContract({ address: usdcAddress, abi: usdc, functionName: "approve", args: [vaultAddress, parseUnits("5", 6)] });
await wait(approvalHash, "Vault approval (5 USDC)");

const depositHash = await ownerClient.writeContract({ address: vaultAddress, abi: vaultAbi, functionName: "deposit", args: [parseUnits("5", 6)] });
await wait(depositHash, "Vault deposit (5 USDC)");

const agentHash = await ownerClient.writeContract({ address: vaultAddress, abi: vaultAbi, functionName: "setAgent", args: [agentAccount.address] });
await wait(agentHash, "Agent policy address");

const recipientHash = await ownerClient.writeContract({ address: vaultAddress, abi: vaultAbi, functionName: "setRecipient", args: [getAddress(merchant), true] });
await wait(recipientHash, "Merchant allowlist");

const expiry = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
const policyHash = await ownerClient.writeContract({ address: vaultAddress, abi: vaultAbi, functionName: "setPolicy", args: [parseUnits("1", 6), parseUnits("5", 6), expiry, true] });
await wait(policyHash, "Spending policy");

console.log(JSON.stringify({ chainId: chain.id, vault: vaultAddress, owner: ownerAccount.address, agent: agentAccount.address, merchant: getAddress(merchant), policy: { perTransaction: "1 USDC", daily: "5 USDC", expiresAt: expiry.toString() } }, null, 2));
