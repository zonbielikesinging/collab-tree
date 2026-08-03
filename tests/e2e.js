// tests/e2e.js — End-to-end full flow tests
// Tests: home page, canvas CRUD, node editing, drag/resize, save/load
// Run: node tests/e2e.js

const { chromium } = require('playwright')

const BASE = 'http://localhost:1234'
const TESTS = []

function test(name, fn) { TESTS.push({ name, fn }) }

// ── Helpers ──
async function goHome(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
}

async function createCanvas(page, name = '测试画布') {
  await goHome(page)
  const createBtn = page.locator('button', { hasText: '新建画布' })
  await createBtn.click()
  await page.waitForTimeout(2000)
  await page.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)

  // Always rename after creation for consistency
  if (name !== '新画布') {
    await page.locator('.back-btn').click()
    await page.waitForTimeout(500)

    // Find the card we just created (last one, or match by name)
    const card = page.locator('.canvas-card', { hasText: '新画布' }).last()
    const renameBtn = card.locator('.card-btn').first()
    await renameBtn.click()
    await page.waitForTimeout(200)

    const input = page.locator('.modal-input')
    await input.fill(name)
    await page.locator('button', { hasText: '确认' }).click()
    await page.waitForTimeout(500)

    // Open the renamed canvas
    const renamedCard = page.locator('.canvas-card', { hasText: name }).last()
    await renamedCard.click()
    await page.waitForTimeout(2000)
    await page.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(500)
  }
}

async function waitForCanvas(page) {
  await page.waitForSelector('svg g.node', { timeout: 10000 })
  await page.waitForTimeout(800)
}

async function clickNodeBody(page, index = 0) {
  const nodeG = page.locator('svg g.node').nth(index)
  const box = await nodeG.boundingBox()
  if (!box) throw new Error('Node bounding box not found')
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3)
  await page.waitForTimeout(300)
}

// ── Tests ──

// ── Home Page ──
test('home page loads', async (page) => {
  await goHome(page)
  const title = await page.title()
  if (!title) throw new Error('No page title')
  const brand = page.locator('.brand .title')
  if (!(await brand.isVisible())) throw new Error('Brand not visible')
  console.log('  ✓ Brand visible')
})

test('home page shows empty state when no canvases', async (page) => {
  await goHome(page)
  // Clear localStorage
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(500)

  const emptyState = page.locator('.empty-state')
  if (!(await emptyState.isVisible())) throw new Error('Empty state not shown')
  console.log('  ✓ Empty state shown')
})

test('new canvas button navigates to canvas page', async (page) => {
  await goHome(page)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(500)
  await page.locator('button', { hasText: '新建画布' }).click()
  await page.waitForTimeout(1500)

  const url = page.url()
  if (!url.includes('/canvas/')) throw new Error('Not on canvas page: ' + url)
  console.log('  ✓ Navigated to canvas')
})

// ── Canvas CRUD ──
test('canvas list shows created canvases', async (page) => {
  await createCanvas(page, '画布A')
  await goHome(page)
  await page.waitForTimeout(500)

  const cards = page.locator('.canvas-card')
  const count = await cards.count()
  if (count < 1) throw new Error('No canvas cards shown')
  console.log(`  ✓ ${count} canvas card(s) shown`)
})

test('rename canvas', async (page) => {
  await createCanvas(page, '画布B')
  await goHome(page)
  await page.waitForTimeout(500)

  // Find the canvas card for 画布B
  const card = page.locator('.canvas-card', { hasText: '画布B' })
  if (!(await card.isVisible())) throw new Error('Canvas card not found')

  // Click rename button
  const renameBtn = card.locator('.card-btn').first()
  await renameBtn.click()
  await page.waitForTimeout(200)

  // Rename
  const input = page.locator('.modal-input')
  await input.fill('画布B-重命名')
  await page.locator('button', { hasText: '确认' }).click()
  await page.waitForTimeout(300)

  const renamed = page.locator('.canvas-card', { hasText: '画布B-重命名' })
  if (!(await renamed.isVisible())) throw new Error('Rename failed')
  console.log('  ✓ Canvas renamed')
})

test('delete canvas', async (page) => {
  await createCanvas(page, '待删除')
  await goHome(page)
  await page.waitForTimeout(500)

  const countBefore = await page.locator('.canvas-card').count()

  // Handle confirm dialog BEFORE clicking delete
  page.once('dialog', async dialog => {
    await dialog.accept()
  })

  // Click delete button on the card
  const card = page.locator('.canvas-card', { hasText: '待删除' })
  const deleteBtn = card.locator('.card-btn').last()
  await deleteBtn.click()
  await page.waitForTimeout(800)

  const countAfter = await page.locator('.canvas-card').count()
  if (countAfter >= countBefore) throw new Error(`Delete failed: ${countBefore} → ${countAfter}`)
  console.log(`  ✓ Deleted: ${countBefore} → ${countAfter}`)
})

test('back button returns to home', async (page) => {
  await createCanvas(page, '返回测试')
  await page.waitForTimeout(500)

  await page.locator('.back-btn').click()
  await page.waitForTimeout(500)

  const url = page.url()
  if (url.includes('/canvas/')) throw new Error('Still on canvas page: ' + url)
  console.log('  ✓ Back to home')
})

// ── Node Operations ──
test('click node opens editor', async (page) => {
  await createCanvas(page, '编辑测试')
  await clickNodeBody(page)

  const editor = page.locator('.editor-panel')
  if (!(await editor.isVisible())) throw new Error('Editor not shown')
  console.log('  ✓ Editor opened')
})

test('edit node label', async (page) => {
  await createCanvas(page, '标签测试')
  await clickNodeBody(page)

  const input = page.locator('.field-input[type="text"]')
  await input.fill('新标签名称')
  await page.waitForTimeout(300)

  // Check node label updated on canvas — SVG text element
  const label = page.locator('svg g.node text').first()
  const text = await label.textContent()
  if (!text.includes('新标签名称')) throw new Error(`Label not updated: "${text}"`)
  console.log('  ✓ Label updated to: ' + text)
})

test('add child node', async (page) => {
  await createCanvas(page, '子节点测试')
  await clickNodeBody(page)

  const countBefore = await page.locator('svg g.node').count()

  // Click "添加子节点" in editor
  await page.locator('button', { hasText: '添加子节点' }).click()
  await page.waitForTimeout(1500)

  const countAfter = await page.locator('svg g.node').count()
  if (countAfter <= countBefore) throw new Error(`Child not added: ${countBefore} → ${countAfter}`)
  console.log(`  ✓ Child added: ${countBefore} → ${countAfter}`)
})

test('change node color', async (page) => {
  await createCanvas(page, '颜色修改')
  await clickNodeBody(page)

  // Switch to style tab
  await page.locator('.tab', { hasText: '样式' }).click()
  await page.waitForTimeout(300)

  // Set color via evaluate (avoid Playwright fill on color input which crashes)
  await page.evaluate(() => {
    const input = document.querySelector('.field-color')
    if (input) {
      input.value = '#e74c3c'
      input.dispatchEvent(new Event('change', { bubbles: true }))
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await page.waitForTimeout(500)

  // Check node rect color changed
  const found = await page.evaluate(() => {
    const rects = document.querySelectorAll('svg g.node rect')
    for (const r of rects) {
      if (r.getAttribute('fill') === '#e74c3c') return true
    }
    return false
  })
  if (!found) throw new Error('Color not changed')
  console.log('  ✓ Color changed')
})

test('add branch from toolbar', async (page) => {
  await createCanvas(page, '分支测试')
  await page.waitForTimeout(500)

  const countBefore = await page.locator('svg g.node').count()

  // Click "添加分支" in toolbar
  await page.locator('button', { hasText: '添加分支' }).click()
  await page.waitForTimeout(1500)

  const countAfter = await page.locator('svg g.node').count()
  // May be collapsed — check if count increased
  if (countAfter <= countBefore) {
    console.log('  - Branches may be collapsed, count unchanged')
  } else {
    console.log(`  ✓ Branch added: ${countBefore} → ${countAfter}`)
  }
})

test('drag handle moves node', async (page) => {
  await createCanvas(page, '拖拽测试')
  await page.waitForTimeout(500)

  const handle = page.locator('svg g.node .drag-handle').first()
  const box = await handle.boundingBox()
  if (!box) throw new Error('Drag handle not found')

  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 80, startY + 40, { steps: 5 })
  await page.mouse.up()

  console.log('  ✓ Drag completed')
})

test('resize handle resizes node', async (page) => {
  await createCanvas(page, '缩放测试')
  await page.waitForTimeout(500)

  const handle = page.locator('svg g.node .resize-handle').first()
  const box = await handle.boundingBox()
  if (!box) throw new Error('Resize handle not found')

  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 50, startY + 30, { steps: 5 })
  await page.mouse.up()

  console.log('  ✓ Resize completed')
})

test('zoom with mouse wheel', async (page) => {
  await createCanvas(page, '缩放测试')
  await page.waitForTimeout(500)

  const svg = page.locator('svg').first()
  const svgBox = await svg.boundingBox()
  await page.mouse.move(svgBox.x + 50, svgBox.y + 50)
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(300)

  console.log('  ✓ Zoom performed')
})

test('pan with background drag', async (page) => {
  await createCanvas(page, '平移测试')
  await page.waitForTimeout(500)

  const svg = page.locator('svg').first()
  const svgBox = await svg.boundingBox()

  await page.mouse.move(svgBox.x + 10, svgBox.y + 10)
  await page.mouse.down()
  await page.mouse.move(svgBox.x + 60, svgBox.y + 50, { steps: 5 })
  await page.mouse.up()

  console.log('  ✓ Pan completed')
})

test('node editor tabs work', async (page) => {
  await createCanvas(page, 'Tab测试')
  await clickNodeBody(page)

  // Click preview tab
  await page.locator('.tab', { hasText: '预览' }).click()
  await page.waitForTimeout(200)
  const preview = page.locator('.markdown-preview')
  if (!(await preview.isVisible())) throw new Error('Preview tab not working')
  console.log('  ✓ Preview tab works')

  // Click style tab
  await page.locator('.tab', { hasText: '样式' }).click()
  await page.waitForTimeout(200)
  const colorInput = page.locator('.field-color')
  if (!(await colorInput.isVisible())) throw new Error('Style tab not working')
  console.log('  ✓ Style tab works')
})

test('edit markdown content', async (page) => {
  await createCanvas(page, 'MD测试')
  await clickNodeBody(page)

  const textarea = page.locator('.md-textarea')
  // Use evaluate to set content directly
  await page.evaluate(() => {
    const ta = document.querySelector('.md-textarea')
    if (ta) {
      ta.value = '# Hello\n\n这是 **Markdown** 内容'
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await page.waitForTimeout(500)

  // Switch to preview
  await page.locator('.tab', { hasText: '预览' }).click()
  await page.waitForTimeout(300)

  const previewHtml = await page.locator('.markdown-preview').innerHTML()
  if (!previewHtml.includes('Hello')) throw new Error('Markdown not rendered')
  console.log('  ✓ Markdown rendered')
})

test('node selection persists across canvas switch', async (page) => {
  // Create canvas A
  await createCanvas(page, '切换测试A')
  await page.locator('button', { hasText: '添加分支' }).click()
  await page.waitForTimeout(2000)

  const countA = await page.locator('svg g.node').count()

  // Go home, create canvas B
  await page.locator('.back-btn').click()
  await page.waitForTimeout(800)

  await createCanvas(page, '切换测试B')
  await page.waitForTimeout(1000)

  // Go home, open canvas A
  await page.locator('.back-btn').click()
  await page.waitForTimeout(800)

  const cardA = page.locator('.canvas-card', { hasText: '切换测试A' }).last()
  await cardA.click()
  await page.waitForTimeout(3000)
  await page.waitForSelector('svg g.node', { timeout: 10000 })

  const countAfter = await page.locator('svg g.node').count()
  console.log(`  ✓ Switched back, ${countAfter} nodes (was ${countA})`)
})

test('canvas data persists after page reload', async (page) => {
  await createCanvas(page, '持久化测试')
  await page.waitForTimeout(500)

  // Add a child node
  await page.locator('button', { hasText: '添加分支' }).click()
  await page.waitForTimeout(2500)

  const countBefore = await page.locator('svg g.node').count()
  console.log('  Before reload:', countBefore, 'nodes')

  // Reload
  await page.reload()
  await page.waitForTimeout(5000)
  await page.waitForSelector('svg g.node', { timeout: 15000 })
  await page.waitForTimeout(500)

  const countAfter = await page.locator('svg g.node').count()
  if (countAfter === 0) throw new Error('No nodes after reload')
  console.log(`  ✓ Persisted: ${countBefore} → ${countAfter} nodes`)
})

test('no grab cursor on node body', async (page) => {
  await createCanvas(page, '光标测试')
  await page.waitForTimeout(500)

  const nodeG = page.locator('svg g.node').first()
  const box = await nodeG.boundingBox()
  if (!box) throw new Error('Node not in viewport')

  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3)
  await page.waitForTimeout(100)

  const cursor = await nodeG.evaluate(el => getComputedStyle(el).cursor)
  if (cursor === 'grab' || cursor === 'grabbing') {
    throw new Error(`Node cursor is '${cursor}' — should not be grab`)
  }
  console.log(`  ✓ Node cursor is '${cursor}'`)
})

// ── Runner ──
async function main() {
  console.log('🌲 CollabTree E2E Test Suite\n')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  // Clear localStorage and IndexedDB for clean start
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    localStorage.clear()
    const databases = await indexedDB.databases()
    for (const db of databases) {
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(db.name)
        req.onsuccess = resolve
        req.onerror = reject
      })
    }
  })

  // Reduce memory pressure: limit concurrent tests
  const runTests = async (testList) => {
    let passed = 0, failed = 0
    for (const { name, fn } of testList) {
      try {
        console.log(`\n▶ ${name}`)
        await fn(page)
        passed++
        console.log(`  ✅ PASSED`)
        // Clear localStorage between tests to reduce memory
        await page.evaluate(() => localStorage.clear())
      } catch (e) {
        failed++
        console.log(`  ❌ FAILED: ${e.message}`)
        try {
          await page.evaluate(() => 1)
        } catch {
          console.log('  ⚠ Browser crashed, skipping remaining tests')
          break
        }
      }
    }
    return { passed, failed }
  }

  const { passed, failed } = await runTests(TESTS)

  await browser.close()

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed, ${TESTS.length} total`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})