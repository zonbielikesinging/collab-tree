<template>
  <aside class="editor-panel" :class="{ empty: !node }">
    <template v-if="node">
      <div v-if="remoteEditors.length > 0" class="remote-banner">
        <span v-for="editor in remoteEditors" :key="editor.clientId" class="remote-badge" :style="{ background: editor.color }">
          {{ editor.name }} 正在编辑
        </span>
      </div>
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'edit' }" @click="activeTab = 'edit'">编辑</button>
        <button class="tab" :class="{ active: activeTab === 'preview' }" @click="activeTab = 'preview'">预览</button>
        <button class="tab" :class="{ active: activeTab === 'style' }" @click="activeTab = 'style'">样式</button>
      </div>

      <div class="tab-content" v-show="activeTab === 'edit'">
        <label class="field">
          <span class="field-label">名称</span>
          <input type="text" :value="node.label" @input="e => emit('update', { label: e.target.value })" @focus="emit('focus')" @blur="emit('blur')" placeholder="节点名称" class="field-input" />
        </label>

        <label class="field">
          <span class="field-label">Markdown 内容 <span class="field-hint">代码 / 公式 / 表格</span></span>
          <div class="md-toolbar">
            <button @click="insertMd('**', '**')" title="粗体"><b>B</b></button>
            <button @click="insertMd('*', '*')" title="斜体"><i>I</i></button>
            <button @click="insertMd('~~', '~~')" title="删除线"><s>S</s></button>
            <button @click="insertMd('`', '`')" title="行内代码">`</button>
            <button @click="insertMdCode()" title="代码块">```</button>
            <button @click="insertMdMath()" title="公式块">$$</button>
            <button @click="insertMd('- ', '')" title="无序列表">ul</button>
            <button @click="insertMd('1. ', '')" title="有序列表">ol</button>
            <button @click="insertMd('> ', '')" title="引用">qt</button>
            <button @click="insertMd('[', '](url)')" title="链接">ln</button>
            <button @click="insertMd('![alt](', ')')" title="图片">img</button>
            <button @click="insertMdColor()" title="颜色">clr</button>
            <button @click="insertMdTable()" title="表格">tbl</button>
            <button @click="insertMd('<u>', '</u>')" title="下划线">_u_</button>
          </div>
          <textarea ref="mdTextarea" :value="node.content || ''" @input="onContentChange" @focus="emit('focus')" @blur="emit('blur')" rows="10" placeholder="# Markdown" class="field-input field-textarea md-textarea"></textarea>
        </label>

        <div class="actions">
          <button class="btn btn-primary" @click="emit('add-child', node.id)">+ 添加子节点</button>
          <button class="btn btn-danger" :disabled="isRoot" @click="emit('delete-node', node.id)">删除节点</button>
        </div>
      </div>

      <div class="tab-content" v-show="activeTab === 'preview'">
        <div class="preview-header"><span class="field-label">{{ node.label || '未命名' }}</span></div>
        <div class="markdown-preview" v-html="renderedMarkdown"></div>
      </div>

      <div class="tab-content" v-show="activeTab === 'style'">
        <label class="field">
          <span class="field-label">颜色</span>
          <div class="color-row">
            <input type="color" :value="node.color" @change="e => emit('update', { color: e.target.value })" class="field-color" />
            <span class="color-hex">{{ node.color || '#666' }}</span>
          </div>
        </label>
        <label class="field">
          <span class="field-label">宽度</span>
          <input type="range" :value="node.width || 180" min="100" max="600" step="10" @input="e => emit('resize', Number(e.target.value), null)" class="field-range" />
          <span class="range-value">{{ node.width || 180 }}px</span>
        </label>
        <label class="field">
          <span class="field-label">高度</span>
          <input type="range" :value="node.height || 56" min="40" max="800" step="10" @input="e => emit('resize', null, Number(e.target.value))" class="field-range" />
          <span class="range-value">{{ node.height || 56 }}px</span>
        </label>
        <label class="field">
          <span class="field-label">折叠子节点</span>
          <div class="toggle-row">
            <label class="toggle"><input type="checkbox" :checked="node.collapsed" @change="emit('toggle-collapse', node.id)" /><span class="toggle-slider"></span></label>
            <span>{{ node.collapsed ? '已折叠' : '已展开' }}</span>
          </div>
        </label>
        <label class="field">
          <span class="field-label">显示内容</span>
          <div class="toggle-row">
            <label class="toggle"><input type="checkbox" :checked="node.expanded" @change="emit('toggle-expand', node.id)" /><span class="toggle-slider"></span></label>
            <span>{{ node.expanded ? '已展开' : '已折叠' }}</span>
          </div>
        </label>
        <div class="actions">
          <button class="btn btn-secondary" @click="emit('reset-position', node.id)" :disabled="node.x == null && node.y == null">重置位置</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="empty-hint">
        <span class="empty-icon">👆</span>
        <p>点击节点进行编辑</p>
      </div>
    </template>
  </aside>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import markdownItKatex from 'markdown-it-katex'
import hljs from 'highlight.js'

const props = defineProps({
  node: { type: Object, default: null },
  isRoot: { type: Boolean, default: false },
  remoteEditors: { type: Array, default: () => [] },
})
const emit = defineEmits([
  'update', 'add-child', 'delete-node',
  'toggle-collapse', 'toggle-expand', 'resize', 'reset-position',
  'focus', 'blur',
])

const activeTab = ref('edit')
const mdTextarea = ref(null)

const md = new MarkdownIt({
  html: true, breaks: true, linkify: true, typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
      } catch (_) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
  }
})
md.use(markdownItKatex, { throwOnError: false, errorColor: '#cc0000' })

const renderedMarkdown = computed(() => {
  if (!props.node || !props.node.content) {
    return '<p style="color:#999;font-style:italic;">no content</p>'
  }
  return md.render(props.node.content)
})

function insertMd(before, after) {
  const ta = mdTextarea.value
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const text = ta.value
  const selected = text.substring(start, end)
  const newText = text.substring(0, start) + before + selected + after + text.substring(end)
  emit('update', { content: newText })
  nextTick(() => {
    ta.focus()
    ta.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
}

function insertMdCode() {
  insertMd('```\n', '\n```')
}

function insertMdMath() {
  insertMd('$$\n', '\n$$')
}

function insertMdTable() {
  insertMd('\n| col1 | col2 | col3 |\n| --- | --- | --- |\n| val1 | val2 | val3 |\n', '')
}

function insertMdColor() {
  insertMd("<span style='color:red'>", '</span>')
}

let contentTimer = null
function onContentChange(e) {
  clearTimeout(contentTimer)
  contentTimer = setTimeout(() => emit('update', { content: e.target.value }), 150)
}
</script>

<style scoped>
.editor-panel {
  width: 340px; flex-shrink: 0; background: #fff;
  border-left: 1px solid #e0e0e0;
  display: flex; flex-direction: column; overflow: hidden;
}
.editor-panel.empty { justify-content: center; align-items: center; }

.remote-banner {
  display: flex; gap: 4px; flex-shrink: 0;
  padding: 6px 12px; background: #FFF3E0;
  border-bottom: 1px solid #FFE0B2;
}
.remote-badge {
  font-size: 11px; color: white; padding: 2px 8px;
  border-radius: 10px; font-weight: 600;
}

.tabs { display: flex; border-bottom: 2px solid #f0f0f0; flex-shrink: 0; }
.tab {
  flex: 1; padding: 10px 0; border: none; background: none;
  font-size: 13px; font-weight: 600; color: #999; cursor: pointer;
  transition: all 0.2s; border-bottom: 2px solid transparent; margin-bottom: -2px;
}
.tab:hover { color: #555; }
.tab.active { color: #4A90D9; border-bottom-color: #4A90D9; }
.tab-content {
  flex: 1; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
}

.field { display: flex; flex-direction: column; gap: 4px; }
.field-label {
  font-size: 11px; font-weight: 600; color: #888;
  text-transform: uppercase; letter-spacing: 0.5px;
  display: flex; align-items: center; gap: 6px;
}
.field-hint { font-weight: 400; text-transform: none; color: #bbb; font-size: 10px; }
.field-input {
  width: 100%; padding: 8px 10px; border: 1px solid #dde;
  border-radius: 6px; font-size: 13px; outline: none;
  transition: border-color 0.2s; font-family: inherit;
}
.field-input:focus { border-color: #4A90D9; box-shadow: 0 0 0 2px rgba(74,144,217,0.15); }
.field-color {
  width: 40px; height: 32px; border: 1px solid #dde;
  border-radius: 6px; cursor: pointer; padding: 2px;
}
.field-textarea { resize: vertical; min-height: 80px; }
.md-textarea {
  font-family: "SF Mono","Fira Code","Consolas",monospace;
  font-size: 12px; line-height: 1.6; min-height: 200px;
}
.field-range { width: 100%; accent-color: #4A90D9; }
.range-value { font-size: 11px; color: #888; text-align: right; }

.md-toolbar { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 4px; }
.md-toolbar button {
  padding: 3px 7px; border: 1px solid #e0e0e0; border-radius: 4px;
  background: #f8f8f8; font-size: 11px; cursor: pointer;
  color: #555; transition: all 0.15s;
}
.md-toolbar button:hover { background: #4A90D9; color: #fff; border-color: #4A90D9; }

.color-row { display: flex; align-items: center; gap: 10px; }
.color-hex { font-size: 13px; font-family: monospace; color: #666; }

.toggle-row { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #555; }
.toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
  background: #ccc; border-radius: 22px; transition: 0.3s;
}
.toggle-slider::before {
  content: ""; position: absolute; height: 16px; width: 16px;
  left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s;
}
.toggle input:checked + .toggle-slider { background: #4A90D9; }
.toggle input:checked + .toggle-slider::before { transform: translateX(18px); }

.actions { display: flex; gap: 8px; margin-top: 4px; }
.btn {
  flex: 1; padding: 8px 0; border: none; border-radius: 6px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: opacity 0.2s; color: white;
}
.btn:hover { opacity: 0.85; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary { background: #4A90D9; }
.btn-secondary { background: #888; }
.btn-danger { background: #e74c3c; }

.preview-header { padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; margin-bottom: 8px; }
.markdown-preview { font-size: 13px; line-height: 1.7; color: #333; word-break: break-word; }
.markdown-preview :deep(h1), .markdown-preview :deep(h2), .markdown-preview :deep(h3) { margin: 12px 0 6px; color: #2c3e50; }
.markdown-preview :deep(h1) { font-size: 18px; border-bottom: 2px solid #eee; padding-bottom: 4px; }
.markdown-preview :deep(h2) { font-size: 15px; }
.markdown-preview :deep(h3) { font-size: 13px; }
.markdown-preview :deep(p) { margin: 6px 0; }
.markdown-preview :deep(code) { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-size: 11px; font-family: monospace; color: #e74c3c; }
.markdown-preview :deep(pre) { background: #282c34; color: #abb2bf; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 11px; line-height: 1.5; margin: 8px 0; }
.markdown-preview :deep(pre code) { background: none; padding: 0; color: inherit; font-size: 11px; }
.markdown-preview :deep(blockquote) { border-left: 3px solid #4A90D9; padding: 4px 12px; margin: 8px 0; color: #666; background: #f8f9fb; }
.markdown-preview :deep(ul), .markdown-preview :deep(ol) { padding-left: 20px; margin: 6px 0; }
.markdown-preview :deep(li) { margin: 2px 0; }
.markdown-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
.markdown-preview :deep(th), .markdown-preview :deep(td) { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
.markdown-preview :deep(th) { background: #f4f6f8; font-weight: 600; }
.markdown-preview :deep(img) { max-width: 100%; border-radius: 4px; }
.markdown-preview :deep(a) { color: #4A90D9; }
.markdown-preview :deep(hr) { border: none; border-top: 1px solid #eee; margin: 12px 0; }

.empty-hint { text-align: center; color: #aaa; }
.empty-icon { font-size: 36px; display: block; margin-bottom: 10px; }
.empty-hint p { font-size: 13px; margin: 0; }
</style>
