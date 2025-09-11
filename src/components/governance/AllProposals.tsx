import React from 'react'
import type { Address, Abi } from 'viem'
import { usePublicClient } from 'wagmi'
import { decodeEventLog } from 'viem'

const REGISTRY = (import.meta.env.VITE_REGISTRY_ADDRESS || '') as `0x${string}`

const REGISTRY_ABI = [
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
] as const satisfies Abi

const EVENT_V5 = {
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

const EVENT_V4 = {
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

type Row = {
  id: string
  governor: Address
  description: string
  voteStart?: string
  voteEnd?: string
}

export function AllProposals() {
  const publicClient = usePublicClient()
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [status, setStatus] = React.useState<string>('')

  React.useEffect(() => {
    ;(async () => {
      try {
        if (!publicClient || !REGISTRY) return
        setStatus('Scanning registry…')
        const total = (await publicClient.readContract({
          address: REGISTRY,
          abi: REGISTRY_ABI,
          functionName: 'totalCircles',
        })) as bigint
        const count = Number(total)
        const governors: Address[] = []
        for (let i = 1; i <= count; i++) {
          const c: any = await publicClient.readContract({
            address: REGISTRY,
            abi: REGISTRY_ABI,
            functionName: 'circles',
            args: [BigInt(i)],
          })
          governors.push((c.governor ?? c[2]) as Address)
        }
        const latest = await publicClient.getBlockNumber()
        const isLocal = publicClient.chain?.id === 1337 || publicClient.chain?.id === 31337
        const fromBlock = isLocal ? 0n : latest > 500000n ? latest - 500000n : 0n
        const acc: Row[] = []
        for (const g of governors) {
          setStatus(`Fetching proposals from ${g}…`)
          let logs: any[] = []
          try {
            const [a, b] = await Promise.all([
              (publicClient as any)
                .getLogs({ address: g, event: EVENT_V5 as any, fromBlock, toBlock: latest })
                .catch(() => []),
              (publicClient as any)
                .getLogs({ address: g, event: EVENT_V4 as any, fromBlock, toBlock: latest })
                .catch(() => []),
            ])
            logs = [...a, ...b]
          } catch {
            logs = []
          }
          // If nothing decoded, get raw logs and decode manually
          if (logs.length === 0) {
            try {
              const raw = (await publicClient.getLogs({
                address: g,
                fromBlock,
                toBlock: latest,
              })) as any[]
              logs = raw
            } catch {
              logs = []
            }
          }
          for (const l of logs) {
            try {
              let args: any = l.args
              if (!args) {
                try {
                  const dec = decodeEventLog({
                    abi: [EVENT_V5] as unknown as Abi,
                    data: l.data,
                    topics: l.topics,
                  }) as any
                  args = dec.args
                } catch {
                  try {
                    const dec = decodeEventLog({
                      abi: [EVENT_V4] as unknown as Abi,
                      data: l.data,
                      topics: l.topics,
                    }) as any
                    args = dec.args
                  } catch {
                    args = null
                  }
                }
              }
              if (!args?.proposalId) continue
              acc.push({
                id: (args.proposalId as bigint).toString(),
                governor: g,
                description: (args.description as string) || '',
                voteStart: (args.voteStart as bigint)?.toString?.(),
                voteEnd: (args.voteEnd as bigint)?.toString?.(),
              })
            } catch {
              // ignore undecodable log
            }
          }
        }
        // dedupe by id+governor
        const map = new Map<string, Row>()
        for (const r of acc) map.set(r.governor + ':' + r.id, r)
        setRows(Array.from(map.values()).reverse())
        setStatus('')
      } catch (e: any) {
        setStatus(`Error scanning: ${e?.message || String(e)}`)
      }
    })()
  }, [publicClient, publicClient?.chain?.id])

  return (
    <div className="w-full max-w-2xl text-slate-700">
      <div className="text-sm font-semibold mb-2">All Proposals (full scan)</div>
      {status && <div className="text-xs text-gray-600 mb-2">{status}</div>}
      {rows === null ? (
        <div className="text-gray-500 text-sm">Scanning…</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-500 text-sm">No proposals found in registry</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.governor + r.id}
              className="border rounded p-2 text-xs text-slate-700 bg-white"
            >
              <div>
                <span className="font-medium">ID:</span> {r.id}
              </div>
              <div>
                <span className="font-medium">Governor:</span>{' '}
                <span className="font-mono">{r.governor}</span>
              </div>
              <div className="truncate" title={r.description}>
                <span className="font-medium">Description:</span>{' '}
                {r.description || '(no description)'}
              </div>
              {r.voteStart && r.voteEnd && (
                <div>
                  <span className="font-medium">Blocks:</span> {r.voteStart} → {r.voteEnd}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
