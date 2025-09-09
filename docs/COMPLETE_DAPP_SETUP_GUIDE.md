# 🚀 Complete DApp Development Guide - Best Practices & Setup Instructions

This comprehensive guide combines **best practices** and **setup instructions** for building production-ready Ethereum DApps using **Wagmi v2.5+**, **Viem**, **Zustand**, **TanStack Query v5**, and **Hardhat**.

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Core Principles](#-core-principles)
3. [Project Setup](#-project-setup)
4. [Configuration](#-configuration)
5. [Smart Contract Development](#-smart-contract-development)
6. [Frontend Development](#-frontend-development)
7. [Best Practices](#-best-practices)
8. [Advanced Patterns](#-advanced-patterns)
9. [Deployment](#-deployment)
10. [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

### Minimal Setup (4 Steps)
```bash
# 1. Create project
pnpm create vite@latest my-dapp --template react-ts
cd my-dapp

# 2. Install dependencies
pnpm add wagmi viem @tanstack/react-query @rainbow-me/rainbowkit
pnpm add -D hardhat @nomicfoundation/hardhat-toolbox

# 3. Setup (see detailed sections below)
# - Configure Vite, TypeScript, Tailwind
# - Setup Wagmi + TanStack Query
# - Initialize Hardhat

# 4. Start developing
pnpm dev
```

### Comprehensive Setup (14 Steps)
Follow the detailed setup instructions in the [Project Setup](#-project-setup) section below.

---

## ✅ Core Principles

- Always write **network-aware, stale-resistant, event-driven** UI logic
- Favor **query-driven rendering** over manual state management
- Prevent stale data via **scopeKey + event-based invalidation**
- Structure logic around **chain separation** and **chain guards**
- **Avoid Zustand for server-derived data**; use it for local UI state only

---

## 🏗️ Project Setup

### Prerequisites
- **Node.js** 18+ and **pnpm** installed
- **Cursor IDE** with TypeScript support
- **Git** for version control
- **WalletConnect Project ID** (get from [WalletConnect Cloud](https://cloud.walletconnect.com/))
- **Alchemy API Key** (get from [Alchemy](https://www.alchemy.com/))

### Step 1: Initialize Project
```bash
mkdir my-dapp
cd my-dapp
pnpm init
```

### Step 2: Install Dependencies
```bash
# Core React and build tools
pnpm add react@18.2.0 react-dom@18.2.0 react-router-dom@6.20.0

# Blockchain and wallet integration
pnpm add wagmi@2.5.0 viem@2.7.0 @rainbow-me/rainbowkit@2.0.0

# State management and data fetching
pnpm add @tanstack/react-query@^5.85.5 zustand@4.4.7

# Node.js polyfills for browser
pnpm add buffer@^6.0.3 process@^0.11.10 util@^0.12.5

# Development dependencies
pnpm add -D @vitejs/plugin-react@4.2.1 vite@5.4.19 typescript@5.2.2
pnpm add -D @types/react@18.2.43 @types/react-dom@18.2.17 @types/node@24.3.0
pnpm add -D tailwindcss@3.3.6 autoprefixer@10.4.16 postcss@8.4.32
pnpm add -D @tanstack/react-query-devtools@^5.85.5
pnpm add -D eslint@8.55.0 @typescript-eslint/eslint-plugin@6.14.0 @typescript-eslint/parser@6.14.0
pnpm add -D eslint-plugin-react-hooks@4.6.0 eslint-plugin-react-refresh@0.4.5

# Smart contract development
pnpm add -D hardhat@^2.26.1 @nomicfoundation/hardhat-toolbox@^6.1.0
pnpm add -D @openzeppelin/contracts@^5.4.0 @openzeppelin/contracts-upgradeable@^5.4.0
```

### Step 3: Create Directory Structure
```bash
mkdir -p src/{components,hooks,config,lib,constants,contexts,stores,utils,abis,realtime,contracts}
mkdir -p src/components/{ui,examples}
mkdir -p public
mkdir -p contracts scripts test
```

---

## ⚙️ Configuration

### TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "vite-env.d.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Vite Configuration (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'global': 'globalThis',
    'Buffer': 'globalThis.Buffer',
    'util': 'globalThis.util',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      util: 'util',
      process: 'process',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'util', 'process'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          wagmi: ['wagmi', '@tanstack/react-query'],
          rainbowkit: ['@rainbow-me/rainbowkit'],
        },
      },
    },
  },
})
```

### Environment Variables (`.env.local`)
```bash
# WalletConnect Project ID
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Alchemy API Key
VITE_ALCHEMY_API_KEY=your_alchemy_key_here

# Chain ID (e.g., 11155111 for Sepolia)
VITE_CHAIN_ID=11155111

# Contract addresses (update after deployment)
VITE_MY_TOKEN_ADDRESS=0x...
```

---

## ⚡ Smart Contract Development

### Hardhat Setup
```bash
npx hardhat init
# Choose "Create a TypeScript project"
# Choose "y" for .gitignore
# Choose "y" for installing dependencies
```

### Hardhat Configuration (`hardhat.config.ts`)
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;
```

### Example Contract (`contracts/MyToken.sol`)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor() ERC20("MyToken", "MTK") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
```

### Deployment Script (`scripts/deploy.ts`)
```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const MyToken = await ethers.getContractFactory("MyToken");
  const myToken = await MyToken.deploy();
  await myToken.waitForDeployment();

  const address = await myToken.getAddress();
  console.log("MyToken deployed to:", address);

  // Save contract address for frontend
  const fs = require('fs');
  const contractInfo = {
    address: address,
    abi: JSON.parse(myToken.interface.format('json') as string)
  };
  
  fs.writeFileSync(
    './src/contracts/MyToken.json',
    JSON.stringify(contractInfo, null, 2)
  );
  
  console.log("Contract ABI saved to src/contracts/MyToken.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

---

## 🎨 Frontend Development

### Wagmi Configuration (`src/config/wagmi.ts`)
```typescript
import { http, webSocket, createConfig, fallback } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'fallback_id'

// Mobile detection for performance tuning
const isMobile = typeof window !== 'undefined' && 
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

// RPC Provider Configuration
const RPC_URLS = {
  alchemy: {
    sepolia: `https://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
    sepoliaWs: `wss://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
  },
}

function buildSepoliaTransport() {
  if (isMobile) {
    return http(RPC_URLS.alchemy.sepolia)
  } else {
    return webSocket(RPC_URLS.alchemy.sepoliaWs)
  }
}

export const config = createConfig({
  appName: 'My DApp',
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: buildSepoliaTransport(),
  },
})
```

### TanStack Query Setup (`src/main.tsx`)
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { config } from './config/wagmi'
import App from './App'
import './index.css'
import '@rainbow-me/rainbowkit/styles.css'

// Create QueryClient with anti-flicker configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      placeholderData: (previousData: any) => previousData,
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_1000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
          <ReactQueryDevtools initialIsOpen={false} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
```

### Scopes Configuration (`src/lib/scopes.ts`)
```typescript
import { QueryClient } from '@tanstack/react-query'

// Centralized scope key names to avoid typos/mismatch
export const scopes = {
  userData: (chainId: number, address: string) =>
    ['user', 'data', chainId, address.toLowerCase()] as const,
  
  contractData: (chainId: number, contractAddress: string) =>
    ['contract', 'data', chainId, contractAddress.toLowerCase()] as const,
  
  eventLogs: (contractAddress: string, eventSig: string, fromBlock?: bigint, toBlock?: bigint) =>
    ['events', 'logs', contractAddress.toLowerCase(), eventSig, fromBlock?.toString(), toBlock?.toString()] as const,
  
  contractLogs: (contractAddress: string) =>
    ['contract', 'logs', contractAddress.toLowerCase()] as const,
  
  blockData: (blockNumber: string) =>
    ['block', 'data', blockNumber] as const,
} as const

// Debounced invalidation to prevent flicker
const pendingInvalidations = new Set<string>()
let invalidationTimeout: number | null = null

export function invalidateByScope(qc: QueryClient, scope: string | readonly unknown[]) {
  const scopeKey = Array.isArray(scope) ? scope.map(String).join('|') : scope
  
  pendingInvalidations.add(scopeKey as string)
  
  if (invalidationTimeout) {
    clearTimeout(invalidationTimeout)
  }
  
  invalidationTimeout = window.setTimeout(() => {
    const scopesToInvalidate = Array.from(pendingInvalidations)
    pendingInvalidations.clear()
    
    scopesToInvalidate.forEach(scopeStr => {
      if (scopeStr.includes('|')) {
        const keyParts = scopeStr.split('|')
        qc.invalidateQueries({ 
          queryKey: keyParts,
          exact: true 
        })
      } else {
        qc.invalidateQueries({
          predicate: (q) => {
            const k = q.queryKey as unknown[]
            return Array.isArray(k) && k.some((el) => el === scopeStr)
          },
        })
      }
    })
    
    console.log(`📱 Debounced invalidation completed for scopes:`, scopesToInvalidate)
  }, 50)
}
```

---

## 🎯 Best Practices

### Hook Conflicts & Common Footguns

#### The Short Answer
- **Wagmi/Viem** = blockchain I/O (reads/writes, wallet/chain status, event watching)
- **TanStack Query** = server-state cache + fetching lifecycle (staleTime, retries, dedupe)
- **React `useState/useEffect`** = local UI state and non-data side-effects only

#### ✅ Safe Patterns

1. **Fetch data via hooks, not `useEffect`:**
   ```typescript
   const { data, isLoading, error } = useReadContract({
     address: contractAddress,
     abi: contractABI,
     functionName: 'balanceOf',
     args: [address!],
     query: {
       enabled: !!address && !!chainId,
       staleTime: 30_000,
       scopeKey: scopes.userData(chainId!, address!),
     },
   })
   ```

2. **Single source of truth:**
   - Chain/wallet status → Wagmi (`useAccount`, `useChainId`)
   - Remote data → TanStack/Wagmi read hooks (do **not** copy to `useState`)
   - Ephemeral UI (open/close, input text) → `useState`/Zustand only

3. **Guard fetches with `enabled`:**
   ```typescript
   const { address } = useAccount();
   const { data } = useReadContract({
     address: contract,
     abi,
     functionName: 'balanceOf',
     args: [address!],
     query: { enabled: !!address, staleTime: 30_000, gcTime: 300_000 }
   });
   ```

4. **Invalidate, don't setState:**
   ```typescript
   const qc = useQueryClient();
   const write = useWriteContract({
     mutation: {
       onSuccess() {
         qc.invalidateQueries({ queryKey: ['org','data', chainId, orgAddress] });
       }
     }
   });
   ```

5. **Event-driven freshness:**
   ```typescript
   useWatchContractEvent({
     address: orgAddress,
     abi,
     eventName: 'NameUpdated',
     onLogs: () => qc.invalidateQueries({ queryKey: ['org','data', chainId, orgAddress] }),
   });
   ```

#### ❌ Common Footguns to Avoid

- Fetching with `useEffect` + `fetch`/Viem while **also** using TanStack/Wagmi hooks → duplicate requests, race conditions
- Storing query results in `useState` "to pass down" → stale UI and double sources of truth
- Building `args`/`contracts` inline (new object each render) → constant refetches
- Updating UI after writes with manual `setState` instead of invalidation → cache and UI drift apart
- Mixing `refetchInterval` and event watchers without coordination → chattiness

---

## 🔌 Advanced Patterns

### Alchemy Integration with Viem

```typescript
// src/lib/alchemyClient.ts
import { createPublicClient, http, webSocket } from "viem"
import { sepolia } from "viem/chains"

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY

// HTTP client for reliable operations
export const alchemyHttpClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
})

// WebSocket client for real-time subscriptions
export const alchemyWsClient = createPublicClient({
  chain: sepolia,
  transport: webSocket(`wss://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
})
```

### Custom Hooks

```typescript
// src/hooks/useUserData.ts
import { useReadContract } from 'wagmi'
import { useAccount } from 'wagmi'
import { scopes } from '../lib/scopes'

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export function useUserData() {
  const { address, chainId } = useAccount()
  
  const { data, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: {
      enabled: !!address && !!chainId,
      staleTime: 30_000,
      scopeKey: scopes.userData(chainId!, address!),
    },
  })

  return {
    userData: data,
    isLoading,
    error,
  }
}
```

---

## 🚀 Deployment

### Development Commands
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run linting
pnpm lint

# Smart contract development
pnpm compile          # Compile contracts
pnpm test            # Run contract tests
pnpm deploy:local    # Deploy to local Hardhat network
pnpm deploy:sepolia  # Deploy to Sepolia testnet
pnpm verify          # Verify contract on Etherscan
```

### Complete Development Cycle
```bash
# 1. Start local Hardhat network
npx hardhat node

# 2. In another terminal, deploy contracts locally
pnpm deploy:local

# 3. Start frontend development server
pnpm dev

# 4. Test your DApp with local contracts
# Frontend will connect to http://localhost:8545
```

### Testing on Sepolia
```bash
# 1. Deploy to Sepolia testnet
pnpm deploy:sepolia

# 2. Update your .env.local with the new contract address
VITE_MY_TOKEN_ADDRESS=0x...

# 3. Verify contract on Etherscan
pnpm verify

# 4. Test your DApp on Sepolia
```

---

## 🚨 Troubleshooting

### Common Issues

1. **Hook Conflicts**: Use Wagmi for blockchain data, TanStack Query for caching, Zustand for UI state only
2. **Stale Data**: Use proper scope keys and event-based invalidation
3. **Network Issues**: Always check `isConnected` and `chainId` before making calls
4. **Performance**: Use `enabled` guards and memoize inputs
5. **Real-time Updates**: Use `useWatchContractEvent` for contract events

### Best Practices Checklist

- [ ] **Single Source of Truth**: Use Wagmi for blockchain data, TanStack Query for caching, Zustand for UI state only
- [ ] **Scope Keys**: Centralized in `scopes.ts` for consistent invalidation
- [ ] **Enabled Guards**: All hooks have proper `enabled` conditions
- [ ] **Memoized Inputs**: Use `useMemo` for objects/arrays passed to hooks
- [ ] **Event-Driven Updates**: Use `useWatchContractEvent` for real-time updates
- [ ] **Proper Invalidation**: Invalidate specific scopes after transactions
- [ ] **Error Handling**: Proper error states and loading states
- [ ] **TypeScript**: Strict typing throughout
- [ ] **Performance**: Debounced invalidations, proper staleTime/gcTime

---

## 📚 Additional Resources

- [Wagmi Documentation](https://wagmi.sh/)
- [Viem Documentation](https://viem.sh/)
- [TanStack Query Documentation](https://tanstack.com/query)
- [Hardhat Documentation](https://hardhat.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

---

This guide provides everything you need to build production-ready DApps with modern tooling and best practices. Follow the patterns outlined here to avoid common pitfalls and build maintainable, performant applications.
