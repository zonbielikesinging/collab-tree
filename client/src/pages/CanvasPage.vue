<template>
  <div class="app">
    <header class="toolbar">
      <div class="brand">
        <button class="back-btn" @click="goHome" title="返回首页">←</button>
        <span class="logo">🌲</span>
        <span v-if="!isEditingName" class="title" @dblclick="startEditName" :title="isOwner ? '双击重命名画布' : ''">
          {{ canvasName }}
        </span>
        <input v-else ref="nameInput" v-model="editName" class="name-input"
          @keydown.enter="confirmEditName" @keydown.escape="cancelEditName" @blur="confirmEditName" />
      </div>

      <div class="save-group">
        <button class="toolbar-btn" :class="{ active: autoSave }" @click="toggleAutoSave" title="自动保存">
          {{ autoSave ? '💾' : '📁' }}
        </button>
        <button class="toolbar-btn" @click="manualSave" title="手动保存">
          {{ saveStatus === 'saving' ? '⏳' : saveStatus === 'saved' ? '✅' : '⬇️' }}
        </button>
      </div>

      <div class="spacer"></div>

      <button class="toolbar-btn axis-btn" :class="{ active: showAxis }" @click="showAxis = !showAxis">
        📐 <span class="axis-label">{{ showAxis ? '坐标轴' : '' }}</span>
      </button>

      <UserList :userName="userName" :userColor="userColor" :userInitials="userInitials"
        :remoteUsers="remoteUsers" :onlineCount="onlineCount" />

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
      <TreeCanvas :treeData="treeData" :selectedNodeId="selectedNodeId"
        :collaborationState="collaborationState" :showAxis="showAxis"
        @node-click="onNodeClick" @node-dblclick="onNodeDblClick"
        @toggle-collapse="onToggleCollapse" @toggle-expand="onToggleExpand"
        @move-node="onMoveNode" @move-node-preview="onMoveNodePreview"
        @resize-node="onResizeNode" @zoom-changed="onZoomChanged" @debug-log="onDebugLog" />
      <NodeEditor v-if="selectedNode" :key="selectedNodeId" :node="selectedNode"
        :isRoot="selectedNodeId === rootId" :remoteEditors="getEditorsForNode(selectedNodeId)"
        @update="onUpdateNode" @add-child="onAddChild" @delete-node="onDeleteNode"
        @toggle-collapse="onToggleCollapse" @toggle-expand="onToggleExpand"
        @resize="onResizeNode" @reset-position="onResetPosition"
        @focus="onEditorFocus" @blur="onEditorBlur" />
      <div v-else class="empty-editor">
        <span class="empty-icon">👆</span>
        <p>点击节点进行编辑</p>
      </div>
    </div>

    <ShareDialog ref="shareDialogRef" :show="showShareDialog" :canvasId="canvasId" @close="showShareDialog = false" />
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
import ShareDialog from '../components/ShareDialog.vue'

const route = useRoute()
const router = useRouter()
const { getCanvas, updateNodeCount, visitCanvas, renameCanvas } = useCanvases()

// ── User identity ──
const identity = useUserIdentity()
const { userId } = identity
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
  isEditingName.value = true; editName.value = canvasName.value
  nextTick(() => nameInput.value?.focus())
}
function confirmEditName() {
  if (!isEditingName.value) return
  isEditingName.value = false
  const newName = editName.value.trim()
  if (newName && newName !== canvasName.value) {
    renameCanvas(canvasId.value, newName)
    setCanvasName(newName); setCanvasOwnerId(userId)
  }
}
function cancelEditName() { isEditingName.value = false }

// ── Yjs tree ──
const { ydoc, wsProvider, rtcProvider, connected, synced, treeData, selectedNodeId, rootId,
  addNode, updateNode, deleteNode, toggleCollapse, toggleExpand,
  moveNode, resetNodePosition, resizeNode, destroy: destroyTree } = useYjsTree(room)

// ── Collaboration ──
const { remoteUsers, remoteCursors, remoteDragging, remoteEditingNodeIds,
  remoteCanvasName, selfPresence, onlineCount,
  init: initCollab, setSelectedNode, setEditingNode, setDragging,
  setCanvasName, setCanvasOwnerId, isNodeBeingEdited, editorsForNode,
  destroy: destroyCollab } = useCollaboration(
  () => wsProvider,
  () => ({ userId, userName: userName.value, userColor: userColor.value, userInitials: userInitials.value })
)

// ── Save ──
const autoSave = ref(true)
const saveStatus = ref('')
function manualSave() {
  saveStatus.value = 'saving'
  if (canvasId.value) updateNodeCount(canvasId.value, countNodes(treeData.value))
  setTimeout(() => { saveStatus.value = 'saved'; setTimeout(() => { saveStatus.value = '' }, 2000) }, 300)
}
function toggleAutoSave() { autoSave.value = !autoSave.value }

const collaborationState = computed(() => ({
  remoteCursors: remoteCursors.value, remoteDragging: remoteDragging.value,
  remoteEditingNodeIds: remoteEditingNodeIds.value,
  selfPresence: selfPresence.value, isNodeBeingEdited,
}))

// ── Share ──
const showShareDialog = ref(false)
const shareDialogRef = ref(null)
const showAxis = ref(false)
async function openShareDialog() {
  showShareDialog.value = true
  nextTick(() => shareDialogRef.value?.open())
}

// ── Init ──
function goHome() { router.push('/') }

onMounted(() => {
  const canvasInfo = getCanvas(canvasId.value)
  if (!canvasInfo || canvasInfo.ownerId !== userId) {
    visitCanvas(canvasId.value, userId, canvasInfo?.name, canvasInfo?.ownerId)
  }
  setCanvasOwnerId(userId)
  watch(remoteCanvasName, (newName) => {
    if (newName && newName !== canvasName.value) renameCanvas(canvasId.value, newName)
  })
  let attempts = 0
  const tryInit = () => {
    const hasProvider = (wsProvider && wsProvider.wsconnected) || (rtcProvider && rtcProvider.peers?.length > 0)
    if (hasProvider || attempts >= 30) { initCollab(); if (attempts >= 30) console.warn('[CollabTree] Init timeout') }
    else { attempts++; setTimeout(tryInit, 300) }
  }
  tryInit()
  wsProvider?.on?.('sync', () => { if (!remoteUsers.value.length) initCollab() })
  rtcProvider?.on?.('peers', () => { if (!remoteUsers.value.length) initCollab() })
})
onUnmounted(() => { destroyTree(); destroyCollab() })

function countNodes(tree) {
  if (!tree) return 0
  let c = 1
  if (tree.children) for (const ch of tree.children) c += countNodes(ch)
  return c
}
watch(treeData, (td) => { if (td && canvasId.value) updateNodeCount(canvasId.value, countNodes(td)) }, { deep: false })

// ── findNodeInTree ──
function findNodeInTree(tree, id) {
  if (!tree || !id) return null
  const queue = [tree]
  while (queue.length) { const n = queue.shift(); if (n.id === id) return n; if (n.children) queue.push(...n.children) }
  return null
}
const selectedNode = computed(() => {
  const td = treeData.value; const sid = selectedNodeId.value
  return (td && sid) ? findNodeInTree(td, sid) : null
})
function getEditorsForNode(nid) { return editorsForNode(nid) }

// ── Handlers ──
function onNodeClick(id) { selectedNodeId.value = id; setSelectedNode(id) }
function onNodeDblClick(id) { selectedNodeId.value = id; setSelectedNode(id) }
function onUpdateNode(updates) { if (selectedNodeId.value) updateNode(selectedNodeId.value, updates) }
function onAddChild(pid) { addNode(pid || selectedNodeId.value || rootId.value, '新节点') }
function addRootChild() { addNode(rootId.value, '新分支') }
function onDeleteNode(id) { if (id && id !== rootId.value) { deleteNode(id); selectedNodeId.value = null; setSelectedNode(null) } }
function onToggleCollapse(id) { toggleCollapse(id) }
function onToggleExpand(id) { toggleExpand(id) }
function onMoveNode(id, x, y) { moveNode(id, x, y); setDragging(null) }
function onMoveNodePreview(id, x, y) { setDragging(id, x, y) }
function onResizeNode(id, w, h) { resizeNode(id, w, h) }
function onResetPosition(id) { resetNodePosition(id) }
function onZoomChanged() {}
function onDebugLog(msg) { console.log('[Canvas]', msg) }
function onEditorFocus() { if (selectedNodeId.value) setEditingNode(selectedNodeId.value) }
function onEditorBlur() { setEditingNode(null) }
</script>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; }
.toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #2c3e50; color: white; flex-shrink: 0; z-index: 10; }
.brand { display: flex; align-items: center; gap: 8px; }
.back-btn { background: rgba(255,255,255,0.15); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
.back-btn:hover { background: rgba(255,255,255,0.25); }
.logo { font-size: 22px; }
.title { font-weight: 700; font-size: 16px; letter-spacing: -0.3px; cursor: default; }
.name-input { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; color: white; font-size: 16px; font-weight: 700; padding: 2px 8px; width: 200px; outline: none; }
.save-group { display: flex; gap: 2px; margin-left: 8px; }
.toolbar-btn { background: rgba(255,255,255,0.12); border: none; color: white; width: 30px; height: 30px; border-radius: 6px; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.toolbar-btn:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
.toolbar-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.toolbar-btn.active { background: rgba(46, 204, 113, 0.3); }
.axis-btn { width: auto; padding: 0 10px; gap: 4px; font-size: 13px; }
.axis-btn.active { background: rgba(74, 144, 217, 0.3); }
.axis-label { font-size: 11px; font-weight: 600; }
.status { display: flex; align-items: center; gap: 6px; }
.dot { width: 9px; height: 9px; border-radius: 50%; background: #e74c3c; transition: background 0.3s; }
.dot.connected { background: #f39c12; }
.dot.synced { background: #2ecc71; }
.status-text { font-size: 12px; opacity: 0.85; }
.status-text.offline { color: #e74c3c; }
.spacer { flex: 1; }
.btn { padding: 7px 16px; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; color: white; }
.btn:hover { opacity: 0.85; }
.btn-green { background: #27ae60; }
.btn-outline { background: transparent; border: 1px solid rgba(255,255,255,0.3); }
.btn-outline:hover { background: rgba(255,255,255,0.1); }
.main-area { display: flex; flex: 1; overflow: hidden; }
.empty-editor { width: 340px; flex-shrink: 0; background: #fff; border-left: 1px solid #e0e0e0; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #aaa; }
.empty-icon { font-size: 36px; display: block; margin-bottom: 10px; }
.empty-editor p { font-size: 13px; margin: 0; }
</style>