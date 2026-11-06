import type { PickerItem } from '~/utils/types'
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

  return { labelItems, assigneeItems, milestoneItems, priorityItems, typeItems }
}
