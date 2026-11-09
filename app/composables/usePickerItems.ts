import type { GhLabel, GhUser, PickerItem } from '~/utils/types'
import type { RepoStore } from './useRepoData'

export const NO_MILESTONE = '__none__'
export const NO_PRIORITY = '__none__'
export const NO_TYPE = '__none__'

export function usePickerItems(store: RepoStore) {
  const labelItems = computed<PickerItem[]>(() => store.labels
    .filter(l => !isPriorityLabel(l.name))
    .map(l => ({ value: l.name, label: l.name, color: l.color, description: l.description ?? undefined })))

  const assigneeItems = computed<PickerItem[]>(() => store.assignees
    .map(u => ({ value: u.login, label: u.login, avatar: { src: u.avatar_url, alt: u.login } })))

  const milestoneItems = computed<PickerItem[]>(() => [
    { value: NO_MILESTONE, label: 'No milestone', icon: 'i-lucide-circle-off', iconClass: 'text-dimmed' },
    ...store.milestones.map(m => ({
      value: String(m.number),
      label: m.title,
      icon: 'i-lucide-milestone',
      description: m.due_on ? `Due ${formatDate(m.due_on)}` : undefined
    }))
  ])

  const priorityItems = computed<PickerItem[]>(() => [
    { value: NO_PRIORITY, label: 'No priority', icon: 'i-lucide-minus', iconClass: 'text-dimmed' },
    ...PRIORITIES.map(p => ({ value: p.key, label: p.title, icon: p.icon, iconClass: p.class }))
  ])

  const typeItems = computed<PickerItem[]>(() => [
    { value: NO_TYPE, label: 'None', icon: 'i-lucide-circle-dashed', iconClass: 'text-dimmed' },
    ...store.issueTypes.map(t => ({
      value: t.name,
      label: t.name,
      ringColor: issueTypeColor(t),
      description: t.description ?? undefined
    }))
  ])

  // Pickers show their current (not yet saved) selection, as names
  function labelsNamed(names: unknown): GhLabel[] {
    return (Array.isArray(names) ? names as string[] : []).map((name, i) =>
      store.labels.find(l => l.name === name) ?? { id: -1 - i, name, color: 'ededed' })
  }

  function usersNamed(logins: unknown): GhUser[] {
    return (Array.isArray(logins) ? logins as string[] : []).map(login =>
      store.assignees.find(u => u.login === login) ?? { login, avatar_url: '' })
  }

  return { labelItems, assigneeItems, milestoneItems, priorityItems, typeItems, labelsNamed, usersNamed }
}
