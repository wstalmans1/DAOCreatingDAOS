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
