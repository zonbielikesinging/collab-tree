// ── Incremental Update Helpers ──
// Functions for updating individual node visuals without full re-render.

import * as d3 from 'd3'
import { nodeTransform, linkPath } from './useSvgDefs.js'
import { cleanupPresence, drawAllPresence, cleanupDragGhosts, drawAllDragGhosts } from './usePresenceRenderer.js'

function nodeSize(d) {
  const w = d.data?.width || 180
  let h = d.data?.height || 56
  if (d.data?.expanded) h += 200
  return { w: Math.max(100, Math.min(600, w)), h }
}

function truncate(s, max) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/**
 * Incremental render: update positions, colors, labels, presence.
 * NO transitions — instant updates for smooth drag.
 */
export function incrementalRender(g, treeData, selectedNodeId, collaborationState) {
  g.selectAll('g.node').each(function (d) {
    const el = d3.select(this)
    const sz = nodeSize(d)

    // Instant position
    el.attr('transform', nodeTransform(d))

    // Update background rect
    el.select('rect').filter(function () {
      return this.getAttribute('filter') !== 'url(#shadow)' && !this.classList.contains('node-body')
    }).attr('width', sz.w).attr('height', sz.h).attr('fill', d.data.color || '#4A90D9')

    // Update label
    const texts = el.selectAll('text').nodes()
    if (texts.length > 0) {
      d3.select(texts[0]).attr('x', sz.w / 2).text(truncate(d.data.label || '', 20))
    }

    // Update separator line
    el.selectAll('line').filter(function () {
      return this.getAttribute('y1') === '34'
    }).attr('x2', sz.w - 10)

    // Update interactive handles
    el.select('.drag-handle').attr('transform', `translate(${sz.w - 26}, 2)`)
    el.select('.resize-handle').attr('transform', `translate(${sz.w - 14}, ${sz.h - 14})`)
    el.select('.btn-collapse').attr('transform', `translate(${sz.w - 28}, ${sz.h - 24})`)
    el.select('.btn-expand').attr('transform', `translate(2, ${sz.h - 24})`)

    // Update child count
    el.selectAll('text').filter(function () {
      return this.getAttribute('font-size') === '10px'
    }).attr('x', sz.w / 2).attr('y', sz.h - 10)

    // Update content preview
    updateContentPreview(el, d)

    // Update selection highlight
    updateSelectionHighlight(el, d, selectedNodeId)

    // Update presence
    cleanupPresence(el)
    if (collaborationState) drawAllPresence(el, d, collaborationState)
  })

  // Update links
  g.selectAll('path.link').attr('d', d => linkPath(d))

  // Update drag ghosts
  cleanupDragGhosts(g)
  if (collaborationState) drawAllDragGhosts(g, collaborationState)
}

/**
 * Presence-only update: no position/color/label changes.
 * Triggered when only collaboration state changes.
 */
export function incrementalPresenceOnly(g, treeData, selectedNodeId, collaborationState) {
  g.selectAll('g.node').each(function (d) {
    const el = d3.select(this)
    updateSelectionHighlight(el, d, selectedNodeId)
    cleanupPresence(el)
    if (collaborationState) drawAllPresence(el, d, collaborationState)
  })
  cleanupDragGhosts(g)
  if (collaborationState) drawAllDragGhosts(g, collaborationState)
}

function updateSelectionHighlight(el, d, selectedNodeId) {
  el.selectAll('rect.selection-highlight').remove()
  if (d.data.id !== selectedNodeId) return

  const sz = nodeSize(d)
  el.insert('rect', ':first-child')
    .attr('class', 'selection-highlight')
    .attr('x', -3).attr('y', -3)
    .attr('width', sz.w + 6).attr('height', sz.h + 6)
    .attr('rx', 12)
    .attr('fill', 'none')
    .attr('stroke', '#FFD700')
    .attr('stroke-width', 3)
    .style('pointer-events', 'none')
}

function updateContentPreview(el, d) {
  // Remove old content preview elements
  el.selectAll('rect').filter(function () {
    return this.getAttribute('y') === '34'
  }).remove()
  el.selectAll('text').filter(function () {
    return this.getAttribute('font-family') === 'monospace'
  }).remove()

  if (!d.data.expanded || !d.data.content) return

  const sz = nodeSize(d)
  el.append('rect')
    .attr('x', 0).attr('y', 34).attr('width', sz.w).attr('height', sz.h - 34)
    .attr('fill', 'rgba(255,255,255,0.95)')
    .style('pointer-events', 'none')

  const lines = d.data.content.split('\n').filter(l => l.trim()).slice(0, 8)
  lines.forEach((line, i) => {
    el.append('text')
      .attr('x', 10).attr('y', 50 + i * 18)
      .attr('fill', '#333').attr('font-size', '11px').attr('font-family', 'monospace')
      .style('pointer-events', 'none')
      .text(truncate(line, 35))
  })
  if (d.data.content.split('\n').filter(l => l.trim()).length > 8) {
    el.append('text')
      .attr('x', 10).attr('y', 50 + 8 * 18)
      .attr('fill', '#999').attr('font-size', '10px')
      .style('pointer-events', 'none')
      .text('… more')
  }
}