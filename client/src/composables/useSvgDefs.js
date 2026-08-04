// ── SVG Defs & Link Helpers ──
// Shadow filters, arrow markers, link path calculation.

import * as d3 from 'd3'

export function setupDefs(svg) {
  const defs = svg.append('defs')

  // Drop shadow on nodes
  defs.append('filter')
    .attr('id', 'shadow')
    .attr('x', '-10%').attr('y', '-10%')
    .attr('width', '130%').attr('height', '130%')
    .append('feDropShadow')
    .attr('dx', 1).attr('dy', 2).attr('stdDeviation', 3)
    .attr('flood-color', 'rgba(0,0,0,0.15)')
    .attr('flood-opacity', 0.5)

  // Arrow marker for links
  defs.append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 10).attr('refY', 5)
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#667788')
}

function nodeSize(d) {
  const w = d.data?.width || 180
  let h = d.data?.height || 56
  if (d.data?.expanded) h += 200
  return { w: Math.max(100, Math.min(600, w)), h }
}

function nodeCenter(d) {
  return {
    cx: d.data?.x != null ? d.data.x : d.x,
    cy: d.data?.y != null ? d.data.y : d.y,
  }
}

export function linkPath(d) {
  const szS = nodeSize(d.source)
  const szT = nodeSize(d.target)
  const s = nodeCenter(d.source)
  const t = nodeCenter(d.target)
  return d3.linkVertical()({
    source: [s.cx, s.cy + szS.h / 2],
    target: [t.cx, t.cy - szT.h / 2],
  })
}

export function nodeTransform(d) {
  const sz = nodeSize(d)
  const c = nodeCenter(d)
  return `translate(${c.cx - sz.w / 2}, ${c.cy - sz.h / 2})`
}

export function updateLinks(nodeId, cx, cy) {
  d3.selectAll('path.link')
    .filter(ld => ld.source.data.id === nodeId || ld.target.data.id === nodeId)
    .attr('d', function (ld) {
      const szS = nodeSize(ld.source)
      const szT = nodeSize(ld.target)
      const s = ld.source.data.id === nodeId ? { cx, cy } : nodeCenter(ld.source)
      const t = ld.target.data.id === nodeId ? { cx, cy } : nodeCenter(ld.target)
      return d3.linkVertical()({
        source: [s.cx, s.cy + szS.h / 2],
        target: [t.cx, t.cy - szT.h / 2],
      })
    })
}

export function updateLinksResize(nodeId, w, h) {
  d3.selectAll('path.link')
    .filter(ld => ld.source.data.id === nodeId || ld.target.data.id === nodeId)
    .attr('d', function (ld) {
      const szS = nodeSize(ld.source)
      const szT = nodeSize(ld.target)
      const s = nodeCenter(ld.source)
      const t = nodeCenter(ld.target)
      const sH = ld.source.data.id === nodeId ? h : szS.h
      const tH = ld.target.data.id === nodeId ? h : szT.h
      return d3.linkVertical()({
        source: [s.cx, s.cy + sH / 2],
        target: [t.cx, t.cy - tH / 2],
      })
    })
}