import React, { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Address, Abi } from 'viem'
import { keccak256, stringToHex } from 'viem'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import {
  useCastVote,
  useProposalMeta,
  IVOTES_MINI_ABI,
  GOVERNOR_MINI_ABI,
} from '../../hooks/useGovernor'

type Props = { governor: Address; id: bigint }

const STATES = [
  'Pending',
  'Active',
  'Canceled',
  'Defeated',
  'Succeeded',
  'Queued',
  'Expired',
  'Executed',
]

export const VotePanel: React.FC<Props> = ({ governor, id }) => {
  const { address } = useAccount()
  const { data } = useProposalMeta(governor, id)
  const { cast, isPending } = useCastVote()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const qc = useQueryClient()
  const [choice, setChoice] = useState<0 | 1 | 2>(1)
  const [reason, setReason] = useState('')
  const canVote = useMemo(() => {
    if (!data) return false
    const active = data.state === 1
    const hasPower = (data.userVotesAt || 0n) > 0n
    return active && hasPower && !data.hasVoted
  }, [data])

  if (!data) return null
  const [against, _for, abstain] = data.votes

  async function loadProposalDetails(): Promise<{
    targets: readonly Address[]
    values: readonly bigint[]
    calldatas: readonly `0x${string}`[]
    description: string
  } | null> {
    if (!publicClient) return null
    const latest = await publicClient.getBlockNumber()
    const fromBlock =
      publicClient.chain?.id === 1337 || publicClient.chain?.id === 31337
        ? 0n
        : latest > 500000n
          ? latest - 500000n
          : 0n
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
    const [logs5, logs4] = await Promise.all([
      publicClient
        .getLogs({ address: governor, event: eventV5 as any, fromBlock, toBlock: latest } as any)
        .catch(() => []),
      publicClient
        .getLogs({ address: governor, event: eventV4 as any, fromBlock, toBlock: latest } as any)
        .catch(() => []),
    ])
    const all: any[] = [...(logs5 as any[]), ...(logs4 as any[])]
    const m = all.find(
      (l) => l.args?.proposalId === id || l.args?.proposalId?.toString?.() === id.toString(),
    )
    if (!m) return null
    return {
      targets: (m.args.targets as Address[]) || [],
      values: (m.args.values as bigint[]) || [],
      calldatas: (m.args.calldatas as `0x${string}`[]) || [],
      description: (m.args.description as string) || '',
    }
  }
  const choiceLabel = choice === 1 ? 'For' : choice === 0 ? 'Against' : 'Abstain'

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="text-sm text-gray-700 flex flex-wrap gap-3">
        <span>
          Status: <b>{STATES[data.state] || String(data.state)}</b>
        </span>
        <span>Snapshot: #{data.snapshot.toString()}</span>
        <span>Deadline: #{data.deadline.toString()}</span>
        <span>Your votes at snapshot: {data.userVotesAt?.toString() || '0'}</span>
      </div>
      <div className="text-xs text-gray-600 flex gap-4">
        <span>Against: {against.toString()}</span>
        <span>For: {_for.toString()}</span>
        <span>Abstain: {abstain.toString()}</span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <label
          className={
            'flex items-center gap-1 rounded border px-2 py-1 cursor-pointer ' +
            (choice === 1
              ? 'bg-green-100 text-green-900 border-green-200'
              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50')
          }
        >
          <input
            type="radio"
            className="mr-1"
            checked={choice === 1}
            onChange={() => setChoice(1)}
          />
          For
        </label>
        <label
          className={
            'flex items-center gap-1 rounded border px-2 py-1 cursor-pointer ' +
            (choice === 0
              ? 'bg-red-100 text-red-900 border-red-200'
              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50')
          }
        >
          <input
            type="radio"
            className="mr-1"
            checked={choice === 0}
            onChange={() => setChoice(0)}
          />
          Against
        </label>
        <label
          className={
            'flex items-center gap-1 rounded border px-2 py-1 cursor-pointer ' +
            (choice === 2
              ? 'bg-slate-100 text-slate-900 border-slate-200'
              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50')
          }
        >
          <input
            type="radio"
            className="mr-1"
            checked={choice === 2}
            onChange={() => setChoice(2)}
          />
          Abstain
        </label>
      </div>
      <div className="text-[11px] text-gray-600">
        Vote options: 0 = Against, 1 = For, 2 = Abstain
      </div>
      <textarea
        className="w-full rounded border border-gray-300 bg-white text-gray-900 px-2 py-1 text-sm"
        placeholder="Optional reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      <button
        disabled={!canVote || isPending}
        className="bg-indigo-600 text-white px-3 py-1.5 rounded disabled:opacity-50"
        onClick={async () => {
          if (choice !== 1) {
            const ok = window.confirm(`You are about to vote "${choiceLabel}". Are you sure?`)
            if (!ok) return
          }
          await cast(governor, id, choice, reason.trim())
        }}
      >
        {isPending
          ? 'Casting…'
          : canVote
            ? `Cast ${choiceLabel}`
            : data.hasVoted
              ? 'Already voted'
              : 'Cannot vote'}
      </button>
      {publicClient &&
        (publicClient.chain?.id === 1337 || publicClient.chain?.id === 31337) &&
        data.state !== 7 && (
          <button
            className="ml-2 bg-green-100 text-green-800 hover:text-green-900 px-2 py-1 rounded border border-green-200 hover:bg-green-200"
            onClick={async () => {
              try {
                // Step 1: if pending, mine to snapshot
                const st0 = (await publicClient.readContract({
                  address: governor,
                  abi: GOVERNOR_MINI_ABI,
                  functionName: 'state',
                  args: [id],
                })) as number
                if (st0 === 0) {
                  const curr = await publicClient.getBlockNumber()
                  const snap = data.snapshot
                  if (curr < snap) {
                    const diff = Number(snap - curr + 1n)
                    const steps = Math.min(diff, 400)
                    for (let i = 0; i < steps; i++)
                      await (publicClient as any).request({ method: 'evm_mine', params: [] })
                  }
                }
                // Step 2: if active, cast FOR (if needed) and mine to deadline
                const st1 = (await publicClient.readContract({
                  address: governor,
                  abi: GOVERNOR_MINI_ABI,
                  functionName: 'state',
                  args: [id],
                })) as number
                if (st1 === 1) {
                  if (!data.hasVoted && (data.userVotesAt || 0n) > 0n) {
                    const hash = await writeContractAsync({
                      address: governor,
                      abi: GOVERNOR_MINI_ABI as unknown as Abi,
                      functionName: 'castVote',
                      args: [id, 1],
                    })
                    try {
                      await publicClient?.waitForTransactionReceipt({ hash })
                    } catch (e) {
                      console.debug('castVote receipt wait skipped/failed', e)
                    }
                  }
                  const curr = await publicClient.getBlockNumber()
                  const dl = data.deadline
                  if (curr < dl) {
                    const diff = Number(dl - curr + 1n)
                    const steps = Math.min(diff, 800)
                    for (let i = 0; i < steps; i++)
                      await (publicClient as any).request({ method: 'evm_mine', params: [] })
                  }
                }
                // Step 3: queue if succeeded
                const st2 = (await publicClient.readContract({
                  address: governor,
                  abi: GOVERNOR_MINI_ABI,
                  functionName: 'state',
                  args: [id],
                })) as number
                const det = await loadProposalDetails()
                if (!det) return
                const descriptionHash = keccak256(stringToHex(det.description))
                if (st2 === 4) {
                  const qHash = await writeContractAsync({
                    address: governor,
                    abi: GOVERNOR_MINI_ABI as unknown as Abi,
                    functionName: 'queue',
                    args: [det.targets, det.values, det.calldatas, descriptionHash],
                  })
                  try {
                    await publicClient?.waitForTransactionReceipt({ hash: qHash })
                  } catch (e) {
                    console.debug('queue receipt wait skipped/failed', e)
                  }
                }
                // Step 4: bump time and execute if queued
                try {
                  await (publicClient as any).request({ method: 'evm_increaseTime', params: [120] })
                  await (publicClient as any).request({ method: 'evm_mine', params: [] })
                } catch (e) {
                  // ignore if evm_increaseTime not supported
                }
                const st3 = (await publicClient.readContract({
                  address: governor,
                  abi: GOVERNOR_MINI_ABI,
                  functionName: 'state',
                  args: [id],
                })) as number
                if (st3 === 5) {
                  const eHash = await writeContractAsync({
                    address: governor,
                    abi: GOVERNOR_MINI_ABI as unknown as Abi,
                    functionName: 'execute',
                    args: [det.targets, det.values, det.calldatas, descriptionHash],
                    value: 0n,
                  })
                  try {
                    await publicClient?.waitForTransactionReceipt({ hash: eHash })
                  } catch (e) {
                    console.debug('execute receipt wait skipped/failed', e)
                  }
                }
                // Invalidate proposal-related queries so UI reflects the latest state
                qc.invalidateQueries({ queryKey: ['gov'] })
              } catch (e) {
                console.error('Fast finalize failed', e)
              }
            }}
          >
            Fast-forward + Queue + Execute (localhost)
          </button>
        )}
      {publicClient &&
        (publicClient.chain?.id === 1337 || publicClient.chain?.id === 31337) &&
        data.state === 1 && (
          <button
            className="ml-2 bg-slate-100 text-slate-700 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200"
            onClick={async () => {
              try {
                const curr = await publicClient.getBlockNumber()
                const dl = data.deadline
                if (curr < dl) {
                  const diff = Number(dl - curr + 1n)
                  const steps = Math.min(diff, 400)
                  for (let i = 0; i < steps; i++) {
                    await (publicClient as any).request({ method: 'evm_mine', params: [] })
                  }
                }
              } catch (e) {
                // ignore
              }
            }}
          >
            Mine to deadline (localhost)
          </button>
        )}
      {publicClient &&
        (publicClient.chain?.id === 1337 || publicClient.chain?.id === 31337) &&
        data.state === 4 && (
          <button
            className="ml-2 bg-slate-100 text-slate-700 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200"
            onClick={async () => {
              const det = await loadProposalDetails()
              if (!det) return
              const descriptionHash = keccak256(stringToHex(det.description))
              const qHash = await writeContractAsync({
                address: governor,
                abi: GOVERNOR_MINI_ABI as unknown as Abi,
                functionName: 'queue',
                args: [det.targets, det.values, det.calldatas, descriptionHash],
              })
              try {
                await publicClient?.waitForTransactionReceipt({ hash: qHash })
              } catch (e) {
                console.debug('queue receipt wait skipped/failed', e)
              }
              qc.invalidateQueries({ queryKey: ['gov'] })
            }}
          >
            Queue (localhost)
          </button>
        )}
      {publicClient &&
        (publicClient.chain?.id === 1337 || publicClient.chain?.id === 31337) &&
        data.state === 5 && (
          <button
            className="ml-2 bg-slate-100 text-slate-700 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200"
            onClick={async () => {
              const det = await loadProposalDetails()
              if (!det) return
              const descriptionHash = keccak256(stringToHex(det.description))
              const eHash = await writeContractAsync({
                address: governor,
                abi: GOVERNOR_MINI_ABI as unknown as Abi,
                functionName: 'execute',
                args: [det.targets, det.values, det.calldatas, descriptionHash],
                value: 0n,
              })
              try {
                await publicClient?.waitForTransactionReceipt({ hash: eHash })
              } catch (e) {
                console.debug('execute receipt wait skipped/failed', e)
              }
              qc.invalidateQueries({ queryKey: ['gov'] })
            }}
          >
            Execute (localhost)
          </button>
        )}
      {publicClient &&
        (publicClient.chain?.id === 1337 || publicClient.chain?.id === 31337) &&
        data.state === 0 && (
          <button
            className="ml-2 bg-slate-100 text-slate-700 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200"
            onClick={async () => {
              try {
                const curr = await publicClient.getBlockNumber()
                const snap = data.snapshot
                if (curr < snap) {
                  const diff = Number(snap - curr + 1n)
                  const steps = Math.min(diff, 200)
                  for (let i = 0; i < steps; i++) {
                    await (publicClient as any).request({ method: 'evm_mine', params: [] })
                  }
                }
              } catch (e) {
                // ignore if not supported
              }
            }}
          >
            Mine to voting start (localhost)
          </button>
        )}
      {!address && <div className="text-xs text-gray-500">Connect a wallet to vote.</div>}
      {data.userVotesAt === 0n && (
        <div className="text-xs text-gray-500">
          <div>You have 0 voting power at the snapshot for this proposal.</div>
          <div className="mt-1 flex items-center gap-2">
            <button
              className="text-indigo-600 underline disabled:opacity-50"
              disabled={!address}
              onClick={async () => {
                if (!address) return
                await writeContractAsync({
                  address: data.token as Address,
                  abi: IVOTES_MINI_ABI,
                  functionName: 'delegate',
                  args: [address],
                })
              }}
            >
              Delegate to self
            </button>
            <span>• takes effect for future proposals (snapshot-based)</span>
          </div>
        </div>
      )}
    </div>
  )
}
