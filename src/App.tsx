import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { UserData } from './components/examples/UserData'

function App() {
  const { isConnected } = useAccount()

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">🏗️ DAO Creating DAOs</h1>
          <p className="text-lg text-gray-600 mb-8">
            A production-ready DApp built with Wagmi v2.5+, Viem, and TanStack Query v5
          </p>
          <ConnectButton />
        </div>

        {isConnected && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4">User Dashboard</h2>
            <UserData />
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Built following best practices for modern DApp development</p>
        </div>
      </div>
    </div>
  )
}

export default App
