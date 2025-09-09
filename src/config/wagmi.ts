import { http, webSocket } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'fallback_id'
const useWs = import.meta.env.VITE_USE_WS === 'true'

// Mobile detection for performance tuning
const isMobile =
  typeof window !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

// RPC Provider Configuration
const RPC_URLS = {
  alchemy: {
    sepolia: `https://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
    sepoliaWs: `wss://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
  },
}

function buildSepoliaTransport() {
  if (useWs && !isMobile) return webSocket(RPC_URLS.alchemy.sepoliaWs)
  return http(RPC_URLS.alchemy.sepolia)
}

export const config = getDefaultConfig({
  appName: 'DAO Creating DAOs',
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: buildSepoliaTransport(),
  },
})
