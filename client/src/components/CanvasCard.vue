<template>
  <div class="canvas-card" :class="{ 'shared-card': isShared }" @click="$emit('open')">
    <div class="card-preview" :class="{ 'shared-preview': isShared }">
      <svg viewBox="0 0 200 120" class="card-svg">
        <rect x="10" y="10" width="60" height="30" rx="6" :fill="isShared ? '#9b59b6' : '#4A90D9'" opacity="0.8" />
        <text x="40" y="29" text-anchor="middle" fill="white" font-size="10" font-weight="bold">Node</text>
        <line x1="40" y1="40" x2="40" y2="55" stroke="#667788" stroke-width="1.5" />
        <rect x="10" y="55" width="50" height="22" rx="5" fill="#27ae60" opacity="0.7" />
        <rect x="70" y="55" width="50" height="22" rx="5" fill="#e67e22" opacity="0.7" />
      </svg>
    </div>
    <div class="card-info">
      <div class="card-name" :title="canvas.name">{{ canvas.name }}</div>
      <div class="card-meta">
        <span v-if="isShared" class="shared-badge">🔗 分享</span>
        <span v-if="isShared">·</span>
        <span>{{ canvas.nodeCount }} 节点</span>
        <span>·</span>
        <span>{{ formatDate(canvas.createdAt) }}</span>
      </div>
    </div>
    <div class="card-actions" @click.stop>
      <button v-if="!isShared && canvas.ownerId === userId" class="card-btn" @click="$emit('rename', canvas)" title="重命名">✏️</button>
      <button class="card-btn" @click="$emit('delete', canvas.id)" title="删除">🗑️</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  canvas: Object,
  userId: String,
  isShared: Boolean,
})

defineEmits(['open', 'rename', 'delete'])

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<style scoped>
.canvas-card {
  background: white; border-radius: 12px; overflow: hidden;
  cursor: pointer; transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06); position: relative;
}
.canvas-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
.shared-card { border-left: 3px solid #9b59b6; }
.card-preview { height: 120px; background: linear-gradient(135deg, #e8ecf1, #d5dce6); display: flex; align-items: center; justify-content: center; }
.shared-preview { background: linear-gradient(135deg, #f3e5f5, #e8daef); }
.card-svg { width: 100%; height: 100%; }
.card-info { padding: 14px 16px; }
.card-name { font-size: 15px; font-weight: 700; color: #2c3e50; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: 12px; color: #999; display: flex; gap: 6px; }
.shared-badge { font-size: 11px; color: #9b59b6; font-weight: 600; }
.card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
.canvas-card:hover .card-actions { opacity: 1; }
.card-btn { width: 32px; height: 32px; border: none; border-radius: 6px; background: rgba(255,255,255,0.9); font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(0,0,0,0.1); transition: all 0.15s; }
.card-btn:hover { background: white; transform: scale(1.1); }
</style>