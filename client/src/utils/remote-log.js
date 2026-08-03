// Send console logs to the local endpoint so the agent can tail them
const LOG_URL = '/__log__'

const origLog = console.log.bind(console)
const origWarn = console.warn.bind(console)
const origError = console.error.bind(console)

function send(level, args) {
  try {
    const msg = args.map(a => {
      if (typeof a === 'object') {
        try { return JSON.stringify(a) } catch { return String(a) }
      }
      return String(a)
    }).join(' ')
    fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: `[${level}] ${msg}\n`,
    }).catch(() => {})
  } catch {}
}

console.log = (...args) => { origLog(...args); send('LOG', args) }
console.warn = (...args) => { origWarn(...args); send('WARN', args) }
console.error = (...args) => { origError(...args); send('ERR', args) }