import { unstable_cache } from "next/cache";
import { Address } from "viem";

export const ACTIVITY_CACHE_SECONDS = 120;

export function activityCacheTag(chainId: string, vaultAddress: Address) {
  return `vault-activity:${chainId}:${vaultAddress.toLowerCase()}`;
}

export function cachedActivity<T>(
  chainId: string,
  vaultAddress: Address,
  loader: () => Promise<T>,
) {
  return unstable_cache(loader, ["vault-activity", chainId, vaultAddress], {
    revalidate: ACTIVITY_CACHE_SECONDS,
    tags: [activityCacheTag(chainId, vaultAddress)],
  })();
}
