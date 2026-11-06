import type { GhIssue, GhLabel } from './types'

// Priorities are stored on GitHub as ordinary labels, so other people
// (who don't use this app) still see them.

export interface Priority {
  key: 'urgent' | 'high' | 'medium' | 'low'
  label: string           // GitHub label name
  title: string
  color: string           // GitHub label colour (hex, no '#')
  icon: string
  class: string           // text colour class for the icon
  rank: number
}

export const PRIORITIES: Priority[] = [
  { key: 'urgent', label: 'priority: urgent', title: 'Urgent', color: 'b60205', icon: 'i-lucide-alert-octagon', class: 'text-red-500', rank: 0 },
  { key: 'high', label: 'priority: high', title: 'High', color: 'd93f0b', icon: 'i-lucide-signal-high', class: 'text-orange-500', rank: 1 },
  { key: 'medium', label: 'priority: medium', title: 'Medium', color: 'fbca04', icon: 'i-lucide-signal-medium', class: 'text-yellow-500', rank: 2 },
  { key: 'low', label: 'priority: low', title: 'Low', color: '0e8a16', icon: 'i-lucide-signal-low', class: 'text-green-600', rank: 3 }
]

export const NO_PRIORITY_RANK = PRIORITIES.length

const byLabel = new Map(PRIORITIES.map(p => [p.label.toLowerCase(), p]))

export function isPriorityLabel(name: string): boolean {
  return byLabel.has(name.toLowerCase())
}

export function priorityOf(issue: GhIssue): Priority | undefined {
  let best: Priority | undefined
  for (const label of issue.labels) {
    const p = byLabel.get(label.name.toLowerCase())
    if (p && (!best || p.rank < best.rank)) {
      best = p
    }
  }
  return best
}

export function priorityRank(issue: GhIssue): number {
  return priorityOf(issue)?.rank ?? NO_PRIORITY_RANK
}

export function findPriority(text: string): Priority | undefined {
  const t = text.toLowerCase()
  const n = Number.parseInt(t)
  if (!Number.isNaN(n) && n >= 1 && n <= PRIORITIES.length) {
    return PRIORITIES[n - 1]
  }
  return PRIORITIES.find(p => p.key === t || p.key.startsWith(t))
}

/** Label names for an issue after setting its priority (or clearing it with `undefined`). */
export function labelsWithPriority(labels: GhLabel[], priority: Priority | undefined): string[] {
  const names = labels.map(l => l.name).filter(n => !isPriorityLabel(n))
  if (priority) {
    names.push(priority.label)
  }
  return names
}
