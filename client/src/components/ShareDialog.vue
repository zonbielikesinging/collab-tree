<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <span>分享画布</span>
        <button class="modal-close" @click="close">✕</button>
      </div>
      <div class="modal-body">
        <!-- Public deploy: show public URL directly -->
        <div v-if="isPublicDeploy" class="share-section">
          <label class="field">
            <span class="field-label">🌐 公网协作链接</span>
            <div class="share-input-row">
              <input type="text" :value="shareUrl" readonly class="field-input share-input" ref="shareInputRef" />
              <button class="btn btn-primary btn-sm" @click="copy('current')">{{ copied === 'current' ? '已复制 ✓' : '复制' }}</button>
            </div>
          </label>
          <p class="share-hint">✅ 将此链接发送给任何人即可实时协作编辑此画布。</p>
        </div>

        <!-- Public tunnel URL -->
        <div v-else-if="tunnelUrl" class="share-section">
          <label class="field">
            <span class="field-label">🌐 公网链接（任何人可用）</span>
            <div class="share-input-row">
              <input type="text" :value="tunnelUrl + '/#/canvas/' + canvasId" readonly class="field-input share-input" />
              <button class="btn btn-primary btn-sm" @click="copy('tunnel')">{{ copied === 'tunnel' ? '已复制 ✓' : '复制' }}</button>
            </div>
          </label>
        </div>

        <!-- LAN URL -->
        <div v-if="!isPublicDeploy && lanUrl" class="share-section">
          <label class="field">
            <span class="field-label">🏠 局域网链接（同一网络）</span>
            <div class="share-input-row">
              <input type="text" :value="lanUrl + '/#/canvas/' + canvasId" readonly class="field-input share-input" />
              <button class="btn btn-primary btn-sm" @click="copy('lan')">{{ copied === 'lan' ? '已复制 ✓' : '复制' }}</button>
            </div>
          </label>
        </div>

        <!-- Fallback -->
        <div v-if="!isPublicDeploy && !tunnelUrl && !lanUrl" class="share-section">
          <label class="field">
            <span class="field-label">🌐 分享链接</span>
            <div class="share-input-row">
              <input type="text" :value="shareUrl" readonly class="field-input share-input" />
              <button class="btn btn-primary btn-sm" @click="copy('current')">{{ copied === 'current' ? '已复制 ✓' : '复制' }}</button>
            </div>
          </label>
        </div>

        <p v-if="tunnelStatus === 'connecting'" class="share-hint">⏳ 正在建立公网隧道…</p>
        <p v-else-if="isPublicDeploy" class="share-hint">✅ 将此链接发送给任何人即可实时协作编辑此画布。</p>
        <p v-else-if="tunnelUrl" class="share-hint">✅ 公网隧道已就绪！将链接发送给任何人即可实时协作。</p>
        <p v-else-if="tunnelStatus === 'error'" class="share-hint error">⚠️ 公网隧道连接失败，请检查网络。局域网内仍可使用。</p>
        <p v-else class="share-hint">将链接发送给其他人，他们可以实时协作编辑此画布。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  show: Boolean,
  canvasId: String,
})

const emit = defineEmits(['close'])

const copied = ref('')
const tunnelUrl = ref('')
const tunnelStatus = ref('')
const lanUrl = ref('')

const shareUrl = computed(() => tunnelUrl.value || window.location.origin + '/#/canvas/' + props.canvasId)

const isPublicDeploy = computed(() => {
  const host = window.location.hostname
  return !host.includes('localhost') && !host.includes('127.0.0.1') && !host.includes('192.168') && !host.includes('10.')
})

function close() { emit('close') }

async function open() {
  try {
    const res = await fetch('/api/tunnel')
    const data = await res.json()
    tunnelUrl.value = data.url || ''
    tunnelStatus.value = data.status || ''
    lanUrl.value = data.lanUrl || ''
  } catch (_) {}
}

function copy(type) {
  let url = shareUrl.value
  if (type === 'tunnel') url = tunnelUrl.value + '/#/canvas/' + props.canvasId
  if (type === 'lan') url = lanUrl.value + '/#/canvas/' + props.canvasId
  navigator.clipboard.writeText(url).then(() => {
    copied.value = type
    setTimeout(() => { copied.value = '' }, 2000)
  })
}

defineExpose({ open })
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: #fff; border-radius: 12px; width: 480px; max-width: 90vw;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #eee; font-weight: 700; font-size: 16px;
}
.modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; padding: 4px; }
.modal-close:hover { color: #333; }
.modal-body { padding: 20px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: #888; }
.field-input {
  width: 100%; padding: 8px 10px; border: 1px solid #dde;
  border-radius: 6px; font-size: 13px; outline: none; font-family: monospace;
}
.share-input-row { display: flex; gap: 8px; }
.share-input { flex: 1; }
.share-hint { font-size: 12px; color: #999; margin-top: 12px; }
.share-hint.error { color: #e74c3c; }
.btn-primary { background: #4A90D9; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn { padding: 7px 16px; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; color: white; }
.btn:hover { opacity: 0.85; }
</style>