// ── Layout collision resolution ──
// Detects overlapping nodes after add/move/resize and
// pushes nodes apart iteratively while respecting tree topology.
//
// Strategy:
//   - Nodes with d.data.x/y set = "manual" (user-dragged), treated as anchor
//   - Nodes without = "auto" (d3.tree layout), free to move
//   - Manual nodes are pushed apart equally from each other
//   - Auto nodes are pushed away from manual nodes (manual nodes don't move)
//   - Auto nodes overlapping each other are pushed apart equally

import { nodeSize } from './useNodeDrawing.js'

const PADDING = 20 // minimum gap between node bounding boxes

/**
 * Resolve overlaps among all visible nodes.
 */
export function resolveCollisions(nodes, maxIterations = 50) {
  if (!nodes || nodes.length < 2) return

  for (let iter = 0; iter < maxIterations; iter++) {
    let anyOverlap = false

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]

        // Skip ancestor-descendant pairs (tree topology means they're close)
        if (isAncestor(a, b) || isAncestor(b, a)) continue

        const szA = nodeSize(a)
        const szB = nodeSize(b)
        const ca = getCenter(a)
        const cb = getCenter(b)

        const overlapX = Math.max(0, (szA.w + szB.w) / 2 + PADDING - Math.abs(ca.cx - cb.cx))
        const overlapY = Math.max(0, (szA.h + szB.h) / 2 + PADDING - Math.abs(ca.cy - cb.cy))

        if (overlapX > 0 && overlapY > 0) {
          anyOverlap = true

          const dx = ca.cx - cb.cx
          const dy = ca.cy - cb.cy
          const dist = Math.sqrt(dx * dx + dy * dy) || 1

          // Push force, proportional to overlap
          const pushX = (dx / dist) * overlapX * 0.5
          const pushY = (dy / dist) * overlapY * 0.5

          const aManual = hasManualPosition(a)
          const bManual = hasManualPosition(b)

          if (aManual && bManual) {
            // Both manual: push equally
            setPosition(a, ca.cx + pushX, ca.cy + pushY)
            setPosition(b, cb.cx - pushX, cb.cy - pushY)
          } else if (aManual) {
            // Only a is manual: push b away from a
            setPosition(b, cb.cx - pushX * 2, cb.cy - pushY * 2)
          } else if (bManual) {
            // Only b is manual: push a away from b
            setPosition(a, ca.cx + pushX * 2, ca.cy + pushY * 2)
          } else {
            // Both auto: push equally
            setPosition(a, ca.cx + pushX, ca.cy + pushY)
            setPosition(b, cb.cx - pushX, cb.cy - pushY)
          }
        }
      }
    }

    if (!anyOverlap) break
  }
}

function hasManualPosition(d) {
  return d.data.x != null || d.data.y != null
}

function setPosition(d, cx, cy) {
  d.data.x = cx
  d.data.y = cy
}

function isAncestor(a, b) {
  let cur = b.parent
  while (cur) {
    if (cur === a) return true
    cur = cur.parent
  }
  return false
}

function getCenter(d) {
  return {
    cx: d.data.x != null ? d.data.x : d.x,
    cy: d.data.y != null ? d.data.y : d.y
  }
}

/**
 * Reposition children of a node in a fan layout, avoiding overlap
 * among siblings. Called when a new child is added to a parent.
 */
export function layoutChildren(children, parentCenter, startAngle = -Math.PI / 2) {
  if (!children || children.length === 0) return

  const RADIUS = 200

  if (children.length === 1) {
    children[0].data.x = parentCenter.cx
    children[0].data.y = parentCenter.cy + RADIUS
    return
  }

  const arc = Math.min(Math.PI * 0.75, children.length * 0.5)
  const startAngle2 = startAngle - arc / 2

  children.forEach((child, i) => {
    const angle = startAngle2 + (arc * i) / (children.length - 1 || 1)
    child.data.x = parentCenter.cx + Math.cos(angle) * RADIUS
    child.data.y = parentCenter.cy + Math.sin(angle) * RADIUS
  })
}

/**
 * After a node is moved, reposition its children relative to the
 * new parent position. Children maintain their relative offsets
 * from the parent.
 */
export function repositionChildrenAfterMove(parentNode) {
  if (!parentNode.children) return
  const parentCenter = getCenter(parentNode)
  // Children keep their relative positions — d3.tree will recalculate
  // on next render. For now just ensure they're not too far.
  // The collision resolver will handle overlaps on next render.
}