// ── Hierarchy Builder ──
// Converts plain tree data into D3 hierarchy, handling collapsed children.

import * as d3 from 'd3'

export function buildHierarchy(data) {
  if (!data) return null
  const root = d3.hierarchy(data)
  root.each(function (d) {
    if (d.data.collapsed && d.children) {
      d._children = d.children
      d.children = null
    }
  })
  return root
}