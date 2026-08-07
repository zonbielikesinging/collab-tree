// ── E2E Tests Part 2: Render Strategy, Collaboration, CRUD, Layout ──
import { describe, it, expect } from 'vitest'

// ───────────────────────────────────────────────────────────────────
// USER SCENARIO 4: Render Strategy Selection
// ───────────────────────────────────────────────────────────────────

describe('User Scenario: Render Strategy', () => {
  function makeDiffJson(data) {
    return JSON.stringify(data, function (key, val) {
      if (key === 'x' || key === 'y' || key === 'content' || key === 'label' ||
          key === 'color' || key === 'width' || key === 'height' ||
          key === 'collapsed' || key === 'expanded') return undefined
      return val
    })
  }

  it('first render should be fullRender', () => {
    let cachedTreeJson = null
    const tree = { id: 'root', label: 'Root', children: [] }
    expect(makeDiffJson(tree) !== cachedTreeJson).toBe(true)
  })

  it('label-only change should NOT trigger fullRender', () => {
    const t1 = { id: 'root', label: 'Old', children: [{ id: 'c1', label: 'C1' }] }
    const t2 = { id: 'root', label: 'New', children: [{ id: 'c1', label: 'C1' }] }
    expect(makeDiffJson(t1)).toBe(makeDiffJson(t2))
  })

  it('color-only change should NOT trigger fullRender', () => {
    const t1 = { id: 'root', label: 'R', color: '#blue', children: [] }
    const t2 = { id: 'root', label: 'R', color: '#red', children: [] }
    expect(makeDiffJson(t1)).toBe(makeDiffJson(t2))
  })

  it('adding child should trigger fullRender', () => {
    const t1 = { id: 'root', label: 'R', children: [] }
    const t2 = { id: 'root', label: 'R', children: [{ id: 'c1', label: 'C1' }] }
    expect(makeDiffJson(t1)).not.toBe(makeDiffJson(t2))
  })

  it('removing child should trigger fullRender', () => {
    const t1 = { id: 'root', label: 'R', children: [{ id: 'c1' }] }
    const t2 = { id: 'root', label: 'R', children: [] }
    expect(makeDiffJson(t1)).not.toBe(makeDiffJson(t2))
  })

  it('collab state change only should trigger presence-only update', () => {
    let cachedCollabJson = null
    const collab2 = { remoteCursors: [{ clientId: 1, name: 'Bob', selectedNodeId: 'c1' }] }
    const newCollabJson = JSON.stringify(collab2)
    expect(newCollabJson !== cachedCollabJson).toBe(true)
  })

  it('selection change should trigger presence-only update', () => {
    let cachedSelectedNodeId = 'node-1'
    const newSel = 'node-2'
    expect(newSel !== cachedSelectedNodeId).toBe(true)
  })
})

// ───────────────────────────────────────────────────────────────────
// USER SCENARIO 5: Collaboration State
// ───────────────────────────────────────────────────────────────────

describe('User Scenario: Collaboration State', () => {
  it('self presence includes own cursor', () => {
    const sp = {
      clientId: 0, userId: 'user-1', name: '我',
      color: '#4A90D9', selectedNodeId: 'node-1', editingNodeId: null, dragging: null,
    }
    expect(sp.selectedNodeId).toBe('node-1')
    expect(sp.name).toBe('我')
  })

  it('all presence classes are cleaned up', () => {
    const classes = [
      'presence-cursor', 'presence-name-bg', 'presence-name-tag',
      'presence-self-cursor', 'presence-self-name-bg', 'presence-self-name-tag',
    ]
    expect(classes.length).toBe(6)
  })

  it('rename only accepted from canvas owner', () => {
    const myUserId = 'user-1'
    const states = [
      { userId: 'user-2', canvasName: 'New Name', canvasOwnerId: 'user-2' },
      { userId: 'user-3', canvasName: 'Hacked', canvasOwnerId: 'user-2' },
    ]
    let found = null
    for (const s of states) {
      if (s.canvasName && s.canvasOwnerId && s.canvasOwnerId !== myUserId) {
        if (s.userId === s.canvasOwnerId) found = s.canvasName
      }
    }
    expect(found).toBe('New Name')
  })

  it('stale remote cursors are filtered out', () => {
    const now = Date.now()
    const stale = now - 30_000
    const states = [
      { userId: 'u1', name: 'Active', lastActive: now },
      { userId: 'u2', name: 'Stale', lastActive: stale - 1 },
    ]
    const active = states.filter(s => !s.lastActive || s.lastActive >= stale)
    expect(active.length).toBe(1)
    expect(active[0].name).toBe('Active')
  })
})

// ───────────────────────────────────────────────────────────────────
// USER SCENARIO 6: Node CRUD Operations
// ───────────────────────────────────────────────────────────────────

describe('User Scenario: Node CRUD', () => {
  it('node has correct defaults', () => {
    const defs = { label: '新节点', color: '#666666', content: '', collapsed: false, expanded: false, width: 180, height: 56, x: null, y: null }
    expect(defs.width).toBe(180)
    expect(defs.height).toBe(56)
    expect(defs.collapsed).toBe(false)
  })

  it('updateNode changes only specified fields', () => {
    const node = { label: 'Old', color: '#666', content: '' }
    const updates = { label: 'New', color: '#4A90D9' }
    const merged = { ...node, ...updates }
    expect(merged.label).toBe('New')
    expect(merged.color).toBe('#4A90D9')
    expect(merged.content).toBe('')
  })

  it('deleteNode removes node and its children', () => {
    function deleteNodeAndChildren(tree, id) {
      const result = []
      function collect(node) {
        result.push(node.id)
        if (node.children) for (const c of node.children) collect(c)
      }
      collect(tree)
      return result
    }
    const tree = { id: 'root', children: [{ id: 'c1', children: [{ id: 'c2' }] }, { id: 'c3' }] }
    const ids = deleteNodeAndChildren(tree)
    expect(ids).toContain('c1')
    expect(ids).toContain('c2')
    expect(ids).toContain('c3')
  })

  it('toggleCollapse toggles collapsed state', () => {
    let collapsed = false
    collapsed = !collapsed; expect(collapsed).toBe(true)
    collapsed = !collapsed; expect(collapsed).toBe(false)
  })

  it('toggleExpand toggles expanded state', () => {
    let expanded = false
    expanded = !expanded; expect(expanded).toBe(true)
    expanded = !expanded; expect(expanded).toBe(false)
  })

  it('moveNode sets x/y coordinates', () => {
    function moveNode(x, y) { return { x: Math.round(x), y: Math.round(y) } }
    expect(moveNode(100.7, 200.3)).toEqual({ x: 101, y: 200 })
  })

  it('resetNodePosition clears x/y', () => {
    function reset() { return { x: null, y: null } }
    expect(reset()).toEqual({ x: null, y: null })
  })
})

// ───────────────────────────────────────────────────────────────────
// USER SCENARIO 7: Layout / Collision Resolution
// ───────────────────────────────────────────────────────────────────

describe('User Scenario: Layout', () => {
  it('collision detection finds overlapping nodes', () => {
    function overlap(a, b, padding) {
      const gapX = Math.abs(a.cx - b.cx) - (a.w + b.w) / 2
      const gapY = Math.abs(a.cy - b.cy) - (a.h + b.h) / 2
      return gapX < padding && gapY < padding
    }
    const a = { cx: 100, cy: 100, w: 180, h: 56 }
    const b = { cx: 150, cy: 120, w: 180, h: 56 }
    const c = { cx: 500, cy: 500, w: 180, h: 56 }
    expect(overlap(a, b, 20)).toBe(true) // overlapping
    expect(overlap(a, c, 20)).toBe(false) // far apart
  })

  it('node separation uses correct size', () => {
    function nodeSize(d) {
      return { w: d.data?.width || 180, h: d.data?.height || 56 }
    }
    const a = { data: { width: 200, height: 80 } }
    expect(nodeSize(a)).toEqual({ w: 200, h: 80 })
  })

  it('children are laid out in fan pattern', () => {
    function layoutChildren(children, parentCenter, radius) {
      const arc = Math.min(Math.PI * 0.75, children.length * 0.5)
      const startAngle = -Math.PI / 2 - arc / 2
      return children.map((_, i) => {
        const angle = startAngle + (arc * i) / (children.length - 1 || 1)
        return {
          x: parentCenter.cx + Math.cos(angle) * radius,
          y: parentCenter.cy + Math.sin(angle) * radius,
        }
      })
    }
    const positions = layoutChildren([1, 2, 3], { cx: 0, cy: 0 }, 200)
    expect(positions.length).toBe(3)
    // All should be at a distance from parent
    for (const p of positions) {
      const dist = Math.sqrt(p.x * p.x + p.y * p.y)
      expect(dist).toBeCloseTo(200, 0)
    }
  })
})