<template>
  <div class="user-list">
    <!-- Current user -->
    <button class="user-chip me" :title="userName + ' (点击编辑)'" @click="$emit('editProfile')">
      <span class="user-avatar" :style="{ background: userColor }">{{ userInitials }}</span>
      <span class="user-name">{{ userName }}</span>
      <span class="user-you">你</span>
    </button>

    <!-- Remote users -->
    <div
      v-for="user in remoteUsers"
      :key="user.clientId"
      class="user-chip"
      :title="user.name"
    >
      <span class="user-avatar" :style="{ background: user.color }">{{ user.initials || user.name[0] }}</span>
      <span class="user-name">{{ user.name }}</span>
      <span v-if="user.editingNodeId" class="user-activity">编辑中</span>
    </div>

    <!-- Online count -->
    <div class="user-count" :title="onlineCount + ' 人在线'">
      <span class="online-icon">👥</span>
      <span>{{ onlineCount }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  userName: { type: String, default: '?' },
  userColor: { type: String, default: '#999' },
  userInitials: { type: String, default: '?' },
  remoteUsers: { type: Array, default: () => [] },
  onlineCount: { type: Number, default: 1 },
})

defineEmits(['editProfile'])
</script>

<style scoped>
.user-list {
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px 2px 3px;
  border-radius: 14px;
  background: rgba(255,255,255,0.1);
  font-size: 11px;
  color: white;
  white-space: nowrap;
  border: none;
  cursor: default;
}
.user-chip.me {
  cursor: pointer;
  padding-right: 6px;
}
.user-chip.me:hover {
  background: rgba(255,255,255,0.2);
}
.user-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.user-name {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-you {
  font-size: 9px;
  opacity: 0.5;
  text-transform: uppercase;
}
.user-activity {
  font-size: 9px;
  background: rgba(255,152,0,0.3);
  padding: 0 4px;
  border-radius: 3px;
  color: #FF9800;
}
.user-count {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: rgba(255,255,255,0.6);
  padding-left: 8px;
  border-left: 1px solid rgba(255,255,255,0.15);
  margin-left: 4px;
}
.online-icon {
  font-size: 12px;
}
</style>