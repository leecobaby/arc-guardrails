import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { config as loadEnv } from "dotenv";
import { configVariable, defineConfig } from "hardhat/config";

loadEnv({ path: ".env.local" });

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  verify: {
    blockscout: {
      apiKey: configVariable("BLOCKSCOUT_PRO_API_KEY"),
    },
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    arcTestnet: {
      type: "http",
      chainType: "l1",
      chainId: 5_042_002,
      url: configVariable("ARC_TESTNET_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
    arcMainnet: {
      type: "http",
      chainType: "l1",
      chainId: 5_042,
      url: configVariable("ARC_MAINNET_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
  },
});
