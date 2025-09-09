import { useReadContract, useAccount } from 'wagmi'

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const

// Replace with your deployed contract address
const CONTRACT_ADDRESS = import.meta.env.VITE_MY_TOKEN_ADDRESS as `0x${string}`

export function useUserData() {
  const { address, chainId } = useAccount()
  
  const { data: balance, isLoading: isLoadingBalance, error: balanceError } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!chainId && !!CONTRACT_ADDRESS,
      staleTime: 30_000,
    },
  })

  const { data: symbol } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: !!CONTRACT_ADDRESS,
      staleTime: 60_000, // Symbol doesn't change often
    },
  })

  const { data: decimals } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: !!CONTRACT_ADDRESS,
      staleTime: 60_000, // Decimals don't change
    },
  })

  return {
    balance,
    symbol,
    decimals,
    isLoadingBalance,
    balanceError,
    contractAddress: CONTRACT_ADDRESS,
  }
}
