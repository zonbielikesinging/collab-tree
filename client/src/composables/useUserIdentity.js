// ── User Identity ──
// Manages local user profile: nickname, color, and unique id.
// Persisted to localStorage; survives page reloads.

const STORAGE_KEY = 'collabtree_user'

// Predefined palette of distinct, readable colors for user cursors
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
  '#F1948A', '#85929E', '#AED6F1', '#D7BDE2',
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function assignColor(id) {
  return USER_COLORS[hashString(id) % USER_COLORS.length]
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const profile = JSON.parse(raw)
      // Validate
      if (profile.id && profile.name && profile.color) {
        return profile
      }
    }
  } catch (_) {}
  return null
}

function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

const ADJECTIVES = [
  '快乐', '勇敢', '安静', '活泼', '温柔', '机智', '可爱', '帅气',
  '优雅', '灵动', '敏捷', '沉稳', '幽默', '好奇', '调皮', '潇洒'
]
const NOUNS = [
  '熊猫', '海豚', '兔子', '狐狸', '考拉', '松鼠', '企鹅', '鹦鹉',
  '蝴蝶', '猫咪', '小狗', '仓鼠', '斑马', '羚羊', '燕子', '海星'
]

function randomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adj}的${noun}`
}

export function useUserIdentity() {
  let profile = loadProfile()

  function getInitials(name) {
    // Extract first character of meaningful words (skip 的, 了, etc.)
    const cleaned = name.replace(/[的了吗呢啊]/g, '')
    return cleaned.slice(0, 2) || name[0]
  }

  if (profile) {
    // Already has profile — ensure id is stable
    return {
      userId: profile.id,
      userName: profile.name,
      userColor: profile.color,
      userInitials: profile.initials || getInitials(profile.name),
      isNewUser: false,
      setName(name) {
        profile.name = name.trim()
        profile.initials = getInitials(name.trim())
        saveProfile(profile)
      },
    }
  }

  // New user — generate identity
  const id = generateId()
  const name = randomName()
  const color = assignColor(id)
  const initials = getInitials(name)
  profile = { id, name, color, initials, createdAt: Date.now() }
  saveProfile(profile)

  return {
    userId: id,
    userName: name,
    userColor: color,
    userInitials: initials,
    isNewUser: true,
    setName(name) {
      profile.name = name.trim()
      profile.initials = getInitials(name.trim())
      saveProfile(profile)
    },
  }
}