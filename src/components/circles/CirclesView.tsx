import React, { useMemo, useState, useEffect } from 'react'
import { useCircles, useCirclesEvents } from '../../hooks/useCircles'
import { REGISTRY_ADDRESS } from '../../constants/contracts'
import { TreeHorizontal } from './TreeHorizontal'
import BlockTicker from '../common/BlockTicker'
import type { Abi } from 'viem'
import { CreateChildForm } from './CreateChildForm'
import { Proposals } from '../governance/Proposals'
import { AllProposals } from '../governance/AllProposals'

export const CirclesView: React.FC = () => {
  const [selectedId, setSelectedId] = useState<bigint | null>(null)

  // Instead of loading ABI dynamically, define the minimal subset inline
  const minimalRegistryAbi = useMemo<Abi>(
    () =>
      [
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
        {
          type: 'event',
          name: 'CircleRegistered',
          inputs: [
            { name: 'id', type: 'uint256', indexed: true },
            { name: 'parentId', type: 'uint256', indexed: false },
            { name: 'governor', type: 'address', indexed: false },
            { name: 'timelock', type: 'address', indexed: false },
            { name: 'treasury', type: 'address', indexed: false },
            { name: 'token', type: 'address', indexed: false },
            { name: 'name', type: 'string', indexed: false },
          ],
        },
      ] as unknown as Abi,
    [],
  )

  const { data: roots, isLoading, error } = useCircles(minimalRegistryAbi)
  // Watch registry events and invalidate circle query to auto-refresh
  useCirclesEvents(minimalRegistryAbi)

  // Build a virtual root so multiple top-level circles display under one parent in the tree
  const root = useMemo(() => {
    if (!roots || roots.length === 0) return undefined
    if (roots.length === 1) return roots[0]
    // Synthetic root (non-selectable) to hold all top-level circles
    return {
      id: 0n as bigint,
      parentId: 0n as bigint,
      name: 'All Circles',
      governor: '0x0000000000000000000000000000000000000000' as const,
      timelock: '0x0000000000000000000000000000000000000000' as const,
      treasury: '0x0000000000000000000000000000000000000000' as const,
      token: '0x0000000000000000000000000000000000000000' as const,
      children: roots,
    }
  }, [roots])

  // Ensure we show the selected panel by default
  useEffect(() => {
    if (root && selectedId === null) setSelectedId(root.id)
  }, [root, selectedId])

  // Find the selected circle node from the tree
  const selected = useMemo(() => {
    if (!root || selectedId === null) return null
    const walk = (n: any): any | null => {
      if (n.id === selectedId) return n
      for (const c of n.children) {
        const found = walk(c)
        if (found) return found
      }
      return null
    }
    return walk(root)
  }, [selectedId, root])

  const selectedParent = useMemo(() => {
    if (!root || !selected) return null
    const findParent = (n: any, parent: any | null): any | null => {
      if (n === selected) return parent
      for (const c of n.children) {
        const p = findParent(c, n)
        if (p) return p
      }
      return null
    }
    return findParent(root, null)
  }, [root, selected])

  if (!REGISTRY_ADDRESS) {
    return (
      <div className="text-red-700 bg-red-50 p-3 rounded">VITE_REGISTRY_ADDRESS is not set.</div>
    )
  }
  if (isLoading) return <div className="text-gray-500">Loading circles…</div>
  if (error) return <div className="text-red-600">Error: {(error as Error).message}</div>
  if (!roots?.length) return <div className="text-gray-500">No circles found</div>

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Tree view at top (overview) */}
      <div className="w-full overflow-auto">
        <TreeHorizontal root={root!} onSelect={(n) => setSelectedId(n.id)} />
      </div>
      {selected && (
        <div className="w-full max-w-2xl">
          <div className="text-sm text-gray-700 mb-2">
            <span className="font-medium">Selected Circle:</span> [{selected.id.toString()}]{' '}
            {selected.name}
            {selectedParent && selectedParent.id !== 0n && (
              <>
                <span className="mx-2 text-gray-400">•</span>
                <span className="text-gray-600">Parent:</span> [{selectedParent.id.toString()}]{' '}
                {selectedParent.name}
              </>
            )}
          </div>
          <CreateChildForm
            parentId={selected.id}
            parentGovernor={selected.governor}
            parentToken={selected.token}
          />
          {/* Network / block controls placed between the create form and proposals */}
          <div className="my-4">
            <BlockTicker />
          </div>
          <div className="mt-4">
            <h3 className="text-base font-semibold mb-2">Proposals</h3>
            <Proposals governor={selected.governor} />
          </div>
        </div>
      )}
      <div className="w-full max-w-2xl">
        <div className="mt-6">
          <AllProposals />
        </div>
      </div>
    </div>
  )
}
