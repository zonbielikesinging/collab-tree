// tests/debug-color.js — Isolate the color change test
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

  // Go home, create canvas
  await page.goto('http://localhost:1234', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.clear())
  await page.waitForTimeout(500)

  const createBtn = page.locator('button', { hasText: '新建画布' })
  await createBtn.click()
  await page.waitForTimeout(2000)
  await page.waitForSelector('svg g.node', { timeout: 10000 })
  await page.waitForTimeout(500)

  console.log('Canvas loaded')

  // Click node
  const nodeG = page.locator('svg g.node').first()
  const box = await nodeG.boundingBox()
  console.log('Node bbox:', box)
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3)
  await page.waitForTimeout(300)

  console.log('Node clicked, editor visible:', await page.locator('.editor-panel').isVisible())

  // Switch to style tab
  await page.locator('.tab', { hasText: '样式' }).click()
  await page.waitForTimeout(300)
  console.log('Style tab clicked')

  // Try to interact with color input
  const colorInput = page.locator('.field-color')
  const colorVisible = await colorInput.isVisible()
  console.log('Color input visible:', colorVisible)

  if (colorVisible) {
    try {
      // Just click it
      await colorInput.click()
      console.log('Clicked color input')
      await page.waitForTimeout(500)
    } catch (e) {
      console.log('Error clicking color input:', e.message)
    }
  }

  console.log('Test survived!')
  await browser.close()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })