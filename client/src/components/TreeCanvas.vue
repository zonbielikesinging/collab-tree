<template>
  <div class="tree-canvas" ref="containerRef">
    <svg ref="svgRef"></svg>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { renderTree } from '../composables/useTreeRenderer.js'
import { renderAxis } from '../composables/useAxisRenderer.js'

const props = defineProps({
  treeData: { type: Object, default: null },
  selectedNodeId: { type: String, default: null },
  collaborationState: { type: Object, default: null },
  showAxis: { type: Boolean, default: false },
})

const emit = defineEmits([
  'node-click', 'node-dblclick',
  'toggle-collapse', 'toggle-expand',
  'move-node', 'move-node-preview', 'resize-node',
  'zoom-changed', 'debug-log',
])

const containerRef = ref(null)
const svgRef = ref(null)

// ── Render ──

function render() {
  renderTree(
    svgRef.value, containerRef.value,
    props.treeData, props.selectedNodeId,
    emit, props.collaborationState
  )
  // Axis is called immediately after render (which fires zoom-changed on pan)
  renderAxis(svgRef.value, containerRef.value, props.showAxis)
}

// ── Watchers ──

watch(() => props.treeData, () => nextTick(render), { deep: false })
watch(() => props.selectedNodeId, () => nextTick(render))
watch(() => props.showAxis, () => renderAxis(svgRef.value, containerRef.value, props.showAxis))

// ── Lifecycle ──

let resizeTimer = null
onMounted(() => {
  nextTick(render)
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(render, 150)
  })
})
onUnmounted(() => {
  window.removeEventListener('resize', () => {})
  clearTimeout(resizeTimer)
})
</script>

<style scoped>
.tree-canvas {
  flex: 1;
  overflow: hidden;
  background: #e8ecf1;
}
.tree-canvas svg {
  width: 100%;
  height: 100%;
}
.node {
  transition: opacity 0.15s;
}
.node:hover {
  opacity: 0.92;
}
</style>