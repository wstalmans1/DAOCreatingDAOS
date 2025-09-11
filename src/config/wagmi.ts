import { http, webSocket, createConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { defineChain } from 'viem'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { injected } from '@wagmi/connectors'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'fallback_id'
const hasWalletConnect = !!projectId && projectId !== 'fallback_id' && projectId !== 'fallback'
const useWs = import.meta.env.VITE_USE_WS === 'true'
const envChainId = Number(import.meta.env.VITE_CHAIN_ID || 11155111)

// Mobile detection for performance tuning
const isMobile =
  typeof window !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

// RPC Provider Configuration (with public RPC fallback)
const sepoliaHttpUrl =
  import.meta.env.VITE_SEPOLIA_RPC_URL ||
  `https://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`
const sepoliaWsUrl =
  import.meta.env.VITE_SEPOLIA_WS_URL ||
  `wss://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`

// Localhost (Hardhat/Anvil) RPC with sensible defaults
const localhostHttpUrl = import.meta.env.VITE_LOCALHOST_RPC_URL || 'http://127.0.0.1:8545'
const localhostWsUrl = import.meta.env.VITE_LOCALHOST_WS_URL || ''

const isLocal = envChainId === 31337 || envChainId === 1337
const localhost = defineChain({
  id: envChainId && isLocal ? envChainId : 1337,
  name: 'Localhost',
  network: 'localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [localhostHttpUrl],
      webSocket: localhostWsUrl ? [localhostWsUrl] : undefined,
    },
    public: {
      http: [localhostHttpUrl],
      webSocket: localhostWsUrl ? [localhostWsUrl] : undefined,
    },
  },
})

function buildSepoliaTransport() {
  if (useWs && !isMobile && sepoliaWsUrl.startsWith('ws')) return webSocket(sepoliaWsUrl)
  return http(sepoliaHttpUrl)
}

// If no WalletConnect project id is provided, fall back to Injected-only connectors
export const config = hasWalletConnect
  ? getDefaultConfig({
      appName: 'DAO Creating DAOs',
      projectId,
      // Include both; active chain is selected by wallet or env
      chains: [localhost, sepolia],
      transports: {
        [sepolia.id]: buildSepoliaTransport(),
        [localhost.id]:
          useWs && !isMobile && localhostWsUrl.startsWith('ws')
            ? webSocket(localhostWsUrl)
            : http(localhostHttpUrl),
      } as any,
    })
  : createConfig({
      chains: [localhost, sepolia],
      transports: {
        [sepolia.id]: buildSepoliaTransport(),
        [localhost.id]:
          useWs && !isMobile && localhostWsUrl.startsWith('ws')
            ? webSocket(localhostWsUrl)
            : http(localhostHttpUrl),
      } as any,
      connectors: [injected({ shimDisconnect: true })],
      ssr: false,
    })
