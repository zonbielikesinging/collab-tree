// ── D3 tree renderer ──
// Incremental rendering: full re-render only on structural changes,
// otherwise update positions/attributes in-place for smooth panning.

import * as d3 from 'd3'
import { nodeSize, nodeCenter, drawNode, drawDragHandle, drawExpandBtn, drawCollapseBtn, drawChildCount, drawResizeHandle } from './useNodeDrawing.js'
import { wireNodeInteractions, isInteractiveTarget } from './useNodeInteraction.js'
import { resolveCollisions } from './useLayout.js'

const H_GAP = 120, V_GAP = 160

let cachedTreeJson = null  // JSON snapshot of last treeData (for structural diff)

export function buildHierarchy(data) {
  if (!data) return null
  const root = d3.hierarchy(data)
  root.each(d => {
    if (d.data.collapsed && d.children) {
      d._children = d.children
      d.children = null
    }
  })
  return root
}

export function renderTree(svgEl, container, treeData, selectedNodeId, emit, collaborationState) {
  if (!svgEl || !container) return
  if (!treeData) {
    emit('debug-log', '[TC] render skip: treeData is null')
    return
  }

  const svg = d3.select(svgEl)
  const W = container.clientWidth || 800
  const H = container.clientHeight || 600
  svg.attr('viewBox', `0 0 ${W} ${H}`)

  // Detect structural change: compare node IDs and children structure
  const newJson = JSON.stringify(treeData, (key, val) => {
    if (key === 'x' || key === 'y' || key === 'content' || key === 'label' || key === 'color') return undefined
    return val
  })
  const structureChanged = newJson !== cachedTreeJson
  cachedTreeJson = newJson

  const g = svg.select('g.main')
  if (g.empty() || structureChanged) {
    // Full re-render
    svg.selectAll('*').remove()
    setupDefs(svg)
    fullRender(svg, container, treeData, selectedNodeId, emit, collaborationState)
  } else {
    // Incremental: only update positions, colors, labels, selection
    incrementalRender(svg, g, treeData, selectedNodeId, emit, collaborationState)
  }
}

function fullRender(svg, container, treeData, selectedNodeId, emit, collaborationState) {
  const W = container.clientWidth || 800
  const H = container.clientHeight || 600

  const g = svg.append('g').attr('class', 'main')

  let currentTransform = d3.zoomIdentity
  const zoom = d3.zoom().scaleExtent([0.1, 5]).on('zoom', e => {
    currentTransform = e.transform
    g.attr('transform', e.transform)
  })

  const bgRect = g.insert('rect', ':first-child')
    .attr('class', 'bg')
    .attr('width', W * 6).attr('height', H * 6)
    .attr('x', -W * 3).attr('y', -H * 3)
    .attr('fill', 'transparent')
    .style('pointer-events', 'all')
  bgRect.call(zoom)

  const root = buildHierarchy(treeData)
  if (!root) return

  const treeLayout = d3.tree().nodeSize([H_GAP, V_GAP])
    .separation((a, b) => ((nodeSize(a).w + nodeSize(b).w) / 2 + 50) / H_GAP)
  treeLayout(root)

  const descendants = root.descendants()
  resolveCollisions(descendants)

  // links
  g.selectAll('path.link').data(root.links()).join('path')
    .attr('class', 'link').attr('fill', 'none').attr('stroke', '#667788')
    .attr('stroke-width', 2.5).attr('opacity', 0.65).attr('marker-end', 'url(#arrow)')
    .attr('d', d => linkPath(d))

  // nodes
  const nodeG = g.selectAll('g.node').data(descendants).join('g')
    .attr('class', 'node')
    .attr('filter', 'url(#shadow)')
    .style('pointer-events', 'all')
    .attr('transform', d => nodeTransform(d))

  nodeG.each(function (d) {
    const el = d3.select(this)
    const { btnY, sz } = drawNode(el, d, { selectedNodeId })

    el.insert('rect', ':first-child')
      .attr('class', 'node-body')
      .attr('width', sz.w).attr('height', sz.h).attr('rx', 10)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all')

    drawDragHandle(el, sz)
    drawExpandBtn(el, d, btnY)
    drawCollapseBtn(el, d, sz, btnY)
    drawChildCount(el, d, sz, btnY)
    drawResizeHandle(el, sz)

    const ctx = { svgEl: svg.node(), g, emit, updateLinks, updateLinksResize }
    wireNodeInteractions(el, d, ctx)

    if (collaborationState && collaborationState.isNodeBeingEdited && collaborationState.isNodeBeingEdited(d.data.id)) {
      el.append('rect')
        .attr('class', 'remote-editing')
        .attr('x', -3).attr('y', -3)
        .attr('width', sz.w + 6).attr('height', sz.h + 6)
        .attr('rx', 12)
        .attr('fill', 'none')
        .attr('stroke', '#FF9800')
        .attr('stroke-width', 2.5)
        .style('pointer-events', 'none')
    }
  })

  // Remote cursors
  if (collaborationState) drawRemoteCursors(svg, g, collaborationState)

  // Click handlers
  nodeG.on('click', function (event, d) {
    if (isInteractiveTarget(event.target, svg.node())) return
    emit('node-click', d.data.id)
  })
  nodeG.on('dblclick', function (event, d) {
    if (isInteractiveTarget(event.target, svg.node())) return
    event.stopPropagation()
    emit('node-dblclick', d.data.id)
  })

  svg.selectAll('.btn-expand').on('click', function (event, d) {
    event.stopPropagation()
    emit('toggle-expand', d.data.id)
  })
  svg.selectAll('.btn-collapse').on('click', function (event, d) {
    event.stopPropagation()
    emit('toggle-collapse', d.data.id)
  })

  // Initial zoom-to-fit
  if (currentTransform.k === 1 && currentTransform.x === 0 && currentTransform.y === 0) {
    if (descendants.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const d of descendants) {
        const sz = nodeSize(d), c = nodeCenter(d)
        minX = Math.min(minX, c.cx - sz.w / 2)
        minY = Math.min(minY, c.cy - sz.h / 2)
        maxX = Math.max(maxX, c.cx + sz.w / 2)
        maxY = Math.max(maxY, c.cy + sz.h / 2)
      }
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      currentTransform = d3.zoomIdentity.translate(W / 2 - cx, H / 3 - cy)
    }
  }
  bgRect.call(zoom.transform, currentTransform)
}

function incrementalRender(svg, g, treeData, selectedNodeId, emit, collaborationState) {
  // Update existing nodes: positions, colors, labels, selection highlights
  g.selectAll('g.node').each(function (d) {
    const el = d3.select(this)

    // Update position transform
    el.transition().duration(50).attr('transform', nodeTransform(d))

    // Update background color
    el.select('rect').filter(function () {
      return this.getAttribute('filter') !== 'url(#shadow)' && !this.classList.contains('node-body')
    }).attr('fill', d.data.color || '#4A90D9')

    // Update label text
    const texts = el.selectAll('text').nodes()
    if (texts.length > 0) {
      d3.select(texts[0]).text(truncate(d.data.label || '', 20))
    }

    // Update content preview if expanded
    el.selectAll('rect').filter(function () {
      return this.getAttribute('y') === '34'
    }).remove()
    el.selectAll('text').filter(function () {
      return this.getAttribute('font-family') === 'monospace'
    }).remove()
    if (d.data.expanded && d.data.content) {
      const sz = nodeSize(d)
      drawContentPreviewIncremental(el, d.data.content, sz)
    }

    // Update selection highlight
    el.selectAll('rect.selection-highlight').remove()
    if (d.data.id === selectedNodeId) {
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

    // Update remote editing indicator
    el.selectAll('rect.remote-editing').remove()
    if (collaborationState && collaborationState.isNodeBeingEdited && collaborationState.isNodeBeingEdited(d.data.id)) {
      const sz = nodeSize(d)
      el.append('rect')
        .attr('class', 'remote-editing')
        .attr('x', -3).attr('y', -3)
        .attr('width', sz.w + 6).attr('height', sz.h + 6)
        .attr('rx', 12)
        .attr('fill', 'none')
        .attr('stroke', '#FF9800')
        .attr('stroke-width', 2.5)
        .style('pointer-events', 'none')
    }
  })

  // Update links
  g.selectAll('path.link')
    .transition().duration(50)
    .attr('d', d => linkPath(d))

  // Remote cursors
  g.selectAll('.remote-cursor, .remote-drag-ghost').remove()
  if (collaborationState) drawRemoteCursors(svg, g, collaborationState)
}

// ── Helpers ──

function linkPath(d) {
  const szS = nodeSize(d.source), szT = nodeSize(d.target)
  const s = nodeCenter(d.source), t = nodeCenter(d.target)
  return d3.linkVertical()({ source: [s.cx, s.cy + szS.h / 2], target: [t.cx, t.cy - szT.h / 2] })
}

function nodeTransform(d) {
  const sz = nodeSize(d), c = nodeCenter(d)
  return `translate(${c.cx - sz.w / 2}, ${c.cy - sz.h / 2})`
}

function updateLinks(nodeId, cx, cy) {
  d3.selectAll('path.link')
    .filter(ld => ld.source.data.id === nodeId || ld.target.data.id === nodeId)
    .attr('d', ld => {
      const szS = nodeSize(ld.source), szT = nodeSize(ld.target)
      const s = ld.source.data.id === nodeId ? { cx, cy } : nodeCenter(ld.source)
      const t = ld.target.data.id === nodeId ? { cx, cy } : nodeCenter(ld.target)
      return d3.linkVertical()({ source: [s.cx, s.cy + szS.h / 2], target: [t.cx, t.cy - szT.h / 2] })
    })
}

function updateLinksResize(nodeId, w, h) {
  d3.selectAll('path.link')
    .filter(ld => ld.source.data.id === nodeId || ld.target.data.id === nodeId)
    .attr('d', ld => {
      const szS = nodeSize(ld.source), szT = nodeSize(ld.target)
      const s = nodeCenter(ld.source), t = nodeCenter(ld.target)
      let sH = szS.h, tH = szT.h
      if (ld.source.data.id === nodeId) sH = h
      if (ld.target.data.id === nodeId) tH = h
      return d3.linkVertical()({ source: [s.cx, s.cy + sH / 2], target: [t.cx, t.cy - tH / 2] })
    })
}

function drawRemoteCursors(svg, rootG, collab) {
  const { remoteCursors, remoteDragging } = collab
  const allNodes = rootG.selectAll('g.node')

  if (remoteCursors && remoteCursors.length > 0) {
    allNodes.each(function (d) {
      const found = remoteCursors.find(c => c.selectedNodeId === d.data.id)
      if (!found) return
      const el = d3.select(this)
      const sz = nodeSize(d)

      el.append('rect')
        .attr('class', 'remote-cursor')
        .attr('x', -5).attr('y', -5)
        .attr('width', sz.w + 10).attr('height', sz.h + 10)
        .attr('rx', 13)
        .attr('fill', 'none')
        .attr('stroke', found.color)
        .attr('stroke-width', 3)
        .attr('stroke-dasharray', '6 3')
        .attr('opacity', 0.8)
        .style('pointer-events', 'none')

      el.append('text')
        .attr('class', 'remote-cursor')
        .attr('x', sz.w / 2).attr('y', -12)
        .attr('text-anchor', 'middle')
        .attr('fill', found.color)
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .style('pointer-events', 'none')
        .text(found.name || '?')
    })
  }

  if (remoteDragging && remoteDragging.length > 0) {
    for (const drag of remoteDragging) {
      let nodeData = null
      allNodes.each(function (d) {
        if (d.data.id === drag.nodeId) nodeData = d
      })
      if (!nodeData) continue

      const sz = nodeSize(nodeData)
      const ghost = rootG.append('g')
        .attr('class', 'remote-drag-ghost')
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
  }
}

function setupDefs(svg) {
  const defs = svg.append('defs')
  defs.append('filter')
    .attr('id', 'shadow').attr('x', '-10%').attr('y', '-10%')
    .attr('width', '130%').attr('height', '130%')
    .append('feDropShadow')
    .attr('dx', 1).attr('dy', 2).attr('stdDeviation', 3)
    .attr('flood-color', 'rgba(0,0,0,0.15)').attr('flood-opacity', 0.5)
  defs.append('marker')
    .attr('id', 'arrow').attr('viewBox', '0 0 10 10')
    .attr('refX', 10).attr('refY', 5).attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('fill', '#667788')
}

function truncate(s, max) {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s
}

function drawContentPreviewIncremental(el, content, sz) {
  el.append('rect')
    .attr('x', 0).attr('y', 34).attr('width', sz.w).attr('height', sz.h - 34)
    .attr('fill', 'rgba(255,255,255,0.95)')
    .style('pointer-events', 'none')

  const lines = content.split('\n').filter(l => l.trim()).slice(0, 8)
  lines.forEach((line, i) => {
    el.append('text')
      .attr('x', 10).attr('y', 50 + i * 18)
      .attr('fill', '#333').attr('font-size', '11px').attr('font-family', 'monospace')
      .style('pointer-events', 'none')
      .text(truncate(line, 35))
  })
  if (content.split('\n').filter(l => l.trim()).length > 8) {
    el.append('text')
      .attr('x', 10).attr('y', 50 + 8 * 18)
      .attr('fill', '#999').attr('font-size', '10px')
      .style('pointer-events', 'none')
      .text('\u2026 more')
  }
}