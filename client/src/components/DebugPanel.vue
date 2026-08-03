<template>
  <div class="debug-panel" :class="{ open: isOpen }">
    <div class="debug-content" v-if="isOpen">
      <div class="debug-header">
        <span class="debug-title">🔍 调试面板</span>
        <div class="debug-actions">
          <button @click="clearLogs" class="debug-btn-debug">清空</button>
          <button @click="isOpen = false" class="debug-btn-debug">✕</button>
        </div>
      </div>
      <div class="debug-body" ref="logBody">
        <div v-for="(entry, i) in logs" :key="i" class="log-entry" :class="'log-' + entry.level">
          <span class="log-time">{{ entry.time }}</span>
          <span class="log-level" :class="'level-' + entry.level">{{ entry.level.toUpperCase() }}</span>
          <span class="log-msg">{{ entry.msg }}</span>
        </div>
        <div v-if="logs.length === 0" class="log-empty">暂无日志</div>
      </div>
    </div>
    <button class="debug-toggle" @click="isOpen = !isOpen" :title="isOpen ? '关闭调试面板' : '打开调试面板'">
      {{ isOpen ? '🔍' : '🐛' }}
    </button>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick } from 'vue'

const props = defineProps({
  log: { type: Object, default: null }
})

const isOpen = ref(false)
const logBody = ref(null)
const logs = reactive([])

const MAX_LOGS = 200

function pad(n) { return String(n).padStart(2, '0') }

function addLog(level, msg) {
  const now = new Date()
  const time = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()) + '.' + String(now.getMilliseconds()).padStart(3, '0')
  logs.push({ time, level, msg })
  if (logs.length > MAX_LOGS) logs.shift()
  nextTick(() => {
    if (logBody.value) logBody.value.scrollTop = logBody.value.scrollHeight
  })
}

watch(() => props.log, (entry) => {
  if (entry && entry.msg) {
    addLog(entry.level || 'info', entry.msg)
  }
}, { deep: false })

function clearLogs() { logs.length = 0 }

defineExpose({ addLog, clearLogs })
</script>

<style scoped>
.debug-panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.debug-toggle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid #e0e0e0;
  background: #fff;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  transition: transform 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.debug-toggle:hover {
  transform: scale(1.1);
}
.debug-content {
  width: 420px;
  max-height: 360px;
  background: #1e1e2e;
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 8px;
}
.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #2a2a3c;
  border-bottom: 1px solid #3a3a4c;
  flex-shrink: 0;
}
.debug-title {
  font-size: 13px;
  font-weight: 700;
  color: #cdd6f4;
}
.debug-actions {
  display: flex;
  gap: 6px;
}
.debug-btn-debug {
  padding: 3px 10px;
  border: 1px solid #45475a;
  border-radius: 4px;
  background: #313244;
  color: #cdd6f4;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
}
.debug-btn-debug:hover {
  background: #45475a;
}
.debug-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.6;
}
.log-entry {
  display: flex;
  gap: 8px;
  padding: 2px 14px;
  align-items: baseline;
}
.log-entry:hover {
  background: rgba(255,255,255,0.03);
}
.log-time {
  color: #585b70;
  flex-shrink: 0;
  min-width: 82px;
}
.log-level {
  flex-shrink: 0;
  min-width: 32px;
  font-weight: 700;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  text-align: center;
}
.level-info { color: #89b4fa; background: rgba(137,180,250,0.1); }
.level-warn { color: #fab387; background: rgba(250,179,135,0.1); }
.level-error { color: #f38ba8; background: rgba(243,139,168,0.1); }
.level-click { color: #a6e3a1; background: rgba(166,227,161,0.15); }
.log-msg {
  color: #bac2de;
  word-break: break-all;
}
.log-empty {
  color: #585b70;
  text-align: center;
  padding: 20px;
  font-style: italic;
}
</style>