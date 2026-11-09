import type { GhIssue } from './types'

// Sub-issues shown as a tree in the task list

/** The number of an issue's parent, if it's a sub-issue of an issue in the same repo. */
export function parentNumber(issue: GhIssue, owner: string, repo: string): number | null {
  const m = issue.parent_issue_url?.match(/\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)$/)
  if (!m || m[1]!.toLowerCase() !== owner.toLowerCase() || m[2]!.toLowerCase() !== repo.toLowerCase()) {
    return null
  }
  return Number(m[3])
}

export interface TaskTreeRow {
  issue: GhIssue
  depth: number
  children: number // how many sub-issues it has in this group
}

/**
 * Arrange (already sorted) issues as a tree: sub-issues follow their parent,
 * indented, unless the parent isn't in the list. Collapsed parents hide theirs.
 */
export function treeRows(issues: GhIssue[], parentOf: (issue: GhIssue) => number | null, collapsed: Set<number>): TaskTreeRow[] {
  const present = new Set(issues.map(i => i.number))
  const children = new Map<number, GhIssue[]>()
  const roots: GhIssue[] = []
  for (const issue of issues) {
    const parent = parentOf(issue)
    if (parent !== null && parent !== issue.number && present.has(parent)) {
      children.set(parent, [...(children.get(parent) ?? []), issue])
    } else {
      roots.push(issue)
    }
  }

  const rows: TaskTreeRow[] = []
  const placed = new Set<number>()
  function visit(issue: GhIssue, depth: number) {
    if (placed.has(issue.number)) {
      return
    }
    placed.add(issue.number)
    const kids = children.get(issue.number) ?? []
    rows.push({ issue, depth, children: kids.length })
    if (!collapsed.has(issue.number)) {
      kids.forEach(kid => visit(kid, depth + 1))
    } else {
      // Mark hidden descendants as placed, so they aren't shown as roots below
      const hide = (n: number) => (children.get(n) ?? []).forEach((k) => { placed.add(k.number); hide(k.number) })
      hide(issue.number)
    }
  }
  roots.forEach(root => visit(root, 0))
  // Anything left over (e.g. a circular parent link) goes at the top level
  issues.filter(i => !placed.has(i.number)).forEach(i => visit(i, 0))
  return rows
}
