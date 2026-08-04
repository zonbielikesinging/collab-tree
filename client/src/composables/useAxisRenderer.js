// ── Axis Renderer ──
// Renders coordinate grid lines + labels on the SVG.
// Reads zoom/pan state from the main <g> transform attribute.
// Y-axis labels are negated (SVG Y-down → math Y-up).

import * as d3 from 'd3'
import { parseTransform } from './useCoordSystem.js'

/**
 * Render the coordinate axis grid.
 * Call this on every zoom/pan event and on showAxis toggle.
 */
export function renderAxis(svgEl, container, showAxis) {
  if (!svgEl) return
  const d3svg = d3.select(svgEl)
  d3svg.select('g.axis-layer').remove()
  if (!showAxis) return

  const W = container?.clientWidth || 800
  const H = container?.clientHeight || 600
  const g = d3svg.select('g.main')
  if (g.empty()) return

  const { x: tx, y: ty, k } = parseTransform(g.attr('transform'))
  const step = calcStep(k)
  const axisLayer = d3svg.append('g').attr('class', 'axis-layer')

  // X axis (horizontal grid lines, labels at bottom)
  const xStart = Math.floor((-tx / k - W) / step) * step
  const xEnd = Math.ceil((-tx / k + W) / step) * step
  for (let x = xStart; x <= xEnd; x += step) {
    const sx = x * k + tx
    // Grid line
    axisLayer.append('line')
      .attr('x1', sx).attr('y1', 0).attr('x2', sx).attr('y2', H)
      .attr('stroke', 'rgba(150,150,150,0.12)').attr('stroke-width', 0.5)
    // Label
    axisLayer.append('text')
      .attr('x', sx).attr('y', H - 4)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(150,150,150,0.45)')
      .attr('font-size', `${Math.max(8, 10 / k)}px`)
      .attr('font-family', 'monospace')
      .style('pointer-events', 'none')
      .text(x)
  }

  // Y axis (vertical grid lines, labels at left, negated)
  const yStart = Math.floor((-ty / k - H) / step) * step
  const yEnd = Math.ceil((-ty / k + H) / step) * step
  for (let y = yStart; y <= yEnd; y += step) {
    const sy = y * k + ty
    // Grid line
    axisLayer.append('line')
      .attr('x1', 0).attr('y1', sy).attr('x2', W).attr('y2', sy)
      .attr('stroke', 'rgba(150,150,150,0.12)').attr('stroke-width', 0.5)
    // Label (negate for display: SVG Y-down → math Y-up)
    axisLayer.append('text')
      .attr('x', 4).attr('y', sy + 3)
      .attr('text-anchor', 'start')
      .attr('fill', 'rgba(150,150,150,0.45)')
      .attr('font-size', `${Math.max(8, 10 / k)}px`)
      .attr('font-family', 'monospace')
      .style('pointer-events', 'none')
      .text(-y)
  }
}

/**
 * Adaptive grid step: larger steps when zoomed out, smaller when zoomed in.
 */
function calcStep(k) {
  if (k <= 0) return 100
  return Math.pow(10, Math.round(Math.log10(200 / k)))
}