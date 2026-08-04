// ── Node interaction wiring (drag, resize, click) ──
// Uses native pointer events for reliable cross-browser behavior.
// d3.drag is avoided because it conflicts with d3.zoom on the same SVG.

import * as d3 from 'd3'
import { nodeSize, nodeCenter } from './useNodeDrawing.js'

const MIN_W = 100, MAX_W = 600, MIN_H = 40, MAX_H = 800

/**
 * Wire all interactions on a single node <g>.
 */
export function wireNodeInteractions(el, d, ctx) {
  const { svgEl, g, emit, updateLinks, updateLinksResize } = ctx

  // ── drag (top-right handle) ──
  const dh = el.select('.drag-handle').node()
  if (dh) {
    wirePointerDrag(dh, {
      onStart() {
        dh.style.cursor = 'grabbing'
        el.raise()
      },
      onMove(dx, dy, ev) {
        const pt = svgEl.createSVGPoint()
        pt.x = ev.clientX; pt.y = ev.clientY
        const ctm = g.node().getScreenCTM()
        if (!ctm) return
        const svgPt = pt.matrixTransform(ctm.inverse())
        const sz2 = nodeSize(d)
        el.attr('transform', `translate(${svgPt.x - sz2.w / 2}, ${svgPt.y - sz2.h / 2})`)
        updateLinks(d.data.id, svgPt.x, svgPt.y)
        // Broadcast drag preview for remote collaborators
        emit('move-node-preview', d.data.id, svgPt.x, svgPt.y)
      },
      onEnd(dx, dy, ev) {
        dh.style.cursor = 'grab'
        const pt = svgEl.createSVGPoint()
        pt.x = ev.clientX; pt.y = ev.clientY
        const ctm = g.node().getScreenCTM()
        if (!ctm) return
        const svgPt = pt.matrixTransform(ctm.inverse())
        emit('move-node', d.data.id, svgPt.x, svgPt.y)
      }
    })
  }

  // ── resize (bottom-right handle) ──
  const rh = el.select('.resize-handle').node()
  if (rh) {
    let sW, sH
    wirePointerDrag(rh, {
      onStart() {
        const sz2 = nodeSize(d)
        sW = sz2.w; sH = sz2.h
      },
      onMove(dx, dy) {
        const nw = Math.max(MIN_W, Math.min(MAX_W, sW + dx))
        const nh = Math.max(MIN_H, Math.min(MAX_H, sH + dy))
        // Update all visual elements
        updateNodeVisuals(el, d, nw, nh)
        d3.select(rh).attr('transform', `translate(${nw - 14}, ${nh - 14})`)
        updateLinksResize(d.data.id, nw, nh)
      },
      onEnd(dx, dy) {
        const nw = Math.max(MIN_W, Math.min(MAX_W, sW + dx))
        const nh = Math.max(MIN_H, Math.min(MAX_H, sH + dy))
        emit('resize-node', d.data.id, nw, nh)
      }
    })
  }
}

/* ── Native pointer drag helper ─────────────────────────────── */

/**
 * Update all visual elements of a node during resize.
 * Must match the structure created by drawNode() in useNodeDrawing.js.
 */
function updateNodeVisuals(el, d, nw, nh) {
  // background rect
  el.select('rect').attr('width', nw).attr('height', nh)

  // label: x = nw/2, y = 24
  el.selectAll('text').filter(function () {
    return this.getAttribute('font-weight') === '700'
  }).attr('x', nw / 2)

  // separator line
  el.selectAll('line').filter(function () {
    return this.getAttribute('y1') === '34'
  }).attr('x2', nw - 10)

  // content preview background (if expanded)
  el.selectAll('rect').filter(function () {
    return this.getAttribute('y') === '34'
  }).attr('width', nw).attr('height', nh - 34)

  // drag handle
  el.select('.drag-handle').attr('transform', `translate(${nw - 26}, 2)`)

  // collapse btn
  el.select('.btn-collapse').attr('transform', `translate(${nw - 28}, ${nh - 24})`)

  // child count
  el.selectAll('text').filter(function () {
    return this.getAttribute('font-size') === '10px'
  }).attr('x', nw / 2).attr('y', nh - 10)

  // expand btn
  el.select('.btn-expand').attr('transform', `translate(2, ${nh - 24})`)

  // resize handle
  el.select('.resize-handle').attr('transform', `translate(${nw - 14}, ${nh - 14})`)
}

function wirePointerDrag(el, { onStart, onMove, onEnd }) {
  let startX, startY, lastX, lastY, dragging = false

  function onPointerDown(e) {
    e.stopPropagation()
    e.preventDefault()
    startX = e.clientX
    startY = e.clientY
    lastX = startX
    lastY = startY
    dragging = true
    el.setPointerCapture(e.pointerId)
    if (onStart) onStart()
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e) {
    if (!dragging) return
    lastX = e.clientX
    lastY = e.clientY
    const dx = lastX - startX
    const dy = lastY - startY
    if (onMove) onMove(dx, dy, e)
  }

  function onPointerUp(e) {
    if (!dragging) return
    dragging = false
    const dx = lastX - startX
    const dy = lastY - startY
    el.releasePointerCapture(e.pointerId)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    if (onEnd) onEnd(dx, dy, e)
  }

  el.addEventListener('pointerdown', onPointerDown)
}

/* ── SVG class helpers ──────────────────────────────────────── */

export function isInClass(el, cls, stopAt) {
  let cur = el
  while (cur && cur !== stopAt) {
    if (hasClass(cur, cls)) return true
    cur = cur.parentNode
  }
  return false
}

function hasClass(el, cls) {
  try {
    return el && el.getAttribute && el.getAttribute('class') === cls
  } catch (e) { return false }
}

export function isInteractiveTarget(el, stopAt) {
  return (
    isInClass(el, 'drag-handle', stopAt) ||
    isInClass(el, 'btn-expand', stopAt) ||
    isInClass(el, 'btn-collapse', stopAt) ||
    isInClass(el, 'resize-handle', stopAt)
  )
}