/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
  readonly VITE_ALCHEMY_API_KEY: string
  readonly VITE_CHAIN_ID: string
  readonly VITE_MY_TOKEN_ADDRESS: string
  readonly VITE_SEPOLIA_RPC_URL?: string
  readonly VITE_SEPOLIA_WS_URL?: string
  readonly VITE_LOCALHOST_RPC_URL?: string
  readonly VITE_LOCALHOST_WS_URL?: string
  readonly VITE_TIMELOCK_ROOT_ADDRESS?: string
  readonly VITE_TREASURY_ROOT_ADDRESS?: string
  readonly VITE_VOTING_TOKEN_ROOT_ADDRESS?: string
  readonly VITE_REGISTRY_ADDRESS?: string
  readonly VITE_FACTORY_ADDRESS?: string
  readonly VITE_GOVERNOR_ROOT_ADDRESS?: string
  readonly VITE_USE_WS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
