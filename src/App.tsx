import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useState, useMemo } from 'react'
import { UserData } from './components/examples/UserData'
import { CirclesView } from './components/circles/CirclesView'
import RecursiveDAOExplorer from './components/RecursiveDAOExplorer'
import { REGISTRY_ADDRESS } from './constants/contracts'
import { useCircles } from './hooks/useCircles'
import type { Abi } from 'viem'
// BottomProposalsBar removed per request

function App() {
  const { isConnected } = useAccount()
  const [currentView, setCurrentView] = useState<'circles' | 'explorer'>('circles')

  // Minimal ABI for registry - duplicated from CirclesView for now
  const minimalRegistryAbi = useMemo<Abi>(
    () =>
      [
        {
          type: 'function',
          name: 'totalCircles',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ type: 'uint256' }],
        },
        {
          type: 'function',
          name: 'circles',
          stateMutability: 'view',
          inputs: [{ name: 'id', type: 'uint256' }],
          outputs: [
            { name: 'id', type: 'uint256' },
            { name: 'parentId', type: 'uint256' },
            { name: 'governor', type: 'address' },
            { name: 'timelock', type: 'address' },
            { name: 'treasury', type: 'address' },
            { name: 'token', type: 'address' },
            { name: 'name', type: 'string' },
          ],
        },
        {
          type: 'event',
          name: 'CircleRegistered',
          inputs: [
            { name: 'id', type: 'uint256', indexed: true },
            { name: 'parentId', type: 'uint256', indexed: false },
            { name: 'governor', type: 'address', indexed: false },
            { name: 'timelock', type: 'address', indexed: false },
            { name: 'treasury', type: 'address', indexed: false },
            { name: 'token', type: 'address', indexed: false },
            { name: 'name', type: 'string', indexed: false },
          ],
        },
      ] as unknown as Abi,
    [],
  )

  const { data: circles } = useCircles(minimalRegistryAbi)

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
          <div className="mb-6">
            <div className="flex justify-center">
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                <button
                  onClick={() => setCurrentView('circles')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentView === 'circles'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Circles
                </button>
                <button
                  onClick={() => setCurrentView('explorer')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentView === 'explorer'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  DAO Explorer
                </button>
              </div>
            </div>
          </div>
        )}

        {isConnected && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <UserData />
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          {currentView === 'circles' ? (
            <>
              <h2 className="text-2xl font-semibold mb-4">Circles</h2>
              {REGISTRY_ADDRESS ? (
                <CirclesView />
              ) : (
                <div className="text-sm text-gray-600">
                  Set VITE_REGISTRY_ADDRESS to display circles.
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold mb-4">DAO Explorer</h2>
              <RecursiveDAOExplorer circles={circles} />
            </>
          )}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Built following best practices for modern DApp development</p>
        </div>
      </div>
      {/* Bottom proposals bar removed */}
    </div>
  )
}

export default App
