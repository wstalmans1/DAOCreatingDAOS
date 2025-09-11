import React, { useMemo, useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { encodeFunctionData, type Abi } from 'viem'
import { CIRCLE_FACTORY_ABI, FACTORY_ADDRESS, OZ_GOVERNOR_ABI } from '../../constants/contracts'

type Props = {
  parentId: bigint // circle id under which to create
  parentGovernor: `0x${string}`
  parentToken: `0x${string}`
}

export const CreateChildForm: React.FC<Props> = ({ parentId, parentGovernor, parentToken }) => {
  const { isConnected, chainId, address } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()
  const publicClient = usePublicClient()
  const qc = useQueryClient()

  const [name, setName] = useState('New Circle')
  const [votingDelay, setVotingDelay] = useState(1)
  const [votingPeriod, setVotingPeriod] = useState(10)
  const [threshold, setThreshold] = useState(0)
  const [quorum, setQuorum] = useState(4)
  const [tlDelay, setTlDelay] = useState(60)
  const [status, setStatus] = useState<string | null>(null)
  const [preflight, setPreflight] = useState<{
    threshold: bigint
    votesPrev: bigint
    block: bigint
    ok: boolean
  } | null>(null)

  const canSubmit = isConnected && FACTORY_ADDRESS && parentGovernor

  const blockTimeSec = useMemo(() => {
    if (chainId === 1337 || chainId === 31337) return 1 // local dev: near-instant blocks
    if (chainId === 11155111) return 12 // Sepolia ~12s
    return 12 // default estimate for EVM chains
  }, [chainId])

  function formatSeconds(total: number) {
    const s = Math.max(0, Math.floor(total))
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    const rs = s % 60
    if (m < 60) return `${m}m${rs ? ` ${rs}s` : ''}`
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}h${rm ? ` ${rm}m` : ''}`
  }

  async function checkProposerPower(): Promise<{
    threshold: bigint
    votesPrev: bigint
    block: bigint
    ok: boolean
  } | null> {
    try {
      if (!publicClient || !address) return null
      const bn = await publicClient.getBlockNumber()
      const [threshold, votesPrev] = await Promise.all([
        publicClient.readContract({
          address: parentGovernor,
          abi: OZ_GOVERNOR_ABI as unknown as Abi,
          functionName: 'proposalThreshold',
        }) as Promise<bigint>,
        publicClient.readContract({
          address: parentToken,
          abi: [
            {
              type: 'function',
              name: 'getPastVotes',
              stateMutability: 'view',
              inputs: [
                { name: 'account', type: 'address' },
                { name: 'blockNumber', type: 'uint256' },
              ],
              outputs: [{ type: 'uint256' }],
            },
          ] as const,
          functionName: 'getPastVotes',
          args: [address, bn - 1n],
        }) as Promise<bigint>,
      ])
      return { threshold, votesPrev, block: bn, ok: votesPrev >= threshold }
    } catch {
      return null
    }
  }

  async function mineOne() {
    try {
      await (publicClient as any)?.request({ method: 'evm_mine', params: [] })
      const r = await checkProposerPower()
      setPreflight(r)
      if (r && r.ok) setStatus('Snapshot votes OK. You can propose now.')
    } catch {
      setStatus('Mining failed (localhost only).')
    }
  }

  React.useEffect(() => {
    ;(async () => {
      const r = await checkProposerPower()
      setPreflight(r)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, parentGovernor, parentToken, publicClient?.chain?.id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('Building proposal…')
    const check = await checkProposerPower()
    setPreflight(check)
    if (check && !check.ok) {
      setStatus(
        `Insufficient proposer votes. Threshold=${check.threshold.toString()} votes, your votes at block ${check.block - 1n} = ${check.votesPrev.toString()}. On localhost mine one block or self‑delegate before proposing.`,
      )
      return
    }
    try {
      const calldata = encodeFunctionData({
        abi: CIRCLE_FACTORY_ABI as unknown as Abi,
        functionName: 'createCircle',
        args: [
          {
            parentId,
            name,
            token: parentToken,
            votingDelay: BigInt(votingDelay),
            votingPeriod: BigInt(votingPeriod),
            proposalThreshold: BigInt(threshold),
            quorumNumerator: BigInt(quorum),
            timelockDelay: BigInt(tlDelay),
          },
        ],
      })
      const targets = [FACTORY_ADDRESS]
      const values = [0n]
      const calldatas = [calldata]
      const description = `Create child circle under ${parentId}: ${name}`
      // const descriptionHash = keccak256(stringToHex(description)) // not used here

      setStatus('Sending propose()…')
      await writeContractAsync({
        address: parentGovernor,
        abi: OZ_GOVERNOR_ABI as unknown as Abi,
        functionName: 'propose',
        args: [targets, values, calldatas, description],
      })
      // Invalidate proposals cache so UI refreshes immediately
      qc.invalidateQueries({ queryKey: ['gov'] })
      setStatus('Proposal submitted! Check your wallet / activity feed.')
    } catch (err: any) {
      setStatus(`Error: ${err?.shortMessage || err?.message || String(err)}`)
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg shadow p-4 w-full max-w-xl space-y-3">
      <h3 className="text-lg font-semibold">Create Child Circle</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-sm text-gray-600">
          Name
          <input
            className="mt-1 w-full rounded border border-gray-300 bg-white text-gray-900 placeholder-gray-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-white dark:text-gray-900"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grants Circle"
          />
          <div className="mt-1 text-xs text-gray-500">Human‑readable label stored on‑chain.</div>
        </label>
        <label className="text-sm text-gray-600">
          Voting Delay (blocks)
          <input
            type="number"
            className="mt-1 w-full rounded border border-gray-300 bg-white text-gray-900 placeholder-gray-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-white dark:text-gray-900"
            value={votingDelay}
            onChange={(e) => setVotingDelay(Number(e.target.value))}
          />
          <div className="mt-1 text-xs text-gray-500">
            ≈ {formatSeconds(votingDelay * blockTimeSec)} at ~{blockTimeSec}s/block
          </div>
        </label>
        <label className="text-sm text-gray-600">
          Voting Period (blocks)
          <input
            type="number"
            className="mt-1 w-full rounded border border-gray-300 bg-white text-gray-900 placeholder-gray-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-white dark:text-gray-900"
            value={votingPeriod}
            onChange={(e) => setVotingPeriod(Number(e.target.value))}
          />
          <div className="mt-1 text-xs text-gray-500">
            ≈ {formatSeconds(votingPeriod * blockTimeSec)} at ~{blockTimeSec}s/block
          </div>
        </label>
        <label className="text-sm text-gray-600">
          Threshold
          <input
            type="number"
            className="mt-1 w-full rounded border border-gray-300 bg-white text-gray-900 placeholder-gray-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-white dark:text-gray-900"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            min={0}
            step={1}
            placeholder="0"
          />
          <div className="mt-1 text-xs text-gray-500">
            Minimum voting power required to propose (0 = no minimum). Units are the governance
            token’s voting units (typically 18 decimals; 1 token = 1e18 units).
          </div>
        </label>
        <label className="text-sm text-gray-600">
          Quorum %
          <input
            type="number"
            className="mt-1 w-full rounded border border-gray-300 bg-white text-gray-900 placeholder-gray-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-white dark:text-gray-900"
            value={quorum}
            onChange={(e) => setQuorum(Number(e.target.value))}
            min={0}
            max={100}
            step={1}
            placeholder="4"
          />
          <div className="mt-1 text-xs text-gray-500">
            Percent of total voting power required for a proposal to pass (e.g., 4 = 4%).
          </div>
        </label>
        <label className="text-sm text-gray-600">
          Timelock (sec)
          <input
            type="number"
            className="mt-1 w-full rounded border border-gray-300 bg-white text-gray-900 placeholder-gray-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-white dark:text-gray-900"
            value={tlDelay}
            onChange={(e) => setTlDelay(Number(e.target.value))}
            min={0}
            step={1}
            placeholder="60"
          />
          <div className="mt-1 text-xs text-gray-500">
            Minimum delay after queueing before execution (in seconds).
          </div>
        </label>
      </div>
      <button
        disabled={!canSubmit || isPending}
        className="bg-indigo-600 text-white px-3 py-1.5 rounded disabled:opacity-50"
      >
        {isPending ? 'Proposing…' : 'Propose'}
      </button>
      {preflight && !preflight.ok && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-2">
          Missing proposer votes: need {preflight.threshold.toString()}, you have{' '}
          {preflight.votesPrev.toString()} at block {(preflight.block - 1n).toString()}.
          {chainId === 1337 || chainId === 31337 ? (
            <>
              {' '}
              <button
                type="button"
                className="ml-2 px-2 py-0.5 rounded border border-slate-200 bg-slate-50"
                onClick={mineOne}
              >
                Mine 1 block (localhost)
              </button>
            </>
          ) : null}
        </div>
      )}
      {status && <div className="text-xs text-gray-600">{status}</div>}
    </form>
  )
}
