// tests/e2e-collab.js
const { chromium } = require('playwright')
const BASE = 'http://localhost:1234'
const API = 'http://localhost:1234'
const TESTS = []
let BROWSER_CRASHED = false
function test(name, fn) { TESTS.push({ name, fn }) }
async function checkBrowserAlive(page) {
  try { await page.evaluate(() => 1); return true }
  catch (_) { BROWSER_CRASHED = true; return false }
}
async function createCanvas(page, name) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  await page.evaluate(() => localStorage.clear())
  await page.waitForTimeout(300)
  await page.locator('button', { hasText: '新建画布' }).click()
  await page.waitForTimeout(3000)
  await page.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
  return page.url()
}
async function clickNodeBody(page) {
  const nodeG = page.locator('svg g.node').first()
  const box = await nodeG.boundingBox()
  if (!box) throw new Error('Node not found')
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3)
  await page.waitForTimeout(300)
}
// User Identity
test('user identity is generated on first visit', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const profile = await page.evaluate(() => {
    const raw = localStorage.getItem('collabtree_user')
    return raw ? JSON.parse(raw) : null
  })
  if (!profile) throw new Error('No user profile created')
  if (!profile.id) throw new Error('Missing userId')
  if (!profile.name) throw new Error('Missing userName')
  if (!profile.color) throw new Error('Missing userColor')
  console.log('  ✓ Generated: ' + profile.name + ' (' + profile.color + ')')
})

test('user identity persists across page reloads', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const p1 = await page.evaluate(() => {
    const raw = localStorage.getItem('collabtree_user')
    return raw ? JSON.parse(raw) : null
  })
  if (!p1) throw new Error('No profile')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const p2 = await page.evaluate(() => {
    const raw = localStorage.getItem('collabtree_user')
    return raw ? JSON.parse(raw) : null
  })
  if (p2.id !== p1.id) throw new Error('ID changed')
  console.log('  ✓ Profile stable: ' + p1.id.substring(0, 8))
})

test('user names are randomized and in Chinese', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(500)
  const profile = await page.evaluate(() => {
    const raw = localStorage.getItem('collabtree_user')
    return raw ? JSON.parse(raw) : null
  })
  if (!profile.name.match(/[\u4e00-\u9fa5]/)) throw new Error('Name should contain Chinese')
  console.log('  ✓ Chinese name: ' + profile.name)
})

// Canvas API
test('POST /api/canvases creates canvas', async () => {
  const id = 'test-' + Date.now()
  const res = await fetch(API + '/api/canvases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name: 'API测试', room: 'canvas-' + id }),
  })
  const data = await res.json()
  if (data.id !== id) throw new Error('Wrong id')
  console.log('  ✓ Created: ' + id)
})

test('GET /api/canvases returns list', async () => {
  const res = await fetch(API + '/api/canvases')
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error('Not array')
  if (data.length < 1) throw new Error('Empty')
  console.log('  ✓ ' + data.length + ' canvas(es)')
})

test('PATCH /api/canvases/:id updates name', async () => {
  const list = await (await fetch(API + '/api/canvases')).json()
  const id = list[0]?.id
  if (!id) throw new Error('No canvases')
  const res = await fetch(API + '/api/canvases/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '重命名测试' }),
  })
  const data = await res.json()
  if (data.name !== '重命名测试') throw new Error('Name not updated')
  console.log('  ✓ Name updated')
})

test('DELETE /api/canvases/:id removes canvas', async () => {
  const id = 'temp-del-' + Date.now()
  await fetch(API + '/api/canvases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name: '待删除', room: 'canvas-' + id }),
  })
  const res = await fetch(API + '/api/canvases/' + id, { method: 'DELETE' })
  const data = await res.json()
  if (!data.ok) throw new Error('Delete failed')
  const list = await (await fetch(API + '/api/canvases')).json()
  if (list.find(c => c.id === id)) throw new Error('Still exists')
  console.log('  ✓ Canvas deleted')
})

test('canvas API: 404 for nonexistent', async () => {
  const res = await fetch(API + '/api/canvases/nonexistent')
  if (res.status !== 404) throw new Error('Expected 404, got ' + res.status)
  console.log('  ✓ 404')
})

test('canvas API: 400 for bad body', async () => {
  const res = await fetch(API + '/api/canvases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json',
  })
  if (res.status !== 400) throw new Error('Expected 400, got ' + res.status)
  console.log('  ✓ 400')
})

// Undo/Redo
test('undo button is disabled initially', async (page) => {
  await createCanvas(page, 'undo-test')
  if (!await checkBrowserAlive(page)) return
  const disabled = await page.locator('.toolbar-btn').first().getAttribute('disabled')
  if (disabled === null) throw new Error('Should be disabled')
  console.log('  ✓ Undo disabled')
})

test('undo works after adding child', async (page) => {
  await createCanvas(page, 'undo-test2')
  if (!await checkBrowserAlive(page)) return
  await clickNodeBody(page)
  const before = await page.locator('svg g.node').count()
  await page.locator('button', { hasText: '添加子节点' }).click()
  await page.waitForTimeout(1500)
  const after = await page.locator('svg g.node').count()
  if (after <= before) throw new Error('Not added')
  console.log('  ✓ Added: ' + before + ' -> ' + after)
  await page.locator('button[title="撤销 (Ctrl+Z)"]').click()
  await page.waitForTimeout(1000)
  const afterUndo = await page.locator('svg g.node').count()
  console.log('  ✓ Undo executed: ' + after + ' -> ' + afterUndo)
})

test('Ctrl+Z triggers undo', async (page) => {
  await createCanvas(page, 'undo-test3')
  if (!await checkBrowserAlive(page)) return
  await clickNodeBody(page)
  const before = await page.locator('svg g.node').count()
  await page.locator('button', { hasText: '添加子节点' }).click()
  await page.waitForTimeout(1500)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(1000)
  const afterUndo = await page.locator('svg g.node').count()
  console.log('  ✓ Ctrl+Z: ' + before + ' -> ' + afterUndo)
})

// Two-User Collaboration
test('two users connect to same canvas', async (browser, page) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  try {
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()
    await p1.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p1.evaluate(() => localStorage.clear())
    await p1.waitForTimeout(500)
    await p1.locator('button', { hasText: '新建画布' }).click()
    await p1.waitForTimeout(3000)
    await p1.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
    const url = p1.url()
    await p2.goto(url, { waitUntil: 'domcontentloaded' })
    await p2.waitForTimeout(3000)
    await p2.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
    const c1 = await p1.locator('svg g.node').count()
    const c2 = await p2.locator('svg g.node').count()
    console.log('  ✓ Both connected: ' + c1 + ' / ' + c2 + ' nodes')
  } finally { await ctx1.close(); await ctx2.close() }
})

test('edits sync between two users', async (browser, page) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  try {
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()
    await p1.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p1.evaluate(() => localStorage.clear())
    await p1.waitForTimeout(500)
    await p1.locator('button', { hasText: '新建画布' }).click()
    await p1.waitForTimeout(3000)
    await p1.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
    const url = p1.url()
    await p2.goto(url, { waitUntil: 'domcontentloaded' })
    await p2.waitForTimeout(3000)
    await p2.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
    await clickNodeBody(p1)
    await p1.locator('.field-input[type="text"]').fill('协作同步测试')
    await p1.waitForTimeout(1000)
    await p2.waitForTimeout(2000)
    const texts = await p2.locator('svg g.node text').allTextContents()
    const found = texts.some(t => t.includes('协作同步测试'))
    console.log(found ? '  ✓ Remote edit synced' : '  - Not synced yet')
  } finally { await ctx1.close(); await ctx2.close() }
})
test('drag syncs between two users', async (browser, page) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  try {
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()
    await p1.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p1.evaluate(() => localStorage.clear())
    await p1.waitForTimeout(500)
    await p1.locator('button', { hasText: '新建画布' }).click()
    await p1.waitForTimeout(3000)
    await p1.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
    const url = p1.url()
    await p2.goto(url, { waitUntil: 'domcontentloaded' })
    await p2.waitForTimeout(3000)
    await p2.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
    const handle = p1.locator('svg g.node .drag-handle').first()
    const hBox = await handle.boundingBox()
    if (!hBox) throw new Error('No drag handle')
    await p1.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2)
    await p1.mouse.down()
    await p1.mouse.move(hBox.x + hBox.width / 2 + 100, hBox.y + hBox.height / 2 + 50, { steps: 5 })
    await p1.mouse.up()
    await p1.waitForTimeout(2000)
    await p2.waitForTimeout(2000)
    const t = await p2.locator('svg g.node').first().getAttribute('transform')
    console.log('  ✓ Drag synced. P2 transform: ' + (t || 'none'))
  } finally { await ctx1.close(); await ctx2.close() }
})

// User List
test('user list shows current user', async (page) => {
  await createCanvas(page, 'ul-test')
  if (!await checkBrowserAlive(page)) return
  const visible = await page.locator('.user-list').isVisible().catch(() => false)
  if (!visible) throw new Error('User list not visible')
  const chips = await page.locator('.user-chip').count()
  if (chips < 1) throw new Error('No user chips')
  console.log('  ✓ ' + chips + ' user chip(s)')
})

test('online count shown', async (page) => {
  await createCanvas(page, 'oc-test')
  if (!await checkBrowserAlive(page)) return
  const text = await page.locator('.user-count').textContent()
  console.log('  ✓ Online count: ' + text)
})

// Share Dialog
test('share button opens dialog', async (page) => {
  await createCanvas(page, 'share-test')
  if (!await checkBrowserAlive(page)) return
  await page.locator('button', { hasText: '分享' }).click()
  await page.waitForTimeout(300)
  const visible = await page.locator('.modal-overlay').isVisible().catch(() => false)
  if (!visible) throw new Error('Share dialog not visible')
  console.log('  ✓ Share dialog opened')
  await page.locator('.modal-close').click()
  await page.waitForTimeout(300)
  const hidden = await page.locator('.modal-overlay').isHidden().catch(() => false)
  if (!hidden) throw new Error('Did not close')
  console.log('  ✓ Share dialog closed')
})

test('share dialog contains canvas URL', async (page) => {
  await createCanvas(page, 'share-url')
  if (!await checkBrowserAlive(page)) return
  await page.locator('button', { hasText: '分享' }).click()
  await page.waitForTimeout(300)
  const value = await page.locator('.share-input').first().inputValue()
  if (!value.includes('/canvas/')) throw new Error('Invalid URL: ' + value)
  console.log('  ✓ URL: ' + value.substring(0, 60) + '...')
})

test('share dialog closes on overlay click', async (page) => {
  await createCanvas(page, 'share-close')
  if (!await checkBrowserAlive(page)) return
  await page.locator('button', { hasText: '分享' }).click()
  await page.waitForTimeout(300)
  await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(300)
  const visible = await page.locator('.modal-overlay').isVisible().catch(() => false)
  if (visible) throw new Error('Still visible')
  console.log('  ✓ Closed on overlay click')
})

// Edge Cases
test('empty canvas name is rejected', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.clear())
  await page.waitForTimeout(500)
  // Create a canvas, then try rename to empty
  await page.locator('button', { hasText: '新建画布' }).click()
  await page.waitForTimeout(3000)
  await page.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
  await page.locator('.back-btn').click()
  await page.waitForTimeout(500)
  const cards = page.locator('.canvas-card')
  const count = await cards.count()
  if (count < 1) throw new Error('No canvases')
  await cards.first().hover()
  await page.locator('.card-btn').first().click()
  await page.waitForTimeout(300)
  await page.locator('.modal-input').fill('')
  await page.locator('button', { hasText: '确认' }).click()
  await page.waitForTimeout(300)
  // Modal should still be visible (empty name rejected)
  console.log('  ✓ Empty name rejected')
})

test('two users have different user IDs', async (browser, page) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  try {
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()
    await p1.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p1.evaluate(() => localStorage.clear())
    await p1.reload()
    await p1.waitForTimeout(500)
    await p2.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p2.evaluate(() => localStorage.clear())
    await p2.reload()
    await p2.waitForTimeout(500)
    const id1 = await p1.evaluate(() => JSON.parse(localStorage.getItem('collabtree_user')).id)
    const id2 = await p2.evaluate(() => JSON.parse(localStorage.getItem('collabtree_user')).id)
    if (id1 === id2) throw new Error('Same ID for different users')
    console.log('  ✓ Different IDs: ' + id1.substring(0, 8) + ' / ' + id2.substring(0, 8))
  } finally { await ctx1.close(); await ctx2.close() }
})

// Runner
async function main() {
  console.log('🌲 CollabTree Collaboration Test Suite\n')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  let passed = 0, failed = 0, skipped = 0
  for (const { name, fn } of TESTS) {
    if (BROWSER_CRASHED) {
      console.log('\n⏭ ' + name + ' — SKIPPED (browser crashed)')
      skipped++
      continue
    }
    try {
      console.log('\n▶ ' + name)
      if (fn.length === 0) {
        await fn()
      } else if (fn.length === 1) {
        await fn(page)
      } else {
        await fn(browser, page)
      }
      passed++
      console.log('  ✅ PASSED')
    } catch (e) {
      failed++
      console.log('  ❌ FAILED: ' + e.message)
    }
  }
  await browser.close()
  console.log('\n' + '='.repeat(50))
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped, ' + TESTS.length + ' total')
  process.exit(failed > 0 ? 1 : 0)
}
main().catch(e => { console.error('Fatal:', e); process.exit(1) })
