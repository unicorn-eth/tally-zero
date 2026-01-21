# Autoconnect Integration for TallyZero

This document details the integration of `@unicorn.eth/autoconnect` into TallyZero, enabling gasless smart account transactions via the Unicorn wallet when users access the app through the Unicorn portal.

## Overview

The integration allows TallyZero to automatically connect users' Unicorn wallets when they arrive via URL parameters (`?walletId=inApp&authCookie=...`). Normal users see the standard Web3Modal wallet options unchanged.

## Files Modified/Created

### New Files

| File | Purpose |
|------|---------|
| `lib/unicorn-connector.ts` | Wagmi v1 compatible connector for Unicorn wallet |
| `components/UnicornAutoConnect.tsx` | React component that triggers auto-connection when URL params detected |

### Modified Files

| File | Changes |
|------|---------|
| `components/Web3ModalProvider.tsx` | Added Unicorn connector and UnicornAutoConnect component |
| `env.ts` | Added optional Thirdweb environment variables |
| `CLAUDE.md` | Documented new environment variables |
| `package.json` | Added `thirdweb` dependency |

## Architecture

### Why a Local Connector?

The published `@unicorn.eth/autoconnect` package bundles Wagmi v2 code, which is incompatible with TallyZero's Wagmi v0.12.6. To avoid import errors, we created a local connector (`lib/unicorn-connector.ts`) based on the v1 connector from the autoconnect library.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Access                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  URL has walletId=inApp &     │
              │  authCookie params?           │
              └───────────────────────────────┘
                     │              │
                    Yes             No
                     │              │
                     ▼              ▼
         ┌──────────────────┐  ┌──────────────────┐
         │ UnicornAutoConnect│  │ Normal Web3Modal │
         │ triggers connect()│  │ wallet selection │
         └──────────────────┘  └──────────────────┘
                     │
                     ▼
         ┌──────────────────┐
         │ UnicornConnector │
         │ reads authCookie │
         │ from URL params  │
         └──────────────────┘
                     │
                     ▼
         ┌──────────────────┐
         │ Thirdweb inApp   │
         │ wallet connects  │
         │ with smart acct  │
         └──────────────────┘
```

### Component Flow

1. **Web3ModalProvider** creates the wagmi client with all connectors including UnicornConnector
2. **UnicornAutoConnect** (rendered inside WagmiConfig) checks for URL params on mount
3. If `walletId=inApp` and `authCookie` are present, it calls `connect()` on the Unicorn connector
4. **UnicornConnector** stores the auth cookie and uses Thirdweb's `inAppWallet` to authenticate
5. The smart account is created with gasless transactions enabled

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Required (existing)
NEXT_PUBLIC_WEB3STORAGE_PROJECT_ID=your_walletconnect_project_id

# Optional - for Unicorn/Autoconnect integration
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS=0xD771615c873ba5a2149D5312448cE01D677Ee48A
```

### Getting Credentials

- **NEXT_PUBLIC_THIRDWEB_CLIENT_ID**: Get from [Thirdweb Dashboard](https://thirdweb.com/dashboard)
- **NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS**: Default smart account factory, or deploy your own

## Supported Chains

The connector supports these chains (mapped to Thirdweb chain objects):

**Mainnets:**
- Ethereum (1)
- Base (8453)
- Polygon (137)
- Arbitrum (42161)
- Optimism (10)
- Gnosis (100)
- Celo (42220)
- Avalanche (43114)
- BSC (56)

**Testnets:**
- Sepolia (11155111)
- Base Sepolia (84532)
- Polygon Amoy (80002)
- Arbitrum Sepolia (421614)
- Optimism Sepolia (11155420)

## Testing

### Local Testing

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Access with Unicorn parameters:
   ```
   http://localhost:3000/explore?walletId=inApp&authCookie=YOUR_AUTH_TOKEN
   ```

3. Check browser console for logs:
   - `[UnicornAutoConnect] URL params detected, attempting connect`
   - `[UnicornConnector] Setting up...`
   - `[UnicornConnector] Auth cookie detected, attempting autoConnect`
   - `[UnicornConnector] AutoConnect successful: 0x...`

### Without URL Parameters

Accessing the app normally (without URL params) should:
- Show standard Web3Modal wallet options
- Not trigger any Unicorn-related logs
- Work exactly as before the integration

## Troubleshooting

### "Unicorn connector not found"

Ensure environment variables are set:
```bash
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=...
NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS=...
```

### Hydration Errors

The integration avoids SSR hydration mismatches by:
- Always including the Unicorn connector (no conditional based on URL params during render)
- Checking URL params only inside `useEffect` in UnicornAutoConnect

### AutoConnect Failed

Check that:
1. The `authCookie` URL parameter contains a valid token
2. The Thirdweb client ID is correct
3. Console logs for specific error messages

## Dependencies Added

```json
{
  "thirdweb": "^5.x.x"
}
```

Note: `@unicorn.eth/autoconnect` was NOT added as a dependency due to Wagmi version conflicts. Instead, the connector code was adapted locally.

## Recommended Changes for the Team

### High Priority

1. **Upgrade Wagmi to v2**
   - Current: Wagmi v0.12.6 (legacy API)
   - Recommended: Wagmi v2.x
   - Benefits:
     - Use `@unicorn.eth/autoconnect` package directly instead of local connector
     - Better TypeScript support
     - Improved performance and bundle size
     - Access to latest wagmi hooks and features
   - Note: This is a breaking change requiring migration of all wagmi hooks

2. **Upgrade Web3Modal to v3/v4 (Reown AppKit)**
   - `@web3modal/react` v2 is deprecated
   - New package: `@reown/appkit` or `@web3modal/wagmi`
   - Should be done alongside Wagmi v2 upgrade

3. **Add Base Chain Support**
   - Base (chain ID 8453) is a popular L2 for governance
   - Already supported by Unicorn connector
   - Add to `config/chains.ts`:
     ```typescript
     import { base } from "wagmi/chains";
     ```

### Medium Priority

4. **Add Loading State for Unicorn Connection**
   - Show a loading indicator while Unicorn wallet connects
   - Improve UX for users arriving via Unicorn portal
   - Example location: `components/UnicornAutoConnect.tsx`

5. **Strip URL Parameters After Connection**
   - Remove `walletId` and `authCookie` from URL after successful connection
   - Prevents accidental sharing of auth tokens
   - Use `window.history.replaceState()` after connect succeeds

6. **Add Error Handling UI**
   - Show toast notification if Unicorn connection fails
   - Guide users to alternative connection methods
   - Integrate with existing Sonner toast system

7. **Environment Variable Validation**
   - Add runtime check that warns if Thirdweb env vars are missing
   - Currently fails silently - connector just isn't added

### Low Priority

8. **Add Unicorn Wallet Indicator**
   - Show visual indicator when connected via Unicorn (e.g., "Gasless" badge)
   - Help users understand they have sponsored transactions

9. **Transaction Approval Dialog**
   - The full autoconnect library includes approval dialogs for transactions
   - Consider adding for better security UX
   - Located in original library: `UnicornTransactionApproval.jsx`

10. **Analytics Integration**
    - Track Unicorn wallet connections separately
    - Measure adoption of gasless voting feature
    - Add events for: connection success/failure, votes cast via Unicorn

### Security Considerations

11. **Auth Cookie Handling**
    - Current: Cookie stored in localStorage
    - Consider: Clear cookie after session ends
    - Consider: Validate cookie format before use

12. **CSP Headers**
    - Ensure Content Security Policy allows Thirdweb endpoints
    - Required domains: `*.thirdweb.com`, `*.walletconnect.com`

### Testing Recommendations

13. **Add Integration Tests**
    - Test Unicorn connector initialization
    - Test URL parameter detection
    - Mock Thirdweb wallet for unit tests

14. **E2E Test with Playwright/Cypress**
    - Test full flow: URL params → auto-connect → vote
    - Test fallback to normal wallets when no params

### Technical Debt

15. **Remove Deprecated Dependencies**
    - `@web3modal/ethereum` and `@web3modal/react` show deprecation warnings
    - Plan migration path to newer packages

16. **Update Next.js**
    - Current: 14.1.0 (has security vulnerability per npm audit)
    - Update to latest 14.x patch version

## Future Considerations

- When TallyZero upgrades to Wagmi v2, the integration can switch to using `@unicorn.eth/autoconnect` directly
- Additional chains can be added to `THIRDWEB_CHAIN_MAP` in `lib/unicorn-connector.ts`
