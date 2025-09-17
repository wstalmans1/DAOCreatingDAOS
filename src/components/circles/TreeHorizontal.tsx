import React from 'react'
import type { CircleNode } from '../../hooks/useCircles'
import { hierarchy, tree } from 'd3-hierarchy'

type Props = {
  root: CircleNode
  onSelect?: (node: CircleNode) => void
}

type HNode = any

// Build a filtered tree according to collapsed ids
function buildHierarchy(root: CircleNode, collapsed: Set<string>) {
  function childrenOf(n: CircleNode): CircleNode[] | undefined {
    if (collapsed.has(String(n.id))) return undefined
    return n.children
  }
  return (hierarchy as any)(root, childrenOf)
}

export const TreeHorizontal: React.FC<Props> = ({ root, onSelect }) => {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set())
  const [seenNodes, setSeenNodes] = React.useState<Set<string>>(() => new Set())

  // Auto-collapse very deep nodes while preserving existing collapse state
  React.useEffect(() => {
    setCollapsed((prevCollapsed) => {
      const newCollapsed = new Set(prevCollapsed)

      // Track all nodes we've seen before
      const currentNodes = new Set<string>()
      const walk = (n: CircleNode, depth: number) => {
        const nodeId = String(n.id)
        currentNodes.add(nodeId)

        // Only auto-collapse if:
        // 1. It's a deep node (depth >= 3)
        // 2. It has children
        // 3. We haven't seen this node before (it's truly new)
        if (depth >= 3 && n.children.length && !seenNodes.has(nodeId)) {
          newCollapsed.add(nodeId)
        }

        n.children.forEach((c) => walk(c, depth + 1))
      }
      walk(root, 0)

      // Update our seen nodes
      setSeenNodes(currentNodes)

      return newCollapsed
    })
  }, [root]) // eslint-disable-line react-hooks/exhaustive-deps

  const h = React.useMemo(() => buildHierarchy(root, collapsed), [root, collapsed])

  // Layout settings
  const nodeV = 70 // vertical spacing (y)
  const nodeH = 120 // horizontal spacing (x) — shorter links
  const layout = React.useMemo(() => (tree as any)().nodeSize([nodeV, nodeH])(h), [h])
  const nodes: HNode[] = layout.descendants()
  const links: HNode[] = layout.links()

  // Compute viewBox bounds
  const xVals = nodes.map((d) => d.x)
  const yVals = nodes.map((d) => d.y)
  // Extra padding to accommodate labels rendered above circles
  const PAD = 90
  const minX = Math.min(...xVals, 0) - PAD
  const maxX = Math.max(...xVals, 0) + PAD
  const minY = Math.min(...yVals, 0) - PAD
  const maxY = Math.max(...yVals, 0) + PAD
  const width = maxY - minY
  const height = maxX - minX

  function toggle(d: HNode) {
    const id = String(d.data.id)
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCollapsed(next)
  }

  function expandAll() {
    setCollapsed(new Set())
  }
  function collapseAll() {
    const next = new Set<string>()
    nodes.forEach((n) => {
      if ((n.children || []).length) next.add(String(n.data.id))
    })
    setCollapsed(next)
  }

  const hasChildren = (d: HNode) =>
    (d.children && d.children.length) || d.data.children?.length || 0

  return (
    <div className="w-full overflow-auto">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
        <span>Tree controls:</span>
        <button className="px-2 py-1 rounded border border-slate-200 bg-white" onClick={expandAll}>
          Expand all
        </button>
        <button
          className="px-2 py-1 rounded border border-slate-200 bg-white"
          onClick={collapseAll}
        >
          Collapse all
        </button>
        <span className="ml-2">Click circle to select; chevron to toggle.</span>
      </div>
      <svg
        width={Math.min(980, width)}
        height={Math.min(720, height)}
        viewBox={`${minY} ${minX} ${width} ${height}`}
      >
        {/* links */}
        {links.map((l, i) => (
          <path
            key={i}
            d={`M${l.source.y},${l.source.x} C${(l.source.y + l.target.y) / 2},${l.source.x} ${(l.source.y + l.target.y) / 2},${l.target.x} ${l.target.y},${l.target.x}`}
            fill="none"
            stroke="#c7d2fe"
            strokeWidth={1.5}
          />
        ))}
        {/* nodes */}
        {nodes.map((d: HNode) => {
          const idStr = String(d.data.id)
          const collapsedHere = collapsed.has(idStr)
          const showToggle = hasChildren(d)
          const r = 18
          const badgeR = 8
          return (
            <g key={idStr} transform={`translate(${d.y},${d.x})`}>
              {showToggle && (
                <g
                  transform={`translate(${r + badgeR},0)`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(d)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={badgeR} fill="#eef2ff" stroke="#6366f1" />
                  <path
                    d={collapsedHere ? 'M -4 0 H 4 M 0 -4 V 4' : 'M -4 0 H 4'}
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </g>
              )}
              <circle
                r={r}
                fill="#ffffff"
                stroke="#6366f1"
                strokeWidth={2}
                onClick={() => onSelect?.(d.data)}
                style={{ cursor: 'pointer' }}
              />
              <text
                x={0}
                y={-r - 8}
                textAnchor="middle"
                dominantBaseline="baseline"
                fontSize={12}
                fill="#111827"
                style={{ pointerEvents: 'none' }}
              >
                {String(d.data.name)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default TreeHorizontal
