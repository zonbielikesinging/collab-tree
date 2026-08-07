// ── Coordinate System — Zoom / Pan State ──
// Manages D3 zoom transform attached to the SVG element.
// Key: preserves zoom state across fullRender calls.
// When installZoom is called again, it restores the previous transform.

import * as d3 from 'd3'

const SCALE_EXTENT = [0.1, 5]

// Preserved zoom state across full renders
let savedTransform = null
let hasAutoFitted = false

/**
 * Install zoom behavior on the SVG element.
 * Call this ONCE during initial render, and on fullRender.
 * Preserves previous zoom state if available.
 */
export function installZoom(svg, g, W, H, onZoom) {
  const zoom = d3.zoom()
    .scaleExtent(SCALE_EXTENT)
    .on('zoom', function (e) {
      savedTransform = e.transform
      g.attr('transform', e.transform)
      if (onZoom) onZoom(e.transform)
    })

  const bgRect = g.select('rect.bg')
  if (!bgRect.empty()) {
    // Already has a bg rect, rebind zoom
    bgRect.on('.zoom', null)
    bgRect.call(zoom)
    // Restore previous transform
    if (savedTransform && savedTransform.k !== 1) {
      bgRect.call(zoom.transform, savedTransform)
      g.attr('transform', savedTransform)
    }
    return bgRect
  }

  // First time: create bg rect
  const newBg = g.insert('rect', ':first-child')
    .attr('class', 'bg')
    .attr('width', W * 6)
    .attr('height', H * 6)
    .attr('x', -W * 3)
    .attr('y', -H * 3)
    .attr('fill', 'transparent')
    .style('pointer-events', 'all')

  newBg.call(zoom)

  // Restore previous transform if available
  if (savedTransform) {
    newBg.call(zoom.transform, savedTransform)
    g.attr('transform', savedTransform)
  }

  return newBg
}

/**
 * Get the current zoom transform.
 */
export function getTransform() {
  return savedTransform || d3.zoomIdentity
}

/**
 * Set the zoom transform (e.g., for initial auto-fit).
 * Only auto-fits once.
 */
export function setTransform(bgRect, t) {
  savedTransform = t
  hasAutoFitted = true
  if (bgRect && bgRect.node()) {
    const zoom = d3.zoom().scaleExtent(SCALE_EXTENT)
    d3.select(bgRect.node()).call(zoom.transform, t)
  }
}

/**
 * Compute initial auto-fit transform to center the tree.
 * Only used on first render.
 */
export function computeAutoFit(descendants, W, H) {
  if (!descendants || descendants.length === 0) return d3.zoomIdentity

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const d of descendants) {
    const sz = { w: d.data?.width || 180, h: d.data?.height || 56 }
    const cx = d.data?.x != null ? d.data.x : d.x
    const cy = d.data?.y != null ? d.data.y : d.y
    minX = Math.min(minX, cx - sz.w / 2)
    minY = Math.min(minY, cy - sz.h / 2)
    maxX = Math.max(maxX, cx + sz.w / 2)
    maxY = Math.max(maxY, cy + sz.h / 2)
  }

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return d3.zoomIdentity.translate(W / 2 - cx, H / 3 - cy)
}

/**
 * Whether auto-fit has been applied.
 */
export function hasAutoFit() {
  return hasAutoFitted
}

/**
 * Parse D3 transform string into { x, y, k }.
 */
export function parseTransform(transformStr) {
  const match = transformStr && transformStr.match(
    /translate\(([^,]+),\s*([^)]+)\)\s*scale\(([^)]+)\)/
  )
  return {
    x: match ? parseFloat(match[1]) : 0,
    y: match ? parseFloat(match[2]) : 0,
    k: match ? parseFloat(match[3]) : 1,
  }
}