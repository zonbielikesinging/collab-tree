// tests/clear-idb.js — Clear IndexedDB data for the tree app
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  await page.goto('http://localhost:1234', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  // Clear all IndexedDB databases
  await page.evaluate(async () => {
    const databases = await indexedDB.databases()
    for (const db of databases) {
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(db.name)
        req.onsuccess = resolve
        req.onerror = reject
      })
      console.log(`Deleted IDB: ${db.name}`)
    }
  })

  console.log('IndexedDB cleared')
  await browser.close()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })