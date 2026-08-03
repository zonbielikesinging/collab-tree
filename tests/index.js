// tests/index.js — Quick smoke test for CollabTree
// Run: node tests/index.js
// For full E2E: node tests/e2e.js

const { chromium } = require('playwright')

const BASE = 'http://localhost:1234'

async function main() {
  console.log('🌲 CollabTree Smoke Test\n')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  page.on('console', msg => {
    if (msg.text().startsWith('[debug]') || msg.text().startsWith('[TC]'))
      console.log(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

  let passed = 0, failed = 0

  function check(name, ok) {
    if (ok) { passed++; console.log(`  ✅ ${name}`) }
    else { failed++; console.log(`  ❌ ${name}`) }
  }

  try {
    // 1. Home page loads
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => localStorage.clear())
    await page.waitForTimeout(500)
    check('Home page loads', (await page.title()).includes('CollabTree'))

    // 2. Empty state
    check('Empty state shown', await page.locator('.empty-state').isVisible().catch(() => false))

    // 3. Create canvas
    await page.locator('button', { hasText: '新建画布' }).click()
    await page.waitForTimeout(2000)
    await page.waitForSelector('svg g.node', { timeout: 10000 }).catch(() => {})
    check('Canvas created', (await page.url()).includes('/canvas/'))

    // 4. Tree renders
    const nodeCount = await page.locator('svg g.node').count()
    check('Tree renders with nodes', nodeCount >= 1)

    // 5. Click node opens editor
    const nodeG = page.locator('svg g.node').first()
    const box = await nodeG.boundingBox()
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3)
    await page.waitForTimeout(300)
    check('Editor opens on click', await page.locator('.editor-panel').isVisible())

    // 6. Edit label
    const input = page.locator('.field-input[type="text"]')
    await input.fill('Hello World')
    await page.waitForTimeout(300)
    const label = await page.locator('svg g.node text').first().textContent()
    check('Label edit works', label.includes('Hello World'))

    // 7. Add child node
    const before = await page.locator('svg g.node').count()
    await page.locator('button', { hasText: '添加子节点' }).click()
    await page.waitForTimeout(1500)
    check('Child node added', (await page.locator('svg g.node').count()) > before)

    // 8. Drag handle
    const handle = page.locator('svg g.node .drag-handle').first()
    const hBox = await handle.boundingBox()
    await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(hBox.x + hBox.width / 2 + 80, hBox.y + hBox.height / 2 + 40, { steps: 5 })
    await page.mouse.up()
    check('Drag handle works', true)

    // 9. Back to home
    await page.locator('.back-btn').click()
    await page.waitForTimeout(500)
    check('Back to home', !(await page.url()).includes('/canvas/'))

    // 10. Card click opens canvas
    await page.locator('.canvas-card').first().click()
    await page.waitForTimeout(2000)
    check('Card click opens canvas', (await page.url()).includes('/canvas/'))

  } catch (e) {
    console.log(`  ❌ FATAL: ${e.message}`)
    failed++
  }

  await browser.close()

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })