// ── Presence Renderer — Self & Remote Cursors ──
// Renders colored border rings + name tags on nodes for self and remote users.
// Also draws drag ghosts (dashed outline + name during drag).

function nodeSize(d) {
  const w = d.data?.width || 180
  let h = d.data?.height || 56
  if (d.data?.expanded) h += 200
  return { w: Math.max(100, Math.min(600, w)), h }
}

/**
 * Clean up all presence elements from a node group.
 */
export function cleanupPresence(el) {
  el.selectAll(
    '.presence-cursor, .presence-name-bg, .presence-name-tag, ' +
    '.presence-self-cursor, .presence-self-name-bg, .presence-self-name-tag'
  ).remove()
}

/**
 * Draw presence indicators on a node for self + remote users.
 */
export function drawAllPresence(el, d, collab) {
  // Self
  if (collab.selfPresence && collab.selfPresence.selectedNodeId === d.data.id) {
    drawPresenceOnNode(el, d, collab.selfPresence, 'self')
  }

  // Remote
  const remoteCursors = collab.remoteCursors
  if (!remoteCursors) return
  const onNode = remoteCursors.filter(c => c.selectedNodeId === d.data.id)
  onNode.forEach((user, i) => drawPresenceOnNode(el, d, user, 'remote', i))
}

function drawPresenceOnNode(el, d, user, kind, index) {
  const sz = nodeSize(d)
  const prefix = kind === 'self' ? 'presence-self' : 'presence'
  const offset = (index || 0) * 2

  // Colored border ring
  el.append('rect')
    .attr('class', prefix + '-cursor')
    .attr('x', -3 - offset).attr('y', -3 - offset)
    .attr('width', sz.w + 6 + offset * 2).attr('height', sz.h + 6 + offset * 2)
    .attr('rx', 12)
    .attr('fill', 'none')
    .attr('stroke', user.color)
    .attr('stroke-width', kind === 'self' ? 3 : 2.5)
    .attr('opacity', kind === 'self' ? 1 : 0.85)
    .style('pointer-events', 'none')

  // Name tag at top-right
  const nameStr = user.name || '?'
  const tagW = nameStr.length * 8 + 16
  const tagX = sz.w
  const tagY = -14

  el.append('rect')
    .attr('class', prefix + '-name-bg')
    .attr('x', tagX - tagW).attr('y', tagY - 8)
    .attr('width', tagW).attr('height', 16)
    .attr('rx', 8)
    .attr('fill', user.color)
    .attr('opacity', 0.92)
    .style('pointer-events', 'none')

  el.append('text')
    .attr('class', prefix + '-name-tag')
    .attr('x', tagX - tagW / 2).attr('y', tagY + 3)
    .attr('text-anchor', 'middle')
    .attr('fill', 'white')
    .attr('font-size', '10px')
    .attr('font-weight', '700')
    .style('pointer-events', 'none')
    .text(nameStr)
}

// ── Drag ghosts ──

export function cleanupDragGhosts(g) {
  g.selectAll('.presence-drag-ghost, .presence-self-drag-ghost').remove()
}

export function drawAllDragGhosts(g, collab) {
  const allNodes = g.selectAll('g.node')

  if (collab.selfPresence && collab.selfPresence.dragging) {
    drawDragGhost(g, allNodes, collab.selfPresence, 'self')
  }

  const remoteDragging = collab.remoteDragging
  if (!remoteDragging) return
  for (let i = 0; i < remoteDragging.length; i++) {
    drawDragGhost(g, allNodes, remoteDragging[i], 'remote')
  }
}

function drawDragGhost(g, allNodes, drag, kind) {
  let nodeData = null
  allNodes.each(function (d) {
    if (d.data.id === drag.nodeId) nodeData = d
  })
  if (!nodeData) return

  const sz = nodeSize(nodeData)
  const prefix = kind === 'self' ? 'presence-self' : 'presence'
  const ghost = g.append('g')
    .attr('class', prefix + '-drag-ghost')
    .attr('transform', `translate(${drag.x - sz.w / 2}, ${drag.y - sz.h / 2})`)
    .style('pointer-events', 'none')

  ghost.append('rect')
    .attr('width', sz.w).attr('height', sz.h).attr('rx', 10)
    .attr('fill', 'none')
    .attr('stroke', drag.color)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4 4')
    .attr('opacity', 0.5)

  ghost.append('text')
    .attr('x', sz.w / 2).attr('y', sz.h / 2 + 4)
    .attr('text-anchor', 'middle')
    .attr('fill', drag.color)
    .attr('font-size', '11px')
    .attr('opacity', 0.7)
    .text(drag.name || '?')
}