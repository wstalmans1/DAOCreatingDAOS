import React from 'react'
import { usePublicClient } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'

export function BlockTicker() {
  const publicClient = usePublicClient()
  const qc = useQueryClient()
  const [block, setBlock] = React.useState<bigint | null>(null)
  const [msg, setMsg] = React.useState<string | null>(null)

  const isLocal = publicClient?.chain?.id === 1337 || publicClient?.chain?.id === 31337

  const load = React.useCallback(async () => {
    if (!publicClient) return
    try {
      const bn = await publicClient.getBlockNumber()
      setBlock(bn)
      // Clear any stale status message on refresh/poll
      setMsg(null)
    } catch {
      setBlock(null)
    }
  }, [publicClient])

  React.useEffect(() => {
    load()
    const t = setInterval(load, 2000)
    return () => clearInterval(t)
  }, [load])

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  async function mineOne() {
    if (!publicClient || !isLocal) return
    try {
      const before = await publicClient.getBlockNumber()
      await (publicClient as any).request({ method: 'evm_mine', params: [] })
      const after = await publicClient.getBlockNumber()
      setBlock(after)
      const delta = Number(after - before)
      // Only show a message if at least one block was mined
      if (delta > 0) {
        setMsg(
          `Mined ${delta} block${delta === 1 ? '' : 's'}: ${before.toString()} → ${after.toString()}`,
        )
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setMsg(null), 2000)
      } else {
        setMsg(null)
      }
      // Nudge queries that depend on block height
      qc.invalidateQueries({ queryKey: ['gov'] })
      qc.invalidateQueries({ queryKey: ['circles'] })
    } catch (e: any) {
      setMsg(`Mining failed: ${e?.message || String(e)}`)
    }
  }

  return (
    <div className="mb-6 border rounded-md p-3 bg-slate-50">
      <div className="flex items-center justify-between text-sm text-slate-700">
        <div className="flex items-center gap-3">
          <span>
            <span className="font-medium">Chain:</span> {publicClient?.chain?.name || '—'}
          </span>
          <span>
            <span className="font-medium">Block:</span> {block?.toString() ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100"
            onClick={load}
          >
            Refresh
          </button>
          <button
            disabled={!isLocal}
            className="px-2 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 disabled:opacity-50 hover:bg-indigo-100"
            onClick={mineOne}
            title={isLocal ? 'Mine 1 block (localhost)' : 'Switch to Localhost to enable mining'}
          >
            Mine 1 block
          </button>
        </div>
      </div>
      {msg && <div className="mt-2 text-[11px] text-slate-600">{msg}</div>}
    </div>
  )
}

export default BlockTicker
