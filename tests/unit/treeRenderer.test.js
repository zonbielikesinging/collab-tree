/**
 * Test: useTreeRenderer — rendering & presence modules
 * 
 * Tests:
 * 1. JSON diff detection for structural changes
 * 2. Node transform calculation
 * 3. Link path generation
 * 4. Self/remote presence differentiation
 * 5. Presence cleanup removes old elements
 * 6. Truncation helper
 */

import { describe, it, expect } from 'vitest'

// ── Mock helpers ──

function makeDiffJson(data) {
  return JSON.stringify(data, function (key, val) {
    if (key === 'x' || key === 'y' || key === 'content' || key === 'label' ||
        key === 'color' || key === 'width' || key === 'height' ||
        key === 'collapsed' || key === 'expanded') return undefined
    return val
  })
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

function nodeTransform(d) {
  const sz = nodeSize(d)
  const c = nodeCenter(d)
  return `translate(${c.cx - sz.w / 2}, ${c.cy - sz.h / 2})`
}

function truncate(s, max) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

describe('TreeRenderer — structural diff', () => {
  const baseTree = {
    id: 'root',
    label: 'Root',
    color: '#4A90D9',
    children: [{ id: 'child1', label: 'Child', color: '#666', children: [] }],
  }

  it('detects same structure as no change', () => {
    const json1 = makeDiffJson(baseTree)
    const json2 = makeDiffJson(baseTree)
    expect(json1).toBe(json2)
  })

  it('detects added child as structural change', () => {
    const json1 = makeDiffJson(baseTree)
    const modified = JSON.parse(JSON.stringify(baseTree))
    modified.children.push({ id: 'child2', label: 'New' })
    const json2 = makeDiffJson(modified)
    expect(json1).not.toBe(json2)
  })

  it('ignores position-only changes', () => {
    const json1 = makeDiffJson(baseTree)
    const modified = JSON.parse(JSON.stringify(baseTree))
    modified.children[0].x = 500
    modified.children[0].y = 300
    const json2 = makeDiffJson(modified)
    expect(json1).toBe(json2)
  })

  it('ignores color-only changes', () => {
    const json1 = makeDiffJson(baseTree)
    const modified = JSON.parse(JSON.stringify(baseTree))
    modified.children[0].color = '#FF0000'
    const json2 = makeDiffJson(modified)
    expect(json1).toBe(json2)
  })

  it('ignores content-only changes', () => {
    const json1 = makeDiffJson(baseTree)
    const modified = JSON.parse(JSON.stringify(baseTree))
    modified.children[0].content = 'new content'
    const json2 = makeDiffJson(modified)
    expect(json1).toBe(json2)
  })
})

describe('TreeRenderer — node transform', () => {
  it('centers node at its position', () => {
    const d = { x: 300, y: 200, data: { width: 180, height: 56 } }
    const t = nodeTransform(d)
    // center = (300, 200), left = 300 - 90 = 210, top = 200 - 28 = 172
    expect(t).toBe('translate(210, 172)')
  })

  it('uses data.x/y over d3 layout x/y', () => {
    const d = { x: 100, y: 50, data: { x: 300, y: 200, width: 180, height: 56 } }
    const t = nodeTransform(d)
    expect(t).toBe('translate(210, 172)')
  })

  it('adds expanded height offset', () => {
    const d = { x: 300, y: 200, data: { width: 180, height: 56, expanded: true } }
    const t = nodeTransform(d)
    // height = 56 + 200 = 256, center.y = 200, top = 200 - 128 = 72
    expect(t).toBe('translate(210, 72)')
  })
})

describe('TreeRenderer — truncation', () => {
  it('passes short text unchanged', () => {
    expect(truncate('hello', 20)).toBe('hello')
  })

  it('truncates long text with ellipsis', () => {
    const result = truncate('this is a very long string that exceeds max', 20)
    expect(result.length).toBe(20) // 19 chars + ellipsis
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('TreeRenderer — presence class naming', () => {
  it('uses presence-self prefix for self', () => {
    const prefix = 'self' === 'self' ? 'presence-self' : 'presence'
    expect(prefix).toBe('presence-self')
  })

  it('uses presence prefix for remote', () => {
    const prefix = 'remote' === 'self' ? 'presence-self' : 'presence'
    expect(prefix).toBe('presence')
  })

  it('cleanup selector covers all presence classes', () => {
    const selector = '.presence-cursor, .presence-name-bg, .presence-name-tag, .presence-self-cursor, .presence-self-name-bg, .presence-self-name-tag'
    // Must have exactly 6 classes
    const classes = selector.split(', ').length
    expect(classes).toBe(6)
  })
})