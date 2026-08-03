// ── D3 tree renderer ──
// Incremental rendering: full re-render only on structural changes,
// otherwise update positions/attributes in-place for smooth panning.
// Remote cursors: colored border ring + name tag at top-right.

import * as d3 from 'd3'
import { nodeSize, nodeCenter, drawNode, drawDragHandle, drawExpandBtn, drawCollapseBtn, drawChildCount, drawResizeHandle } from './useNodeDrawing.js'
import { wireNodeInteractions, isInteractiveTarget } from './useNodeInteraction.js'
import { resolveCollisions } from './useLayout.js'

var H_GAP = 120
var V_GAP = 160

var cachedTreeJson = null

export function buildHierarchy(data) {
  if (!data) return null
  var root = d3.hierarchy(data)
  root.each(function(d) {
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

  var svg = d3.select(svgEl)
  var W = container.clientWidth || 800
  var H = container.clientHeight || 600
  svg.attr('viewBox', '0 0 ' + W + ' ' + H)

  var newJson = JSON.stringify(treeData, function(key, val) {
    if (key === 'x' || key === 'y' || key === 'content' || key === 'label' ||
        key === 'color' || key === 'width' || key === 'height' ||
        key === 'collapsed' || key === 'expanded') return undefined
    return val
  })
  var structureChanged = newJson !== cachedTreeJson
  cachedTreeJson = newJson

  var g = svg.select('g.main')
  if (g.empty() || structureChanged) {
    svg.selectAll('*').remove()
    setupDefs(svg)
    fullRender(svg, container, treeData, selectedNodeId, emit, collaborationState)
  } else {
    incrementalRender(svg, g, treeData, selectedNodeId, emit, collaborationState)
  }
}

function fullRender(svg, container, treeData, selectedNodeId, emit, collaborationState) {
  var W = container.clientWidth || 800
  var H = container.clientHeight || 600

  var g = svg.append('g').attr('class', 'main')

  var currentTransform = d3.zoomIdentity
  var zoom = d3.zoom().scaleExtent([0.1, 5]).on('zoom', function(e) {
    currentTransform = e.transform
    g.attr('transform', e.transform)
  })
  svg._zoomTransform = function() { return currentTransform }
  svg._setZoom = function(t) { currentTransform = t }

  var bgRect = g.insert('rect', ':first-child')
    .attr('class', 'bg')
    .attr('width', W * 6).attr('height', H * 6)
    .attr('x', -W * 3).attr('y', -H * 3)
    .attr('fill', 'transparent')
    .style('pointer-events', 'all')
  bgRect.call(zoom)

  var root = buildHierarchy(treeData)
  if (!root) return

  var treeLayout = d3.tree().nodeSize([H_GAP, V_GAP])
    .separation(function(a, b) { return ((nodeSize(a).w + nodeSize(b).w) / 2 + 50) / H_GAP })
  treeLayout(root)

  var descendants = root.descendants()
  resolveCollisions(descendants)

  g.selectAll('path.link').data(root.links()).join('path')
    .attr('class', 'link').attr('fill', 'none').attr('stroke', '#667788')
    .attr('stroke-width', 2.5).attr('opacity', 0.65).attr('marker-end', 'url(#arrow)')
    .attr('d', function(d) { return linkPath(d) })

  var nodeG = g.selectAll('g.node').data(descendants).join('g')
    .attr('class', 'node')
    .attr('filter', 'url(#shadow)')
    .style('pointer-events', 'all')
    .attr('transform', function(d) { return nodeTransform(d) })

  nodeG.each(function(d) {
    var el = d3.select(this)
    var result = drawNode(el, d, { selectedNodeId: selectedNodeId })
    var btnY = result.btnY
    var sz = result.sz

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

    var ctx = { svgEl: svg.node(), g: g, emit: emit, updateLinks: updateLinks, updateLinksResize: updateLinksResize }
    wireNodeInteractions(el, d, ctx)

    if (collaborationState) {
      drawRemotePresence(el, d, collaborationState)
    }
  })

  if (collaborationState) {
    drawRemoteDragGhosts(g, collaborationState)
  }

  nodeG.on('click', function(event, d) {
    if (isInteractiveTarget(event.target, svg.node())) return
    emit('node-click', d.data.id)
  })
  nodeG.on('dblclick', function(event, d) {
    if (isInteractiveTarget(event.target, svg.node())) return
    event.stopPropagation()
    emit('node-dblclick', d.data.id)
  })

  svg.selectAll('.btn-expand').on('click', function(event, d) {
    event.stopPropagation()
    emit('toggle-expand', d.data.id)
  })
  svg.selectAll('.btn-collapse').on('click', function(event, d) {
    event.stopPropagation()
    emit('toggle-collapse', d.data.id)
  })

  if (currentTransform.k === 1 && currentTransform.x === 0 && currentTransform.y === 0) {
    if (descendants.length > 0) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (var i = 0; i < descendants.length; i++) {
        var d = descendants[i]
        var sz = nodeSize(d)
        var c = nodeCenter(d)
        minX = Math.min(minX, c.cx - sz.w / 2)
        minY = Math.min(minY, c.cy - sz.h / 2)
        maxX = Math.max(maxX, c.cx + sz.w / 2)
        maxY = Math.max(maxY, c.cy + sz.h / 2)
      }
      var cx = (minX + maxX) / 2
      var cy = (minY + maxY) / 2
      currentTransform = d3.zoomIdentity.translate(W / 2 - cx, H / 3 - cy)
    }
  }
  bgRect.call(zoom.transform, currentTransform)
}

function incrementalRender(svg, g, treeData, selectedNodeId, emit, collaborationState) {
  g.selectAll('g.node').each(function(d) {
    var el = d3.select(this)

    // Instant position update - no transition to avoid jank
    el.attr('transform', nodeTransform(d))

    // Update background color
    el.select('rect').filter(function() {
      return this.getAttribute('filter') !== 'url(#shadow)' && !this.classList.contains('node-body')
    }).attr('fill', d.data.color || '#4A90D9')

    // Update label text
    var texts = el.selectAll('text').nodes()
    if (texts.length > 0) {
      d3.select(texts[0]).text(truncate(d.data.label || '', 20))
    }

    // Update content preview
    el.selectAll('rect').filter(function() {
      return this.getAttribute('y') === '34'
    }).remove()
    el.selectAll('text').filter(function() {
      return this.getAttribute('font-family') === 'monospace'
    }).remove()
    if (d.data.expanded && d.data.content) {
      var sz = nodeSize(d)
      drawContentPreviewIncremental(el, d.data.content, sz)
    }

    // Selection highlight
    el.selectAll('rect.selection-highlight').remove()
    if (d.data.id === selectedNodeId) {
      var sz = nodeSize(d)
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

    // Remote presence
    el.selectAll('rect.remote-cursor, text.remote-name-tag, rect.remote-name-bg').remove()
    if (collaborationState) {
      drawRemotePresence(el, d, collaborationState)
    }
  })

  // Links - instant
  g.selectAll('path.link').attr('d', function(d) { return linkPath(d) })

  // Drag ghosts
  g.selectAll('.remote-drag-ghost').remove()
  if (collaborationState) {
    drawRemoteDragGhosts(g, collaborationState)
  }
}

// Remote presence: colored border + name tag at top-right

function drawRemotePresence(el, d, collab) {
  var remoteCursors = collab.remoteCursors
  if (!remoteCursors) return

  var onNode = remoteCursors.filter(function(c) { return c.selectedNodeId === d.data.id })
  if (onNode.length === 0) return

  var sz = nodeSize(d)

  onNode.forEach(function(user, i) {
    var offset = i * 2
    el.append('rect')
      .attr('class', 'remote-cursor')
      .attr('x', -3 - offset).attr('y', -3 - offset)
      .attr('width', sz.w + 6 + offset * 2).attr('height', sz.h + 6 + offset * 2)
      .attr('rx', 12)
      .attr('fill', 'none')
      .attr('stroke', user.color)
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.85)
      .style('pointer-events', 'none')
  })

  // Name tag at top-right
  var user = onNode[0]
  var nameStr = user.name || '?'
  var tagW = nameStr.length * 8 + 16
  var tagX = sz.w
  var tagY = -14

  el.append('rect')
    .attr('class', 'remote-name-bg')
    .attr('x', tagX - tagW).attr('y', tagY - 8)
    .attr('width', tagW).attr('height', 16)
    .attr('rx', 8)
    .attr('fill', user.color)
    .attr('opacity', 0.92)
    .style('pointer-events', 'none')

  el.append('text')
    .attr('class', 'remote-name-tag')
    .attr('x', tagX - tagW / 2).attr('y', tagY + 3)
    .attr('text-anchor', 'middle')
    .attr('fill', 'white')
    .attr('font-size', '10px')
    .attr('font-weight', '700')
    .style('pointer-events', 'none')
    .text(nameStr)
}

function drawRemoteDragGhosts(g, collab) {
  var remoteDragging = collab.remoteDragging
  if (!remoteDragging || remoteDragging.length === 0) return

  var allNodes = g.selectAll('g.node')
  for (var i = 0; i < remoteDragging.length; i++) {
    var drag = remoteDragging[i]
    var nodeData = null
    allNodes.each(function(d) {
      if (d.data.id === drag.nodeId) nodeData = d
    })
    if (!nodeData) continue

    var sz = nodeSize(nodeData)
    var ghost = g.append('g')
      .attr('class', 'remote-drag-ghost')
      .attr('transform', 'translate(' + (drag.x - sz.w / 2) + ', ' + (drag.y - sz.h / 2) + ')')
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

function linkPath(d) {
  var szS = nodeSize(d.source)
  var szT = nodeSize(d.target)
  var s = nodeCenter(d.source)
  var t = nodeCenter(d.target)
  return d3.linkVertical()({ source: [s.cx, s.cy + szS.h / 2], target: [t.cx, t.cy - szT.h / 2] })
}

function nodeTransform(d) {
  var sz = nodeSize(d)
  var c = nodeCenter(d)
  return 'translate(' + (c.cx - sz.w / 2) + ', ' + (c.cy - sz.h / 2) + ')'
}

function updateLinks(nodeId, cx, cy) {
  d3.selectAll('path.link')
    .filter(function(ld) { return ld.source.data.id === nodeId || ld.target.data.id === nodeId })
    .attr('d', function(ld) {
      var szS = nodeSize(ld.source)
      var szT = nodeSize(ld.target)
      var s = ld.source.data.id === nodeId ? { cx: cx, cy: cy } : nodeCenter(ld.source)
      var t = ld.target.data.id === nodeId ? { cx: cx, cy: cy } : nodeCenter(ld.target)
      return d3.linkVertical()({ source: [s.cx, s.cy + szS.h / 2], target: [t.cx, t.cy - szT.h / 2] })
    })
}

function updateLinksResize(nodeId, w, h) {
  d3.selectAll('path.link')
    .filter(function(ld) { return ld.source.data.id === nodeId || ld.target.data.id === nodeId })
    .attr('d', function(ld) {
      var szS = nodeSize(ld.source)
      var szT = nodeSize(ld.target)
      var s = nodeCenter(ld.source)
      var t = nodeCenter(ld.target)
      var sH = szS.h
      var tH = szT.h
      if (ld.source.data.id === nodeId) sH = h
      if (ld.target.data.id === nodeId) tH = h
      return d3.linkVertical()({ source: [s.cx, s.cy + sH / 2], target: [t.cx, t.cy - tH / 2] })
    })
}

function setupDefs(svg) {
  var defs = svg.append('defs')
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

  var lines = content.split('\n').filter(function(l) { return l.trim() }).slice(0, 8)
  lines.forEach(function(line, i) {
    el.append('text')
      .attr('x', 10).attr('y', 50 + i * 18)
      .attr('fill', '#333').attr('font-size', '11px').attr('font-family', 'monospace')
      .style('pointer-events', 'none')
      .text(truncate(line, 35))
  })
  if (content.split('\n').filter(function(l) { return l.trim() }).length > 8) {
    el.append('text')
      .attr('x', 10).attr('y', 50 + 8 * 18)
      .attr('fill', '#999').attr('font-size', '10px')
      .style('pointer-events', 'none')
      .text('... more')
  }
}
