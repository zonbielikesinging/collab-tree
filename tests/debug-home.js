// tests/debug-home.js — Quick smoke test for home page + canvas creation
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  page.on('console', msg => {
    if (msg.text().startsWith('[debug]') || msg.text().startsWith('[TC]'))
      console.log(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

  // 1. Load home page
  await page.goto('http://localhost:1234', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  const title = await page.title()
  console.log('Page title:', title)

  // Check empty state
  const emptyState = page.locator('.empty-state')
  const emptyVisible = await emptyState.isVisible().catch(() => false)
  console.log('Empty state visible:', emptyVisible)

  // 2. Click "新建画布"
  const createBtn = page.locator('button', { hasText: '新建画布' })
  await createBtn.click()
  await page.waitForTimeout(2000)

  // Should now be on canvas page
  const url = page.url()
  console.log('After create, URL:', url)

  const canvasPage = page.locator('.app')
  const canvasVisible = await canvasPage.isVisible().catch(() => false)
  console.log('Canvas page visible:', canvasVisible)

  // Check brand name in toolbar
  const brandName = page.locator('.toolbar .title')
  const brandText = await brandName.innerText().catch(() => 'not found')
  console.log('Canvas name:', brandText)

  // Check tree renders
  const nodes = page.locator('svg g.node')
  const nodeCount = await nodes.count()
  console.log('Nodes rendered:', nodeCount)

  // 3. Navigate back to home
  const backBtn = page.locator('.back-btn')
  await backBtn.click()
  await page.waitForTimeout(500)

  const homeUrl = page.url()
  console.log('After back, URL:', homeUrl)

  // Check canvas card appears
  const cards = page.locator('.canvas-card')
  const cardCount = await cards.count()
  console.log('Canvas cards:', cardCount)

  // 4. Click the card to open canvas
  if (cardCount > 0) {
    await cards.first().click()
    await page.waitForTimeout(1000)
    const canvasUrl = page.url()
    console.log('After clicking card, URL:', canvasUrl)
  }

  await browser.close()
  console.log('\n✅ Smoke test complete')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })