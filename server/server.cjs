const { WebSocketServer } = require('ws')
const { setupWSConnection, setPersistence, docs } = require('y-websocket/bin/utils')
const Y = require('yjs')
const fs = require('fs')
const path = require('path')
const http = require('http')

const DATA_DIR = path.join(__dirname, 'data')
const DIST_DIR = path.join(__dirname, '..', 'client', 'dist')
const PORT = process.env.PORT || 1234

// ── Ensure data directory exists ──────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// ── Persistence: load on bind, save on update ─────────────────────────────
const docMeta = new Map()

setPersistence({
  bindState: async (docName, ydoc) => {
    const filePath = path.join(DATA_DIR, `${docName}.json`)
    const meta = { lastSaved: Date.now(), dirty: false }
    docMeta.set(docName, meta)

    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const updates = JSON.parse(raw)
        if (Array.isArray(updates) && updates.length > 0) {
          Y.applyUpdate(ydoc, Buffer.from(updates[0], 'base64'))
        }
        console.log(`[persist] ✓ Loaded: ${docName}`)
      } catch (err) {
        console.error(`[persist] ✗ Load failed ${docName}:`, err.message)
      }
    } else {
      console.log(`[persist]   New: ${docName}`)
    }

    ydoc.on('update', () => {
      meta.dirty = true
      scheduleSave()
    })
  },

  writeState: async (docName, ydoc) => {
    const filePath = path.join(DATA_DIR, `${docName}.json`)
    try {
      const state = Y.encodeStateAsUpdate(ydoc)
      const updates = [Buffer.from(state).toString('base64')]
      await fs.promises.writeFile(filePath, JSON.stringify(updates), 'utf-8')
    } catch (err) {
      console.error(`[persist] ✗ Save failed ${docName}:`, err.message)
    }
  }
})

// ── Periodic auto-save (debounced, only if dirty) ────────────────────────
const AUTO_SAVE_INTERVAL = parseInt(process.env.AUTO_SAVE_INTERVAL || '60000', 10)
let saveTimer = null

function scheduleSave() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    const now = Date.now()
    for (const [docName, meta] of docMeta) {
      if (!meta.dirty || now - meta.lastSaved < 5_000) continue
      const ydoc = docs.get(docName)
      if (!ydoc) continue
      const filePath = path.join(DATA_DIR, `${docName}.json`)
      try {
        const state = Y.encodeStateAsUpdate(ydoc)
        const updates = [Buffer.from(state).toString('base64')]
        fs.writeFileSync(filePath, JSON.stringify(updates), 'utf-8')
        meta.lastSaved = now
        meta.dirty = false
      } catch (err) {
        console.error(`[persist] Auto-save failed for ${docName}:`, err.message)
      }
    }
  }, AUTO_SAVE_INTERVAL).unref()
}

// ── Canvas list helpers ───────────────────────────────────────────────────
const canvasesPath = path.join(DATA_DIR, 'canvas-list.json')

function readCanvases() {
  try {
    if (fs.existsSync(canvasesPath)) {
      return JSON.parse(fs.readFileSync(canvasesPath, 'utf-8'))
    }
  } catch (_) {}
  return []
}

function writeCanvases(list) {
  fs.writeFileSync(canvasesPath, JSON.stringify(list, null, 2), 'utf-8')
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function getLocalIp() {
  const os = require('os')
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try { resolve(JSON.parse(body)) }
      catch (_) { resolve(null) }
    })
  })
}

// ── Static file serving (production mode) ─────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function serveStatic(req, res) {
  if (req.method !== 'GET') return false
  // Serve client/dist as static files
  let urlPath = req.url.split('?')[0]
  if (urlPath === '/') urlPath = '/index.html'
  const filePath = path.join(DIST_DIR, urlPath)

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) return false

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback: serve index.html only for non-API routes
    if (!urlPath.startsWith('/api/') && urlPath !== '/api' && urlPath !== '/__log__' && urlPath !== '/health') {
      const indexHtml = path.join(DIST_DIR, 'index.html')
      if (fs.existsSync(indexHtml)) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        return res.end(fs.readFileSync(indexHtml, 'utf-8'))
      }
    }
    return false
  }

  const ext = path.extname(filePath)
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  return res.end(fs.readFileSync(filePath))
}

// ── HTTP request handler ──────────────────────────────────────────────────
async function handleRequest(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  // Remote log endpoint
  if (req.method === 'POST' && req.url === '/__log__') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      process.stdout.write(body)
      res.writeHead(200)
      res.end('ok')
    })
    return
  }

  // ── REST API ──

  // GET /api/canvases
  if (req.method === 'GET' && req.url === '/api/canvases') {
    return jsonResponse(res, readCanvases())
  }

  // GET /api/tunnel — get the public tunnel URL
  if (req.method === 'GET' && req.url === '/api/tunnel') {
    const publicUrl = tunnelUrl || process.env.PUBLIC_URL || ''
    return jsonResponse(res, {
      url: publicUrl,
      status: publicUrl ? 'connected' : tunnelStatus,
      lanUrl: tunnelUrl ? null : `http://${getLocalIp()}:${PORT}`,
      lanWsUrl: tunnelUrl ? null : `ws://${getLocalIp()}:${PORT}`
    })
  }

  // GET /health — health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    return jsonResponse(res, { status: 'ok', uptime: process.uptime() })
  }

  // POST /api/canvases
  if (req.method === 'POST' && req.url === '/api/canvases') {
    const body = await readBody(req)
    if (!body || !body.id) {
      return jsonResponse(res, { error: 'Missing id' }, 400)
    }
    const list = readCanvases()
    const existing = list.findIndex(c => c.id === body.id)
    const canvas = {
      id: body.id,
      name: body.name || '新画布',
      room: body.room || `canvas-${body.id}`,
      createdAt: body.createdAt || new Date().toISOString(),
      nodeCount: body.nodeCount || 0,
    }
    if (existing >= 0) {
      list[existing] = { ...list[existing], ...canvas }
    } else {
      list.push(canvas)
    }
    writeCanvases(list)
    console.log(`[api] Canvas created/updated: ${canvas.id}`)
    return jsonResponse(res, canvas)
  }

  // DELETE /api/canvases/:id
  if (req.method === 'DELETE' && req.url.startsWith('/api/canvases/')) {
    const id = decodeURIComponent(req.url.split('/api/canvases/')[1])
    if (!id) return jsonResponse(res, { error: 'Missing id' }, 400)
    const list = readCanvases().filter(c => c.id !== id)
    writeCanvases(list)
    const room = `canvas-${id}`
    const dataFile = path.join(DATA_DIR, `${room}.json`)
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile)
    console.log(`[api] Canvas deleted: ${id}`)
    return jsonResponse(res, { ok: true })
  }

  // PATCH /api/canvases/:id
  if (req.method === 'PATCH' && req.url.startsWith('/api/canvases/')) {
    const id = decodeURIComponent(req.url.split('/api/canvases/')[1])
    if (!id) return jsonResponse(res, { error: 'Missing id' }, 400)
    const body = await readBody(req)
    if (!body) return jsonResponse(res, { error: 'Invalid body' }, 400)
    const list = readCanvases()
    const idx = list.findIndex(c => c.id === id)
    if (idx < 0) return jsonResponse(res, { error: 'Not found' }, 404)
    if (body.name !== undefined) list[idx].name = body.name
    if (body.nodeCount !== undefined) list[idx].nodeCount = body.nodeCount
    list[idx].updatedAt = new Date().toISOString()
    writeCanvases(list)
    return jsonResponse(res, list[idx])
  }

  // ── Static files (production mode) ──
  if (serveStatic(req, res)) return

  // 404
  res.writeHead(404)
  res.end()
}

// ── HTTP server ───────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error('[http]', err)
    res.writeHead(500)
    res.end('Internal Server Error')
  })
})

const wss = new WebSocketServer({ server })

// ── Localtunnel for public sharing (dev mode only) ────────────────────────
let tunnelUrl = null
let tunnelStatus = 'stopped'

async function startTunnel() {
  if (process.env.DISABLE_TUNNEL === '1' || process.env.NODE_ENV === 'production') {
    console.log('[tunnel] Disabled (production mode or DISABLE_TUNNEL=1)')
    return
  }
  try {
    tunnelStatus = 'connecting'
    // Dynamic require — only load localtunnel in dev mode
    const localtunnel = require('localtunnel')
    const tunnel = await localtunnel({ port: PORT })
    tunnelUrl = tunnel.url
    tunnelStatus = 'connected'
    console.log(`[tunnel] 🌐 ${tunnelUrl}`)
    tunnel.on('close', () => {
      console.log('[tunnel] Closed')
      tunnelUrl = null
      tunnelStatus = 'stopped'
    })
    tunnel.on('error', (err) => {
      console.error('[tunnel] Error:', err.message)
      tunnelStatus = 'error'
    })
  } catch (err) {
    console.error('[tunnel] Failed:', err.message)
    tunnelStatus = 'error'
  }
}

server.listen(PORT, () => {
  console.log(`\n🌲 CollabTree server running on http://localhost:${PORT}\n`)
  startTunnel()
})

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  let docName = url.pathname.slice(1) || 'default-tree'
  if (docName.startsWith('ws/')) docName = docName.slice(3)
  setupWSConnection(ws, req, { docName })
  console.log(`[ws] + Client connected → room: ${docName}`)
})