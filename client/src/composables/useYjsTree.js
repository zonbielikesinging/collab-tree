import { ref, shallowRef, onUnmounted } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { nanoid } from 'nanoid'

// Auto-detect WS URL from current page location (for remote sharing)
// In production mode, WS and HTTP are on the same port
function detectWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const host = window.location.host || 'localhost:1234'
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${host}`
}
const WS_URL = detectWsUrl()
const ROOM_NAME = 'default-tree'

const DEFAULTS = Object.freeze({
  label: '新节点', color: '#666666', content: '',
  collapsed: false, expanded: false,
  width: 180, height: 56, x: null, y: null
})

/**
 * Build a plain JS tree node from Yjs data.
 * Applies defaults for missing fields (read-only, no write-back).
 */
function buildTree(nodesMap, id) {
  const node = nodesMap.get(id)
  if (!node) return null
  const raw = node.toJSON()
  const merged = { ...DEFAULTS, ...raw }
  merged.children = (raw.children || []).map(cid => buildTree(nodesMap, cid)).filter(Boolean)
  return merged
}

function findParentId(nodesMap, childId) {
  for (const [nodeId, node] of nodesMap) {
    const children = node.get('children')
    if (children.toArray().includes(childId)) return nodeId
  }
  return null
}

export function useYjsTree(roomRef) {
  // ── Resolve room name ──
  const roomName = typeof roomRef === 'string' ? roomRef : (roomRef?.value || ROOM_NAME)

  // ── Yjs doc + providers ──────────────────────────────────────────
  const ydoc = new Y.Doc()
  const wsProvider = new WebsocketProvider(WS_URL, roomName, ydoc, { connect: true, maxBackoffTime: 10_000 })
  const idbPersistence = new IndexeddbPersistence(roomName, ydoc)
  const connected = ref(false)
  const synced = ref(false)

  wsProvider.on('status', ({ status }) => { connected.value = status === 'connected' })
  wsProvider.on('synced', (state) => { synced.value = state })

  const treeMap = ydoc.getMap('tree')
  let nodesMap = treeMap.get('nodes')

  // ── One-time init: after IndexedDB loads, create default if empty ──
  let initialised = false
  const initTree = () => {
    if (initialised) return
    initialised = true
    // Refresh nodesMap reference (may have been replaced by IndexedDB)
    nodesMap = treeMap.get('nodes')
    const rid = treeMap.get('rootId')
    if (!nodesMap || nodesMap.size === 0 || !rid || !nodesMap.has(rid)) {
      ydoc.transact(() => {
        const newNodesMap = new Y.Map()
        const newRootId = nanoid()
        const rootNode = new Y.Map()
        rootNode.set('id', newRootId)
        rootNode.set('label', '根节点')
        rootNode.set('color', '#4A90D9')
        rootNode.set('content', '# 欢迎 🌲\n\n点击节点编辑 | 拖拽移动 | 右下角缩放')
        rootNode.set('collapsed', false)
        rootNode.set('expanded', false)
        rootNode.set('width', 220)
        rootNode.set('height', 56)
        rootNode.set('x', null)
        rootNode.set('y', null)
        rootNode.set('children', new Y.Array())
        newNodesMap.set(newRootId, rootNode)
        treeMap.set('nodes', newNodesMap)
        treeMap.set('rootId', newRootId)
        nodesMap = newNodesMap
      })
    }
    // Always sync rootId from treeMap
    rootId.value = treeMap.get('rootId')
    forceRefresh()
  }

  idbPersistence.on('synced', initTree)
  // Fallback: if already synced or no IDB data, init after 500ms
  setTimeout(initTree, 500)

  // ── Reactive state ────────────────────────────────────────────────
  const treeData = shallowRef(null)
  const selectedNodeId = ref(null)
  const rootId = ref(treeMap.get('rootId'))

  // ── Build tree snapshot (never returns null if root exists) ───────
  function toTreeData() {
    const nm = nodesMap || treeMap.get('nodes')
    if (!nm) return null
    const rid = treeMap.get('rootId')
    if (!rid || !nm.has(rid)) return null
    return buildTree(nm, rid)
  }

  function forceRefresh() {
    const td = toTreeData()
    if (td !== null) treeData.value = td
  }

  // ── observeDeep on treeMap, but only update treeData when valid ───
  let refreshTimer = null
  function scheduleRefresh() {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      const td = toTreeData()
      // CRITICAL: never set treeData to null if we already have data
      if (td !== null) {
        treeData.value = td
      }
    }, 0)
  }

  treeMap.observeDeep(() => scheduleRefresh())

  // Initial build
  forceRefresh()

  // ── CRUD operations ───────────────────────────────────────────────
  function getNode(id) { return nodesMap.get(id) }

  function addNode(parentId, label = '新节点') {
    if (!nodesMap) return null
    const parent = nodesMap.get(parentId)
    if (!parent) return null
    const id = nanoid()
    const newNode = new Y.Map()
    ydoc.transact(() => {
      newNode.set('id', id)
      newNode.set('label', label)
      newNode.set('color', DEFAULTS.color)
      newNode.set('content', '')
      newNode.set('collapsed', false)
      newNode.set('expanded', false)
      newNode.set('width', DEFAULTS.width)
      newNode.set('height', DEFAULTS.height)
      newNode.set('x', null)
      newNode.set('y', null)
      newNode.set('children', new Y.Array())
      nodesMap.set(id, newNode)
      parent.get('children').push([id])
    })
    return id
  }

  function updateNode(id, updates) {
    const node = nodesMap?.get(id)
    if (!node) return
    ydoc.transact(() => {
      for (const [key, value] of Object.entries(updates)) {
        node.set(key, value)
      }
    })
  }

  function toggleCollapse(id) {
    const node = nodesMap?.get(id)
    if (node) node.set('collapsed', !node.get('collapsed'))
  }

  function toggleExpand(id) {
    const node = nodesMap?.get(id)
    if (node) node.set('expanded', !node.get('expanded'))
  }

  function moveNode(id, x, y) {
    const node = nodesMap?.get(id)
    if (node) {
      ydoc.transact(() => {
        node.set('x', Math.round(x))
        node.set('y', Math.round(y))
      })
    }
  }

  function resetNodePosition(id) {
    const node = nodesMap?.get(id)
    if (node) {
      ydoc.transact(() => {
        node.set('x', null)
        node.set('y', null)
      })
    }
  }

  function resizeNode(id, width, height) {
    const node = nodesMap?.get(id)
    if (!node) return
    const newW = width != null ? Math.max(100, Math.min(600, Math.round(width))) : null
    const newH = height != null ? Math.max(40, Math.min(800, Math.round(height))) : null
    ydoc.transact(() => {
      if (newW != null) node.set('width', newW)
      if (newH != null) node.set('height', newH)
    })
    forceRefresh()
  }

  function deleteNode(id) {
    const node = nodesMap?.get(id)
    if (!node) return
    ydoc.transact(() => {
      const children = node.get('children').toArray()
      for (const childId of children) deleteNode(childId)
      const parentId = findParentId(nodesMap, id)
      if (parentId) {
        const parent = nodesMap.get(parentId)
        const siblings = parent.get('children')
        const idx = siblings.toArray().indexOf(id)
        if (idx >= 0) siblings.delete(idx, 1)
      }
      nodesMap.delete(id)
    })
  }

  function findParent(childId) { return findParentId(nodesMap, childId) }

  function destroy() {
    clearTimeout(refreshTimer)
    wsProvider.destroy()
    idbPersistence.destroy()
    ydoc.destroy()
  }

  onUnmounted(() => destroy())

  return {
    ydoc, wsProvider, connected, synced,
    treeData, selectedNodeId, rootId, treeMap,
    getNode, toTreeData, forceRefresh,
    addNode, updateNode, deleteNode, findParent,
    toggleCollapse, toggleExpand, moveNode, resetNodePosition, resizeNode,
    destroy
  }
}