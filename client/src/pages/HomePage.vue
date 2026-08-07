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
            <CanvasCard
              v-for="canvas in myCanvases"
              :key="canvas.id"
              :canvas="canvas"
              :userId="userId"
              :isShared="false"
              @open="openCanvas(canvas.id)"
              @rename="startRename"
              @delete="onDeleteCanvas"
            />
          </div>
        </section>

        <!-- Shared canvases -->
        <section v-if="sharedCanvases.length > 0" class="canvas-section">
          <div class="shared-divider"></div>
          <h3 class="section-title">🤝 协作画布</h3>
          <div class="canvas-grid">
            <CanvasCard
              v-for="canvas in sharedCanvases"
              :key="canvas.id"
              :canvas="canvas"
              :userId="userId"
              :isShared="true"
              @open="openCanvas(canvas.id)"
              @delete="onDeleteCanvas"
            />
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

      <ProfileDialog
        :show="showProfileDialog"
        :userName="userName"
        :userColor="userColor"
        :userInitials="userInitials"
        @close="showProfileDialog = false"
        @save="onProfileSave"
      />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useCanvases } from '../composables/useCanvases.js'
import { useUserIdentity } from '../composables/useUserIdentity.js'
import CanvasCard from '../components/CanvasCard.vue'
import ProfileDialog from '../components/ProfileDialog.vue'

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

function onProfileSave(name) {
  setName(name)
  userName.value = name
  const cleaned = name.replace(/[的吗了呢啊]/g, '')
  userInitials.value = cleaned.slice(0, 2) || name[0]
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
</style>