// ── Collaboration — Awareness, Remote Presence, Cursors ──
// Manages Yjs Awareness protocol for multi-user awareness:
// - Remote cursor positions (selected node, viewport)
// - Editing state (who is editing which node)
// - Dragging preview (real-time drag position before commit)
// - Online user list
// - Canvas name sync (owner broadcasts, others receive)

import { ref, computed, onUnmounted } from 'vue'

export function useCollaboration(providerRef, getIdentity) {
  // ── Reactive state ──
  const remoteUsers = ref([])
  const remoteCursors = ref([])
  const remoteEditingNodeIds = ref(new Set())
  const remoteDragging = ref([])
  const remoteSelectedNodeIds = ref([])
  const remoteCanvasName = ref(null)

  // Current user's own presence (so self sees own cursor/name on canvas)
  const selfPresence = ref(null)

  let awareness = null
  let localStateUpdateTimer = null
  let pendingLocalState = null

  // ── Initialize awareness when provider is ready ──
  function init() {
    const provider = typeof providerRef === 'function' ? providerRef() : providerRef?.value
    if (!provider) return false
    awareness = provider.awareness
    if (!awareness) return false

    // Set local state from identity (which is now a function that returns live values)
    const id = getIdentity()
    awareness.setLocalState({
      userId: id.userId,
      name: id.userName,
      color: id.userColor,
      initials: id.userInitials,
      selectedNodeId: null,
      editingNodeId: null,
      dragging: null,
      canvasOwnerId: null,
      canvasName: null,
      lastActive: Date.now()
    })

    // Listen for remote changes
    awareness.on('change', () => {
      const states = awareness.getStates()
      const now = Date.now()
      const stale = now - 30_000

      const users = []
      const cursors = []
      const editingIds = new Set()
      const dragging = []
      const selectedIds = []

      let selfState = null
      let foundCanvasName = null

      states.forEach((state, clientId) => {
        if (!state.userId) return

        if (clientId === awareness.clientID) {
          // Track self presence for canvas rendering
          selfState = {
            clientId,
            userId: state.userId,
            name: state.name || '我',
            color: state.color || '#4A90D9',
            selectedNodeId: state.selectedNodeId || null,
            editingNodeId: state.editingNodeId || null,
            dragging: state.dragging || null,
          }
          selfPresence.value = selfState
          return
        }

        if (state.lastActive && state.lastActive < stale) return

        users.push({
          clientId,
          userId: state.userId,
          name: state.name || '未知用户',
          color: state.color || '#999',
          initials: state.initials || (state.name ? state.name[0] : '?'),
          selectedNodeId: state.selectedNodeId || null,
          editingNodeId: state.editingNodeId || null,
          lastActive: state.lastActive || 0,
        })

        if (state.selectedNodeId) {
          cursors.push({
            clientId,
            userId: state.userId,
            name: state.name,
            color: state.color || '#999',
            selectedNodeId: state.selectedNodeId,
          })
          selectedIds.push(state.selectedNodeId)
        }

        if (state.editingNodeId) {
          editingIds.add(state.editingNodeId)
        }

        if (state.dragging) {
          dragging.push({
            clientId,
            userId: state.userId,
            name: state.name,
            color: state.color || '#999',
            nodeId: state.dragging.nodeId,
            x: state.dragging.x,
            y: state.dragging.y,
          })
        }

        // Only accept canvasName from the canvas owner
        if (state.canvasName && state.canvasOwnerId && state.canvasOwnerId !== getIdentity().userId) {
          foundCanvasName = state.canvasName
        }
      })

      remoteUsers.value = users
      remoteCursors.value = cursors
      remoteEditingNodeIds.value = editingIds
      remoteDragging.value = dragging
      remoteSelectedNodeIds.value = selectedIds

      if (foundCanvasName) {
        remoteCanvasName.value = foundCanvasName
      }
    })

    return true
  }

  // ── Update local awareness state (batched via microtask, no throttle) ──
  function updateState(patch) {
    if (!awareness) return
    pendingLocalState = patch
    if (localStateUpdateTimer) return
    localStateUpdateTimer = setTimeout(() => {
      localStateUpdateTimer = null
      if (!pendingLocalState || !awareness) return
      const current = awareness.getLocalState() || {}
      awareness.setLocalState({ ...current, ...pendingLocalState, lastActive: Date.now() })
      pendingLocalState = null
    }, 0)
  }

  function setSelectedNode(nodeId) {
    updateState({ selectedNodeId: nodeId || null, editingNodeId: null, dragging: null })
  }

  function setEditingNode(nodeId) {
    updateState({ editingNodeId: nodeId || null })
  }

  function setDragging(nodeId, x, y) {
    if (nodeId) {
      updateState({ dragging: { nodeId, x, y } })
    } else {
      updateState({ dragging: null })
    }
  }

  function clearAll() {
    updateState({ selectedNodeId: null, editingNodeId: null, dragging: null })
  }

  function setCanvasName(name) {
    updateState({ canvasName: name })
  }

  function setCanvasOwnerId(ownerId) {
    updateState({ canvasOwnerId: ownerId })
  }

  // ── Computed helpers ──
  const onlineCount = computed(() => remoteUsers.value.length + 1)

  const isNodeBeingEdited = (nodeId) => {
    return remoteEditingNodeIds.value.has(nodeId)
  }

  const editorsForNode = (nodeId) => {
    return remoteUsers.value.filter(u => u.editingNodeId === nodeId)
  }

  // ── Cleanup ──
  function destroy() {
    clearTimeout(localStateUpdateTimer)
    if (awareness) {
      awareness.setLocalState(null)
    }
  }

  onUnmounted(() => destroy())

  return {
    remoteUsers,
    remoteCursors,
    remoteDragging,
    remoteSelectedNodeIds,
    remoteEditingNodeIds,
    remoteCanvasName,
    selfPresence,
    onlineCount,

    init,
    updateState,
    setSelectedNode,
    setEditingNode,
    setDragging,
    setCanvasName,
    setCanvasOwnerId,
    clearAll,

    isNodeBeingEdited,
    editorsForNode,

    destroy,
  }
}