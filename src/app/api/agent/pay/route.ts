import "server-only";

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
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { arc, arcTestnet, explorerUrl } from "@/lib/arc";
import { arcGuardVaultAbi } from "@/lib/contracts";

type PaymentRequest = {
  recipient?: string;
  amount?: string;
  invoice?: string;
};

export async function POST(request: NextRequest) {
  const configuredApiKey = process.env.AGENT_API_KEY;
  const suppliedApiKey = request.headers.get("x-agent-api-key");

  if (!configuredApiKey || suppliedApiKey !== configuredApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const privateKey = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
  const isMainnet = process.env.AGENT_NETWORK === "mainnet";
  const chain = isMainnet ? arc : arcTestnet;
  const vaultCandidate = isMainnet
    ? process.env.NEXT_PUBLIC_MAINNET_VAULT_ADDRESS
    : process.env.NEXT_PUBLIC_TESTNET_VAULT_ADDRESS;

  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return NextResponse.json(
      { error: "Agent signer is not configured" },
      { status: 503 },
    );
  }
  if (!vaultCandidate || !isAddress(vaultCandidate)) {
    return NextResponse.json(
      { error: "Vault deployment is not configured" },
      { status: 503 },
    );
  }

  let body: PaymentRequest;
  try {
    body = (await request.json()) as PaymentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
  const publicClient = createPublicClient({ chain, transport: http() });
  const walletClient = createWalletClient({ account, chain, transport: http() });
  const vault = getAddress(vaultCandidate) as Address;
  const paymentId = keccak256(stringToHex(invoice));

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

    return NextResponse.json({
      status: receipt.status,
      network: chain.name,
      hash,
      paymentId,
      explorer: explorerUrl(chain.id, "tx", hash),
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
