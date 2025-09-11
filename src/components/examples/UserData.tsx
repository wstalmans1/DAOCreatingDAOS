import { useAccount } from 'wagmi'
import { useUserData } from '../../hooks/useUserData'
import { formatUnits } from 'viem'
import { DelegationPanel } from '../governance/DelegationPanel'
import {
  REGISTRY_ADDRESS,
  FACTORY_ADDRESS,
  GOVERNOR_ROOT_ADDRESS,
  TIMELOCK_ROOT_ADDRESS,
  TREASURY_ROOT_ADDRESS,
  VOTING_TOKEN_ROOT_ADDRESS,
} from '../../constants/contracts'

export function UserData() {
  const { address } = useAccount()
  const { balance, symbol, decimals, isLoadingBalance, balanceError, contractAddress, source } =
    useUserData()

  if (!address) {
    return <div className="text-gray-500">Please connect your wallet</div>
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Contracts */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-1 text-sm">Contracts</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div>
              <span className="font-medium">Voting Token (root):</span>
              <div className="truncate" title={VOTING_TOKEN_ROOT_ADDRESS || '(not set)'}>
                {VOTING_TOKEN_ROOT_ADDRESS || '—'}
              </div>
            </div>
            <div>
              <span className="font-medium">Registry:</span>
              <div className="truncate" title={REGISTRY_ADDRESS || '(not set)'}>
                {REGISTRY_ADDRESS || '—'}
              </div>
            </div>
            <div>
              <span className="font-medium">Factory:</span>
              <div className="truncate" title={FACTORY_ADDRESS || '(not set)'}>
                {FACTORY_ADDRESS || '—'}
              </div>
            </div>
            <div>
              <span className="font-medium">Governor (root):</span>
              <div className="truncate" title={GOVERNOR_ROOT_ADDRESS || '(not set)'}>
                {GOVERNOR_ROOT_ADDRESS || '—'}
              </div>
            </div>
            <div>
              <span className="font-medium">Timelock (root):</span>
              <div className="truncate" title={TIMELOCK_ROOT_ADDRESS || '(not set)'}>
                {TIMELOCK_ROOT_ADDRESS || '—'}
              </div>
            </div>
            <div>
              <span className="font-medium">Treasury (root):</span>
              <div className="truncate" title={TREASURY_ROOT_ADDRESS || '(not set)'}>
                {TREASURY_ROOT_ADDRESS || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Balance + Voting Power & Delegation */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-1 text-sm">Token Balance</h3>
          <div className="text-xs">
            {!contractAddress ? (
              <p className="text-gray-600">Set VITE_VOTING_TOKEN_ROOT_ADDRESS to query balance.</p>
            ) : isLoadingBalance ? (
              <p className="text-blue-600">Loading…</p>
            ) : balanceError ? (
              <p className="text-red-600">{balanceError.message}</p>
            ) : balance !== undefined && decimals !== undefined ? (
              <div className="text-gray-800 space-y-1">
                <p>
                  {(() => {
                    const raw = formatUnits(balance as any, decimals as any)
                    const [i, f] = raw.split('.')
                    const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                    const ff = (f || '').replace(/0+$/, '').slice(0, 4)
                    return ff ? `${ii}.${ff}` : ii
                  })()}{' '}
                  {symbol}
                </p>
                <p className="text-[11px] text-gray-600">
                  Source: {source} • Token: <span className="font-mono">{contractAddress}</span>
                </p>
              </div>
            ) : (
              <p className="text-gray-600">Balance unavailable</p>
            )}
          </div>
          {/* Delegation panel (root) embedded here to avoid duplication elsewhere */}
          <div className="mt-3">
            {GOVERNOR_ROOT_ADDRESS ? (
              <DelegationPanel governor={GOVERNOR_ROOT_ADDRESS} />
            ) : (
              <div className="text-xs text-gray-600">
                Set VITE_GOVERNOR_ROOT_ADDRESS to manage voting power.
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Delegation panel moved inside Token Balance card above */}
    </div>
  )
}
