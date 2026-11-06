import type { GhIssue } from './types'

// The ways a task can be copied from the details panel

export interface CopyFormat {
  label: string
  icon: string
  text: (issue: GhIssue) => string
}

function commitMessage(issue: GhIssue): string {
  return `Fixes #${issue.number}: ${issue.title}`
}

export const COPY_FORMATS: CopyFormat[] = [
  { label: 'Task Identifier', icon: 'i-lucide-hash', text: issue => `#${issue.number}` },
  { label: 'ID, Title, & URL', icon: 'i-lucide-text', text: issue => `#${issue.number} ${issue.title}\n${issue.html_url}` },
  { label: 'URL', icon: 'i-lucide-compass', text: issue => issue.html_url },
  { label: 'Fixed Commit Message', icon: 'i-lucide-quote', text: commitMessage },
  {
    label: 'git commit Command',
    icon: 'i-lucide-git-commit-horizontal',
    // Single quotes, so the shell leaves the message alone
    text: issue => `git commit -m '${commitMessage(issue).replace(/'/g, `'\\''`)}'`
  },
  { label: 'To-Do List Entry', icon: 'i-lucide-list-todo', text: issue => `- [ ] #${issue.number} ${issue.title}` }
]
