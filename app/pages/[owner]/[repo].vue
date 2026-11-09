<script setup lang="ts">
import { useEventListener, useIntervalFn, useLocalStorage } from '@vueuse/core'
import type { GhIssue, GroupBy, SmartFilter, SortBy, ViewSettings } from '~/utils/types'

const SYNC_INTERVAL = 2 * 60 * 1000

const route = useRoute()
const owner = String(route.params.owner)
const name = String(route.params.repo)
const key = repoKey(owner, name)

const { viewer } = useGitHub()
const { addRepo } = useRepos()
const data = useRepoData(owner, name)
const actions = useTaskActions(data)
const pins = usePins(key)
const smart = useSmartFilters(key)
const dialogs = useDialogs()
const toast = useToast()
const store = data.store

provide(TasksContextKey, {
  data,
  actions,
  pins,
  viewer: computed(() => viewer.value as GhIssue['user']),
  open: async (number: number) => {
    if (!data.find(number)) {
      await actions.attempt('Unable to load task', () => data.fetchIssue(number))
    }
    if (data.find(number)) {
      selected.value = [number]
    }
  }
})

useHead({ title: `${owner}/${name} · GitHub Tasks` })

// Opening a repo by URL adds it to the sidebar
addRepo(owner, name)

// ---------------------------------------------------------------- View settings

const DEFAULT_VIEW: ViewSettings = {
  search: '',
  state: 'open',
  groupBy: 'milestone',
  sortBy: 'priority',
  reverse: false,
  assignee: 'anyone',
  openedByMe: false,
  hideEmpty: false,
  hidden: []
}
const view = useLocalStorage<ViewSettings>(`ghtasks:view:${key}`, { ...DEFAULT_VIEW }, { mergeDefaults: true })
const activeFilter = ref<string | null>(null)

watch(() => view.value.state, (state) => {
  if (state !== 'open') {
    data.ensureClosed().catch(() => {})
  }
}, { immediate: true })

function viewOf(f: Partial<ViewSettings>): ViewSettings {
  const settings = { ...DEFAULT_VIEW }
  for (const k of Object.keys(DEFAULT_VIEW) as (keyof ViewSettings)[]) {
    if (f[k] !== undefined) {
      (settings as Record<string, unknown>)[k] = f[k]
    }
  }
  return settings
}

// Any manual change means we're no longer showing a saved filter as-is
watch(view, () => {
  const f = smart.filters.value.find(f => f.id === activeFilter.value)
  if (f && JSON.stringify(viewOf(f)) !== JSON.stringify(viewOf(view.value))) {
    activeFilter.value = null
  }
}, { deep: true })

function applyFilter(f: SmartFilter) {
  view.value = viewOf(f)
  activeFilter.value = f.id
}

async function saveFilter() {
  const filterName = await dialogs.prompt('Save smart filter', { placeholder: 'e.g. My urgent bugs' })
  if (filterName) {
    const saved = smart.save({ name: filterName, ...view.value })
    activeFilter.value = saved.id
  }
}

function resetView() {
  view.value = { ...DEFAULT_VIEW }
  activeFilter.value = null
}

// ---------------------------------------------------------------- Filtering

const query = computed(() => parseTokens(view.value.search, store.assignees, store.labels, false))

const visible = computed(() => {
  const q = query.value
  const text = q.text.toLowerCase()
  const number = text.match(/^#?(\d+)$/)?.[1]
  const me = viewer.value?.login
  return store.issues.filter((issue) => {
    if (view.value.state !== 'all' && issue.state !== view.value.state) return false
    if (view.value.assignee === 'me' && !issue.assignees.some(a => a.login === me)) return false
    if (view.value.assignee === 'unassigned' && issue.assignees.length) return false
    if (view.value.openedByMe && issue.user?.login !== me) return false
    if (q.assignees.length && !q.assignees.every(l => issue.assignees.some(a => a.login.toLowerCase() === l.toLowerCase()))) return false
    if (q.labels.length && !q.labels.every(l => issue.labels.some(il => il.name.toLowerCase() === l.toLowerCase()))) return false
    if (q.priority && priorityOf(issue)?.key !== q.priority.key) return false
    if (number) return String(issue.number) === number || issue.title.toLowerCase().includes(text)
    if (text && !issue.title.toLowerCase().includes(text) && !(issue.body ?? '').toLowerCase().includes(text)) return false
    return true
  })
})

// ---------------------------------------------------------------- Sorting and grouping

function compare(a: GhIssue, b: GhIssue, by: SortBy): number {
  switch (by) {
    case 'updated': return b.updated_at.localeCompare(a.updated_at)
    case 'created': return b.created_at.localeCompare(a.created_at)
    case 'number': return b.number - a.number
    case 'title': return a.title.localeCompare(b.title)
    case 'state':
      return (a.state === b.state ? 0 : a.state === 'open' ? -1 : 1) || compare(a, b, 'updated')
    case 'assignee': {
      const la = a.assignees[0]?.login ?? '\uffff'
      const lb = b.assignees[0]?.login ?? '\uffff'
      return la.localeCompare(lb) || compare(a, b, 'priority')
    }
    case 'priority':
      return priorityRank(a) - priorityRank(b) || compare(a, b, 'updated')
  }
}

function sorted(issues: GhIssue[]): GhIssue[] {
  const direction = view.value.reverse ? -1 : 1
  return [...issues].sort((a, b) => {
    // Pinned tasks always come first
    const pa = pins.isPinned(a.number) ? 0 : 1
    const pb = pins.isPinned(b.number) ? 0 : 1
    return pa - pb || direction * compare(a, b, view.value.sortBy)
  })
}

interface Group {
  key: string
  title: string
  icon?: string
  iconClass?: string
  color?: string
  avatar?: string
  subtitle?: string
  issues: GhIssue[]
  defaults: { labels?: string[], assignees?: string[], milestone?: number | null, type?: string }
}

// Every group for the current grouping, before hiding any
const allGroups = computed<Group[]>(() => {
  const issues = visible.value
  const by: GroupBy = view.value.groupBy
  const result: Group[] = []
  if (by === 'none') {
    result.push({ key: 'all', title: 'All tasks', issues, defaults: {} })
  } else if (by === 'type') {
    for (const t of store.issueTypes) {
      result.push({ key: `t${t.id}`, title: t.name, issues: issues.filter(i => i.type?.name === t.name), defaults: { type: t.name } })
    }
    result.push({ key: 't-none', title: 'No type', issues: issues.filter(i => !i.type), defaults: {} })
  } else if (by === 'milestone') {
    for (const m of store.milestones) {
      result.push({
        key: `m${m.number}`,
        title: m.title,
        icon: 'i-lucide-milestone',
        subtitle: m.due_on ? `Due ${formatDate(m.due_on)}` : undefined,
        issues: issues.filter(i => i.milestone?.number === m.number),
        defaults: { milestone: m.number }
      })
    }
    // Issues in closed milestones that we don't list
    const known = new Set(store.milestones.map(m => m.number))
    const others = new Map<number, GhIssue[]>()
    for (const i of issues) {
      if (i.milestone && !known.has(i.milestone.number)) {
        others.set(i.milestone.number, [...(others.get(i.milestone.number) ?? []), i])
      }
    }
    for (const [number, list] of others) {
      result.push({ key: `m${number}`, title: list[0]!.milestone!.title, icon: 'i-lucide-milestone', subtitle: 'Closed', issues: list, defaults: { milestone: number } })
    }
    result.push({ key: 'm-none', title: 'No milestone', icon: 'i-lucide-inbox', issues: issues.filter(i => !i.milestone), defaults: {} })
  } else if (by === 'label') {
    for (const l of store.labels.filter(l => !isPriorityLabel(l.name))) {
      const list = issues.filter(i => i.labels.some(il => il.name === l.name))
      if (list.length) {
        result.push({ key: `l${l.id}`, title: l.name, color: l.color, issues: list, defaults: { labels: [l.name] } })
      }
    }
    result.push({
      key: 'l-none',
      title: 'No label',
      icon: 'i-lucide-inbox',
      issues: issues.filter(i => !i.labels.some(l => !isPriorityLabel(l.name))),
      defaults: {}
    })
  } else if (by === 'priority') {
    for (const p of PRIORITIES) {
      result.push({ key: `p${p.key}`, title: p.title, icon: p.icon, iconClass: p.class, issues: issues.filter(i => priorityOf(i)?.key === p.key), defaults: { labels: [p.label] } })
    }
    result.push({ key: 'p-none', title: 'No priority', icon: 'i-lucide-minus', issues: issues.filter(i => !priorityOf(i)), defaults: {} })
  } else if (by === 'assignee') {
    for (const u of store.assignees) {
      const list = issues.filter(i => i.assignees.some(a => a.login === u.login))
      if (list.length) {
        result.push({ key: `a${u.login}`, title: u.login, avatar: u.avatar_url, issues: list, defaults: { assignees: [u.login] } })
      }
    }
    result.push({ key: 'a-none', title: 'Unassigned', icon: 'i-lucide-user-x', issues: issues.filter(i => !i.assignees.length), defaults: {} })
  }
  return result.map(g => ({ ...g, issues: sorted(g.issues) }))
})

// Parents whose sub-issues are collapsed in the list
const collapsedTasks = useLocalStorage<number[]>(`ghtasks:collapsed-tasks:${key}`, [])
const collapsedTaskSet = computed(() => new Set(collapsedTasks.value))

function toggleTask(number: number) {
  collapsedTasks.value = collapsedTaskSet.value.has(number)
    ? collapsedTasks.value.filter(n => n !== number)
    : [...collapsedTasks.value, number]
}

// Visible groups, with their tasks arranged as trees (sub-issues under parents)
const groups = computed(() => allGroups.value
  .filter(g => !view.value.hidden.includes(g.key) && !(view.value.hideEmpty && !g.issues.length))
  .map(g => ({ ...g, rows: treeRows(g.issues, i => parentNumber(i, owner, name), collapsedTaskSet.value) })))

const groupOptions = computed(() => allGroups.value.map(g => ({ key: g.key, title: g.title })))

const collapsed = useLocalStorage<Record<string, boolean>>(`ghtasks:collapsed:${key}`, {})

function toggleGroup(groupKey: string) {
  collapsed.value = { ...collapsed.value, [groupKey]: !collapsed.value[groupKey] }
}

// Rows in display order (a task with several labels can appear more than once)
const order = computed(() => {
  const seen = new Set<number>()
  const numbers: number[] = []
  for (const g of groups.value) {
    if (collapsed.value[g.key]) continue
    for (const { issue: i } of g.rows) {
      if (!seen.has(i.number)) {
        seen.add(i.number)
        numbers.push(i.number)
      }
    }
  }
  return numbers
})

// ---------------------------------------------------------------- Selection

const selected = ref<number[]>([])
const anchor = ref<number | null>(null)

// e.g. "1 of 19 Tasks Selected — Last Updated Today at 9:31 AM"
const statusText = computed(() => {
  const total = order.value.length
  const tasks = `${total} ${total === 1 ? 'Task' : 'Tasks'}`
  const count = selected.value.length ? `${selected.value.length} of ${tasks} Selected` : tasks
  return store.lastSync ? `${count} — Last Updated ${formatDayTime(store.lastSync)}` : count
})

const selectedIssues = computed(() => selected.value.map(n => data.find(n)).filter((i): i is GhIssue => !!i))

function select(number: number, event?: MouseEvent) {
  if (event?.metaKey || event?.ctrlKey) {
    selected.value = selected.value.includes(number)
      ? selected.value.filter(n => n !== number)
      : [...selected.value, number]
    anchor.value = number
  } else if (event?.shiftKey && anchor.value !== null) {
    const a = order.value.indexOf(anchor.value)
    const b = order.value.indexOf(number)
    if (a >= 0 && b >= 0) {
      selected.value = order.value.slice(Math.min(a, b), Math.max(a, b) + 1)
    }
  } else {
    selected.value = [number]
    anchor.value = number
  }
}

/** A click on the list's background (not a task or control) deselects everything. */
function onListClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('[data-number], button, a, input, textarea, [role="menu"], [role="listbox"], [role="dialog"]')) {
    selected.value = []
  }
}

function move(delta: number) {
  const list = order.value
  if (!list.length) return
  const current = selected.value.length ? list.indexOf(selected.value[selected.value.length - 1]!) : -1
  const next = current < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, current + delta))
  select(list[next]!)
}

// ---------------------------------------------------------------- Loading and syncing

async function refresh() {
  try {
    await data.sync()
  } catch (err) {
    toast.add({ title: 'Unable to refresh', description: errorMessage(err), color: 'error' })
  }
}

onMounted(async () => {
  try {
    await data.load()
    if (view.value.state !== 'open') {
      await data.ensureClosed()
    }
  } catch {
    // shown in the page from store.error
  }
})

useIntervalFn(() => { if (store.loaded) refresh() }, SYNC_INTERVAL)
useEventListener(window, 'focus', () => { if (store.loaded) refresh() })

// ---------------------------------------------------------------- Keyboard

const toolbar = useTemplateRef<{ openSearch: () => void }>('toolbar')
const quickAdds = ref<Record<string, { open: () => void }>>({})

function newTask() {
  const g = groups.value.find(g => !collapsed.value[g.key]) ?? groups.value[0]
  if (g) {
    collapsed.value = { ...collapsed.value, [g.key]: false }
    nextTick(() => quickAdds.value[g.key]?.open())
  }
}

defineShortcuts({
  'j': () => move(1),
  'arrowdown': () => move(1),
  'k': () => move(-1),
  'arrowup': () => move(-1),
  'escape': () => {
    // Esc closes an open menu, pulldown or dialog first; don't also deselect
    if (!document.querySelector('[role="menu"], [role="listbox"], [role="dialog"]')) {
      selected.value = []
    }
  },
  '/': () => toolbar.value?.openSearch(),
  'meta_f': () => toolbar.value?.openSearch(),
  'n': newTask,
  'r': refresh,
  'x': () => selectedIssues.value.length && actions.setState(selectedIssues.value, selectedIssues.value.some(i => i.state === 'open') ? 'closed' : 'open'),
  'p': () => selectedIssues.value.length && pins.setPinned(selected.value, !selected.value.every(n => pins.isPinned(n))),
  'o': () => selectedIssues.value.length === 1 && openExternal(selectedIssues.value[0]!.html_url),
  'i': () => inspector.toggle(),
  'meta_a': () => { selected.value = [...order.value] },
  '1': () => selectedIssues.value.length && actions.setPriority(selectedIssues.value, PRIORITIES[0]),
  '2': () => selectedIssues.value.length && actions.setPriority(selectedIssues.value, PRIORITIES[1]),
  '3': () => selectedIssues.value.length && actions.setPriority(selectedIssues.value, PRIORITIES[2]),
  '4': () => selectedIssues.value.length && actions.setPriority(selectedIssues.value, PRIORITIES[3]),
  '0': () => selectedIssues.value.length && actions.setPriority(selectedIssues.value, undefined)
})

const inspector = useInspectorWidth()
const sidebar = useSidebar()

const shortcutsOpen = ref(false)
const SHORTCUTS: [string[], string][] = [
  [['j'], 'Next task'], [['k'], 'Previous task'], [['meta', 'click'], 'Add to selection'], [['shift', 'click'], 'Select range'],
  [['meta', 'a'], 'Select all'], [['escape'], 'Clear selection'], [['n'], 'New task'], [['/'], 'Search'],
  [['x'], 'Close / reopen'], [['p'], 'Pin / unpin'], [['1'], 'Urgent … 4 = Low'], [['0'], 'Clear priority'],
  [['o'], 'Open on GitHub'], [['i'], 'Show / hide details'], [['meta', '\\'], 'Show / hide sidebar'], [['r'], 'Refresh'], [['meta', 'o'], 'Add repository']
]
</script>

<template>
  <UDashboardPanel id="tasks" :min-size="30">
    <template #header>
      <UDashboardNavbar>
        <template v-if="!sidebar.open.value" #leading>
          <SidebarToggle class="me-1" />
        </template>
        <template #title>
          <span class="text-muted font-normal">{{ owner }} /</span>&nbsp;{{ name }}
        </template>
        <template #right>
          <ViewToolbar
            ref="toolbar"
            v-model:view="view"
            :users="store.assignees"
            :labels="store.labels"
            :group-options="groupOptions"
            :has-types="store.issueTypes.length > 0"
            :smart-filters="smart.filters.value"
            :active-filter="activeFilter"
            :loading="store.loading"
            @new-task="newTask"
            @new-milestone="actions.newMilestone()"
            @new-label="actions.newLabel()"
            @refresh="refresh"
            @shortcuts="shortcutsOpen = true"
            @open-github="openExternal(`https://github.com/${owner}/${name}/issues`)"
            @apply-filter="applyFilter"
            @save-filter="saveFilter"
            @remove-filter="smart.remove"
            @reset-view="resetView"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="store.error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Unable to load issues"
        :description="store.error"
        :actions="[{ label: 'Retry', onClick: () => data.load(true) }]"
        class="m-4"
      />

      <div v-else-if="!store.loaded" class="p-4 space-y-2">
        <USkeleton v-for="n in 8" :key="n" class="h-8 w-full" />
      </div>

      <div v-else class="flex-1 -mx-4 -my-4 sm:-mx-6 sm:-my-6" @click="onListClick">
        <section v-for="group in groups" :key="group.key" class="pt-4 first:pt-2">
          <!-- Group title with a rule to the right; click to collapse -->
          <button
            type="button"
            class="group/header relative flex w-full items-center gap-2 ps-10 pe-4 h-10 text-start"
            :aria-expanded="!collapsed[group.key]"
            @click="toggleGroup(group.key)"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="absolute start-4 size-4 text-dimmed transition-transform"
              :class="[collapsed[group.key] ? '' : 'rotate-90 opacity-0 group-hover/header:opacity-100']"
            />
            <UAvatar v-if="group.avatar" :src="group.avatar" size="2xs" />
            <span v-else-if="group.color" class="size-3 rounded-full shrink-0" :style="{ backgroundColor: `#${group.color}` }" />
            <UIcon v-else-if="group.iconClass" :name="group.icon!" class="size-5 shrink-0" :class="group.iconClass" />
            <span class="text-xl font-semibold text-highlighted truncate">{{ group.title }}</span>
            <span v-if="collapsed[group.key]" class="text-sm text-muted">{{ group.issues.length }}</span>
            <span v-if="group.subtitle" class="text-sm text-dimmed whitespace-nowrap">{{ group.subtitle }}</span>
            <span class="flex-1 h-px bg-(--ui-border) ms-4" />
          </button>

          <template v-if="!collapsed[group.key]">
            <TaskRow
              v-for="row in group.rows"
              :key="row.issue.number"
              :issue="row.issue"
              :depth="row.depth"
              :sub-issues="row.children"
              :expanded="!collapsedTaskSet.has(row.issue.number)"
              :selected="selected.includes(row.issue.number)"
              :group-by="view.groupBy"
              @select="select(row.issue.number, $event)"
              @toggle="toggleTask(row.issue.number)"
            />
            <QuickAdd
              :ref="(el: any) => { if (el) quickAdds[group.key] = el }"
              :defaults="group.defaults"
              @created="n => select(n)"
            />
          </template>
        </section>

        <UEmpty
          v-if="!visible.length && !groups.length"
          icon="i-lucide-list-checks"
          title="No tasks"
          description="Nothing matches the current filters."
          class="py-16"
        />
      </div>
    </template>

    <template #footer>
      <div :class="STATUS_BAR">
        <span class="truncate">{{ statusText }}</span>
      </div>
    </template>
  </UDashboardPanel>

  <!-- The details panel stays open (toggle with `i`), even with nothing selected -->
  <template v-if="inspector.open.value">
    <TaskInspector
      v-if="selectedIssues.length === 1"
      :key="selectedIssues[0]!.number"
      :issue="selectedIssues[0]!"
    />
    <BatchInspector
      v-else-if="selectedIssues.length > 1"
      :issues="selectedIssues"
    />
    <EmptyInspector v-else />
  </template>

  <UModal v-model:open="shortcutsOpen" title="Keyboard shortcuts">
    <template #body>
      <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <template v-for="[keys, label] in SHORTCUTS" :key="label">
          <dt class="flex gap-1">
            <UKbd v-for="k in keys" :key="k" :value="k" />
          </dt>
          <dd class="text-muted">
            {{ label }}
          </dd>
        </template>
      </dl>
    </template>
  </UModal>
</template>
