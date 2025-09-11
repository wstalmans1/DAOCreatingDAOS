import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { config } from './config/wagmi'
import App from './App'
import { ErrorBoundary } from './components/common/ErrorBoundary'
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
      gcTime: 5 * 60 * 1000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          <ReactQueryDevtools initialIsOpen={false} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
