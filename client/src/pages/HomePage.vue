<template>
  <div class="home">
    <header class="home-header">
      <div class="brand">
        <span class="logo">🌲</span>
        <span class="title">CollabTree</span>
        <span class="subtitle">实时协作树状图编辑器</span>
      </div>
      <div class="spacer"></div>
      <!-- Profile button -->
      <button class="profile-btn" @click="showProfileDialog = true" title="编辑个人资料">
        <span class="profile-avatar" :style="{ background: userColor }">{{ userInitials }}</span>
        <span class="profile-name">{{ userName }}</span>
      </button>
    </header>

    <main class="home-main">
      <div class="toolbar">
        <h2>我的画布</h2>
        <button class="btn btn-primary" @click="onCreateCanvas">＋ 新建画布</button>
      </div>

      <div v-if="myCanvases.length === 0 && sharedCanvases.length === 0" class="empty-state">
        <span class="empty-icon">📋</span>
        <p>还没有画布，点击上方按钮创建第一个</p>
      </div>

      <template v-else>
        <!-- My canvases -->
        <section v-if="myCanvases.length > 0" class="canvas-section">
          <h3 class="section-title">📁 我的画布</h3>
          <div class="canvas-grid">
            <div
              v-for="canvas in myCanvases"
              :key="canvas.id"
              class="canvas-card"
              @click="openCanvas(canvas.id)"
            >
              <div class="card-preview">
                <svg viewBox="0 0 200 120" class="card-svg">
                  <rect x="10" y="10" width="60" height="30" rx="6" fill="#4A90D9" opacity="0.8" />
                  <text x="40" y="29" text-anchor="middle" fill="white" font-size="10" font-weight="bold">Node</text>
                  <line x1="40" y1="40" x2="40" y2="55" stroke="#667788" stroke-width="1.5" />
                  <rect x="10" y="55" width="50" height="22" rx="5" fill="#27ae60" opacity="0.7" />
                  <rect x="70" y="55" width="50" height="22" rx="5" fill="#e67e22" opacity="0.7" />
                </svg>
              </div>
              <div class="card-info">
                <div class="card-name" :title="canvas.name">{{ canvas.name }}</div>
                <div class="card-meta">
                  <span>{{ canvas.nodeCount }} 节点</span>
                  <span>·</span>
                  <span>{{ formatDate(canvas.createdAt) }}</span>
                </div>
              </div>
              <div class="card-actions" @click.stop>
                <button v-if="canvas.ownerId === userId" class="card-btn" @click="startRename(canvas)" title="重命名">✏️</button>
                <button class="card-btn" @click="onDeleteCanvas(canvas.id)" title="删除">🗑️</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Shared canvases -->
        <section v-if="sharedCanvases.length > 0" class="canvas-section">
          <div class="shared-divider"></div>
          <h3 class="section-title">🤝 协作画布</h3>
          <div class="canvas-grid">
            <div
              v-for="canvas in sharedCanvases"
              :key="canvas.id"
              class="canvas-card shared-card"
              @click="openCanvas(canvas.id)"
            >
              <div class="card-preview shared-preview">
                <svg viewBox="0 0 200 120" class="card-svg">
                  <rect x="10" y="10" width="60" height="30" rx="6" fill="#9b59b6" opacity="0.8" />
                  <text x="40" y="29" text-anchor="middle" fill="white" font-size="10" font-weight="bold">Node</text>
                  <line x1="40" y1="40" x2="40" y2="55" stroke="#667788" stroke-width="1.5" />
                  <rect x="10" y="55" width="50" height="22" rx="5" fill="#27ae60" opacity="0.7" />
                  <rect x="70" y="55" width="50" height="22" rx="5" fill="#e67e22" opacity="0.7" />
                </svg>
              </div>
              <div class="card-info">
                <div class="card-name" :title="canvas.name">{{ canvas.name }}</div>
                <div class="card-meta">
                  <span class="shared-badge">🔗 分享</span>
                  <span>·</span>
                  <span>{{ formatDate(canvas.createdAt) }}</span>
                </div>
              </div>
              <div class="card-actions" @click.stop>
                <button class="card-btn" @click="onDeleteCanvas(canvas.id)" title="移除">🗑️</button>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- Rename dialog -->
      <div v-if="renaming" class="modal-overlay" @click="renaming = null">
        <div class="modal" @click.stop>
          <h3>重命名画布</h3>
          <input
            ref="renameInput"
            v-model="renameValue"
            @keydown.enter="confirmRename"
            @keydown.escape="renaming = null"
            class="modal-input"
            placeholder="输入新名称"
          />
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="renaming = null">取消</button>
            <button class="btn btn-primary" @click="confirmRename">确认</button>
          </div>
        </div>
      </div>

      <!-- Profile edit dialog -->
      <div v-if="showProfileDialog" class="modal-overlay" @click.self="showProfileDialog = false">
        <div class="modal" @click.stop>
          <h3>编辑个人资料</h3>
          <div class="profile-preview">
            <span class="profile-avatar-lg" :style="{ background: userColor }">{{ userInitials }}</span>
            <span class="profile-name-preview">{{ pendingName || userName }}</span>
          </div>
          <label class="field">
            <span class="field-label">昵称</span>
            <input
              v-model="pendingName"
              type="text"
              class="modal-input"
              :placeholder="userName"
              maxlength="12"
              @keyup.enter="saveProfile"
            />
          </label>
          <div class="modal-actions">
            <button class="btn btn-outline" @click="randomizeName">🎲 随机</button>
            <button class="btn btn-primary" @click="saveProfile">保存</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useCanvases } from '../composables/useCanvases.js'
import { useUserIdentity } from '../composables/useUserIdentity.js'

const router = useRouter()
const { listCanvases, createCanvas, deleteCanvas, renameCanvas } = useCanvases()
const identity = useUserIdentity()
const { userId, setName } = identity

const userName = ref(identity.userName)
const userColor = ref(identity.userColor)
const userInitials = ref(identity.userInitials)

const canvases = ref([])
const myCanvases = computed(() => canvases.value.filter(c => c.ownerId === userId))
const sharedCanvases = computed(() => canvases.value.filter(c => c.ownerId !== userId || (c.visitors?.includes(userId) && c.ownerId !== userId)))
const renaming = ref(null)
const renameValue = ref('')
const renameInput = ref(null)

// Profile
const showProfileDialog = ref(false)
const pendingName = ref('')

function saveProfile() {
  const name = pendingName.value.trim()
  if (name) {
    setName(name)
    userName.value = name
    const cleaned = name.replace(/[的吗了呢啊]/g, '')
    userInitials.value = cleaned.slice(0, 2) || name[0]
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

async function loadCanvases() {
  canvases.value = await listCanvases(userId)
}

async function onCreateCanvas() {
  const canvas = await createCanvas('新画布', userId)
  router.push(`/canvas/${canvas.id}`)
}

function openCanvas(id) {
  router.push(`/canvas/${id}`)
}

async function onDeleteCanvas(id) {
  if (confirm('确定要删除这个画布吗？此操作不可撤销。')) {
    await deleteCanvas(id)
    await loadCanvases()
  }
}

function startRename(canvas) {
  renaming.value = canvas.id
  renameValue.value = canvas.name
  nextTick(() => renameInput.value?.focus())
}

async function confirmRename() {
  if (renaming.value && renameValue.value.trim()) {
    await renameCanvas(renaming.value, renameValue.value.trim())
    await loadCanvases()
  }
  renaming.value = null
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(async () => { await loadCanvases() })
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0f2f5;
}

.home-header {
  background: linear-gradient(135deg, #2c3e50, #34495e);
  padding: 24px 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.spacer { flex: 1; }
.logo { font-size: 32px; }
.title {
  font-size: 24px;
  font-weight: 800;
  color: white;
  letter-spacing: -0.5px;
}
.subtitle {
  font-size: 14px;
  color: rgba(255,255,255,0.6);
  margin-left: 4px;
}

/* Profile button in header */
.profile-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 6px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.1);
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.profile-btn:hover {
  background: rgba(255,255,255,0.2);
  border-color: rgba(255,255,255,0.4);
}
.profile-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.profile-name {
  font-weight: 500;
}

.home-main {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.toolbar h2 {
  font-size: 18px;
  font-weight: 700;
  color: #2c3e50;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn:hover { opacity: 0.85; transform: translateY(-1px); }
.btn-primary { background: #4A90D9; color: white; }
.btn-secondary { background: #95a5a6; color: white; }
.btn-outline {
  background: transparent;
  border: 1px solid #dde;
  color: #666;
}
.btn-outline:hover { background: #f5f5f5; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #aaa;
}
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-state p { font-size: 14px; }

.canvas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.canvas-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  position: relative;
}
.canvas-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}

.card-preview {
  height: 120px;
  background: linear-gradient(135deg, #e8ecf1, #d5dce6);
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-svg {
  width: 100%;
  height: 100%;
}

.card-info {
  padding: 14px 16px;
}
.card-name {
  font-size: 15px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-meta {
  font-size: 12px;
  color: #999;
  display: flex;
  gap: 6px;
}

.card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.canvas-card:hover .card-actions {
  opacity: 1;
}
.card-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: rgba(255,255,255,0.9);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  transition: all 0.15s;
}
.card-btn:hover {
  background: white;
  transform: scale(1.1);
}

/* Profile dialog */
.profile-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}
.profile-avatar-lg {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.profile-name-preview { font-size: 18px; font-weight: 600; }
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.field-label { font-size: 12px; font-weight: 600; color: #888; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 360px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.modal h3 {
  font-size: 16px;
  margin-bottom: 16px;
  color: #2c3e50;
}
.modal-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dde;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}
.modal-input:focus {
  border-color: #4A90D9;
  box-shadow: 0 0 0 2px rgba(74,144,217,0.15);
}
.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* Section divider for shared canvases */
.canvas-section { margin-bottom: 32px; }
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #555;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}
.shared-divider {
  border-top: 2px dashed #e0e0e0;
  margin: 8px 0 24px;
}
.shared-card { border-left: 3px solid #9b59b6; }
.shared-preview {
  background: linear-gradient(135deg, #f3e5f5, #e8daef);
}
.shared-badge {
  font-size: 11px;
  color: #9b59b6;
  font-weight: 600;
}
</style>