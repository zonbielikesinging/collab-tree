// tests/debug-add.js
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`))

  await page.goto('http://localhost:1234', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const countBefore = await page.locator('svg g.node').count()
  console.log('Nodes before:', countBefore)

  // Check rootId via Vue devtools approach
  const result = await page.evaluate(() => {
    const appEl = document.querySelector('#app')
    const vm = appEl.__vue_app__._instance?.proxy
    console.log('vm:', !!vm)
    if (vm) {
      console.log('rootId:', vm.rootId)
      console.log('treeData:', vm.treeData)
    }
    return 'done'
  })

  // Click add branch button
  const addBtn = page.locator('button', { hasText: '添加分支' })
  const btnCount = await addBtn.count()
  console.log('Add button count:', btnCount)

  if (btnCount > 0) {
    const btnBox = await addBtn.boundingBox()
    console.log('Button box:', btnBox)
    await addBtn.click()
    await page.waitForTimeout(3000)
  }

  const countAfter = await page.locator('svg g.node').count()
  console.log('Nodes after:', countAfter)

  // Also check the inner text of all nodes
  const nodeTexts = await page.locator('svg g.node').allTextContents()
  console.log('Node texts:', nodeTexts)

  // Debug: check if addNode was called
  const debugLogs = await page.evaluate(() => {
    const logs = document.querySelectorAll('.debug-panel .log-entry')
    return Array.from(logs).map(l => l.textContent).join('\n')
  })
  console.log('Debug logs:', debugLogs)

  await browser.close()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })