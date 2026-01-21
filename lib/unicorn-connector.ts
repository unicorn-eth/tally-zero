// Unicorn Wallet Connector for Wagmi v1 (Web3Modal v2 compatible)
// Based on @unicorn.eth/autoconnect v1.4.0
// This connector auto-connects when URL contains ?walletId=inApp&authCookie=...

import { Connector } from "wagmi";
import type { Chain } from "wagmi";
import { createThirdwebClient } from "thirdweb";
import { inAppWallet, EIP1193 } from "thirdweb/wallets";
import {
  ethereum,
  base,
  baseSepolia,
  polygon,
  polygonAmoy,
  arbitrum,
  arbitrumSepolia,
  optimism,
  optimismSepolia,
  gnosis,
  celo,
  avalanche,
  bsc,
  sepolia,
} from "thirdweb/chains";

// Centralized mapping of wagmi chain IDs to Thirdweb chain objects
const THIRDWEB_CHAIN_MAP: Record<number, any> = {
  // Mainnets
  1: ethereum,
  8453: base,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  100: gnosis,
  42220: celo,
  43114: avalanche,
  56: bsc,
  // Testnets
  11155111: sepolia,
  84532: baseSepolia,
  80002: polygonAmoy,
  421614: arbitrumSepolia,
  11155420: optimismSepolia,
};

export interface UnicornConnectorOptions {
  clientId: string;
  factoryAddress: string;
  defaultChain?: number;
  icon?: string;
}

interface UnicornConnectorConfig {
  chains: Chain[];
  options: UnicornConnectorOptions;
}

// Use type assertion to avoid abstract class issues
const ConnectorBase = Connector as any;

/**
 * Unicorn Wallet Connector for Wagmi v1 (Web3Modal v2 compatible)
 */
export class UnicornConnector extends ConnectorBase {
  readonly id = "unicorn";
  readonly name = "Unicorn Wallet";
  readonly ready = true;

  private clientId: string;
  private factoryAddress: string;
  private defaultChain: number;
  private icon: string;
  private client: any = null;
  private wallet: any = null;
  private account: any = null;
  private _provider: any = null;

  constructor(config: UnicornConnectorConfig) {
    super({
      chains: config.chains,
      options: config.options,
    });

    this.clientId = config.options.clientId;
    this.factoryAddress = config.options.factoryAddress;
    this.defaultChain = config.options.defaultChain || 1;
    this.icon =
      config.options.icon ||
      "https://cdn.prod.website-files.com/66530e16a1530eb2c5731631/66532b163a3d036984005867_favicon.png";

    if (!this.clientId) {
      throw new Error("UnicornConnector: clientId is required");
    }
    if (!this.factoryAddress) {
      throw new Error("UnicornConnector: factoryAddress is required");
    }
  }

  async connect({ chainId }: { chainId?: number } = {}) {
    try {
      await this.setupIfNeeded();

      // Check for auth cookie in URL
      const params = new URLSearchParams(window?.location?.search || "");
      const authCookie = params.get("authCookie");

      if (authCookie && !this.account) {
        console.log(
          "[UnicornConnector] Auth cookie detected, attempting autoConnect"
        );

        // Store auth data in localStorage
        try {
          localStorage.setItem(`walletToken-${this.clientId}`, authCookie);
          localStorage.setItem("thirdweb:active-wallet-id", "inApp");
          localStorage.setItem(
            "thirdweb:connected-wallet-ids",
            JSON.stringify(["inApp"])
          );
        } catch (error) {
          console.warn("[UnicornConnector] Could not store auth data:", error);
        }

        try {
          this.account = await this.wallet.autoConnect({
            client: this.client,
          });
          console.log(
            "[UnicornConnector] AutoConnect successful:",
            this.account.address
          );
        } catch (error: any) {
          console.log(
            "[UnicornConnector] AutoConnect failed:",
            error?.message
          );
        }
      }

      // If no account yet, try to get existing
      if (!this.account?.address) {
        try {
          this.account = await this.wallet.getAccount();
        } catch {
          throw new Error("No account available - wallet not authenticated");
        }
      }

      if (!this.account?.address) {
        throw new Error("No account available - wallet not authenticated");
      }

      const address = this.account.address;
      const targetChainId = chainId || this.defaultChain;

      this.emit("connect", {
        account: address,
        chain: { id: targetChainId, unsupported: false },
      });

      return {
        account: address,
        chain: { id: targetChainId, unsupported: false },
        provider: await this.getProvider(),
      };
    } catch (error) {
      console.error("[UnicornConnector] Connect error:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.wallet) {
        await this.wallet.disconnect();
      }
      this.account = null;
      this._provider = null;

      // Reset wallet
      await this.setupIfNeeded();

      this.emit("disconnect");
    } catch (error) {
      console.error("[UnicornConnector] Disconnect error:", error);
    }
  }

  async getAccount() {
    if (this.account?.address) {
      return this.account.address;
    }
    return null;
  }

  async getChainId() {
    if (this.account?.chain?.id) {
      return this.account.chain.id;
    }
    return this.defaultChain;
  }

  async getProvider() {
    if (!this._provider) {
      await this.setupIfNeeded();

      if (!this.account) {
        throw new Error("No account connected");
      }

      const currentChainId = this.account.chain?.id || this.defaultChain;
      const thirdwebChain = THIRDWEB_CHAIN_MAP[currentChainId] || base;

      const baseProvider = await EIP1193.toProvider({
        client: this.client,
        chain: thirdwebChain,
        wallet: this.wallet,
      });

      // Wrap provider to intercept methods
      const originalRequest = baseProvider.request.bind(baseProvider);
      const account = this.account;

      this._provider = {
        ...baseProvider,
        request: async (args: { method: string; params?: any[] }) => {
          console.log("[UnicornConnector] Provider request:", args.method);

          // Handle wallet_watchAsset
          if (args.method === "wallet_watchAsset") {
            return true;
          }

          // Intercept personal_sign and use account's signMessage directly
          if (args.method === "personal_sign" && account) {
            try {
              const [message] = args.params || [];
              console.log(
                "[UnicornConnector] Intercepting personal_sign, using account.signMessage"
              );

              // Use account's signMessage for smart account signing
              const signature = await account.signMessage({ message });
              console.log("[UnicornConnector] Signature from account");

              if (!signature || signature === "0x") {
                throw new Error("Failed to generate signature");
              }

              return signature;
            } catch (error) {
              console.error("[UnicornConnector] personal_sign failed:", error);
              throw error;
            }
          }

          return originalRequest(args);
        },
      };
    }

    return this._provider;
  }

  async getSigner() {
    const provider = await this.getProvider();
    const account = await this.getAccount();

    if (!provider || !account) {
      throw new Error("Not connected");
    }

    return {
      ...provider,
      getAddress: async () => account,
      signMessage: async (message: string) => {
        return provider.request({
          method: "personal_sign",
          params: [message, account],
        });
      },
      signTransaction: async (transaction: any) => {
        return provider.request({
          method: "eth_signTransaction",
          params: [transaction],
        });
      },
      sendTransaction: async (transaction: any) => {
        return provider.request({
          method: "eth_sendTransaction",
          params: [transaction],
        });
      },
    };
  }

  async isAuthorized() {
    try {
      const account = await this.getAccount();
      return !!account;
    } catch {
      return false;
    }
  }

  async switchChain(chainId: number) {
    const thirdwebChain = THIRDWEB_CHAIN_MAP[chainId];

    if (!thirdwebChain) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    if (this.account) {
      this.account.chain = thirdwebChain;
    }

    this._provider = null; // Reset provider

    this.emit("change", { chain: { id: chainId, unsupported: false } });

    return thirdwebChain;
  }

  private async setupIfNeeded() {
    if (this.client && this.wallet) {
      return;
    }

    console.log("[UnicornConnector] Setting up...");

    this.client = createThirdwebClient({ clientId: this.clientId });

    const thirdwebChain = THIRDWEB_CHAIN_MAP[this.defaultChain] || base;

    this.wallet = inAppWallet({
      auth: {
        options: ["email", "google", "apple", "phone"],
      },
      smartAccount: {
        chain: thirdwebChain,
        factoryAddress: this.factoryAddress,
        gasless: true,
      },
    });

    console.log("[UnicornConnector] Setup complete");
  }
}
