"use client";

import {
  EthereumClient,
  w3mConnectors,
  w3mProvider,
} from "@web3modal/ethereum";
import { Web3Modal } from "@web3modal/react";
import { WagmiConfig, configureChains, createClient } from "wagmi";
import { env } from "../env";

import { chains } from "@config/chains";
import { UnicornConnector } from "@lib/unicorn-connector";
import { UnicornAutoConnect } from "./UnicornAutoConnect";

export function Web3ModalProvider({ children }: { children: React.ReactNode }) {
  const projectId = env.NEXT_PUBLIC_WEB3STORAGE_PROJECT_ID;
  if (projectId === undefined) {
    throw new Error("NEXT_PUBLIC_WEB3STORAGE_PROJECT_ID is undefined");
  }

  const { provider } = configureChains(chains, [w3mProvider({ projectId })]);

  // Build connectors array - always include Unicorn if env vars present
  // (UnicornAutoConnect component handles the URL param detection)
  const connectors = w3mConnectors({ projectId, chains });

  if (
    env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID &&
    env.NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS
  ) {
    const unicorn = new UnicornConnector({
      chains,
      options: {
        clientId: env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
        factoryAddress: env.NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS,
        defaultChain: 1, // Ethereum mainnet
      },
    });
    connectors.push(unicorn as any);
  }

  const wagmiClient = createClient({
    autoConnect: true,
    connectors,
    provider,
  });

  const ethereumClient = new EthereumClient(wagmiClient, chains);

  return (
    <>
      <WagmiConfig client={wagmiClient}>
        <UnicornAutoConnect />
        {children}
      </WagmiConfig>
      <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
    </>
  );
}
