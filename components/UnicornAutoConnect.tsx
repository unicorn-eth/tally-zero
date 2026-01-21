"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";

/**
 * Auto-connects the Unicorn wallet when URL parameters are detected.
 * This component should be rendered inside WagmiConfig.
 */
export function UnicornAutoConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected, connector } = useAccount();
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Skip if already attempted
    if (attemptedRef.current) return;

    // Skip if already connected to Unicorn
    if (isConnected && connector?.id === "unicorn") {
      attemptedRef.current = true;
      return;
    }

    // Check for Unicorn URL parameters
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const walletId = params.get("walletId");
    const authCookie = params.get("authCookie");

    // Not a Unicorn URL - skip
    if (walletId !== "inApp" || !authCookie) {
      attemptedRef.current = true;
      return;
    }

    console.log("[UnicornAutoConnect] URL params detected, attempting connect");

    // Find the Unicorn connector
    const unicornConnector = connectors.find((c) => c.id === "unicorn");

    if (!unicornConnector) {
      console.warn(
        "[UnicornAutoConnect] Unicorn connector not found in wagmi config"
      );
      attemptedRef.current = true;
      return;
    }

    // Attempt connection
    const doConnect = async () => {
      try {
        console.log("[UnicornAutoConnect] Connecting...");
        connect({ connector: unicornConnector });
        console.log("[UnicornAutoConnect] Connect initiated");
      } catch (error) {
        console.error("[UnicornAutoConnect] Connect failed:", error);
      }
      attemptedRef.current = true;
    };

    // Small delay to ensure wagmi is ready
    const timer = setTimeout(doConnect, 100);
    return () => clearTimeout(timer);
  }, [connect, connectors, isConnected, connector]);

  // This component doesn't render anything
  return null;
}
