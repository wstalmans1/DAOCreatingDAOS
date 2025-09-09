# 🏗️ DAO Creating DAOs

A production-ready Ethereum DApp built with modern tools and best practices, following the comprehensive setup guide.

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Blockchain**: Wagmi v2.5+ + Viem + RainbowKit
- **State Management**: TanStack Query v5 + Zustand
- **Smart Contracts**: Hardhat + OpenZeppelin
- **Styling**: Tailwind CSS
- **Network**: Alchemy (Sepolia testnet)

## 📋 Quick Start

### 1. Environment Setup

Create separate env files for backend (Hardhat) and frontend (Vite):

```bash
# Backend (Node/Hardhat)
cp env.template .env

# Frontend (Vite)
cp env.local.template .env.local
```

Fill the files with your values:

- `.env` (backend only, NOT exposed to browser):
  - `PRIVATE_KEY` — deployment wallet private key
  - `ETHERSCAN_API_KEY` — for contract verification
  - `SEPOLIA_RPC_URL` or `ALCHEMY_API_KEY` — RPC provider config
- `.env.local` (frontend, Vite will expose these):
  - `VITE_WALLETCONNECT_PROJECT_ID` — from WalletConnect Cloud
  - `VITE_ALCHEMY_API_KEY` — from Alchemy
  - `VITE_CHAIN_ID` — default `11155111` (Sepolia)
  - `VITE_MY_TOKEN_ADDRESS` — set after deploying the token

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Smart Contract Development

Compile contracts:

```bash
pnpm compile
```

Run tests:

```bash
pnpm test
```

Deploy to local Hardhat network:

```bash
# In terminal 1 - Start local blockchain
npx hardhat node

# In terminal 2 - Deploy contracts
pnpm deploy:local
```

Deploy to Sepolia testnet:

```bash
pnpm deploy:sepolia
```

Verify on Etherscan (reads address from deployments folder):

```bash
pnpm verify:sepolia
```

### 4. Frontend Development

Start the development server:

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

## 📦 Deployments

Deployment artifacts are saved to `deployments/<network>/MyToken.json` with address and ABI. After deploying to your target network, copy the address into `.env.local` as `VITE_MY_TOKEN_ADDRESS` for the frontend to read.

Optional: To use WebSockets in the frontend (default is HTTP to avoid blocked WS environments), set `VITE_USE_WS=true` in `.env.local`.

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── examples/       # Example components
│   └── ui/            # Reusable UI components
├── config/             # Configuration files
│   └── wagmi.ts       # Wagmi configuration
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
│   ├── scopes.ts      # TanStack Query scopes
│   └── alchemyClient.ts # Alchemy client setup
├── constants/          # App constants
├── stores/             # Zustand stores
├── utils/              # Utility functions
├── contracts/          # Contract ABIs and addresses
└── abis/              # Contract ABIs

contracts/              # Solidity smart contracts
scripts/               # Deployment scripts
test/                  # Contract tests
```

## 🎯 Key Features

### Smart Contract Integration

- ✅ Type-safe contract interactions with Wagmi + Viem
- ✅ Automatic ABI generation and type inference
- ✅ Event watching and real-time updates
- ✅ Proper error handling and loading states

### State Management

- ✅ TanStack Query for server state caching
- ✅ Scoped invalidation for efficient updates
- ✅ Debounced invalidation to prevent flicker
- ✅ Zustand for local UI state

### Performance Optimizations

- ✅ Mobile-optimized transport selection (HTTP vs WebSocket)
- ✅ Proper query configuration with staleTime/gcTime
- ✅ Code splitting and bundle optimization
- ✅ Memoized query inputs to prevent refetches

## 🔧 Development Workflow

### Local Development

1. Start Hardhat node: `npx hardhat node`
2. Deploy contracts: `pnpm deploy:local`
3. Start frontend: `pnpm dev`
4. Connect MetaMask to localhost:8545

### Testnet Deployment

1. Deploy to Sepolia: `pnpm deploy:sepolia`
2. Update contract address in `.env.local`
3. Verify contract: `pnpm verify`
4. Test on Sepolia testnet

## 📚 Best Practices Implemented

### Hook Usage Patterns

- ✅ **Wagmi/Viem**: Blockchain I/O (reads/writes, wallet/chain status)
- ✅ **TanStack Query**: Server-state cache + fetching lifecycle
- ✅ **React useState/useEffect**: Local UI state only

### Data Management

- ✅ Single source of truth for blockchain data
- ✅ Proper enabled guards for all queries
- ✅ Event-driven cache invalidation
- ✅ Scoped query keys for precise updates

### Performance

- ✅ Debounced invalidations
- ✅ Optimized transport selection
- ✅ Proper staleTime configuration
- ✅ Bundle splitting and optimization

## 🚨 Common Pitfalls Avoided

- ❌ Fetching with `useEffect` + manual state management
- ❌ Storing query results in `useState`
- ❌ Building args/contracts inline (causing refetches)
- ❌ Manual UI updates instead of invalidation
- ❌ Mixing refetchInterval with event watchers

## 📖 Learn More

This project implements the patterns described in the comprehensive DApp setup guide. For detailed explanations of the architecture and best practices, refer to `COMPLETE_DAPP_SETUP_GUIDE.md`.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the established patterns
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details
