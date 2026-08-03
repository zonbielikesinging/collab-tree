// ── D3 tree renderer ──
// Builds hierarchy, layout, links, nodes, and zoom.
// Delegates per-node drawing to useNodeDrawing and
// interaction wiring to useNodeInteraction.

import * as d3 from 'd3'
import { nodeSize, nodeCenter, drawNode, drawDragHandle, drawExpandBtn, drawCollapseBtn, drawChildCount, drawResizeHandle } from './useNodeDrawing.js'
import { wireNodeInteractions, isInteractiveTarget } from './useNodeInteraction.js'
import { resolveCollisions } from './useLayout.js'

const H_GAP = 120, V_GAP = 160

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
  svg.selectAll('*').remove()

  // defs
  setupDefs(svg)

  const g = svg.append('g')

  // Zoom: pan + wheel on background rect only
  let currentTransform = d3.zoomIdentity
  const zoom = d3.zoom().scaleExtent([0.15, 4]).on('zoom', e => {
    currentTransform = e.transform
    g.attr('transform', e.transform)
  })

  // Background rect catches all zoom interactions (pan + wheel)
  const bgRect = g.insert('rect', ':first-child')
    .attr('width', W * 4).attr('height', H * 4)
    .attr('x', -W * 2).attr('y', -H * 2)
    .attr('fill', 'transparent')
    .style('pointer-events', 'all')
  bgRect.call(zoom)

  const root = buildHierarchy(treeData)
  if (!root) {
    emit('debug-log', '[TC] render skip: buildHierarchy returned null')
    return
  }

  const treeLayout = d3.tree().nodeSize([H_GAP, V_GAP])
    .separation((a, b) => ((nodeSize(a).w + nodeSize(b).w) / 2 + 50) / H_GAP)
  treeLayout(root)

  // Run collision resolution to prevent overlapping nodes
  const descendants = root.descendants()
  resolveCollisions(descendants)

  // link helpers
  function updateLinks(nodeId, cx, cy) {
    svg.selectAll('path.link')
      .filter(ld => ld.source.data.id === nodeId || ld.target.data.id === nodeId)
      .attr('d', ld => {
        const szS = nodeSize(ld.source), szT = nodeSize(ld.target)
        const s = ld.source.data.id === nodeId ? { cx, cy } : nodeCenter(ld.source)
        const t = ld.target.data.id === nodeId ? { cx, cy } : nodeCenter(ld.target)
        return d3.linkVertical()({ source: [s.cx, s.cy + szS.h / 2], target: [t.cx, t.cy - szT.h / 2] })
      })
  }
  function updateLinksResize(nodeId, w, h) {
    svg.selectAll('path.link')
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

  // links
  g.selectAll('path.link').data(root.links()).join('path')
    .attr('class', 'link').attr('fill', 'none').attr('stroke', '#667788')
    .attr('stroke-width', 2.5).attr('opacity', 0.65).attr('marker-end', 'url(#arrow)')
    .attr('d', d => {
      const szS = nodeSize(d.source), szT = nodeSize(d.target)
      const s = nodeCenter(d.source), t = nodeCenter(d.target)
      return d3.linkVertical()({ source: [s.cx, s.cy + szS.h / 2], target: [t.cx, t.cy - szT.h / 2] })
    })

  // nodes
  const nodeG = g.selectAll('g.node').data(descendants).join('g')
    .attr('class', 'node').attr('filter', 'url(#shadow)')
    .style('pointer-events', 'all')
    .attr('transform', d => {
      const sz = nodeSize(d), c = nodeCenter(d)
      return `translate(${c.cx - sz.w / 2}, ${c.cy - sz.h / 2})`
    })

  // draw each node
  nodeG.each(function (d) {
    const el = d3.select(this)
    const { btnY, sz } = drawNode(el, d, { selectedNodeId })

    // Invisible overlay rect to capture click events on node body
    // (SVG <g> elements don't have a fill, so pointer events pass through)
    el.insert('rect', ':first-child')
      .attr('class', 'node-body')
      .attr('width', sz.w).attr('height', sz.h).attr('rx', 10)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all')

    // draw interactive zones
    drawDragHandle(el, sz)
    drawExpandBtn(el, d, btnY)
    drawCollapseBtn(el, d, sz, btnY)
    drawChildCount(el, d, sz, btnY)
    drawResizeHandle(el, sz)

    // wire interactions
    const ctx = { svgEl, g, emit, updateLinks, updateLinksResize }
    wireNodeInteractions(el, d, ctx)

    // Remote editing indicator
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

  // ── Remote collaboration cursors ──
  if (collaborationState) {
    drawRemoteCursors(svg, g, collaborationState)
  }

  // click on node body (D3 event, fires on the <g> element)
  nodeG.on('click', function (event, d) {
    if (isInteractiveTarget(event.target, svgEl)) return
    emit('node-click', d.data.id)
  })
  nodeG.on('dblclick', function (event, d) {
    if (isInteractiveTarget(event.target, svgEl)) return
    event.stopPropagation()
    emit('node-dblclick', d.data.id)
  })

  // expand/collapse buttons
  svg.selectAll('.btn-expand').on('click', function (event, d) {
    event.stopPropagation()
    emit('toggle-expand', d.data.id)
  })
  svg.selectAll('.btn-collapse').on('click', function (event, d) {
    event.stopPropagation()
    emit('toggle-collapse', d.data.id)
  })

  // initial zoom-to-fit: center on nodes using nodeCenter (accounts for manual positions)
  if (currentTransform.k === 1 && currentTransform.x === 0 && currentTransform.y === 0) {
    if (descendants.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const d of descendants) {
        const sz = nodeSize(d)
        const c = nodeCenter(d)
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

/**
 * Render remote collaboration indicators on the SVG.
 */
function drawRemoteCursors(svg, rootG, collab) {
  const { remoteCursors, remoteDragging } = collab
  const allNodes = rootG.selectAll('g.node')

  // ── Remote selection rings ──
  if (remoteCursors && remoteCursors.length > 0) {
    allNodes.each(function (d) {
      const found = remoteCursors.find(c => c.selectedNodeId === d.data.id)
      if (!found) return

      const el = d3.select(this)
      const sz = nodeSize(d)
      el.selectAll('.remote-cursor').remove()

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

  // ── Remote dragging ghosts ──
  if (remoteDragging && remoteDragging.length > 0) {
    rootG.selectAll('.remote-drag-ghost').remove()
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