// ── Undo/Redo manager ──
// Wraps Y.UndoManager for the tree Y.Map.
// Supports undo/redo of node operations (add, delete, move, resize, update label/color).
// Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo)

import { ref, onUnmounted } from 'vue'
import * as Y from 'yjs'

export function useUndo(ydoc, treeMap) {
  const undoManager = ref(null)
  const canUndo = ref(false)
  const canRedo = ref(false)
  const undoStackSize = ref(0)
  const redoStackSize = ref(0)

  function init() {
    if (!ydoc || !treeMap) {
      setTimeout(init, 300)
      return
    }

    const nodesMap = treeMap.get('nodes')
    if (!nodesMap) {
      setTimeout(init, 300)
      return
    }

    const um = new Y.UndoManager([nodesMap, treeMap], {
      trackedOrigins: new Set([null]),
      captureTimeout: 500,
    })

    um.on('stack-item-added', updateState)
    um.on('stack-item-popped', updateState)

    // Also observe ydoc for any change — this catches transactions
    ydoc.on('update', updateState)

    undoManager.value = um
    updateState()

    // Poll regularly as a fallback (UndoManager events can be unreliable with y-websocket)
    const pollInterval = setInterval(updateState, 1000)
    onUnmounted(() => clearInterval(pollInterval))
  }

  function updateState() {
    if (!undoManager.value) return
    canUndo.value = undoManager.value.canUndo()
    canRedo.value = undoManager.value.canRedo()
    undoStackSize.value = undoManager.value.undoStack.length
    redoStackSize.value = undoManager.value.redoStack.length
  }

  function updateState() {
    if (!undoManager.value) return
    canUndo.value = undoManager.value.undoStack.length > 0
    canRedo.value = undoManager.value.redoStack.length > 0
    undoStackSize.value = undoManager.value.undoStack.length
    redoStackSize.value = undoManager.value.redoStack.length
  }

  function undo() {
    if (undoManager.value && canUndo.value) {
      undoManager.value.undo()
    }
  }

  function redo() {
    if (undoManager.value && canRedo.value) {
      undoManager.value.redo()
    }
  }

  function clear() {
    if (undoManager.value) {
      undoManager.value.clear()
      updateState()
    }
  }

  // ── Keyboard handler ──
  function handleKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
      return true
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      redo()
      return true
    }
    return false
  }

  return {
    undoManager,
    canUndo,
    canRedo,
    undoStackSize,
    redoStackSize,
    init,
    undo,
    redo,
    clear,
    handleKeydown,
  }
}