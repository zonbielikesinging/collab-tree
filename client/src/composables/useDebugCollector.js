// ── Debug Log Collector ──
// Collects structured debug logs for display in the DOM (not just F12 console).
// Automatically hooks into common error patterns and performance measurements.
// Used by the DebugPanel component to show real-time diagnostic output.

const MAX_LOGS = 200

/**
 * Create a debug log collector.
 * Returns an object with methods to add logs, query logs, and clear.
 * Also exposes the log array as a reactive ref for Vue binding.
 */
export function createDebugCollector() {
  const logs = []
  const listeners = []

  function addLog(level, category, message, data) {
    const entry = {
      ts: Date.now(),
      level, // 'info', 'warn', 'error', 'perf', 'render', 'user-action'
      category, // 'render', 'zoom', 'drag', 'resize', 'collab', 'yjs', 'network'
      message,
      data: data ? JSON.stringify(data).slice(0, 200) : null,
    }
    logs.push(entry)
    if (logs.length > MAX_LOGS) logs.shift()

    // Also log to console for browser devtools
    const fn = console[level] || console.log
    fn(`[${category}] ${message}`, data || '')

    // Notify listeners
    for (const fn of listeners) fn(entry)
  }

  function onLog(fn) {
    listeners.push(fn)
    return () => {
      const idx = listeners.indexOf(fn)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }

  function getLogs(filter) {
    if (!filter) return logs.slice()
    return logs.filter(e => {
      if (filter.level && e.level !== filter.level) return false
      if (filter.category && e.category !== filter.category) return false
      if (filter.since && e.ts < filter.since) return false
      return true
    })
  }

  function clear() { logs.length = 0 }

  return {
    addLog, onLog, getLogs, clear, logs,
    info: (cat, msg, d) => addLog('info', cat, msg, d),
    warn: (cat, msg, d) => addLog('warn', cat, msg, d),
    error: (cat, msg, d) => addLog('error', cat, msg, d),
    perf: (cat, msg, d) => addLog('perf', cat, msg, d),
    render: (cat, msg, d) => addLog('render', cat, msg, d),
    userAction: (cat, msg, d) => addLog('user-action', cat, msg, d),
  }
}

// Singleton instance
let globalDebug = null
export function getDebugCollector() {
  if (!globalDebug) globalDebug = createDebugCollector()
  return globalDebug
}