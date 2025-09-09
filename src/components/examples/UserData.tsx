import { useAccount } from 'wagmi'
import { useUserData } from '../../hooks/useUserData'
import { formatUnits } from 'viem'

export function UserData() {
  const { address, chainId } = useAccount()
  const { balance, symbol, decimals, isLoadingBalance, balanceError, contractAddress } = useUserData()

  if (!address) {
    return <div className="text-gray-500">Please connect your wallet</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">Wallet Info</h3>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium">Address:</span> {address}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Chain ID:</span> {chainId}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">Contract Info</h3>
          {contractAddress ? (
            <>
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">Contract:</span> {contractAddress}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Symbol:</span> {symbol || 'Loading...'}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              No contract address configured. Please deploy a contract and update VITE_MY_TOKEN_ADDRESS in your .env.local file.
            </p>
          )}
        </div>
      </div>

      {contractAddress && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Token Balance</h3>
          {isLoadingBalance ? (
            <p className="text-blue-600">Loading balance...</p>
          ) : balanceError ? (
            <p className="text-red-600">Error loading balance: {balanceError.message}</p>
          ) : balance !== undefined && decimals !== undefined ? (
            <p className="text-lg font-medium text-blue-800">
              {formatUnits(balance, decimals)} {symbol}
            </p>
          ) : (
            <p className="text-blue-600">Balance data unavailable</p>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500 mt-4">
        <p>💡 This component demonstrates:</p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Wagmi hooks for reading contract data</li>
          <li>Proper error handling and loading states</li>
          <li>Scoped query invalidation</li>
          <li>Type-safe contract interactions</li>
        </ul>
      </div>
    </div>
  )
}
