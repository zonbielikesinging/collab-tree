// ── Canvas management ──
// Persists canvas list to localStorage (cache) + server API (source of truth).
// Each canvas maps to a Yjs room name.

const STORAGE_KEY = 'collabtree_canvases'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:1234'

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!res.ok) {
      console.warn(`[canvases] API ${options.method || 'GET'} ${path} failed: ${res.status}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.warn(`[canvases] API ${path} error:`, err.message)
    return null
  }
}

export function useCanvases() {
  // ── Local cache ──
  function loadCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  function saveCache(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }

  // ── Server sync ──
  async function syncToServer(canvas) {
    return apiFetch('/api/canvases', {
      method: 'POST',
      body: JSON.stringify(canvas),
    })
  }

  async function deleteFromServer(id) {
    return apiFetch(`/api/canvases/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  }

  async function patchServer(id, patch) {
    return apiFetch(`/api/canvases/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }

  // ── CRUD ──
  async function listCanvases() {
    // Try server first
    const serverList = await apiFetch('/api/canvases')
    if (serverList && Array.isArray(serverList) && serverList.length > 0) {
      saveCache(serverList)
      return serverList
    }
    // Fallback to local cache
    return loadCache()
  }

  function getCanvas(id) {
    return loadCache().find(c => c.id === id) || null
  }

  async function createCanvas(name = '新画布') {
    const list = loadCache()
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const room = `canvas-${id}`
    const canvas = {
      id, name, room,
      createdAt: new Date().toISOString(),
      nodeCount: 0,
    }
    list.push(canvas)
    saveCache(list)

    // Sync to server
    syncToServer(canvas).catch(() => {})
    return canvas
  }

  async function deleteCanvas(id) {
    const list = loadCache().filter(c => c.id !== id)
    saveCache(list)

    // Delete from server
    deleteFromServer(id).catch(() => {})

    // Clear IndexedDB
    try {
      const room = `canvas-${id}`
      const dbName = `yjs-${room}`
      indexedDB.deleteDatabase(dbName)
    } catch (_) {}
    return list
  }

  async function renameCanvas(id, newName) {
    const list = loadCache()
    const canvas = list.find(c => c.id === id)
    if (canvas) {
      canvas.name = newName
      saveCache(list)
      patchServer(id, { name: newName }).catch(() => {})
    }
    return canvas
  }

  async function updateNodeCount(id, count) {
    const list = loadCache()
    const canvas = list.find(c => c.id === id)
    if (canvas) {
      canvas.nodeCount = count
      saveCache(list)
      // No need to sync nodeCount to server immediately — debounced
    }
  }

  return {
    listCanvases,
    getCanvas,
    createCanvas,
    deleteCanvas,
    renameCanvas,
    updateNodeCount,
  }
}