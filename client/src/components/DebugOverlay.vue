<template>
  <DebugPanel ref="debugPanelRef" :log="debugLogEntry" />
</template>

<script setup>
import { ref } from 'vue'
import DebugPanel from './DebugPanel.vue'

const props = defineProps({
  addLog: { type: Function, required: true },
})

const debugPanelRef = ref(null)
const debugLogEntry = ref(null)

function log(level, msg) {
  debugLogEntry.value = { level, msg }
  if (debugPanelRef.value) debugPanelRef.value.addLog(level, msg)
}

defineExpose({ log })
</script>