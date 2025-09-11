import React, { useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { useGovernorProposals, useGovernanceWatch, useProposalMeta } from '../../hooks/useGovernor'
import { VotePanel } from './VotePanel'

type Props = { governor: Address }

export const Proposals: React.FC<Props> = ({ governor }) => {
  const { data: proposals, isLoading, error } = useGovernorProposals(governor)

  useGovernanceWatch(governor)
  const [openId, setOpenId] = useState<bigint | null>(null)

  if (isLoading) return <div className="text-gray-500">Loading proposals…</div>
  if (error) return <div className="text-red-600">Error loading proposals</div>
  const none = !proposals || proposals.length === 0

  return (
    <div className="w-full max-w-2xl space-y-3">
      {none ? (
        <div className="text-gray-500">No proposals yet</div>
      ) : (
        proposals
          .slice()
          .reverse()
          .map((p) => (
            <div key={p.id.toString()} className="border rounded p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-800">
                    Proposal #{p.id.toString()}
                  </div>
                  <div
                    className="text-xs text-gray-600 truncate max-w-[38rem]"
                    title={p.description}
                  >
                    {p.description || '(no description)'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Blocks {p.voteStart?.toString?.() || '0'} → {p.voteEnd?.toString?.() || '0'}
                  </div>
                  <StateBadge governor={governor} id={p.id} />
                  <YourVotesAtSnapshot governor={governor} id={p.id} />
                </div>
                <button
                  className="text-indigo-600 text-sm"
                  onClick={() => setOpenId((id) => (id === p.id ? null : p.id))}
                >
                  {openId === p.id ? 'Hide' : 'Details'}
                </button>
              </div>
              {openId === p.id && (
                <div className="mt-3">
                  <VotePanel governor={governor} id={p.id} />
                </div>
              )}
            </div>
          ))
      )}
    </div>
  )
}

function YourVotesAtSnapshot({ governor, id }: { governor: Address; id: bigint }) {
  const { data } = useProposalMeta(governor, id)
  if (!data) return null
  if (data.state !== 1 && data.state !== 0) return null // show mainly for Pending/Active
  const formattedVotes = (() => {
    const s = formatUnits(data.userVotesAt || 0n, 18)
    const [i, f] = s.split('.')
    const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const ff = (f || '').replace(/0+$/, '').slice(0, 4)
    return ff ? `${ii}.${ff}` : ii
  })()
  return (
    <div className="text-[11px] text-gray-600 mt-1">
      Your votes at snapshot: <b>{formattedVotes}</b>
    </div>
  )
}

function StateBadge({ governor, id }: { governor: Address; id: bigint }) {
  const { data } = useProposalMeta(governor, id)
  if (!data) return null
  const n = data.state
  const label =
    n === 0
      ? 'Pending'
      : n === 1
        ? 'Active'
        : n === 2
          ? 'Canceled'
          : n === 3
            ? 'Defeated'
            : n === 4
              ? 'Succeeded'
              : n === 5
                ? 'Queued'
                : n === 6
                  ? 'Expired'
                  : n === 7
                    ? 'Executed'
                    : 'Unknown'
  const cls =
    n === 1
      ? 'bg-yellow-100 text-yellow-900 border-yellow-200'
      : n === 4
        ? 'bg-green-100 text-green-900 border-green-200'
        : n === 3
          ? 'bg-red-100 text-red-900 border-red-200'
          : 'bg-slate-100 text-slate-900 border-slate-200'
  return (
    <div className="mt-1">
      <span className={`text-[10px] inline-block rounded border px-2 py-[1px] ${cls}`}>
        {label}
      </span>
    </div>
  )
}
