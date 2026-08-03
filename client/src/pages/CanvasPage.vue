<template>
  <div class="app">
    <header class="toolbar">
      <div class="brand">
        <button class="back-btn" @click="goHome" title="返回首页">←</button>
        <span class="logo">🌲</span>
        <span v-if="!isEditingName" class="title" @dblclick="startEditName" :title="isOwner ? '双击重命名画布' : ''">
          {{ canvasName }}
        </span>
        <input
          v-else
          ref="nameInput"
          v-model="editName"
          class="name-input"
          @keydown.enter="confirmEditName"
          @keydown.escape="cancelEditName"
          @blur="confirmEditName"
        />
      </div>

      <!-- Save / Auto-save -->
      <div class="save-group">
        <button class="toolbar-btn" :class="{ active: autoSave }" @click="toggleAutoSave" title="自动保存">
          {{ autoSave ? '💾' : '📁' }}
        </button>
        <button class="toolbar-btn" @click="manualSave" title="手动保存">
          {{ saveStatus === 'saving' ? '⏳' : saveStatus === 'saved' ? '✅' : '⬇️' }}
        </button>
      </div>

      <div class="spacer"></div>

      <!-- Axis toggle -->
      <button class="toolbar-btn axis-btn" :class="{ active: showAxis }" @click="showAxis = !showAxis" :title="showAxis ? '隐藏坐标轴' : '显示坐标轴'">
        📐 <span class="axis-label">{{ showAxis ? '坐标轴' : '' }}</span>
      </button>

      <!-- Remote users -->
      <UserList
        :userName="userName"
        :userColor="userColor"
        :userInitials="userInitials"
        :remoteUsers="remoteUsers"
        :onlineCount="onlineCount"
      />

      <div class="status">
        <span class="dot" :class="{ synced, connected: connected && !synced }"></span>
        <span v-if="synced" class="status-text">已同步</span>
        <span v-else-if="connected" class="status-text">同步中…</span>
        <span v-else class="status-text offline">离线</span>
      </div>

      <button class="btn btn-outline" @click="openShareDialog" title="分享画布">🔗 分享</button>
      <button class="btn btn-green" @click="addRootChild">＋ 添加分支</button>
    </header>

    <div class="main-area">
      <TreeCanvas
        :treeData="treeData"
        :selectedNodeId="selectedNodeId"
        :collaborationState="collaborationState"
        :showAxis="showAxis"
        @node-click="onNodeClick"
        @node-dblclick="onNodeDblClick"
        @toggle-collapse="onToggleCollapse"
        @toggle-expand="onToggleExpand"
        @move-node="onMoveNode"
        @move-node-preview="onMoveNodePreview"
        @resize-node="onResizeNode"
        @zoom-changed="onZoomChanged"
        @debug-log="onDebugLog"
      />
      <NodeEditor
        v-if="selectedNode"
        :key="selectedNodeId"
        :node="selectedNode"
        :isRoot="selectedNodeId === rootId"
        :remoteEditors="getEditorsForNode(selectedNodeId)"
        @update="onUpdateNode"
        @add-child="onAddChild"
        @delete-node="onDeleteNode"
        @toggle-collapse="onToggleCollapse"
        @toggle-expand="onToggleExpand"
        @resize="onResizeNode"
        @reset-position="onResetPosition"
        @focus="onEditorFocus"
        @blur="onEditorBlur"
      />
      <div v-else class="empty-editor">
        <span class="empty-icon">👆</span>
        <p>点击节点进行编辑</p>
      </div>
    </div>

    <DebugPanel ref="debugPanelRef" :log="debugLogEntry" />

    <!-- Share dialog -->
    <div v-if="showShareDialog" class="modal-overlay" @click.self="showShareDialog = false">
      <div class="modal">
        <div class="modal-header">
          <span>分享画布</span>
          <button class="modal-close" @click="showShareDialog = false">✕</button>
        </div>
        <div class="modal-body">
          <!-- Public deploy: show public URL directly -->
          <div v-if="isPublicDeploy" class="share-section">
            <label class="field">
              <span class="field-label">🌐 公网协作链接</span>
              <div class="share-input-row">
                <input type="text" :value="shareUrl" readonly class="field-input share-input" ref="shareInputRef" />
                <button class="btn btn-primary btn-sm" @click="copyShareUrl">{{ copied === 'current' ? '已复制 ✓' : '复制' }}</button>
              </div>
            </label>
            <p class="share-hint">✅ 将此链接发送给任何人即可实时协作编辑此画布。</p>
          </div>

          <!-- Public tunnel URL (auto-provisioned) -->
          <div v-else-if="tunnelUrl" class="share-section">
            <label class="field">
              <span class="field-label">🌐 公网链接（任何人可用）</span>
              <div class="share-input-row">
                <input type="text" :value="tunnelUrl + '/#/canvas/' + canvasId" readonly class="field-input share-input" />
                <button class="btn btn-primary btn-sm" @click="copyTunnelUrl">{{ copied === 'tunnel' ? '已复制 ✓' : '复制' }}</button>
              </div>
            </label>
          </div>

          <!-- LAN URL (same network) -->
          <div v-if="!isPublicDeploy && lanUrl" class="share-section">
            <label class="field">
              <span class="field-label">🏠 局域网链接（同一网络）</span>
              <div class="share-input-row">
                <input type="text" :value="lanUrl + '/#/canvas/' + canvasId" readonly class="field-input share-input" />
                <button class="btn btn-primary btn-sm" @click="copyLanUrl">{{ copied === 'lan' ? '已复制 ✓' : '复制' }}</button>
              </div>
            </label>
          </div>

          <!-- Fallback -->
          <div v-if="!isPublicDeploy && !tunnelUrl && !lanUrl" class="share-section">
            <label class="field">
              <span class="field-label">🌐 分享链接</span>
              <div class="share-input-row">
                <input type="text" :value="shareUrl" readonly class="field-input share-input" ref="shareInputRef" />
                <button class="btn btn-primary btn-sm" @click="copyShareUrl">{{ copied === 'current' ? '已复制 ✓' : '复制' }}</button>
              </div>
            </label>
          </div>

          <p v-if="tunnelStatus === 'connecting'" class="share-hint">⏳ 正在建立公网隧道…</p>
          <p v-else-if="isPublicDeploy" class="share-hint">✅ 将此链接发送给任何人即可实时协作编辑此画布。</p>
          <p v-else-if="tunnelUrl" class="share-hint">✅ 公网隧道已就绪！将此链接发送给任何人即可实时协作。</p>
          <p v-else-if="tunnelStatus === 'error'" class="share-hint error">⚠️ 公网隧道连接失败，请检查网络。局域网内仍可使用。</p>
          <p v-else class="share-hint">将链接发送给其他人，他们可以实时协作编辑此画布。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useYjsTree } from '../composables/useYjsTree.js'
import { useCanvases } from '../composables/useCanvases.js'
import { useUserIdentity } from '../composables/useUserIdentity.js'
import { useCollaboration } from '../composables/useCollaboration.js'
import TreeCanvas from '../components/TreeCanvas.vue'
import NodeEditor from '../components/NodeEditor.vue'
import UserList from '../components/UserList.vue'
import DebugPanel from '../components/DebugPanel.vue'

const route = useRoute()
const router = useRouter()
const { getCanvas, updateNodeCount, visitCanvas, renameCanvas } = useCanvases()

// ── User identity ──
const identity = useUserIdentity()
const { userId, userInitials: initVal } = identity
const userName = ref(identity.userName)
const userColor = ref(identity.userColor)
const userInitials = ref(identity.userInitials)

// ── Canvas ──
const canvasId = computed(() => route.params.id)
const canvas = computed(() => getCanvas(canvasId.value))
const canvasName = computed(() => canvas.value?.name || '未命名画布')
const isOwner = computed(() => canvas.value?.ownerId === userId)
const room = computed(() => canvas.value?.room || `canvas-${canvasId.value}`)

// ── Canvas rename ──
const isEditingName = ref(false)
const editName = ref('')
const nameInput = ref(null)

function startEditName() {
  if (!isOwner.value) return
  isEditingName.value = true
  editName.value = canvasName.value
  nextTick(() => nameInput.value?.focus())
}
function confirmEditName() {
  if (!isEditingName.value) return
  isEditingName.value = false
  const newName = editName.value.trim()
  if (newName && newName !== canvasName.value) {
    renameCanvas(canvasId.value, newName)
    // Broadcast rename to shared users via awareness
    setCanvasName(newName)
    setCanvasOwnerId(userId)
  }
}
function cancelEditName() {
  isEditingName.value = false
}

// ── Yjs tree ──
const {
  ydoc, wsProvider, rtcProvider, connected, synced, treeData, selectedNodeId, rootId, treeMap,
  addNode, updateNode, deleteNode,
  toggleCollapse, toggleExpand,
  moveNode, resetNodePosition, resizeNode,
  destroy: destroyTree
} = useYjsTree(room)

// ── Collaboration ──
const {
  remoteUsers, remoteCursors, remoteDragging,
  remoteEditingNodeIds, remoteCanvasName, selfPresence, onlineCount,
  init: initCollab,
  setSelectedNode, setEditingNode, setDragging, setCanvasName, setCanvasOwnerId,
  updateState,
  isNodeBeingEdited, editorsForNode,
  destroy: destroyCollab
} = useCollaboration(
  () => wsProvider,
  () => ({ userId, userName: userName.value, userColor: userColor.value, userInitials: userInitials.value })
)

// ── Undo/Redo ──
// Removed — undo/redo in multi-user real-time collaboration is too complex.
// Instead: manual save + auto-save toggle.

const autoSave = ref(true)  // Default: auto-save enabled
const saveStatus = ref('')  // '', 'saving', 'saved'

function manualSave() {
  saveStatus.value = 'saving'
  // Force sync to IndexedDB (already happening via y-indexeddb)
  // Also sync canvas metadata to server
  if (canvasId.value) {
    updateNodeCount(canvasId.value, countNodes(treeData.value))
  }
  setTimeout(() => {
    saveStatus.value = 'saved'
    setTimeout(() => { saveStatus.value = '' }, 2000)
  }, 300)
}

function toggleAutoSave() {
  autoSave.value = !autoSave.value
}

// ── Collaboration state for TreeCanvas ──
const collaborationState = computed(() => ({
  remoteCursors: remoteCursors.value,
  remoteDragging: remoteDragging.value,
  remoteEditingNodeIds: remoteEditingNodeIds.value,
  selfPresence: selfPresence.value,
  isNodeBeingEdited,
}))

// ── Share dialog ──
const showShareDialog = ref(false)
const showAxis = ref(false)
const shareInputRef = ref(null)
const copied = ref('')
const tunnelUrl = ref('')
const tunnelStatus = ref('')
const lanUrl = ref('')

const shareUrl = computed(() => tunnelUrl.value || window.location.origin + '/#/canvas/' + canvasId.value)

const isPublicDeploy = computed(() => {
  const host = window.location.hostname
  return !host.includes('localhost') && !host.includes('127.0.0.1') && !host.includes('192.168') && !host.includes('10.')
})

const isLocalhost = computed(() => {
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
})

async function openShareDialog() {
  showShareDialog.value = true
  // Fetch tunnel info from server
  try {
    const res = await fetch('/api/tunnel')
    const data = await res.json()
    tunnelUrl.value = data.url || ''
    tunnelStatus.value = data.status || ''
    lanUrl.value = data.lanUrl || ''
  } catch (_) {
    // Server might not have tunnel API
  }
}

function copyShareUrl() {
  navigator.clipboard.writeText(shareUrl.value).then(() => {
    copied.value = 'current'
    setTimeout(() => { copied.value = '' }, 2000)
  })
}

function copyTunnelUrl() {
  navigator.clipboard.writeText(tunnelUrl.value + '/#/canvas/' + canvasId.value).then(() => {
    copied.value = 'tunnel'
    setTimeout(() => { copied.value = '' }, 2000)
  })
}

function copyLanUrl() {
  navigator.clipboard.writeText(lanUrl.value + '/#/canvas/' + canvasId.value).then(() => {
    copied.value = 'lan'
    setTimeout(() => { copied.value = '' }, 2000)
  })
}

// ── Debug ──
const debugPanelRef = ref(null)
const debugLogEntry = ref(null)

function addLog(level, msg) {
  debugLogEntry.value = { level, msg }
  if (debugPanelRef.value) debugPanelRef.value.addLog(level, msg)
}

function goHome() {
  router.push('/')
}

// ── Init collaboration after providers connect ──
onMounted(() => {
  // Register visit for shared canvases (auto-save to user's list)
  const canvasInfo = getCanvas(canvasId.value)
  if (!canvasInfo || canvasInfo.ownerId !== userId) {
    visitCanvas(canvasId.value, userId, canvasInfo?.name, canvasInfo?.ownerId)
  }

  // Set canvas owner in awareness so renames are attributed correctly
  setCanvasOwnerId(userId)

  // Watch for remote canvas name changes (owner renamed)
  watch(remoteCanvasName, (newName) => {
    if (newName && newName !== canvasName.value) {
      renameCanvas(canvasId.value, newName)
    }
  })

  // Init collaboration — try immediately, retry if provider not ready
  let attempts = 0
  const tryInit = () => {
    // rtcProvider or wsProvider might be ready
    const hasProvider = (wsProvider && wsProvider.wsconnected) || (rtcProvider && rtcProvider.peers?.length > 0)
    if (hasProvider || attempts >= 30) {
      initCollab()
      if (attempts >= 30) console.warn('[CollabTree] Collaboration init after timeout')
    } else {
      attempts++
      setTimeout(tryInit, 300)
    }
  }
  tryInit()

  // Also listen for sync events as fallback
  wsProvider?.on?.('sync', () => {
    if (!remoteUsers.value.length) initCollab()
  })
  rtcProvider?.on?.('peers', () => {
    if (!remoteUsers.value.length) initCollab()
  })
})

onUnmounted(() => {
  destroyTree()
  destroyCollab()
})

// ── Update node count in canvas metadata ──
function countNodes(tree) {
  if (!tree) return 0
  let count = 1
  if (tree.children) {
    for (const child of tree.children) count += countNodes(child)
  }
  return count
}

watch(treeData, (td) => {
  if (td && canvasId.value) {
    updateNodeCount(canvasId.value, countNodes(td))
  }
}, { deep: false })

// ── findNodeInTree ──
function findNodeInTree(tree, id) {
  if (!tree || !id) return null
  const queue = [tree]
  while (queue.length) {
    const node = queue.shift()
    if (node.id === id) return node
    if (node.children) queue.push(...node.children)
  }
  return null
}

const selectedNode = computed(() => {
  const td = treeData.value
  const sid = selectedNodeId.value
  if (!td || !sid) return null
  return findNodeInTree(td, sid)
})

function getEditorsForNode(nodeId) {
  return editorsForNode(nodeId)
}

// ── handlers ──
function onNodeClick(id) {
  addLog('click', 'Node clicked: ' + id)
  selectedNodeId.value = id
  setSelectedNode(id)
}
function onNodeDblClick(id) {
  addLog('click', 'Node double-clicked: ' + id)
  selectedNodeId.value = id
  setSelectedNode(id)
}
function onUpdateNode(updates) {
  if (selectedNodeId.value) updateNode(selectedNodeId.value, updates)
}
function onAddChild(parentId) {
  const pid = parentId || selectedNodeId.value || rootId.value
  addNode(pid, '新节点')
}
function addRootChild() {
  addNode(rootId.value, '新分支')
}
function onDeleteNode(id) {
  if (id && id !== rootId.value) {
    deleteNode(id)
    selectedNodeId.value = null
    setSelectedNode(null)
  }
}
function onToggleCollapse(id) { toggleCollapse(id) }
function onToggleExpand(id) { toggleExpand(id) }
function onMoveNode(id, x, y) {
  moveNode(id, x, y)
  setDragging(null)
}
function onMoveNodePreview(id, x, y) {
  setDragging(id, x, y)
}
function onResizeNode(id, w, h) { resizeNode(id, w, h) }
function onResetPosition(id) { resetNodePosition(id) }
function onZoomChanged() { /* handled by TreeCanvas watcher */ }
function onDebugLog(msg) { addLog('info', msg) }
function onEditorFocus() {
  if (selectedNodeId.value) setEditingNode(selectedNodeId.value)
}
function onEditorBlur() {
  setEditingNode(null)
}
</script>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; }
.toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 20px; background: #2c3e50; color: white;
  flex-shrink: 0; z-index: 10;
}
.brand { display: flex; align-items: center; gap: 8px; }
.back-btn {
  background: rgba(255,255,255,0.15);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.back-btn:hover { background: rgba(255,255,255,0.25); }
.logo { font-size: 22px; }
.title { font-weight: 700; font-size: 16px; letter-spacing: -0.3px; cursor: default; }
.name-input {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  color: white;
  font-size: 16px;
  font-weight: 700;
  padding: 2px 8px;
  width: 200px;
  outline: none;
}

.save-group {
  display: flex;
  gap: 2px;
  margin-left: 8px;
}
.toolbar-btn {
  background: rgba(255,255,255,0.12);
  border: none;
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.toolbar-btn:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
.toolbar-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.toolbar-btn.active { background: rgba(46, 204, 113, 0.3); }

.axis-btn {
  width: auto;
  padding: 0 10px;
  gap: 4px;
  font-size: 13px;
}
.axis-btn.active { background: rgba(74, 144, 217, 0.3); }
.axis-label { font-size: 11px; font-weight: 600; }

.status { display: flex; align-items: center; gap: 6px; }
.dot {
  width: 9px; height: 9px; border-radius: 50%;
  background: #e74c3c; transition: background 0.3s;
}
.dot.connected { background: #f39c12; }
.dot.synced { background: #2ecc71; }
.status-text { font-size: 12px; opacity: 0.85; }
.status-text.offline { color: #e74c3c; }
.spacer { flex: 1; }
.btn {
  padding: 7px 16px; border: none; border-radius: 6px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: opacity 0.2s; color: white;
}
.btn:hover { opacity: 0.85; }
.btn-green { background: #27ae60; }
.btn-outline {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.3);
}
.btn-outline:hover { background: rgba(255,255,255,0.1); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-primary { background: #4A90D9; }

.main-area { display: flex; flex: 1; overflow: hidden; }
.empty-editor {
  width: 340px; flex-shrink: 0; background: #fff;
  border-left: 1px solid #e0e0e0;
  display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  color: #aaa;
}
.empty-icon { font-size: 36px; display: block; margin-bottom: 10px; }
.empty-editor p { font-size: 13px; margin: 0; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: #fff; border-radius: 12px;
  width: 480px; max-width: 90vw;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #eee;
  font-weight: 700; font-size: 16px;
}
.modal-close {
  background: none; border: none; font-size: 18px; cursor: pointer;
  color: #999; padding: 4px;
}
.modal-close:hover { color: #333; }
.modal-body { padding: 20px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: #888; }
.field-input {
  width: 100%; padding: 8px 10px; border: 1px solid #dde;
  border-radius: 6px; font-size: 13px; outline: none;
  font-family: monospace;
}
.share-input-row { display: flex; gap: 8px; }
.share-input { flex: 1; }
.share-hint { font-size: 12px; color: #999; margin-top: 12px; }
</style>