import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import { defineChain } from "viem";

export const arc = defineChain({
  id: 5_042,
  name: "Arc",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.mainnet.arc.io"],
      webSocket: ["wss://rpc.mainnet.arc.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://explorer.arc.io",
    },
  },
});

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.io"],
      webSocket: ["wss://rpc.testnet.arc.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Testnet Explorer",
      url: "https://explorer.testnet.arc.io",
    },
  },
  testnet: true,
});

export const supportedChains = [arcTestnet, arc] as const;

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected()],
  multiInjectedProviderDiscovery: true,
  ssr: true,
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
    [arc.id]: http(arc.rpcUrls.default.http[0]),
  },
});

export const ARC_USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;

export function explorerUrl(
  chainId: number,
  type: "address" | "tx",
  value: string,
) {
  const chain = chainId === arc.id ? arc : arcTestnet;
  return `${chain.blockExplorers.default.url}/${type}/${value}`;
}
