import { useAccount, usePublicClient, useWatchContractEvent, useWriteContract } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Abi, Address } from 'viem'
import { decodeEventLog } from 'viem'

// Minimal Governor + IVotes ABIs
export const GOVERNOR_MINI_ABI = [
  // events
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      // Note: Our CircleGovernor (artifact) emits non-indexed id/proposer and includes signatures[]
      { name: 'proposalId', type: 'uint256', indexed: false },
      { name: 'proposer', type: 'address', indexed: false },
      { name: 'targets', type: 'address[]', indexed: false },
      { name: 'values', type: 'uint256[]', indexed: false },
      { name: 'signatures', type: 'string[]', indexed: false },
      { name: 'calldatas', type: 'bytes[]', indexed: false },
      { name: 'voteStart', type: 'uint256', indexed: false },
      { name: 'voteEnd', type: 'uint256', indexed: false },
      { name: 'description', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      { name: 'voter', type: 'address', indexed: true },
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'support', type: 'uint8', indexed: false },
      { name: 'weight', type: 'uint256', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  // reads
  {
    type: 'function',
    name: 'state',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'proposalSnapshot',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'proposalDeadline',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'proposalVotes',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [
      { type: 'uint256', name: 'againstVotes' },
      { type: 'uint256', name: 'forVotes' },
      { type: 'uint256', name: 'abstainVotes' },
    ],
  },
  {
    type: 'function',
    name: 'hasVoted',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }, { type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'token',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  // writes
  {
    type: 'function',
    name: 'castVote',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }, { type: 'uint8' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'castVoteWithReason',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }, { type: 'uint8' }, { type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'queue',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address[]', name: 'targets' },
      { type: 'uint256[]', name: 'values' },
      { type: 'bytes[]', name: 'calldatas' },
      { type: 'bytes32', name: 'descriptionHash' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { type: 'address[]', name: 'targets' },
      { type: 'uint256[]', name: 'values' },
      { type: 'bytes[]', name: 'calldatas' },
      { type: 'bytes32', name: 'descriptionHash' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const satisfies Abi

export const IVOTES_MINI_ABI = [
  {
    type: 'function',
    name: 'getVotes',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getPastVotes',
    stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'delegate',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'delegates',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'event',
    name: 'DelegateChanged',
    inputs: [
      { name: 'delegator', type: 'address', indexed: true },
      { name: 'fromDelegate', type: 'address', indexed: true },
      { name: 'toDelegate', type: 'address', indexed: true },
    ],
  },
] as const satisfies Abi

export type ProposalRow = {
  id: bigint
  proposer: Address
  voteStart: bigint
  voteEnd: bigint
  description: string
}

export function useGovernorProposals(governor?: Address) {
  const publicClient = usePublicClient()
  const enabled = Boolean(governor && publicClient)

  return useQuery({
    queryKey: ['gov', 'proposals', publicClient?.chain?.id, governor],
    enabled,
    queryFn: async (): Promise<ProposalRow[]> => {
      if (!governor || !publicClient) return []
      const latest = await publicClient.getBlockNumber()
      const isLocal = publicClient.chain?.id === 1337 || publicClient.chain?.id === 31337
      const fromBlock = isLocal ? 0n : latest > 500000n ? latest - 500000n : 0n

      // Try OZ v5 (no signatures[]), then OZ v4 (includes signatures[])
      const eventV5 = {
        type: 'event',
        name: 'ProposalCreated',
        inputs: [
          { name: 'proposalId', type: 'uint256', indexed: false },
          { name: 'proposer', type: 'address', indexed: false },
          { name: 'targets', type: 'address[]', indexed: false },
          { name: 'values', type: 'uint256[]', indexed: false },
          { name: 'calldatas', type: 'bytes[]', indexed: false },
          { name: 'voteStart', type: 'uint256', indexed: false },
          { name: 'voteEnd', type: 'uint256', indexed: false },
          { name: 'description', type: 'string', indexed: false },
        ],
      } as const
      const eventV4 = {
        type: 'event',
        name: 'ProposalCreated',
        inputs: [
          { name: 'proposalId', type: 'uint256', indexed: false },
          { name: 'proposer', type: 'address', indexed: false },
          { name: 'targets', type: 'address[]', indexed: false },
          { name: 'values', type: 'uint256[]', indexed: false },
          { name: 'signatures', type: 'string[]', indexed: false },
          { name: 'calldatas', type: 'bytes[]', indexed: false },
          { name: 'voteStart', type: 'uint256', indexed: false },
          { name: 'voteEnd', type: 'uint256', indexed: false },
          { name: 'description', type: 'string', indexed: false },
        ],
      } as const

      // Fetch both shapes via event filters; if both fail, fall back to raw logs and manual decode
      let allLogs: any[] = []
      try {
        const [logsV5, logsV4] = await Promise.all([
          publicClient
            .getLogs({
              address: governor,
              event: eventV5 as any,
              fromBlock,
              toBlock: latest,
            } as any)
            .catch(() => []),
          publicClient
            .getLogs({
              address: governor,
              event: eventV4 as any,
              fromBlock,
              toBlock: latest,
            } as any)
            .catch(() => []),
        ])
        allLogs = [...(logsV5 as any[]), ...(logsV4 as any[])]
      } catch {
        allLogs = []
      }
      if (allLogs.length === 0) {
        // Raw logs (no filtering) then manual decode — resilient to ABI mismatches
        try {
          const raw = (await publicClient.getLogs({
            address: governor,
            fromBlock,
            toBlock: latest,
          })) as any[]
          allLogs = raw
        } catch {
          allLogs = []
        }
      }
      // If decoding failed upstream, try manual decode
      const proposals: ProposalRow[] = []
      for (const l of allLogs) {
        if (l?.args?.proposalId) {
          proposals.push({
            id: l.args.proposalId as bigint,
            proposer: l.args.proposer as Address,
            voteStart: (l.args.voteStart as bigint) ?? 0n,
            voteEnd: (l.args.voteEnd as bigint) ?? 0n,
            description: (l.args.description as string) || '',
          })
          continue
        }
        try {
          // Manual decode attempt for safety
          const decoded = decodeEventLog({
            abi: [eventV5] as unknown as Abi,
            data: l.data,
            topics: l.topics,
          }) as any
          proposals.push({
            id: decoded.args.proposalId as bigint,
            proposer: decoded.args.proposer as Address,
            voteStart: (decoded.args.voteStart as bigint) ?? 0n,
            voteEnd: (decoded.args.voteEnd as bigint) ?? 0n,
            description: (decoded.args.description as string) || '',
          })
        } catch {
          try {
            const decoded = decodeEventLog({
              abi: [eventV4] as unknown as Abi,
              data: l.data,
              topics: l.topics,
            }) as any
            proposals.push({
              id: decoded.args.proposalId as bigint,
              proposer: decoded.args.proposer as Address,
              voteStart: (decoded.args.voteStart as bigint) ?? 0n,
              voteEnd: (decoded.args.voteEnd as bigint) ?? 0n,
              description: (decoded.args.description as string) || '',
            })
          } catch {
            // ignore undecodable logs
          }
        }
      }

      // dedupe by id
      const byId = new Map<string, ProposalRow>()
      for (const p of proposals) byId.set(p.id.toString(), p)
      return Array.from(byId.values())
    },
  })
}

export function useProposalMeta(governor?: Address, id?: bigint) {
  const publicClient = usePublicClient()
  const { address: user } = useAccount()
  const enabled = Boolean(governor && id !== undefined && publicClient)

  return useQuery({
    queryKey: [
      'gov',
      'meta',
      publicClient?.chain?.id,
      governor,
      id !== undefined ? id.toString() : undefined,
      user,
    ],
    enabled,
    queryFn: async () => {
      if (!governor || id === undefined || !publicClient) return null
      const [state, snapshot, deadline, votes, hasVoted, token] = await Promise.all([
        publicClient.readContract({
          address: governor,
          abi: GOVERNOR_MINI_ABI,
          functionName: 'state',
          args: [id],
        }) as Promise<number>,
        publicClient.readContract({
          address: governor,
          abi: GOVERNOR_MINI_ABI,
          functionName: 'proposalSnapshot',
          args: [id],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: governor,
          abi: GOVERNOR_MINI_ABI,
          functionName: 'proposalDeadline',
          args: [id],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: governor,
          abi: GOVERNOR_MINI_ABI,
          functionName: 'proposalVotes',
          args: [id],
        }) as Promise<readonly [bigint, bigint, bigint]>,
        user
          ? (publicClient.readContract({
              address: governor,
              abi: GOVERNOR_MINI_ABI,
              functionName: 'hasVoted',
              args: [id, user],
            }) as Promise<boolean>)
          : Promise.resolve(false),
        publicClient.readContract({
          address: governor,
          abi: GOVERNOR_MINI_ABI,
          functionName: 'token',
        }) as Promise<Address>,
      ])

      let userVotesAt = 0n
      if (user) {
        try {
          userVotesAt = (await publicClient.readContract({
            address: token,
            abi: IVOTES_MINI_ABI,
            functionName: 'getPastVotes',
            args: [user, snapshot],
          })) as bigint
        } catch (_) {
          // ignore
        }
      }

      return { state, snapshot, deadline, votes, hasVoted, token, userVotesAt }
    },
  })
}

export function useGovernanceWatch(governor?: Address) {
  const qc = useQueryClient()
  useWatchContractEvent({
    address: governor,
    abi: GOVERNOR_MINI_ABI,
    eventName: 'ProposalCreated',
    enabled: Boolean(governor),
    onLogs: () => qc.invalidateQueries({ queryKey: ['gov', 'proposals'] }),
  })
  useWatchContractEvent({
    address: governor,
    abi: GOVERNOR_MINI_ABI,
    eventName: 'VoteCast',
    enabled: Boolean(governor),
    onLogs: () => qc.invalidateQueries({ queryKey: ['gov'] }),
  })
}

export function useGovernorToken(governor?: Address) {
  const publicClient = usePublicClient()
  const enabled = Boolean(governor && publicClient)
  return useQuery({
    queryKey: ['gov', 'token', publicClient?.chain?.id, governor],
    enabled,
    queryFn: async () => {
      if (!governor || !publicClient) return null
      const t = (await publicClient.readContract({
        address: governor,
        abi: GOVERNOR_MINI_ABI,
        functionName: 'token',
      })) as Address
      return t
    },
  })
}

export function useCastVote() {
  const { writeContractAsync, isPending } = useWriteContract()
  return {
    isPending,
    cast: async (governor: Address, id: bigint, support: 0 | 1 | 2, reason?: string) => {
      if (reason && reason.trim().length) {
        await writeContractAsync({
          address: governor,
          abi: GOVERNOR_MINI_ABI,
          functionName: 'castVoteWithReason',
          args: [id, support, reason],
        })
      } else {
        await writeContractAsync({
          address: governor,
          abi: GOVERNOR_MINI_ABI,
          functionName: 'castVote',
          args: [id, support],
        })
      }
    },
  }
}
