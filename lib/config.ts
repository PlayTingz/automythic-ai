// Define network types
export type SolanaNetworkType = "mainnet-beta" | "testnet" | "devnet";
export type NetworkProvider = "sonic" | "solana";

// Solana configuration
export const SOLANA_RPC_URL = "https://api.testnet.sonic.game";
export const SOLANA_NETWORK: SolanaNetworkType = "testnet"; // 'mainnet-beta', 'testnet', 'devnet'
export const NETWORK_PROVIDER: NetworkProvider = "sonic"; // 'sonic' or 'solana'

// Network configurations for Sonic
export const SONIC_NETWORKS = {
  "mainnet-beta": {
    name: "Sonic Mainnet Beta",
    endpoint: "https://api.mainnet-alpha.sonic.game",
    explorerUrl: "https://explorer.sonic.game",
  },
  testnet: {
    name: "Sonic Testnet",
    endpoint: "https://api.testnet.sonic.game",
    explorerUrl: "https://explorer.testnet.sonic.game",
  },
};

// Network configurations for regular Solana
export const SOLANA_NETWORKS_CONFIG = {
  "mainnet-beta": {
    name: "Solana Mainnet Beta",
    endpoint: "https://api.mainnet-beta.solana.com",
    explorerUrl: "https://explorer.solana.com",
  },
  testnet: {
    name: "Solana Testnet",
    endpoint: "https://api.testnet.solana.com",
    explorerUrl: "https://explorer.solana.com/?cluster=testnet",
  },
  devnet: {
    name: "Solana Devnet",
    endpoint: "https://api.devnet.solana.com",
    explorerUrl: "https://explorer.solana.com/?cluster=devnet",
  },
};

// Get the current network configuration based on provider
export const CURRENT_NETWORK =
  NETWORK_PROVIDER === "sonic"
    ? SONIC_NETWORKS[SOLANA_NETWORK]
    : SOLANA_NETWORKS_CONFIG[SOLANA_NETWORK];

// Legacy NEAR configuration (kept for backward compatibility)
export const NetworkId = "testnet";
