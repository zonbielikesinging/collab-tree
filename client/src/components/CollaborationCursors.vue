<template>
  <!--
    SVG overlay layer for remote collaboration cursors.
    Renders:
    - Remote selection: colored ring around selected nodes
    - Remote dragging: ghost outline of node being dragged
    - Remote editing: pulsing indicator on edited nodes
    Must be rendered AFTER the main tree <g> so it appears on top.
  -->
</template>

<script setup>
/**
 * CollaborationCursors is a composable-style renderer, not a Vue component.
 * It's called from useTreeRenderer.js to draw into the SVG.
 *
 * Exports:
 *   drawRemoteCursors(svg, rootG, remoteCursors, remoteDragging, remoteEditingNodeIds)
 *   drawRemoteUserLabels(svg, remoteUsers)
 */

import { nodeSize, nodeCenter } from '../composables/useNodeDrawing.js'

const STROKE_WIDTH = 3
const CURSOR_RADIUS = 12

/**
 * Draw remote cursors on the SVG.
 * - For each remoteSelectedNodeId: draw a colored ring around the node
 * - For each remoteDragging: draw a ghost outline at the dragged position
 * - For each remoteEditingNodeId: draw a pulsing indicator
 */
export function drawRemoteCursors(svg, rootG, remoteCursors, remoteDragging, remoteEditingNodeIds) {
  if (!svg || !rootG) return

  const allNodes = rootG.selectAll('g.node')

  // ── Remote selection rings ──
  allNodes.each(function (d) {
    if (!remoteCursors || remoteCursors.length === 0) return
    const found = remoteCursors.find(c => c.selectedNodeId === d.data.id)
    if (!found) return

    const el = d3.select(this)
    const sz = nodeSize(d)

    // Remove any existing remote cursor
    el.selectAll('.remote-cursor').remove()

    // Draw colored ring
    el.append('rect')
      .attr('class', 'remote-cursor')
      .attr('x', -4).attr('y', -4)
      .attr('width', sz.w + 8).attr('height', sz.h + 8)
      .attr('rx', 12)
      .attr('fill', 'none')
      .attr('stroke', found.color)
      .attr('stroke-width', STROKE_WIDTH)
      .attr('stroke-dasharray', '6 3')
      .attr('opacity', 0.8)
      .style('pointer-events', 'none')

    // Label with user name
    el.append('text')
      .attr('class', 'remote-cursor')
      .attr('x', sz.w / 2).attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', found.color)
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .style('pointer-events', 'none')
      .text(found.userId?.slice(0, 4) || found.name || '?')
  })

  // ── Remote dragging ghost ──
  if (remoteDragging && remoteDragging.length > 0) {
    // Remove old ghosts
    svg.selectAll('.remote-drag-ghost').remove()

    for (const drag of remoteDragging) {
      // Find the node data
      let nodeData = null
      allNodes.each(function (d) {
        if (d.data.id === drag.nodeId) nodeData = d
      })
      if (!nodeData) continue

      const sz = nodeSize(nodeData)
      const g = svg.append('g')
        .attr('class', 'remote-drag-ghost')
        .attr('transform', `translate(${drag.x - sz.w / 2}, ${drag.y - sz.h / 2})`)
        .style('pointer-events', 'none')

      g.append('rect')
        .attr('width', sz.w).attr('height', sz.h).attr('rx', 10)
        .attr('fill', 'none')
        .attr('stroke', drag.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4 4')
        .attr('opacity', 0.5)

      g.append('text')
        .attr('x', sz.w / 2).attr('y', sz.h / 2 + 4)
        .attr('text-anchor', 'middle')
        .attr('fill', drag.color)
        .attr('font-size', '11px')
        .attr('opacity', 0.7)
        .text(drag.name || '?')
    }
  }

  // ── Remote editing indicator ──
  if (remoteEditingNodeIds && remoteEditingNodeIds.size > 0) {
    allNodes.each(function (d) {
      if (!remoteEditingNodeIds.has(d.data.id)) return
      const el = d3.select(this)
      el.selectAll('.remote-editing').remove()

      const sz = nodeSize(d)
      el.append('rect')
        .attr('class', 'remote-editing')
        .attr('x', -2).attr('y', -2)
        .attr('width', sz.w + 4).attr('height', sz.h + 4)
        .attr('rx', 11)
        .attr('fill', 'none')
        .attr('stroke', '#FF9800')
        .attr('stroke-width', 2)
        .style('pointer-events', 'none')
    })
  }
}

// Import d3 for the SVG manipulation inside drawRemoteCursors
import * as d3 from 'd3'
</script>

<style scoped>
/* No styles needed — all rendered as SVG elements */
</style>