import { decodeEventLog, isAddress, isHex, toEventSelector, type Hex } from "viem";

import { arc, arcTestnet } from "@/lib/arc";
import { arcGuardVaultAbi } from "@/lib/contracts";

const spentEvent = arcGuardVaultAbi.find(
  (item) => item.type === "event" && item.name === "Spent",
);
const spentTopic = toEventSelector(spentEvent!);

function parseSpentLog(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const log = value as Record<string, unknown>;
  if (
    !Array.isArray(log.topics) ||
    log.topics.length !== 4 ||
    !log.topics.every((topic) => isHex(topic)) ||
    log.topics[0].toLowerCase() !== spentTopic.toLowerCase() ||
    !isHex(log.data) ||
    typeof log.transaction_hash !== "string" ||
    !/^0x[\da-fA-F]{64}$/.test(log.transaction_hash) ||
    typeof log.block_number !== "number" ||
    !Number.isSafeInteger(log.block_number)
  ) {
    return null;
  }

  try {
    const { args } = decodeEventLog({
      abi: arcGuardVaultAbi,
      eventName: "Spent",
      topics: log.topics as [Hex, ...Hex[]],
      data: log.data,
      strict: true,
    });
    return {
      hash: log.transaction_hash,
      recipient: args.recipient,
      amount: args.amount.toString(),
      paymentId: args.paymentId,
      blockNumber: log.block_number.toString(),
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const chainId = new URL(request.url).searchParams.get("chainId");
  const vaultAddress =
    chainId === String(arc.id)
      ? process.env.NEXT_PUBLIC_MAINNET_VAULT_ADDRESS
      : chainId === String(arcTestnet.id)
        ? process.env.NEXT_PUBLIC_TESTNET_VAULT_ADDRESS
        : undefined;

  if (!chainId || ![String(arc.id), String(arcTestnet.id)].includes(chainId)) {
    return Response.json({ error: "Unsupported network." }, { status: 400 });
  }
  if (!vaultAddress || !isAddress(vaultAddress)) {
    return Response.json({ error: "Vault is not configured." }, { status: 404 });
  }

  const apiKey = process.env.BLOCKSCOUT_PRO_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Activity index is not configured." },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    chain_id: chainId,
    endpoint_path: `/api/v2/addresses/${vaultAddress}/logs`,
    "query_params[topic]": spentTopic,
    "query_params[items_count]": "12",
  });

  try {
    const response = await fetch(
      `https://mcp.blockscout.com/v1/direct_api_call?${params}`,
      {
        headers: {
          "Blockscout-MCP-Pro-Api-Key": apiKey,
          "User-Agent": "Blockscout-SkillGuidedScript/0.6.0",
        },
        next: { revalidate: 10 },
      },
    );
    if (!response.ok) throw new Error(`Blockscout status ${response.status}`);

    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== "object" ||
      !("data" in result) ||
      !Array.isArray(result.data)
    ) {
      throw new Error("Invalid Blockscout response");
    }

    const activities = result.data
      .flatMap((log) => {
        const row = parseSpentLog(log);
        return row ? [row] : [];
      })
      .slice(0, 12);
    return Response.json({ activities });
  } catch (error) {
    console.error("Unable to load vault activity:", error);
    return Response.json(
      { error: "Activity is temporarily unavailable." },
      { status: 502 },
    );
  }
}
