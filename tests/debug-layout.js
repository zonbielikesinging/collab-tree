// tests/debug-layout.js
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  page.on('console', msg => {
    if (msg.text().startsWith('[debug]') || msg.text().startsWith('[TC]') ||
        msg.text().startsWith('[layout]') || msg.text().startsWith('[node]'))
      console.log(`[${msg.type()}] ${msg.text()}`)
  })

  await page.goto('http://localhost:1234', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // Get node positions and sizes
  const info = await page.evaluate(() => {
    const nodes = document.querySelectorAll('svg g.node')
    const result = []
    nodes.forEach((n, i) => {
      const transform = n.getAttribute('transform')
      const rect = n.querySelector('rect')
      const w = rect?.getAttribute('width') || '?'
      const h = rect?.getAttribute('height') || '?'
      result.push(`Node ${i}: transform=${transform}, size=${w}x${h}`)
    })
    return result
  })
  console.log('Node info:', info)

  await browser.close()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })