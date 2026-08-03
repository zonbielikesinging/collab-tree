// ── Collaboration — Awareness, Remote Presence, Cursors ──
// Manages Yjs Awareness protocol for multi-user awareness:
// - Remote cursor positions (selected node, viewport)
// - Editing state (who is editing which node)
// - Dragging preview (real-time drag position before commit)
// - Online user list
//
// Awareness state per user:
// {
//   name: string,
//   color: string,
//   selectedNodeId: string | null,
//   editingNodeId: string | null,
//   dragging: { nodeId: string, x: number, y: number } | null,
//   cursor: { x: number, y: number } | null,
//   lastActive: number
// }

import { ref, shallowRef, computed, watch, onUnmounted } from 'vue'

const AWARENESS_THROTTLE_MS = 50

export function useCollaboration(providerRef, userIdentity) {
  const { userId, userName, userColor } = userIdentity

  // ── Reactive state ──
  const remoteUsers = ref([])        // Array of { clientId, name, color, ... }
  const remoteCursors = ref([])      // Cursor positions to render on SVG
  const remoteEditingNodeIds = ref(new Set()) // Nodes being edited by others
  const remoteDragging = ref([])     // Nodes being dragged by others
  const remoteSelectedNodeIds = ref([]) // Nodes selected by others

  let awareness = null
  let lastThrottledUpdate = 0

  // ── Initialize awareness when provider is ready ──
  function init() {
    const provider = typeof providerRef === 'function' ? providerRef() : providerRef?.value
    if (!provider) return false
    awareness = provider.awareness

    // Set local state
    awareness.setLocalState({
      userId,
      name: userName,
      color: userColor,
      initials: userIdentity.userInitials || userName[0],
      selectedNodeId: null,
      editingNodeId: null,
      dragging: null,
      lastActive: Date.now()
    })

    // Listen for remote changes
    awareness.on('change', () => {
      const states = awareness.getStates()
      const now = Date.now()
      const stale = now - 30_000 // 30s timeout

      const users = []
      const cursors = []
      const editingIds = new Set()
      const dragging = []
      const selectedIds = []

      states.forEach((state, clientId) => {
        if (clientId === awareness.clientID) return
        if (!state.userId) return
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
            color: state.color || '#999',
            nodeId: state.dragging.nodeId,
            x: state.dragging.x,
            y: state.dragging.y,
          })
        }
      })

      remoteUsers.value = users
      remoteCursors.value = cursors
      remoteEditingNodeIds.value = editingIds
      remoteDragging.value = dragging
      remoteSelectedNodeIds.value = selectedIds
    })

    return true
  }

  // ── Update local awareness state ──
  function updateState(patch) {
    if (!awareness) return
    const now = Date.now()
    // Throttle to avoid flooding
    if (now - lastThrottledUpdate < AWARENESS_THROTTLE_MS) return
    lastThrottledUpdate = now

    const current = awareness.getLocalState() || {}
    awareness.setLocalState({ ...current, ...patch, lastActive: now })
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
    if (awareness) {
      awareness.setLocalState(null)
    }
  }

  onUnmounted(() => destroy())

  return {
    // State
    remoteUsers,
    remoteCursors,
    remoteDragging,
    remoteSelectedNodeIds,
    remoteEditingNodeIds,
    onlineCount,

    // Actions
    init,
    updateState,
    setSelectedNode,
    setEditingNode,
    setDragging,
    clearAll,

    // Helpers
    isNodeBeingEdited,
    editorsForNode,

    destroy,
  }
}