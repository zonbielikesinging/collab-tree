// tests/debug-click.js — Minimal test to debug click behavior
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  // Intercept ALL console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`)
  })

  // Intercept page errors
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

  await page.goto('http://localhost:1234', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('svg g.node', { timeout: 10000 })
  await page.waitForTimeout(1000)

  // Inject a click listener on the body to see if clicks reach anywhere
  await page.evaluate(() => {
    document.body.addEventListener('click', (e) => {
      console.log('[CLICK ON BODY]', e.target.tagName, e.target.className?.baseVal || e.target.className, 'at', e.clientX, e.clientY)
    }, true) // capture phase
  })

  // Also inject a listener on the SVG
  await page.evaluate(() => {
    const svg = document.querySelector('svg')
    if (svg) {
      svg.addEventListener('click', (e) => {
        console.log('[CLICK ON SVG]', e.target.tagName, e.target.className?.baseVal || e.target.className)
      })
    }
  })

  // Add listener on g.node
  await page.evaluate(() => {
    document.querySelectorAll('g.node').forEach(g => {
      g.addEventListener('click', (e) => {
        console.log('[CLICK ON g.node]', e.target.tagName, e.target.className?.baseVal || e.target.className)
      })
    })
  })

  // Find the node and click it
  const nodeG = page.locator('svg g.node').first()
  const box = await nodeG.boundingBox()
  console.log(`\nNode bounding box:`, box)

  if (box) {
    const cx = box.x + box.width * 0.3
    const cy = box.y + box.height / 2 - 10

    console.log(`Clicking at (${cx}, ${cy})...`)

    // Do a raw mouse click
    await page.mouse.click(cx, cy)

    await page.waitForTimeout(500)
  }

  // Check if editor panel appeared
  const editor = page.locator('.editor-panel')
  const editorVisible = await editor.isVisible().catch(() => false)
  console.log('Editor panel visible:', editorVisible)

  // Check what's in the node-editor
  if (editorVisible) {
    const text = await editor.innerText().catch(() => 'error')
    console.log('Editor content:', text.slice(0, 100))
  }

  // Check if empty-editor is still there
  const emptyEditor = page.locator('.empty-editor')
  const emptyVisible = await emptyEditor.isVisible().catch(() => false)
  console.log('Empty editor visible:', emptyVisible)

  await page.waitForTimeout(1000)
  await browser.close()
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})