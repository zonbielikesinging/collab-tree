// ── Node drawing helpers for D3 tree renderer ──
// Each node is drawn inside a <g class="node"> element.
// All DOM elements appended here use pointer-events:none for
// the body parts, and explicit classes for interactive zones.

const MIN_W = 100, MAX_W = 600
const EXPANDED_CONTENT_H = 200

export function nodeSize(d) {
  const w = d.data.width || 180
  let h = d.data.height || 56
  if (d.data.expanded) h += EXPANDED_CONTENT_H
  return { w: Math.max(MIN_W, Math.min(MAX_W, w)), h }
}

export function nodeCenter(d) {
  return {
    cx: d.data.x != null ? d.data.x : d.x,
    cy: d.data.y != null ? d.data.y : d.y,
  }
}

/**
 * Draw the full node body inside a D3 selection `el` (<g>).
 * Returns { btnY, sz } for interaction wiring.
 */
export function drawNode(el, d, opts) {
  const { selectedNodeId, isInClass } = opts
  const sz = nodeSize(d)
  const sel = d.data.id === selectedNodeId
  const color = d.data.color || '#4A90D9'
  const btnY = sz.h - 14

  // background
  el.append('rect')
    .attr('width', sz.w).attr('height', sz.h).attr('rx', 10)
    .attr('fill', color)
    .attr('stroke', sel ? '#FFD700' : 'rgba(255,255,255,0.3)')
    .attr('stroke-width', sel ? 3 : 2)
    .attr('opacity', 0.95)
    .style('pointer-events', 'none')

  // label
  el.append('text')
    .attr('x', sz.w / 2).attr('y', 24).attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('font-size', sel ? '14px' : '13px').attr('font-weight', '700')
    .style('pointer-events', 'none')
    .text(truncate(d.data.label || '', 20))

  // separator
  el.append('line')
    .attr('x1', 10).attr('y1', 34).attr('x2', sz.w - 10).attr('y2', 34)
    .attr('stroke', 'rgba(255,255,255,0.35)').attr('stroke-width', 1)
    .style('pointer-events', 'none')

  // content preview (expanded)
  if (d.data.expanded && d.data.content) {
    drawContentPreview(el, d.data.content, sz)
  }

  return { btnY, sz }
}

function truncate(s, max) {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s
}

function drawContentPreview(el, content, sz) {
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

/**
 * Append drag handle (top-right) and return the <g> selection.
 */
export function drawDragHandle(el, sz) {
  const dh = el.append('g')
    .attr('class', 'drag-handle')
    .attr('transform', `translate(${sz.w - 26}, 2)`)
    .style('cursor', 'grab')

  dh.append('rect')
    .attr('width', 24).attr('height', 20).attr('rx', 4)
    .attr('fill', 'rgba(255,255,255,0.18)')
    .attr('stroke', 'rgba(255,255,255,0.3)')
    .attr('stroke-width', 1)

  // 2x3 dot grid
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++)
      dh.append('circle')
        .attr('cx', 7 + c * 5).attr('cy', 7 + r * 5).attr('r', 1.2)
        .attr('fill', 'rgba(255,255,255,0.7)')
        .style('pointer-events', 'none')

  return dh
}

/**
 * Append expand-content button (bottom-left) and return the <g> selection.
 */
export function drawExpandBtn(el, d, btnY) {
  const btn = el.append('g')
    .attr('class', 'btn-expand')
    .attr('transform', `translate(2, ${btnY - 10})`)
    .style('cursor', 'pointer')

  btn.append('rect')
    .attr('width', 24).attr('height', 20).attr('rx', 4)
    .attr('fill', 'rgba(255,255,255,0.2)')

  btn.append('text')
    .attr('x', 12).attr('y', 14).attr('text-anchor', 'middle')
    .attr('fill', '#fff').attr('font-size', '11px').attr('font-weight', 'bold')
    .style('pointer-events', 'none')
    .text(d.data.expanded ? '[-]' : '[+]')

  return btn
}

/**
 * Append collapse-children button (bottom-right) if node has kids.
 * Returns the <g> selection or null.
 */
export function drawCollapseBtn(el, d, sz, btnY) {
  const hasKids =
    (d.children && d.children.length > 0) ||
    (d._children && d._children.length > 0)
  if (!hasKids) return null

  const btn = el.append('g')
    .attr('class', 'btn-collapse')
    .attr('transform', `translate(${sz.w - 28}, ${btnY - 10})`)
    .style('cursor', 'pointer')

  btn.append('rect')
    .attr('width', 24).attr('height', 20).attr('rx', 4)
    .attr('fill', 'rgba(255,255,255,0.2)')

  btn.append('text')
    .attr('x', 12).attr('y', 14).attr('text-anchor', 'middle')
    .attr('fill', '#fff').attr('font-size', '11px').attr('font-weight', 'bold')
    .style('pointer-events', 'none')
    .text(d.data.collapsed ? '\u25b6' : '\u25bc')

  return btn
}

/**
 * Draw child count label.
 */
export function drawChildCount(el, d, sz, btnY) {
  const cc = d.data.children ? d.data.children.length : 0
  if (cc === 0) return
  el.append('text')
    .attr('x', sz.w / 2).attr('y', btnY + 4).attr('text-anchor', 'middle')
    .attr('fill', 'rgba(255,255,255,0.65)').attr('font-size', '10px')
    .style('pointer-events', 'none')
    .text(cc + ' children')
}

/**
 * Append resize handle (bottom-right) and return the <g> selection.
 */
export function drawResizeHandle(el, sz) {
  const rh = el.append('g')
    .attr('class', 'resize-handle')
    .attr('transform', `translate(${sz.w - 14}, ${sz.h - 14})`)
    .style('cursor', 'nwse-resize')

  rh.append('rect')
    .attr('width', 14).attr('height', 14).attr('rx', 3)
    .attr('fill', 'rgba(255,255,255,0.25)')

  rh.append('line')
    .attr('x1', 4).attr('y1', 11).attr('x2', 11).attr('y2', 4)
    .attr('stroke', 'rgba(255,255,255,0.5)').attr('stroke-width', 1.5)
    .style('pointer-events', 'none')

  rh.append('line')
    .attr('x1', 7).attr('y1', 11).attr('x2', 11).attr('y2', 7)
    .attr('stroke', 'rgba(255,255,255,0.5)').attr('stroke-width', 1.5)
    .style('pointer-events', 'none')

  return rh
}
