import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

import { createPublicClient, createWalletClient, defineChain, getAddress, http, keccak256, parseUnits, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const chain = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_TESTNET_RPC_URL] } },
  blockExplorers: { default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io" } },
});
const agent = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const vault = getAddress(process.env.NEXT_PUBLIC_TESTNET_VAULT_ADDRESS);
const recipient = getAddress(process.env.MERCHANT_ADDRESS);
const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ account: agent, chain, transport: http() });
const abi = [{ type: "function", name: "spend", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }, { name: "paymentId", type: "bytes32" }], outputs: [] }];
const tokenAbi = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }];
const paymentId = keccak256(stringToHex(`research-api-${Date.now()}`));
const before = await publicClient.readContract({ address: process.env.USDC_ADDRESS, abi: tokenAbi, functionName: "balanceOf", args: [recipient] });
const { request } = await publicClient.simulateContract({ account: agent, address: vault, abi, functionName: "spend", args: [recipient, parseUnits("0.10", 6), paymentId] });
const hash = await walletClient.writeContract(request);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
const after = await publicClient.readContract({ address: process.env.USDC_ADDRESS, abi: tokenAbi, functionName: "balanceOf", args: [recipient] });

console.log(JSON.stringify({ status: receipt.status, hash, explorer: `https://explorer.testnet.arc.io/tx/${hash}`, paymentId, recipient, before: before.toString(), after: after.toString(), delta: (after - before).toString() }, null, 2));
