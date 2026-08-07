// ── D3 Tree Renderer (Orchestration) ──
// Orchestrates full render + incremental updates.
// Delegates to: useCoordSystem, useSvgDefs, usePresenceRenderer, useIncremental, useAxisRenderer

import * as d3 from 'd3'
import { buildHierarchy } from './useHierarchy.js'
import { nodeSize, nodeCenter, drawNode, drawDragHandle, drawExpandBtn, drawCollapseBtn, drawChildCount, drawResizeHandle } from './useNodeDrawing.js'
import { wireNodeInteractions, isInteractiveTarget } from './useNodeInteraction.js'
import { resolveCollisions } from './useLayout.js'
import { installZoom, setTransform, computeAutoFit, hasAutoFit } from './useCoordSystem.js'
import { setupDefs, linkPath, nodeTransform, updateLinks, updateLinksResize } from './useSvgDefs.js'
import { drawAllPresence, drawAllDragGhosts } from './usePresenceRenderer.js'
import { incrementalRender, incrementalPresenceOnly } from './useIncremental.js'

const H_GAP = 120
const V_GAP = 160

let cachedTreeJson = null
let cachedCollabJson = null
let cachedSelectedNodeId = null

/**
 * Main render function. Determines render strategy:
 * - fullRender: structure changed or first render
 * - incrementalPresenceOnly: only collaboration state changed
 * - incrementalRender: positions/colors/labels changed
 */
export function renderTree(svgEl, container, treeData, selectedNodeId, emit, collaborationState) {
  if (!svgEl || !container) return
  if (!treeData) { emit('debug-log', '[TC] render skip: treeData is null'); return }

  const svg = d3.select(svgEl)
  const W = container.clientWidth || 800
  const H = container.clientHeight || 600
  svg.attr('viewBox', `0 0 ${W} ${H}`)

  // Diff for structural changes
  const newJson = makeDiffJson(treeData)
  const structureChanged = newJson !== cachedTreeJson
  cachedTreeJson = newJson

  // Diff for collaboration changes
  const collabJson = collaborationState ? JSON.stringify(collaborationState) : null
  const collabChanged = collabJson !== cachedCollabJson
  cachedCollabJson = collabJson

  // Selection change
  const selChanged = selectedNodeId !== cachedSelectedNodeId
  cachedSelectedNodeId = selectedNodeId

  const g = svg.select('g.main')
  if (g.empty() || structureChanged) {
    svg.selectAll('*').remove()
    fullRender(svg, container, treeData, selectedNodeId, emit, collaborationState)
  } else if (collabChanged || selChanged) {
    incrementalPresenceOnly(g, treeData, selectedNodeId, collaborationState)
  } else {
    incrementalRender(g, treeData, selectedNodeId, collaborationState)
  }
}

function fullRender(svg, container, treeData, selectedNodeId, emit, collaborationState) {
  const W = container.clientWidth || 800
  const H = container.clientHeight || 600

  const g = svg.append('g').attr('class', 'main')
  setupDefs(svg)

  // Install zoom — preserves previous state if re-creating
  installZoom(svg, g, W, H, () => {
    if (emit) emit('zoom-changed')
  })

  const root = buildHierarchy(treeData)
  if (!root) return

  // Layout
  const treeLayout = d3.tree().nodeSize([H_GAP, V_GAP])
    .separation((a, b) => ((nodeSize(a).w + nodeSize(b).w) / 2 + 50) / H_GAP)
  treeLayout(root)
  const descendants = root.descendants()
  resolveCollisions(descendants)

  // Links
  g.selectAll('path.link').data(root.links()).join('path')
    .attr('class', 'link').attr('fill', 'none').attr('stroke', '#667788')
    .attr('stroke-width', 2.5).attr('opacity', 0.65).attr('marker-end', 'url(#arrow)')
    .attr('d', d => linkPath(d))

  // Nodes
  const nodeG = g.selectAll('g.node').data(descendants).join('g')
    .attr('class', 'node')
    .attr('filter', 'url(#shadow)')
    .style('pointer-events', 'all')
    .attr('transform', d => nodeTransform(d))

  nodeG.each(function (d) {
    const el = d3.select(this)
    const result = drawNode(el, d, { selectedNodeId })
    const { btnY, sz } = result

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

    wireNodeInteractions(el, d, {
      svgEl: svg.node(), g, emit,
      updateLinks, updateLinksResize,
    })

    if (collaborationState) drawAllPresence(el, d, collaborationState)
  })

  if (collaborationState) drawAllDragGhosts(g, collaborationState)

  // Wire click events
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

  // Auto-fit only on first render (not after structure changes from user edits)
  if (!hasAutoFit() && descendants.length > 0) {
    const bgRect = g.select('rect.bg')
    const t = computeAutoFit(descendants, W, H)
    setTransform(bgRect, t)
    if (emit) emit('zoom-changed')
  }
}

// ── Diff helper ──

function makeDiffJson(data) {
  return JSON.stringify(data, function (key, val) {
    if (key === 'x' || key === 'y' || key === 'content' || key === 'label' ||
        key === 'color' || key === 'width' || key === 'height' ||
        key === 'collapsed' || key === 'expanded') return undefined
    return val
  })
}

// ── Re-export for consumers ──

export { buildHierarchy } from './useHierarchy.js'