import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePublicClient, useWatchContractEvent } from 'wagmi'
import { REGISTRY_ADDRESS } from '../constants/contracts'
import type { Abi } from 'viem'

export type CircleNode = {
  id: bigint
  parentId: bigint
  name: string
  governor: `0x${string}`
  timelock: `0x${string}`
  treasury: `0x${string}`
  token: `0x${string}`
  children: CircleNode[]
}

export function useCircles(registryAbi?: Abi) {
  const publicClient = usePublicClient()

  return useQuery({
    queryKey: ['circles', publicClient?.chain?.id, REGISTRY_ADDRESS],
    enabled: Boolean(publicClient && REGISTRY_ADDRESS && registryAbi),
    queryFn: async () => {
      if (!publicClient || !registryAbi) throw new Error('Missing client or ABI')
      const total = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: 'totalCircles',
      })) as bigint

      const nodes: CircleNode[] = []
      for (let i = 1n; i <= total; i++) {
        const c = (await publicClient.readContract({
          address: REGISTRY_ADDRESS,
          abi: registryAbi,
          functionName: 'circles',
          args: [i],
        })) as any
        const node: CircleNode = {
          id: (c.id_ ?? c[0]) as bigint,
          parentId: (c.parentId ?? c[1]) as bigint,
          governor: (c.governor ?? c[2]) as `0x${string}`,
          timelock: (c.timelock ?? c[3]) as `0x${string}`,
          treasury: (c.treasury ?? c[4]) as `0x${string}`,
          token: (c.token ?? c[5]) as `0x${string}`,
          name: (c.name ?? c[6]) as string,
          children: [],
        }
        nodes.push(node)
      }
      // Build tree
      const byId = new Map<bigint, CircleNode>()
      nodes.forEach((n) => byId.set(n.id, n))
      const roots: CircleNode[] = []
      nodes.forEach((n) => {
        if (n.parentId === 0n) roots.push(n)
        else byId.get(n.parentId)?.children.push(n)
      })
      return roots
    },
  })
}

// Event-driven refresh: watch CircleRegistered and invalidate the circles query
export function useCirclesEvents(registryAbi?: Abi) {
  const publicClient = usePublicClient()
  const qc = useQueryClient()

  useWatchContractEvent({
    address: REGISTRY_ADDRESS,
    abi: registryAbi as Abi,
    eventName: 'CircleRegistered',
    enabled: Boolean(publicClient && REGISTRY_ADDRESS && registryAbi),
    onLogs: () => {
      const chainId = publicClient?.chain?.id
      if (chainId) qc.invalidateQueries({ queryKey: ['circles', chainId, REGISTRY_ADDRESS] })
    },
    onError: () => {
      // ignore for now; UI can still refetch manually
    },
  })
}
