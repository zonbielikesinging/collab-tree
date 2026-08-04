// ── Coordinate System — Zoom / Pan State ──
// Manages D3 zoom transform as a singleton attached to the SVG element.
// Exposes reactive transform for axis rendering and viewport calculations.
// This is the single source of truth for zoom/pan state.

import * as d3 from 'd3'

const SCALE_EXTENT = [0.1, 5]
let currentTransform = d3.zoomIdentity

/**
 * Install zoom behavior on the SVG element.
 * Returns the background rect that receives zoom events.
 * Call this ONCE during full render.
 */
export function installZoom(svg, g, W, H, onZoom) {
  currentTransform = d3.zoomIdentity

  const zoom = d3.zoom()
    .scaleExtent(SCALE_EXTENT)
    .on('zoom', function (e) {
      currentTransform = e.transform
      g.attr('transform', e.transform)
      if (onZoom) onZoom(e.transform)
    })

  const bgRect = g.insert('rect', ':first-child')
    .attr('class', 'bg')
    .attr('width', W * 6)
    .attr('height', H * 6)
    .attr('x', -W * 3)
    .attr('y', -H * 3)
    .attr('fill', 'transparent')
    .style('pointer-events', 'all')

  bgRect.call(zoom)
  return bgRect
}

/**
 * Get the current zoom transform.
 */
export function getTransform() {
  return currentTransform
}

/**
 * Set the zoom transform (e.g., for initial auto-fit).
 */
export function setTransform(bgRect, t) {
  currentTransform = t
  if (bgRect) {
    const zoom = d3.zoom().scaleExtent(SCALE_EXTENT)
    bgRect.call(zoom.transform, t)
  }
}

/**
 * Compute initial auto-fit transform to center the tree.
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