import React, { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Gavel,
  Wallet,
  ShieldQuestion,
  PlusCircle,
  MinusCircle,
  Search,
  Layers3,
  GitBranch,
} from 'lucide-react'

/**
 * Recursive DAO Explorer — single-file React component
 * ---------------------------------------------------
 * - Visualizes a recursive DAO (DAO → SubDAOs → Sub-SubDAOs …)
 * - Clean, modern UI with Tailwind; animated expand/collapse
 * - Self-contained: ships with demo data but accepts `data` prop
 * - Production-friendly patterns: memoization, keys, accessibility
 *
 * Usage:
 *   <RecursiveDAOExplorer data={yourTree} />
 *   // or simply <RecursiveDAOExplorer /> to see demo content
 *
 * Data shape:
 *   type DaoNode = {
 *     id: string
 *     name: string
 *     policy?: { quorum?: string; threshold?: string; parent?: string }
 *     voting?: { module?: string; delay?: string }
 *     treasury?: { balance?: string; currency?: string }
 *     children?: DaoNode[]
 *   }
 */

// ------------------ Demo Data (you can remove/replace) ------------------
const demoData = {
  id: 'root',
  name: 'RootDAO',
  policy: { quorum: '15%', threshold: '>50%', parent: '—' },
  voting: { module: 'Governor / Timelock', delay: '2d delay' },
  treasury: { balance: '2,450 ETH', currency: 'ETH' },
  children: [
    {
      id: 'A',
      name: 'SubDAO A',
      policy: { quorum: '10%', threshold: '>50%', parent: 'RootDAO' },
      voting: { module: 'Governor (params A)', delay: '1d' },
      treasury: { balance: '420 ETH', currency: 'ETH' },
      children: [
        {
          id: 'A1',
          name: 'SubDAO A1',
          policy: { quorum: '8%', threshold: '>50%', parent: 'SubDAO A' },
          voting: { module: 'Governor (A1)', delay: '12h' },
          treasury: { balance: '120 ETH', currency: 'ETH' },
          children: [
            { id: 'A1a', name: 'SubDAO A1a', treasury: { balance: '35 ETH', currency: 'ETH' } },
            { id: 'A1b', name: 'SubDAO A1b', treasury: { balance: '22 ETH', currency: 'ETH' } },
          ],
        },
        {
          id: 'A2',
          name: 'SubDAO A2',
          policy: { quorum: '9%', threshold: '>50%', parent: 'SubDAO A' },
          voting: { module: 'Governor (A2)', delay: '18h' },
          treasury: { balance: '88 ETH', currency: 'ETH' },
        },
      ],
    },
    {
      id: 'B',
      name: 'SubDAO B',
      policy: { quorum: '12%', threshold: '>50%', parent: 'RootDAO' },
      voting: { module: 'Governor (B)', delay: '1d' },
      treasury: { balance: '310 ETH', currency: 'ETH' },
      children: [
        {
          id: 'B1',
          name: 'SubDAO B1',
          policy: { quorum: '7%', threshold: '>50%', parent: 'SubDAO B' },
          voting: { module: 'Governor (B1)', delay: '8h' },
          treasury: { balance: '64 ETH', currency: 'ETH' },
        },
      ],
    },
  ],
}

// ------------------ Types ------------------
export type DaoNode = {
  id: string
  name: string
  policy?: { quorum?: string; threshold?: string; parent?: string }
  voting?: { module?: string; delay?: string }
  treasury?: { balance?: string; currency?: string }
  children?: DaoNode[]
}

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

// ------------------ Helpers ------------------
function useFlatten(tree: DaoNode) {
  return useMemo(() => {
    const arr: DaoNode[] = []
    const walk = (n?: DaoNode) => {
      if (!n) return
      arr.push(n)
      n.children?.forEach(walk)
    }
    walk(tree)
    return arr
  }, [tree])
}

function transformCirclesToDaoNodes(circles: CircleNode[]): DaoNode {
  // If no circles, return demo data
  if (!circles || circles.length === 0) {
    return demoData
  }

  // If multiple roots, create a synthetic root
  if (circles.length > 1) {
    const syntheticRoot: DaoNode = {
      id: 'root',
      name: 'All Circles',
      policy: { quorum: '—', threshold: '—', parent: '—' },
      voting: { module: 'Multiple Roots', delay: '—' },
      treasury: { balance: '—', currency: '—' },
      children: circles.map((circle) => transformCircleToDaoNode(circle)),
    }
    return syntheticRoot
  }

  // Single root
  return transformCircleToDaoNode(circles[0])
}

function transformCircleToDaoNode(circle: CircleNode): DaoNode {
  return {
    id: circle.id.toString(),
    name: circle.name,
    policy: {
      quorum: '—',
      threshold: '>50%',
      parent: circle.parentId === 0n ? '—' : circle.parentId.toString(),
    },
    voting: {
      module: 'Governor',
      delay: '2d',
    },
    treasury: {
      balance: '—',
      currency: 'ETH',
    },
    children: circle.children.map(transformCircleToDaoNode),
  }
}

function highlight(text: string, q: string) {
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-yellow-200 px-0.5 text-black">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

// ------------------ Node Card ------------------
function NodeCard({
  node,
  depth,
  expanded,
  onToggle,
  matchQuery,
}: {
  node: DaoNode
  depth: number
  expanded: boolean
  onToggle: () => void
  matchQuery: (s: string) => React.ReactNode
}) {
  const hasChildren = !!node.children?.length
  return (
    <div className="relative">
      {/* connectors */}
      {depth > 0 && <div className="absolute -left-6 top-6 h-0.5 w-6 bg-gray-300/70" />}

      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-full bg-gray-100 p-2">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-lg font-semibold">{matchQuery(node.name)}</h3>
              <button
                onClick={onToggle}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {hasChildren ? `${node.children!.length}` : '0'}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Gavel className="h-4 w-4" />
                <span>
                  {node.policy?.threshold ? `${node.policy.threshold}` : '—'}
                  {node.policy?.quorum ? ` • Quorum ${node.policy.quorum}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <ShieldQuestion className="h-4 w-4" />
                <span>
                  {node.voting?.module ?? '—'}
                  {node.voting?.delay ? ` • ${node.voting.delay}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Wallet className="h-4 w-4" />
                <span>
                  {node.treasury?.balance ?? '—'}
                  {node.treasury?.currency ? ` ${node.treasury.currency}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {hasChildren && (
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 border-t pt-3"
              >
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>SubDAOs</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  )
}

// ------------------ Tree Renderer ------------------
function Tree({
  node,
  depth,
  openMap,
  setOpenMap,
  query,
}: {
  node: DaoNode
  depth: number
  openMap: Record<string, boolean>
  setOpenMap: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void
  query: string
}) {
  const expanded = !!openMap[node.id]
  const toggle = () => setOpenMap((s) => ({ ...s, [node.id]: !s[node.id] }))
  const matchQuery = (s: string) => highlight(s, query)

  return (
    <div className="relative">
      <NodeCard
        node={node}
        depth={depth}
        expanded={expanded}
        onToggle={toggle}
        matchQuery={matchQuery}
      />

      <AnimatePresence initial={false}>
        {expanded && node.children?.length ? (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="relative ml-10 mt-4 space-y-4 before:absolute before:-left-6 before:top-0 before:h-full before:w-0.5 before:bg-gray-200/80"
          >
            {node.children!.map((child) => (
              <li key={child.id} className="relative">
                <Tree
                  node={child}
                  depth={depth + 1}
                  openMap={openMap}
                  setOpenMap={setOpenMap}
                  query={query}
                />
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// ------------------ Toolbar ------------------
function Toolbar({
  onExpandAll,
  onCollapseAll,
  query,
  setQuery,
}: {
  onExpandAll: () => void
  onCollapseAll: () => void
  query: string
  setQuery: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Layers3 className="h-4 w-4" />
        <span className="font-medium">Recursive DAO</span>
        <span className="text-gray-400">•</span>
        <span className="text-gray-500">Self-similar governance across nested subDAOs</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search DAO names…"
            className="w-56 rounded-full border border-gray-300 bg-white pl-8 pr-3 py-1.5 text-sm outline-none ring-0 focus:border-gray-400"
          />
        </div>
        <button
          onClick={onExpandAll}
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <PlusCircle className="h-4 w-4" /> Expand all
        </button>
        <button
          onClick={onCollapseAll}
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <MinusCircle className="h-4 w-4" /> Collapse all
        </button>
      </div>
    </div>
  )
}

// ------------------ Legend ------------------
function Legend() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 sm:grid-cols-3">
      <div className="flex items-center gap-2">
        <Gavel className="h-4 w-4" />
        <span>Policy: threshold • quorum</span>
      </div>
      <div className="flex items-center gap-2">
        <ShieldQuestion className="h-4 w-4" />
        <span>Voting module • delay</span>
      </div>
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4" />
        <span>Treasury balance • currency</span>
      </div>
    </div>
  )
}

// ------------------ Root Component ------------------
export default function RecursiveDAOExplorer({
  data,
  circles,
}: {
  data?: DaoNode
  circles?: CircleNode[]
}) {
  const tree = useMemo(() => {
    if (circles && circles.length > 0) {
      return transformCirclesToDaoNodes(circles)
    }
    return data ?? demoData
  }, [data, circles])

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({ root: true, A: true, B: true })
  const [query, setQuery] = useState('')

  const flat = useFlatten(tree)

  // Preserve expand/collapse state when tree data changes
  useEffect(() => {
    setOpenMap((prevOpenMap) => {
      const newOpenMap = { ...prevOpenMap }

      // Add any new nodes that aren't already in the openMap
      flat.forEach((node) => {
        if (!(node.id in newOpenMap)) {
          // For new nodes, default to collapsed unless it's the root
          newOpenMap[node.id] = node.id === tree.id
        }
      })

      return newOpenMap
    })
  }, [flat, tree.id])
  const matches = useMemo(
    () =>
      new Set(
        flat.filter((n) => n.name.toLowerCase().includes(query.toLowerCase())).map((n) => n.id),
      ),
    [flat, query],
  )

  const expandAll = () => setOpenMap(() => Object.fromEntries(flat.map((n) => [n.id, true])))
  const collapseAll = () => setOpenMap(() => ({ [tree.id]: true }))

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Toolbar
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        query={query}
        setQuery={setQuery}
      />
      <Legend />

      {/* Tree */}
      <div className="relative rounded-3xl border border-gray-200 bg-gray-50 p-5">
        <Tree node={tree} depth={0} openMap={openMap} setOpenMap={setOpenMap} query={query} />
      </div>

      {/* Match helper */}
      {query && (
        <div className="text-xs text-gray-500">
          Matching nodes: {Array.from(matches).length || 0}
        </div>
      )}

      {/* Footer note */}
      <div className="text-xs text-gray-500">
        Tip: Map Holacracy circles ↔ SubDAOs. Each node carries its own Policy, Voting, and
        Treasury while inheriting guardrai
      </div>
    </div>
  )
}
