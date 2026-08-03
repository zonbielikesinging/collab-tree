// tests/debug-screenshot.js
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  page.on('console', msg => {
    if (msg.text().startsWith('[debug]') || msg.text().startsWith('[TC]') ||
        msg.text().startsWith('[layout]'))
      console.log(`[${msg.type()}] ${msg.text()}`)
  })

  await page.goto('http://localhost:1234', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // Get zoom transform
  const zoomInfo = await page.evaluate(() => {
    const g = document.querySelector('svg > g')
    const transform = g?.getAttribute('transform')
    const nodes = document.querySelectorAll('svg g.node')
    const nodeInfo = []
    nodes.forEach((n, i) => {
      const b = n.getBBox()
      const rect = n.querySelector('rect')
      const rw = rect?.getAttribute('width') || '?'
      const rh = rect?.getAttribute('height') || '?'
      nodeInfo.push(`Node ${i}: transform=${n.getAttribute('transform')}, rect=${rw}x${rh}, bbox={x:${b.x},y:${b.y},w:${b.width},h:${b.height}}`)
    })
    // Also get the SVG viewBox
    const svg = document.querySelector('svg')
    const viewBox = svg?.getAttribute('viewBox')
    return { transform, nodeInfo, viewBox }
  })
  console.log('Zoom transform:', zoomInfo.transform)
  console.log('SVG viewBox:', zoomInfo.viewBox)
  console.log('Node info:', zoomInfo.nodeInfo)

  // Screenshot
  await page.screenshot({ path: '/home/user/projects/collab-tree/tests/screenshot.png' })
  console.log('Screenshot saved')

  await browser.close()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })