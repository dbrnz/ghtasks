<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
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
  viewer: computed(() => viewer.value as GhIssue['user'])
})

useHead({ title: `${owner}/${name} · GitHub Tasks` })

// Opening a repo by URL adds it to the sidebar
addRepo(owner, name)

// ---------------------------------------------------------------- View settings

const DEFAULT_VIEW: ViewSettings = { search: '', state: 'open', groupBy: 'milestone', sortBy: 'priority', assignee: 'anyone' }
const view = useLocalStorage<ViewSettings>(`ghtasks:view:${key}`, { ...DEFAULT_VIEW }, { mergeDefaults: true })
const activeFilter = ref<string | null>(null)

const stateItems = [
  { label: 'Open', value: 'open', icon: 'i-lucide-circle-dot' },
  { label: 'Closed', value: 'closed', icon: 'i-lucide-circle-check' },
  { label: 'All', value: 'all', icon: 'i-lucide-circle-dashed' }
]
const groupItems = [
  { label: 'No grouping', value: 'none', icon: 'i-lucide-list' },
  { label: 'Milestone', value: 'milestone', icon: 'i-lucide-milestone' },
  { label: 'Label', value: 'label', icon: 'i-lucide-tag' },
  { label: 'Priority', value: 'priority', icon: 'i-lucide-signal' },
  { label: 'Assignee', value: 'assignee', icon: 'i-lucide-users' }
]
const sortItems = [
  { label: 'Priority', value: 'priority', icon: 'i-lucide-signal' },
  { label: 'Recently updated', value: 'updated', icon: 'i-lucide-clock' },
  { label: 'Newest', value: 'created', icon: 'i-lucide-calendar-plus' },
  { label: 'Assignee', value: 'assignee', icon: 'i-lucide-user' },
  { label: 'Title', value: 'title', icon: 'i-lucide-arrow-down-a-z' },
  { label: 'Number', value: 'number', icon: 'i-lucide-hash' }
]
const assigneeItems = [
  { label: 'Anyone', value: 'anyone', icon: 'i-lucide-users' },
  { label: 'Assigned to me', value: 'me', icon: 'i-lucide-user-check' },
  { label: 'Unassigned', value: 'unassigned', icon: 'i-lucide-user-x' }
]

watch(() => view.value.state, (state) => {
  if (state !== 'open') {
    data.ensureClosed().catch(() => {})
  }
}, { immediate: true })

// Any manual change means we're no longer showing a saved filter as-is
watch(view, () => {
  const f = smart.filters.value.find(f => f.id === activeFilter.value)
  if (f && (['search', 'state', 'groupBy', 'sortBy', 'assignee'] as const).some(k => f[k] !== view.value[k])) {
    activeFilter.value = null
  }
}, { deep: true })

function applyFilter(f: SmartFilter) {
  view.value = { search: f.search, state: f.state, groupBy: f.groupBy, sortBy: f.sortBy, assignee: f.assignee }
  activeFilter.value = f.id
}

async function saveFilter() {
  const filterName = await dialogs.prompt('Save smart filter', { placeholder: 'e.g. My urgent bugs' })
  if (filterName) {
    const saved = smart.save({ name: filterName, ...view.value })
    activeFilter.value = saved.id
  }
}

const filterMenu = computed<DropdownMenuItem[][]>(() => [
  smart.filters.value.length
    ? smart.filters.value.map(f => ({
        label: f.name,
        icon: 'i-lucide-filter',
        type: 'checkbox' as const,
        checked: f.id === activeFilter.value,
        onSelect: () => applyFilter(f),
        children: [[{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => smart.remove(f.id) }]]
      }))
    : [{ label: 'No smart filters yet', disabled: true }],
  [
    { label: 'Save current view…', icon: 'i-lucide-save', onSelect: saveFilter },
    { label: 'Reset view', icon: 'i-lucide-rotate-ccw', onSelect: () => { view.value = { ...DEFAULT_VIEW }; activeFilter.value = null } }
  ]
])

const activeFilterName = computed(() => smart.filters.value.find(f => f.id === activeFilter.value)?.name)

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
    case 'assignee': {
      const la = a.assignees[0]?.login ?? '￿'
      const lb = b.assignees[0]?.login ?? '￿'
      return la.localeCompare(lb) || compare(a, b, 'priority')
    }
    case 'priority':
      return priorityRank(a) - priorityRank(b) || compare(a, b, 'updated')
  }
}

function sorted(issues: GhIssue[]): GhIssue[] {
  return [...issues].sort((a, b) => {
    const pa = pins.isPinned(a.number) ? 0 : 1
    const pb = pins.isPinned(b.number) ? 0 : 1
    // Open before closed, then pinned first
    return (a.state === b.state ? 0 : a.state === 'open' ? -1 : 1) || pa - pb || compare(a, b, view.value.sortBy)
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
  defaults: { labels?: string[], assignees?: string[], milestone?: number | null }
}

const groups = computed<Group[]>(() => {
  const issues = visible.value
  const by: GroupBy = view.value.groupBy
  const result: Group[] = []
  if (by === 'none') {
    result.push({ key: 'all', title: 'All tasks', issues, defaults: {} })
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
    for (const i of g.issues) {
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

const search = useTemplateRef<{ focus: () => void }>('search')
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
  'escape': () => { selected.value = [] },
  '/': () => search.value?.focus(),
  'meta_f': () => search.value?.focus(),
  'n': newTask,
  'r': refresh,
  'x': () => selectedIssues.value.length && actions.setState(selectedIssues.value, selectedIssues.value.some(i => i.state === 'open') ? 'closed' : 'open'),
  'p': () => selectedIssues.value.length && pins.setPinned(selected.value, !selected.value.every(n => pins.isPinned(n))),
  'o': () => selectedIssues.value.length === 1 && openExternal(selectedIssues.value[0]!.html_url),
  'meta_a': () => { selected.value = [...order.value] },
  '1': () => selectedIssues.value.length && actions.setPriority(selectedIssues.value, PRIORITIES[0]),
  '2': () => selectedIssues.value.length && actions.setPriority(selectedIssues.value, PRIORITIES[1]),
  '3': () => selectedIssues.value.length && actions.setPriority(selectedIssues.value, PRIORITIES[2]),
  '4': () => selectedIssues.value.length && actions.setPriority(selectedIssues.value, PRIORITIES[3]),
  '0': () => selectedIssues.value.length && actions.setPriority(selectedIssues.value, undefined)
})

const shortcutsOpen = ref(false)
const SHORTCUTS: [string[], string][] = [
  [['j'], 'Next task'], [['k'], 'Previous task'], [['meta', 'click'], 'Add to selection'], [['shift', 'click'], 'Select range'],
  [['meta', 'a'], 'Select all'], [['escape'], 'Clear selection'], [['n'], 'New task'], [['/'], 'Search'],
  [['x'], 'Close / reopen'], [['p'], 'Pin / unpin'], [['1'], 'Urgent … 4 = Low'], [['0'], 'Clear priority'],
  [['o'], 'Open on GitHub'], [['r'], 'Refresh'], [['meta', 'o'], 'Add repository']
]
</script>

<template>
  <UDashboardPanel id="tasks" :min-size="30">
    <template #header>
      <UDashboardNavbar>
        <template #title>
          <span class="text-muted font-normal">{{ owner }} /</span>&nbsp;{{ name }}
        </template>
        <template #right>
          <UTooltip text="Keyboard shortcuts">
            <UButton icon="i-lucide-keyboard" color="neutral" variant="ghost" @click="shortcutsOpen = true" />
          </UTooltip>
          <UTooltip text="Refresh" :kbds="['r']">
            <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="store.loading" @click="refresh" />
          </UTooltip>
          <UTooltip text="Open on GitHub">
            <UButton icon="i-simple-icons-github" color="neutral" variant="ghost" @click="openExternal(`https://github.com/${owner}/${name}/issues`)" />
          </UTooltip>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <TokenInput
            ref="search"
            v-model="view.search"
            :users="store.assignees"
            :labels="store.labels"
            placeholder="Search…  @user #label !priority"
            icon="i-lucide-search"
            size="sm"
            class="w-64 lg:w-80"
            @escape="view.search = ''"
          />
        </template>
        <template #right>
          <USelect v-model="view.state" :items="stateItems" size="sm" class="w-28" />
          <USelect v-model="view.assignee" :items="assigneeItems" size="sm" class="w-40" />
          <USelect v-model="view.groupBy" :items="groupItems" size="sm" class="w-36">
            <template #leading>
              <span class="text-xs text-dimmed">Group</span>
            </template>
          </USelect>
          <USelect v-model="view.sortBy" :items="sortItems" size="sm" class="w-44">
            <template #leading>
              <span class="text-xs text-dimmed">Sort</span>
            </template>
          </USelect>
          <UDropdownMenu :items="filterMenu" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-sliders-horizontal"
              :label="activeFilterName ?? 'Smart filters'"
              :color="activeFilterName ? 'primary' : 'neutral'"
              variant="outline"
              size="sm"
            />
          </UDropdownMenu>
        </template>
      </UDashboardToolbar>
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

      <div v-else class="-mx-4 -my-4 sm:-mx-6 sm:-my-6" @click.self="selected = []">
        <section v-for="group in groups" :key="group.key">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 h-9 bg-elevated/40 border-b border-default text-sm font-semibold"
            @click="toggleGroup(group.key)"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 text-dimmed transition-transform"
              :class="collapsed[group.key] ? '' : 'rotate-90'"
            />
            <UAvatar v-if="group.avatar" :src="group.avatar" size="3xs" />
            <span v-else-if="group.color" class="size-3 rounded-full" :style="{ backgroundColor: `#${group.color}` }" />
            <UIcon v-else-if="group.icon" :name="group.icon" class="size-4" :class="group.iconClass ?? 'text-muted'" />
            <span class="truncate">{{ group.title }}</span>
            <UBadge :label="String(group.issues.length)" size="sm" color="neutral" variant="soft" />
            <span v-if="group.subtitle" class="text-xs font-normal text-dimmed">{{ group.subtitle }}</span>
          </button>

          <template v-if="!collapsed[group.key]">
            <TaskRow
              v-for="issue in group.issues"
              :key="issue.number"
              :issue="issue"
              :selected="selected.includes(issue.number)"
              :group-by="view.groupBy"
              @select="select(issue.number, $event)"
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
  </UDashboardPanel>

  <TaskInspector
    v-if="selectedIssues.length === 1"
    :key="selectedIssues[0]!.number"
    :issue="selectedIssues[0]!"
    @close="selected = []"
  />
  <BatchInspector
    v-else-if="selectedIssues.length > 1"
    :issues="selectedIssues"
    @close="selected = []"
  />

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
