<template>
  <div class="app">
    <header class="toolbar">
      <div class="brand">
        <button class="back-btn" @click="goHome" title="返回首页">←</button>
        <span class="logo">🌲</span>
        <span class="title">{{ canvasName }}</span>
      </div>

      <!-- Undo/Redo -->
      <div class="undo-group">
        <button class="toolbar-btn" :disabled="!canUndo" @click="undo" title="撤销 (Ctrl+Z)">↩</button>
        <button class="toolbar-btn" :disabled="!canRedo" @click="redo" title="重做 (Ctrl+Shift+Z)">↪</button>
      </div>

      <div class="spacer"></div>

      <!-- Remote users -->
      <UserList
        :userName="userName"
        :userColor="userColor"
        :userInitials="userInitials"
        :remoteUsers="remoteUsers"
        :onlineCount="onlineCount"
        @editProfile="showProfileDialog = true"
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
        @node-click="onNodeClick"
        @node-dblclick="onNodeDblClick"
        @toggle-collapse="onToggleCollapse"
        @toggle-expand="onToggleExpand"
        @move-node="onMoveNode"
        @move-node-preview="onMoveNodePreview"
        @resize-node="onResizeNode"
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
          <!-- Public tunnel URL (auto-provisioned) -->
          <div v-if="tunnelUrl" class="share-section">
            <label class="field">
              <span class="field-label">🌐 公网链接（任何人可用）</span>
              <div class="share-input-row">
                <input type="text" :value="tunnelUrl + '/#/canvas/' + canvasId" readonly class="field-input share-input" />
                <button class="btn btn-primary btn-sm" @click="copyTunnelUrl">{{ copied === 'tunnel' ? '已复制 ✓' : '复制' }}</button>
              </div>
            </label>
          </div>

          <!-- LAN URL (same network) -->
          <div v-if="lanUrl" class="share-section">
            <label class="field">
              <span class="field-label">🏠 局域网链接（同一网络）</span>
              <div class="share-input-row">
                <input type="text" :value="lanUrl + '/#/canvas/' + canvasId" readonly class="field-input share-input" />
                <button class="btn btn-primary btn-sm" @click="copyLanUrl">{{ copied === 'lan' ? '已复制 ✓' : '复制' }}</button>
              </div>
            </label>
          </div>

          <!-- Fallback: current URL (works for both localhost and public deploy) -->
          <div v-if="!tunnelUrl && !lanUrl" class="share-section">
            <label class="field">
              <span class="field-label">🌐 分享链接</span>
              <div class="share-input-row">
                <input type="text" :value="shareUrl" readonly class="field-input share-input" ref="shareInputRef" />
                <button class="btn btn-primary btn-sm" @click="copyShareUrl">{{ copied === 'current' ? '已复制 ✓' : '复制' }}</button>
              </div>
            </label>
          </div>

          <p v-if="tunnelStatus === 'connecting'" class="share-hint">⏳ 正在建立公网隧道…</p>
          <p v-else-if="tunnelUrl" class="share-hint">✅ 公网隧道已就绪！将此链接发送给任何人即可实时协作。</p>
          <p v-else-if="tunnelStatus === 'error'" class="share-hint error">⚠️ 公网隧道连接失败，请检查网络。局域网内仍可使用。</p>
          <p v-else-if="!lanUrl" class="share-hint">✅ 将此链接发送给任何人即可实时协作编辑此画布。</p>
          <p v-else class="share-hint">将链接发送给其他人，他们可以实时协作编辑此画布。</p>
        </div>
      </div>
    </div>

    <!-- Profile edit dialog -->
    <div v-if="showProfileDialog" class="modal-overlay" @click.self="showProfileDialog = false">
      <div class="modal">
        <div class="modal-header">
          <span>编辑个人资料</span>
          <button class="modal-close" @click="showProfileDialog = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="profile-preview">
            <span class="profile-avatar" :style="{ background: userColor }">{{ userInitials }}</span>
            <span class="profile-name-preview">{{ pendingName || userName }}</span>
          </div>
          <label class="field">
            <span class="field-label">昵称</span>
            <input
              v-model="pendingName"
              type="text"
              class="field-input"
              :placeholder="userName"
              maxlength="12"
              @keyup.enter="saveProfile"
            />
          </label>
          <div class="profile-actions">
            <button class="btn btn-outline" @click="randomizeName">🎲 随机</button>
            <button class="btn btn-primary" @click="saveProfile">保存</button>
          </div>
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
import { useUndo } from '../composables/useUndo.js'
import TreeCanvas from '../components/TreeCanvas.vue'
import NodeEditor from '../components/NodeEditor.vue'
import UserList from '../components/UserList.vue'
import DebugPanel from '../components/DebugPanel.vue'

const route = useRoute()
const router = useRouter()
const { getCanvas, updateNodeCount } = useCanvases()

// ── User identity ──
const identity = useUserIdentity()
const { userId, setName } = identity
const userName = ref(identity.userName)
const userColor = ref(identity.userColor)
const userInitials = ref(identity.userInitials)

// ── Canvas ──
const canvasId = computed(() => route.params.id)
const canvas = computed(() => getCanvas(canvasId.value))
const canvasName = computed(() => canvas.value?.name || '未命名画布')
const room = computed(() => canvas.value?.room || `canvas-${canvasId.value}`)

// ── Yjs tree ──
const {
  ydoc, wsProvider, connected, synced, treeData, selectedNodeId, rootId, treeMap,
  addNode, updateNode, deleteNode,
  toggleCollapse, toggleExpand,
  moveNode, resetNodePosition, resizeNode,
  destroy: destroyTree
} = useYjsTree(room)

// ── Collaboration ──
const {
  remoteUsers, remoteCursors, remoteDragging,
  remoteEditingNodeIds, onlineCount,
  init: initCollab,
  setSelectedNode, setEditingNode, setDragging,
  updateState,
  isNodeBeingEdited, editorsForNode,
  destroy: destroyCollab
} = useCollaboration(() => wsProvider, { userId, userName, userColor, userInitials })

// ── Undo/Redo ──
const { canUndo, canRedo, init: initUndo, undo, redo, handleKeydown } = useUndo(ydoc, treeMap)

// ── Collaboration state for TreeCanvas ──
const collaborationState = computed(() => ({
  remoteCursors: remoteCursors.value,
  remoteDragging: remoteDragging.value,
  remoteEditingNodeIds: remoteEditingNodeIds.value,
  isNodeBeingEdited,
}))

// ── Share dialog ──
const showShareDialog = ref(false)
const shareInputRef = ref(null)
const copied = ref('')
const tunnelUrl = ref('')
const tunnelStatus = ref('')
const lanUrl = ref('')

// ── Profile ──
const showProfileDialog = ref(false)
const pendingName = ref('')

function saveProfile() {
  const name = pendingName.value.trim()
  if (name) {
    setName(name)
    userName.value = name
    const cleaned = name.replace(/[的吗了呢啊]/g, '')
    const initials = cleaned.slice(0, 2) || name[0]
    userInitials.value = initials
    // Update awareness so remote users see the new name
    updateState({ name, initials })
  }
  showProfileDialog.value = false
  pendingName.value = ''
}

function randomizeName() {
  const ADJECTIVES = ['快乐','勇敢','安静','活泼','温柔','机智','可爱','帅气','优雅','灵动','敏捷','沉稳','幽默','好奇','调皮','潇洒']
  const NOUNS = ['熊猫','海豚','兔子','狐狸','考拉','松鼠','企鹅','鹦鹉','蝴蝶','猫咪','小狗','仓鼠','斑马','羚羊','燕子','海星']
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  pendingName.value = `${adj}的${noun}`
}

const shareUrl = computed(() => tunnelUrl.value || window.location.origin + '/#/canvas/' + canvasId.value)

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

// ── Init collaboration after provider connects ──
onMounted(() => {
  let attempts = 0
  const tryInit = () => {
    if (wsProvider && wsProvider.wsconnected) {
      initCollab()
      initUndo()
    } else if (attempts < 20) {
      attempts++
      setTimeout(tryInit, 300)
    }
  }
  tryInit()

  // Keyboard shortcuts
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  destroyTree()
  destroyCollab()
})

function onKeydown(e) {
  // Undo/Redo
  handleKeydown(e)
}

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
.title { font-weight: 700; font-size: 16px; letter-spacing: -0.3px; }

.undo-group {
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
  transition: background 0.15s;
}
.toolbar-btn:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
.toolbar-btn:disabled { opacity: 0.3; cursor: not-allowed; }

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

/* Profile */
.profile-preview {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 16px; padding: 12px;
  background: #f5f7fa; border-radius: 8px;
}
.profile-avatar {
  width: 48px; height: 48px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700; color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.profile-name-preview { font-size: 18px; font-weight: 600; }
.profile-actions {
  display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end;
}
</style>