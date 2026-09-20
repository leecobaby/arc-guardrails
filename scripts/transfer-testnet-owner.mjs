import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const newOwnerInput = process.argv[2];
if (!isAddress(newOwnerInput ?? "")) {
  throw new Error("Pass the new owner EVM address as the first argument.");
}

const chain = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_TESTNET_RPC_URL] } },
  blockExplorers: { default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io" } },
});
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ account, chain, transport: http() });
const vault = getAddress(process.env.NEXT_PUBLIC_TESTNET_VAULT_ADDRESS);
const abi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "pendingOwner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "transferOwnership", stateMutability: "nonpayable", inputs: [{ name: "newOwner", type: "address" }], outputs: [] },
];

const currentOwner = await publicClient.readContract({ address: vault, abi, functionName: "owner" });
const pendingOwner = await publicClient.readContract({ address: vault, abi, functionName: "pendingOwner" });
if (currentOwner.toLowerCase() !== account.address.toLowerCase()) {
  throw new Error(`Configured deployer is not current owner: ${currentOwner}`);
}

const newOwner = getAddress(newOwnerInput);
console.log(JSON.stringify({ vault, currentOwner, pendingOwner, newOwner }, null, 2));
const hash = await walletClient.writeContract({ address: vault, abi, functionName: "transferOwnership", args: [newOwner] });
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(JSON.stringify({ status: receipt.status, hash, explorer: `https://explorer.testnet.arc.io/tx/${hash}`, pendingOwner: newOwner }, null, 2));
