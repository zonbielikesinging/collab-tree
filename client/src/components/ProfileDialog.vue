<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal" @click.stop>
      <h3>编辑个人资料</h3>
      <div class="profile-preview">
        <span class="profile-avatar-lg" :style="{ background: userColor }">{{ userInitials }}</span>
        <span class="profile-name-preview">{{ pendingName || userName }}</span>
      </div>
      <label class="field">
        <span class="field-label">昵称</span>
        <input v-model="pendingName" type="text" class="modal-input"
          :placeholder="userName" maxlength="12" @keyup.enter="save" />
      </label>
      <div class="modal-actions">
        <button class="btn btn-outline" @click="randomizeName">🎲 随机</button>
        <button class="btn btn-primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  show: Boolean,
  userName: String,
  userColor: String,
  userInitials: String,
})

const emit = defineEmits(['close', 'save'])

const pendingName = ref('')

watch(() => props.show, (v) => { if (v) pendingName.value = '' })

function save() {
  const name = pendingName.value.trim()
  if (name) emit('save', name)
  emit('close')
}

function randomizeName() {
  const ADJECTIVES = ['快乐','勇敢','安静','活泼','温柔','机智','可爱','帅气','优雅','灵动','敏捷','沉稳','幽默','好奇','调皮','潇洒']
  const NOUNS = ['熊猫','海豚','兔子','狐狸','考拉','松鼠','企鹅','鹦鹉','蝴蝶','猫咪','小狗','仓鼠','斑马','羚羊','燕子','海星']
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  pendingName.value = `${adj}的${noun}`
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: white; border-radius: 12px; padding: 24px; width: 360px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
.modal h3 { font-size: 16px; margin-bottom: 16px; color: #2c3e50; }
.modal-input { width: 100%; padding: 10px 12px; border: 1px solid #dde; border-radius: 6px; font-size: 14px; outline: none; }
.modal-input:focus { border-color: #4A90D9; box-shadow: 0 0 0 2px rgba(74,144,217,0.15); }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.profile-preview { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: #f5f7fa; border-radius: 8px; }
.profile-avatar-lg { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
.profile-name-preview { font-size: 18px; font-weight: 600; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.field-label { font-size: 12px; font-weight: 600; color: #888; }
.btn { padding: 8px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.btn:hover { opacity: 0.85; }
.btn-primary { background: #4A90D9; color: white; }
.btn-outline { background: transparent; border: 1px solid #dde; color: #666; }
.btn-outline:hover { background: #f5f5f5; }
</style>