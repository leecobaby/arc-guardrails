import { revalidateTag } from "next/cache";
import { decodeEventLog, isAddress, isHex, toEventSelector, type Address, type Hex } from "viem";

import { arc, arcTestnet } from "@/lib/arc";
import { arcGuardVaultAbi } from "@/lib/contracts";
import { activityCacheTag, cachedActivity } from "@/lib/activity-cache";

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

async function loadBlockscoutActivities(chainId: string, vaultAddress: string) {
  const apiKey = process.env.BLOCKSCOUT_PRO_API_KEY;
  if (!apiKey) throw new Error("Activity index is not configured.");

  const params = new URLSearchParams({
    chain_id: chainId,
    endpoint_path: `/api/v2/addresses/${vaultAddress}/logs`,
    "query_params[topic]": spentTopic,
    "query_params[items_count]": "12",
  });
  const response = await fetch(
    `https://mcp.blockscout.com/v1/direct_api_call?${params}`,
    {
      headers: {
        "Blockscout-MCP-Pro-Api-Key": apiKey,
        "User-Agent": "Blockscout-SkillGuidedScript/0.6.0",
      },
      cache: "no-store",
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

  return result.data
    .flatMap((log) => {
      const row = parseSpentLog(log);
      return row ? [row] : [];
    })
    .slice(0, 12);
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const chainId = searchParams.get("chainId");
  const afterHash = searchParams.get("after")?.toLowerCase();
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

  const typedVaultAddress = vaultAddress as Address;
  const forceRefresh = Boolean(afterHash);

  try {
    const activities = forceRefresh
      ? await loadBlockscoutActivities(chainId, typedVaultAddress)
      : await cachedActivity(chainId, typedVaultAddress, () =>
          loadBlockscoutActivities(chainId, typedVaultAddress),
        );
    const indexed = Boolean(
      afterHash && activities.some((activity) => activity.hash.toLowerCase() === afterHash),
    );
    if (indexed) {
      revalidateTag(activityCacheTag(chainId, typedVaultAddress), { expire: 0 });
    }

    return Response.json(
      { activities, indexed: indexed || !afterHash },
      {
        headers: forceRefresh
          ? { "Cache-Control": "no-store" }
          : { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
      },
    );
  } catch (error) {
    console.error("Unable to load vault activity:", error);
    return Response.json(
      { error: "Activity is temporarily unavailable." },
      { status: 502 },
    );
  }
}
