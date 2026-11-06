import type { ComputedRef, InjectionKey } from 'vue'
import type { GhIssue, GhUser, IssuePatch } from '~/utils/types'
import type { Priority } from '~/utils/priority'
import type { RepoData } from './useRepoData'

// Edits to tasks, with error reporting, shared by the list and the inspector

export function useTaskActions(data: RepoData) {
  const toast = useToast()
  const dialogs = useDialogs()
  const s = data.store

  async function attempt<T>(title: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn()
    } catch (err) {
      toast.add({ title, description: errorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
      return undefined
    }
  }

  function labelNames(issue: GhIssue) {
    return issue.labels.map(l => l.name)
  }

  function logins(issue: GhIssue) {
    return issue.assignees.map(a => a.login)
  }

  async function update(issues: GhIssue[], patch: (issue: GhIssue) => IssuePatch | null, what: string) {
    return attempt(`Unable to ${what}`, () => Promise.all(issues.map((issue) => {
      const p = patch(issue)
      return p ? data.updateIssue(issue.number, p) : Promise.resolve(issue)
    })))
  }

  async function withLabels(names: string[]) {
    const known = new Set(s.labels.map(l => l.name.toLowerCase()))
    const missing = names.filter(n => !known.has(n.toLowerCase())).map(name => ({
      name,
      color: PRIORITIES.find(p => p.label === name)?.color
    }))
    if (missing.length) {
      await data.ensureLabels(missing)
    }
  }

  function setState(issues: GhIssue[], state: 'open' | 'closed', reason?: 'completed' | 'not_planned') {
    return update(
      issues,
      i => i.state === state && !reason ? null : { state, state_reason: state === 'closed' ? (reason ?? 'completed') : 'reopened' },
      state === 'closed' ? 'close task' : 'reopen task'
    )
  }

  function toggleState(issue: GhIssue) {
    return setState([issue], issue.state === 'open' ? 'closed' : 'open')
  }

  function rename(issue: GhIssue, title: string) {
    const t = title.trim()
    if (!t || t === issue.title) {
      return Promise.resolve(undefined)
    }
    return update([issue], () => ({ title: t }), 'rename task')
  }

  function setBody(issue: GhIssue, body: string) {
    return update([issue], () => ({ body }), 'update description')
  }

  async function setLabels(issue: GhIssue, names: string[]) {
    await attempt('Unable to create label', () => withLabels(names))
    return update([issue], () => ({ labels: names }), 'update labels')
  }

  async function addLabel(issues: GhIssue[], name: string) {
    await attempt('Unable to create label', () => withLabels([name]))
    return update(issues, (i) => {
      const names = labelNames(i)
      return names.includes(name) ? null : { labels: [...names, name] }
    }, 'add label')
  }

  function removeLabel(issues: GhIssue[], name: string) {
    return update(issues, (i) => {
      const names = labelNames(i)
      return names.includes(name) ? { labels: names.filter(n => n !== name) } : null
    }, 'remove label')
  }

  function setAssignees(issue: GhIssue, users: string[]) {
    return update([issue], () => ({ assignees: users }), 'update assignees')
  }

  function addAssignee(issues: GhIssue[], login: string) {
    return update(issues, (i) => {
      const users = logins(i)
      return users.includes(login) ? null : { assignees: [...users, login] }
    }, 'add assignee')
  }

  function removeAssignee(issues: GhIssue[], login: string) {
    return update(issues, (i) => {
      const users = logins(i)
      return users.includes(login) ? { assignees: users.filter(u => u !== login) } : null
    }, 'remove assignee')
  }

  /** Create a milestone, asking for its title, and then put the issues in it. */
  async function newMilestone(issues: GhIssue[]) {
    const title = await dialogs.prompt('New Milestone', { placeholder: 'Milestone title', confirmLabel: 'Create' })
    if (!title) {
      return undefined
    }
    const existing = s.milestones.find(m => m.title.toLowerCase() === title.toLowerCase())
    const milestone = existing ?? await attempt('Unable to create milestone', () => data.createMilestone(title))
    if (milestone) {
      await setMilestone(issues, milestone.number)
    }
    return milestone
  }

  function setMilestone(issues: GhIssue[], milestone: number | null) {
    return update(issues, i => (i.milestone?.number ?? null) === milestone ? null : { milestone }, 'set milestone')
  }

  function setType(issues: GhIssue[], type: string | null) {
    return update(issues, i => (i.type?.name ?? null) === type ? null : { type }, 'set type')
  }

  async function setPriority(issues: GhIssue[], priority: Priority | undefined) {
    if (priority) {
      await attempt('Unable to create priority label', () => withLabels([priority.label]))
    }
    return update(issues, (i) => {
      if (priorityOf(i)?.key === priority?.key) {
        return null
      }
      return { labels: labelsWithPriority(i.labels, priority) }
    }, 'set priority')
  }

  /** Create a task from quick-add text such as `Fix login @alice #bug !high`. */
  async function create(text: string, defaults: { labels?: string[], assignees?: string[], milestone?: number | null, type?: string } = {}) {
    const parsed = parseTokens(text, s.assignees, s.labels)
    if (!parsed.text) {
      return undefined
    }
    const labels = [...new Set([...(defaults.labels ?? []), ...parsed.labels])]
    if (parsed.priority) {
      labels.push(parsed.priority.label)
    }
    const assignees = [...new Set([...(defaults.assignees ?? []), ...parsed.assignees])]
    await attempt('Unable to create label', () => withLabels(labels))
    return attempt('Unable to create task', () => data.createIssue({
      title: parsed.text,
      labels,
      assignees,
      milestone: defaults.milestone ?? null,
      type: defaults.type ?? null
    }))
  }

  return {
    attempt,
    setState,
    toggleState,
    rename,
    setBody,
    setLabels,
    addLabel,
    removeLabel,
    setAssignees,
    addAssignee,
    removeAssignee,
    setMilestone,
    newMilestone,
    setType,
    setPriority,
    create
  }
}

export type TaskActions = ReturnType<typeof useTaskActions>

export interface TasksContext {
  data: RepoData
  actions: TaskActions
  pins: ReturnType<typeof usePins>
  viewer: ComputedRef<GhUser | null>
}

export const TasksContextKey: InjectionKey<TasksContext> = Symbol('tasks')

export function useTasksContext(): TasksContext {
  const ctx = inject(TasksContextKey)
  if (!ctx) {
    throw new Error('useTasksContext() called outside a repository page')
  }
  return ctx
}
