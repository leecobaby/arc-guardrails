import "server-only";

import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  Address,
  Hex,
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseUnits,
  stringToHex,
  verifyMessage,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { arc, arcTestnet, explorerUrl } from "@/lib/arc";
import { arcGuardVaultAbi } from "@/lib/contracts";
import { activityCacheTag } from "@/lib/activity-cache";

type PaymentRequest = {
  recipient?: string;
  amount?: string;
  invoice?: string;
  chainId?: number | string;
  owner?: string;
  authorization?: {
    issuedAt?: number | string;
    signature?: Hex;
  };
};

export async function POST(request: NextRequest) {
  const configuredApiKey = process.env.AGENT_API_KEY;
  const suppliedApiKey = request.headers.get("x-agent-api-key");
  const sameOriginBrowser = request.headers.get("origin") === request.nextUrl.origin;

  if (!sameOriginBrowser && (!configuredApiKey || suppliedApiKey !== configuredApiKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const privateKey = process.env.AGENT_PRIVATE_KEY as Hex | undefined;

  let body: PaymentRequest;
  try {
    body = (await request.json()) as PaymentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestedChainId = Number(body.chainId);
  const network =
    requestedChainId === arc.id
      ? {
          chain: arc,
          vaultCandidate: process.env.NEXT_PUBLIC_MAINNET_VAULT_ADDRESS,
        }
      : requestedChainId === arcTestnet.id
        ? {
            chain: arcTestnet,
            vaultCandidate: process.env.NEXT_PUBLIC_TESTNET_VAULT_ADDRESS,
          }
        : undefined;

  if (!network) {
    return NextResponse.json(
      { error: "chainId must be Arc mainnet (5042) or testnet (5042002)" },
      { status: 400 },
    );
  }
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return NextResponse.json(
      { error: "Agent signer is not configured" },
      { status: 503 },
    );
  }
  if (!network.vaultCandidate || !isAddress(network.vaultCandidate)) {
    return NextResponse.json(
      { error: "Vault deployment is not configured for this network" },
      { status: 503 },
    );
  }

  const recipient = body.recipient?.trim();
  const invoice = body.invoice?.trim();
  const amountInput = body.amount?.trim();

  if (!recipient || !isAddress(recipient) || !invoice || !amountInput) {
    return NextResponse.json(
      { error: "recipient, amount, and invoice are required" },
      { status: 400 },
    );
  }

  let amount: bigint;
  try {
    amount = parseUnits(amountInput, 6);
  } catch {
    return NextResponse.json({ error: "Invalid USDC amount" }, { status: 400 });
  }
  if (amount <= 0n) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: network.chain, transport: http() });
  const walletClient = createWalletClient({
    account,
    chain: network.chain,
    transport: http(),
  });
  const vault = getAddress(network.vaultCandidate) as Address;
  const paymentId = keccak256(stringToHex(invoice));

  if (sameOriginBrowser) {
    const owner = body.owner?.trim();
    const issuedAt = Number(body.authorization?.issuedAt);
    const signature = body.authorization?.signature;
    const now = Math.floor(Date.now() / 1000);
    const ownerMessage = [
      "Arc Guardrails payment authorization",
      `Network: ${network.chain.id}`,
      `Vault: ${vault}`,
      `Owner: ${owner ?? ""}`,
      `Recipient: ${getAddress(recipient)}`,
      `Amount: ${amountInput}`,
      `Invoice: ${invoice}`,
      `Issued at: ${issuedAt}`,
    ].join("\n");

    if (
      !owner ||
      !isAddress(owner) ||
      !signature ||
      !Number.isSafeInteger(issuedAt) ||
      issuedAt < now - 300 ||
      issuedAt > now + 60
    ) {
      return NextResponse.json(
        { error: "A fresh Owner authorization signature is required" },
        { status: 401 },
      );
    }

    try {
      const currentOwner = await publicClient.readContract({
        address: vault,
        abi: arcGuardVaultAbi,
        functionName: "owner",
      });
      const validSignature =
        getAddress(owner) === getAddress(currentOwner) &&
        (await verifyMessage({
          address: getAddress(owner),
          message: ownerMessage,
          signature,
        }));
      if (!validSignature) {
        return NextResponse.json({ error: "Owner authorization is invalid" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Owner authorization is invalid" }, { status: 401 });
    }
  }

  try {
    const { request: transaction } = await publicClient.simulateContract({
      account,
      address: vault,
      abi: arcGuardVaultAbi,
      functionName: "spend",
      args: [getAddress(recipient), amount, paymentId],
    });
    const hash = await walletClient.writeContract(transaction);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    revalidateTag(activityCacheTag(String(network.chain.id), vault), { expire: 0 });

    return NextResponse.json({
      status: receipt.status,
      network: network.chain.name,
      hash,
      paymentId,
      blockNumber: receipt.blockNumber.toString(),
      explorer: explorerUrl(network.chain.id, "tx", hash),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Policy rejected or transaction failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 422 },
    );
  }
}
