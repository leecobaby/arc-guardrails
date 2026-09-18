import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { network } from "hardhat";
import { getAddress, isAddress } from "viem";

const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

const connection = await network.create();
const { viem, networkName } = connection;
const [deployer] = await viem.getWalletClients();

const ownerCandidate = process.env.INITIAL_OWNER_ADDRESS?.trim();
const initialOwner = ownerCandidate || deployer.account.address;
const usdcAddress = process.env.USDC_ADDRESS?.trim() || ARC_USDC_ADDRESS;

if (!isAddress(initialOwner) || !isAddress(usdcAddress)) {
  throw new Error("INITIAL_OWNER_ADDRESS and USDC_ADDRESS must be valid EVM addresses");
}

const { contract: vault, deploymentTransaction } =
  await viem.sendDeploymentTransaction("ArcGuardVault", [
    getAddress(initialOwner),
    getAddress(usdcAddress),
  ]);

const publicClient = await viem.getPublicClient();
const receipt = await publicClient.waitForTransactionReceipt({
  hash: deploymentTransaction.hash,
});

const deployment = {
  network: networkName,
  chainId: await publicClient.getChainId(),
  contract: vault.address,
  deployer: deployer.account.address,
  initialOwner: getAddress(initialOwner),
  usdc: getAddress(usdcAddress),
  transactionHash: deploymentTransaction.hash,
  blockNumber: receipt.blockNumber.toString(),
  deployedAt: new Date().toISOString(),
};

await mkdir(path.join(process.cwd(), "deployments"), { recursive: true });
await writeFile(
  path.join(process.cwd(), "deployments", `${networkName}.json`),
  `${JSON.stringify(deployment, null, 2)}\n`,
  { encoding: "utf8", mode: 0o644 },
);

console.log(JSON.stringify(deployment, null, 2));
