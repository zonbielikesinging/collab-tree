<template>
  <div class="tree-canvas" ref="containerRef">
    <svg ref="svgRef"></svg>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { renderTree } from '../composables/useTreeRenderer.js'
import * as d3 from 'd3'

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

function render() {
  renderTree(svgRef.value, containerRef.value, props.treeData, props.selectedNodeId, emit, props.collaborationState)
  renderAxis()
}

function handleZoomChanged() {
  renderAxis()
}

function renderAxis() {
  const svgEl = svgRef.value
  if (!svgEl) return
  const d3svg = d3.select(svgEl)
  d3svg.select('g.axis-layer').remove()
  if (!props.showAxis) return

  const W = containerRef.value?.clientWidth || 800
  const H = containerRef.value?.clientHeight || 600
  const g = d3svg.select('g.main')
  if (g.empty()) return

  const transform = g.attr('transform')
  const match = transform && transform.match(/translate\(([^,]+),\s*([^)]+)\)\s*scale\(([^)]+)\)/)
  const tx = match ? parseFloat(match[1]) : 0
  const ty = match ? parseFloat(match[2]) : 0
  const k = match ? parseFloat(match[3]) : 1

  const axisLayer = d3svg.append('g').attr('class', 'axis-layer')

  const step = Math.pow(10, Math.round(Math.log10(200 / k)))

  // X axis ticks (bottom) - positive to the right
  const xStart = Math.floor((-tx / k - W) / step) * step
  const xEnd = Math.ceil((-tx / k + W) / step) * step
  for (let x = xStart; x <= xEnd; x += step) {
    const sx = (x * k + tx)
    axisLayer.append('line')
      .attr('x1', sx).attr('y1', 0).attr('x2', sx).attr('y2', H)
      .attr('stroke', 'rgba(150,150,150,0.15)')
      .attr('stroke-width', 0.5)
    axisLayer.append('text')
      .attr('x', sx).attr('y', H - 4)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(150,150,150,0.5)')
      .attr('font-size', `${Math.max(8, 10 / k)}px`)
      .attr('font-family', 'monospace')
      .style('pointer-events', 'none')
      .text(x)
  }

  // Y axis ticks (left) - positive UP (negate y for display)
  const yStart = Math.floor((-ty / k - H) / step) * step
  const yEnd = Math.ceil((-ty / k + H) / step) * step
  for (let y = yStart; y <= yEnd; y += step) {
    const sy = (y * k + ty)
    axisLayer.append('line')
      .attr('x1', 0).attr('y1', sy).attr('x2', W).attr('y2', sy)
      .attr('stroke', 'rgba(150,150,150,0.15)')
      .attr('stroke-width', 0.5)
    axisLayer.append('text')
      .attr('x', 4).attr('y', sy + 3)
      .attr('text-anchor', 'start')
      .attr('fill', 'rgba(150,150,150,0.5)')
      .attr('font-size', `${Math.max(8, 10 / k)}px`)
      .attr('font-family', 'monospace')
      .style('pointer-events', 'none')
      .text(-y)
  }
}

watch(() => props.treeData, () => nextTick(render), { deep: false })
watch(() => props.selectedNodeId, () => nextTick(render))
watch(() => props.showAxis, () => nextTick(renderAxis))
// Skip collaborationState watcher - renderer uses its own collab diff cache
// to avoid re-rendering on every awareness change

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
