import React from 'react'
import type { Abi, Address } from 'viem'
import { decodeEventLog } from 'viem'
import { usePublicClient } from 'wagmi'
import { REGISTRY_ADDRESS } from '../../constants/contracts'
import { GOVERNOR_MINI_ABI } from '../../hooks/useGovernor'

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
  id: bigint
  governor: Address
  description: string
  voteStart?: bigint
  voteEnd?: bigint
  state?: number
}

function stateLabel(n?: number) {
  switch (n) {
    case 0:
      return 'Pending'
    case 1:
      return 'Active'
    case 2:
      return 'Canceled'
    case 3:
      return 'Defeated'
    case 4:
      return 'Succeeded'
    case 5:
      return 'Queued'
    case 6:
      return 'Expired'
    case 7:
      return 'Executed'
    default:
      return 'Unknown'
  }
}

export function BottomProposalsBar() {
  const publicClient = usePublicClient()
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [status, setStatus] = React.useState<string>('')

  const isLocal = publicClient?.chain?.id === 1337 || publicClient?.chain?.id === 31337

  const load = React.useCallback(async () => {
    if (!publicClient || !REGISTRY_ADDRESS) return
    setStatus('Scanning registry…')
    try {
      const total = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'totalCircles',
      })) as bigint

      const governors: Address[] = []
      for (let i = 1n; i <= total; i++) {
        const c: any = await publicClient.readContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'circles',
          args: [i],
        })
        governors.push((c.governor ?? c[2]) as Address)
      }

      const latest = await publicClient.getBlockNumber()
      const fromBlock = isLocal ? 0n : latest > 500000n ? latest - 500000n : 0n

      const acc: Row[] = []
      for (const g of governors) {
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
              id: args.proposalId as bigint,
              governor: g,
              description: (args.description as string) || '',
              voteStart: (args.voteStart as bigint) ?? undefined,
              voteEnd: (args.voteEnd as bigint) ?? undefined,
            })
          } catch {
            // ignore undecodable log
          }
        }
      }

      // dedupe and fetch states
      const unique = new Map<string, Row>()
      for (const r of acc) unique.set(r.governor + ':' + r.id.toString(), r)
      const list = Array.from(unique.values())

      // Read state for each proposal (best-effort)
      const withStates = await Promise.all(
        list.map(async (r) => {
          try {
            const s = (await publicClient.readContract({
              address: r.governor,
              abi: GOVERNOR_MINI_ABI,
              functionName: 'state',
              args: [r.id],
            })) as number
            return { ...r, state: s }
          } catch {
            return r
          }
        }),
      )

      // sort recent first (by voteStart if present else id)
      withStates.sort((a, b) => Number((b.voteStart ?? b.id) - (a.voteStart ?? a.id)))

      setRows(withStates)
      setStatus('')
    } catch (e: any) {
      setStatus(`Error: ${e?.message || String(e)}`)
      setRows([])
    }
  }, [publicClient, isLocal])

  React.useEffect(() => {
    if (!publicClient || !REGISTRY_ADDRESS) return
    // Avoid hitting public testnet by default; this module is for local dev UX
    if (!(publicClient.chain?.id === 1337 || publicClient.chain?.id === 31337)) {
      setStatus('Switch wallet to Localhost to enable proposal bar')
      setRows([])
      return
    }
    load()
    // Optionally refresh every 10s while on local
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [publicClient, publicClient?.chain?.id, load])

  if (!REGISTRY_ADDRESS) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto max-w-6xl">
        <div className="m-2 rounded-lg border border-indigo-400 bg-indigo-950/95 text-indigo-50 shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <div className="font-semibold">Proposals (Registry)</div>
            <div className="flex items-center gap-2">
              {status && <span className="text-indigo-200">{status}</span>}
              <button
                className="rounded border border-indigo-400/60 bg-indigo-800 px-2 py-0.5 hover:bg-indigo-700"
                onClick={() => load()}
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="max-h-40 overflow-auto px-3 pb-3">
            {rows === null ? (
              <div className="text-indigo-200 text-xs">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="text-indigo-200 text-xs">No proposals found</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {rows.map((r) => (
                  <div
                    key={r.governor + ':' + r.id.toString()}
                    className="rounded bg-indigo-900/60 p-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-[11px]">{r.id.toString()}</div>
                      <div
                        className={`rounded px-2 py-[2px] text-[10px] ${
                          r.state === 1
                            ? 'bg-yellow-300 text-black'
                            : r.state === 4
                              ? 'bg-green-300 text-black'
                              : r.state === 3
                                ? 'bg-red-300 text-black'
                                : 'bg-indigo-300 text-black'
                        }`}
                        title={`State code: ${r.state}`}
                      >
                        {stateLabel(r.state)}
                      </div>
                    </div>
                    <div className="truncate" title={r.description}>
                      {r.description || '(no description)'}
                    </div>
                    <div className="mt-1 text-[10px] text-indigo-200">
                      Gov: <span className="font-mono">{r.governor}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BottomProposalsBar
