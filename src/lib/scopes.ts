import { QueryClient } from '@tanstack/react-query'

// Centralized scope key names to avoid typos/mismatch
export const scopes = {
  userData: (chainId: number, address: string) =>
    ['user', 'data', chainId, address.toLowerCase()] as const,
  
  contractData: (chainId: number, contractAddress: string) =>
    ['contract', 'data', chainId, contractAddress.toLowerCase()] as const,
  
  eventLogs: (contractAddress: string, eventSig: string, fromBlock?: bigint, toBlock?: bigint) =>
    ['events', 'logs', contractAddress.toLowerCase(), eventSig, fromBlock?.toString(), toBlock?.toString()] as const,
  
  contractLogs: (contractAddress: string) =>
    ['contract', 'logs', contractAddress.toLowerCase()] as const,
  
  blockData: (blockNumber: string) =>
    ['block', 'data', blockNumber] as const,
} as const

// Debounced invalidation to prevent flicker
const pendingInvalidations = new Set<string>()
let invalidationTimeout: number | null = null

export function invalidateByScope(qc: QueryClient, scope: string | readonly unknown[]) {
  const scopeKey = Array.isArray(scope) ? scope.map(String).join('|') : scope
  
  pendingInvalidations.add(scopeKey as string)
  
  if (invalidationTimeout) {
    clearTimeout(invalidationTimeout)
  }
  
  invalidationTimeout = window.setTimeout(() => {
    const scopesToInvalidate = Array.from(pendingInvalidations)
    pendingInvalidations.clear()
    
    scopesToInvalidate.forEach(scopeStr => {
      if (scopeStr.includes('|')) {
        const keyParts = scopeStr.split('|')
        qc.invalidateQueries({ 
          queryKey: keyParts,
          exact: true 
        })
      } else {
        qc.invalidateQueries({
          predicate: (q) => {
            const k = q.queryKey as unknown[]
            return Array.isArray(k) && k.some((el) => el === scopeStr)
          },
        })
      }
    })
    
    console.log(`📱 Debounced invalidation completed for scopes:`, scopesToInvalidate)
  }, 50)
}
