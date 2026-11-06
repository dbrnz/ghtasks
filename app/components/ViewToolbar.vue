<script setup lang="ts">
// The task list's toolbar: new task, quick filters, sort, group, search and more
import type { DropdownMenuItem } from '@nuxt/ui'
import type { GhLabel, GhUser, GroupBy, SmartFilter, SortBy, ViewSettings } from '~/utils/types'

const props = defineProps<{
  users: GhUser[]
  labels: GhLabel[]
  groupOptions: { key: string, title: string }[]
  hasTypes: boolean
  smartFilters: SmartFilter[]
  activeFilter: string | null
  loading: boolean
}>()

const view = defineModel<ViewSettings>('view', { required: true })

const emit = defineEmits<{
  'new-task': []
  'refresh': []
  'shortcuts': []
  'open-github': []
  'apply-filter': [filter: SmartFilter]
  'save-filter': []
  'remove-filter': [id: string]
  'reset-view': []
}>()

function update(patch: Partial<ViewSettings>) {
  view.value = { ...view.value, ...patch }
}

// Shared look for the round icon buttons
const ROUND = 'rounded-full'
const PILL_BG = 'bg-elevated/70'

// ---------------------------------------------------------------- Quick filters

const lastState = ref<'open' | 'closed'>(view.value.state === 'closed' ? 'closed' : 'open')

const stateItems = [
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' }
]

function setStateFilter(enabled: boolean) {
  update({ state: enabled ? lastState.value : 'all' })
}

function setStateValue(value: 'open' | 'closed') {
  lastState.value = value
  update({ state: value })
}

const filtersActive = computed(() => view.value.state !== 'all'
  || view.value.assignee !== 'anyone'
  || view.value.openedByMe
  || view.value.hideEmpty)

// ---------------------------------------------------------------- Sorting

const SORTS: { label: string, value: SortBy }[] = [
  { label: 'Priority', value: 'priority' },
  { label: 'State', value: 'state' },
  { label: 'Creation Date', value: 'created' },
  { label: 'Last Modified Date', value: 'updated' },
  { label: 'Assignees', value: 'assignee' },
  { label: 'Title', value: 'title' }
]

const sortMenu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: 'Sort Tasks by' }],
  SORTS.map(s => ({
    label: s.label,
    type: 'checkbox' as const,
    checked: view.value.sortBy === s.value,
    onUpdateChecked: () => update({ sortBy: s.value })
  })),
  [{
    label: 'Reverse Order',
    type: 'checkbox' as const,
    checked: view.value.reverse,
    onUpdateChecked: (checked: boolean) => update({ reverse: checked })
  }]
])

// ---------------------------------------------------------------- Grouping

const GROUPS = computed<{ label: string, value: GroupBy, icon: string, plural: string }[]>(() => [
  { label: 'None', value: 'none', icon: 'i-lucide-list', plural: '' },
  ...(props.hasTypes ? [{ label: 'Type', value: 'type' as const, icon: 'i-lucide-shapes', plural: 'Types' }] : []),
  { label: 'Milestone', value: 'milestone', icon: 'i-lucide-flag', plural: 'Milestones' },
  { label: 'Label', value: 'label', icon: 'i-lucide-tag', plural: 'Labels' },
  { label: 'Priority', value: 'priority', icon: 'i-lucide-signal', plural: 'Priorities' },
  { label: 'Assignee', value: 'assignee', icon: 'i-lucide-users', plural: 'Assignees' }
])

function setHidden(key: string, hidden: boolean) {
  const set = new Set(view.value.hidden)
  if (hidden) {
    set.add(key)
  } else {
    set.delete(key)
  }
  update({ hidden: [...set] })
}

const groupMenu = computed<DropdownMenuItem[][]>(() => {
  const current = GROUPS.value.find(g => g.value === view.value.groupBy)
  const keys = props.groupOptions.map(g => g.key)
  const hiddenHere = keys.filter(k => view.value.hidden.includes(k))
  const menu: DropdownMenuItem[][] = [
    [{ type: 'label', label: 'Group by' }],
    GROUPS.value.map(g => ({
      label: g.label,
      icon: g.icon,
      type: 'checkbox' as const,
      checked: view.value.groupBy === g.value,
      onUpdateChecked: () => update({ groupBy: g.value })
    }))
  ]
  if (current && current.value !== 'none') {
    menu.push([{
      label: `Visible ${current.plural}`,
      icon: 'i-lucide-eye',
      children: [
        props.groupOptions.map(g => ({
          label: g.title,
          type: 'checkbox' as const,
          checked: !view.value.hidden.includes(g.key),
          onUpdateChecked: (checked: boolean) => setHidden(g.key, !checked),
          onSelect: (e: Event) => e.preventDefault() // keep the menu open
        })),
        [
          {
            label: 'Show All',
            disabled: !hiddenHere.length,
            onSelect: (e: Event) => {
              e.preventDefault()
              update({ hidden: view.value.hidden.filter(k => !keys.includes(k)) })
            }
          },
          {
            label: 'Hide All',
            disabled: hiddenHere.length === keys.length,
            onSelect: (e: Event) => {
              e.preventDefault()
              update({ hidden: [...new Set([...view.value.hidden, ...keys])] })
            }
          }
        ]
      ]
    }])
  }
  return menu
})

// ---------------------------------------------------------------- Search

const searching = ref(!!view.value.search)
const searchInput = useTemplateRef<{ focus: () => void }>('searchInput')

function openSearch() {
  searching.value = true
  nextTick(() => searchInput.value?.focus())
}

function closeSearch() {
  update({ search: '' })
  searching.value = false
}

function onSearchEscape() {
  if (view.value.search) {
    update({ search: '' })
  } else {
    searching.value = false
  }
}

// ---------------------------------------------------------------- More

const moreMenu = computed<DropdownMenuItem[][]>(() => [[
  { label: 'Refresh', icon: 'i-lucide-refresh-cw', kbds: ['r'], onSelect: () => emit('refresh') },
  { label: 'Keyboard shortcuts', icon: 'i-lucide-keyboard', onSelect: () => emit('shortcuts') },
  { label: 'Open on GitHub', icon: 'i-simple-icons-github', onSelect: () => emit('open-github') }
]])

defineExpose({ openSearch })
</script>

<template>
  <div class="flex items-center gap-2">
    <UTooltip text="New task" :kbds="['n']">
      <UButton icon="i-lucide-plus" color="neutral" variant="ghost" :class="[ROUND, PILL_BG]" aria-label="New task" @click="emit('new-task')" />
    </UTooltip>

    <!-- Filter, sort and group -->
    <div class="flex items-center gap-0.5 p-0.5 rounded-full" :class="PILL_BG">
      <UPopover :content="{ align: 'center', sideOffset: 8 }" arrow>
        <UButton
          icon="i-lucide-list-filter"
          :color="filtersActive ? 'primary' : 'neutral'"
          :variant="filtersActive ? 'solid' : 'ghost'"
          :class="ROUND"
          aria-label="Quick filters"
        />
        <template #content>
          <div class="w-72 p-4 space-y-3 text-sm">
            <p class="text-xs font-semibold text-dimmed">
              Task Quick Filters
            </p>
            <div class="flex items-center gap-2">
              <UCheckbox :model-value="view.state !== 'all'" label="State:" @update:model-value="v => setStateFilter(!!v)" />
              <USelect
                :model-value="view.state === 'all' ? lastState : view.state"
                :items="stateItems"
                :disabled="view.state === 'all'"
                variant="soft"
                size="sm"
                class="w-28"
                @update:model-value="v => setStateValue(v as 'open' | 'closed')"
              />
            </div>
            <UCheckbox
              :model-value="view.assignee === 'me'"
              label="Assigned to me"
              @update:model-value="v => update({ assignee: v ? 'me' : 'anyone' })"
            />
            <UCheckbox
              :model-value="view.openedByMe"
              label="Opened by me"
              @update:model-value="v => update({ openedByMe: !!v })"
            />
            <USeparator />
            <UCheckbox
              :model-value="view.hideEmpty"
              label="Hide groups with no tasks"
              @update:model-value="v => update({ hideEmpty: !!v })"
            />
            <USeparator />
            <p class="text-xs font-semibold text-dimmed">
              Smart Filters
            </p>
            <ul v-if="smartFilters.length" class="space-y-0.5">
              <li v-for="f in smartFilters" :key="f.id" class="group/filter flex items-center gap-1">
                <UButton
                  :label="f.name"
                  :icon="f.id === activeFilter ? 'i-lucide-check' : 'i-lucide-sliders-horizontal'"
                  :color="f.id === activeFilter ? 'primary' : 'neutral'"
                  variant="ghost"
                  size="sm"
                  class="flex-1"
                  @click="emit('apply-filter', f)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  class="opacity-0 group-hover/filter:opacity-100"
                  :aria-label="`Delete ${f.name}`"
                  @click="emit('remove-filter', f.id)"
                />
              </li>
            </ul>
            <p v-else class="text-dimmed">
              Save the current search, filters, sort and grouping for later.
            </p>
            <div class="flex gap-2">
              <UButton label="Save current view…" icon="i-lucide-save" color="neutral" variant="soft" size="sm" @click="emit('save-filter')" />
              <UButton label="Reset" icon="i-lucide-rotate-ccw" color="neutral" variant="ghost" size="sm" @click="emit('reset-view')" />
            </div>
          </div>
        </template>
      </UPopover>

      <UDropdownMenu :items="sortMenu" :content="{ align: 'center', sideOffset: 8 }">
        <UButton icon="i-lucide-arrow-down-up" color="neutral" variant="ghost" :class="ROUND" aria-label="Sort" />
      </UDropdownMenu>

      <UDropdownMenu :items="groupMenu" :content="{ align: 'center', sideOffset: 8 }">
        <UButton icon="i-lucide-flag" color="neutral" variant="ghost" :class="ROUND" aria-label="Group" />
      </UDropdownMenu>
    </div>

    <!-- Search: an icon that expands into a field -->
    <template v-if="searching">
      <UButton icon="i-lucide-chevrons-right" color="neutral" variant="ghost" :class="[ROUND, PILL_BG]" aria-label="Close search" @click="closeSearch" />
      <TokenInput
        ref="searchInput"
        :model-value="view.search"
        :users="users"
        :labels="labels"
        placeholder="Filter Issues"
        icon="i-lucide-search"
        class="w-56 xl:w-72"
        :ui="{ base: 'rounded-full' }"
        @update:model-value="v => update({ search: v })"
        @escape="onSearchEscape"
      />
    </template>
    <UTooltip v-else text="Search" :kbds="['/']">
      <UButton icon="i-lucide-search" color="neutral" variant="ghost" :class="[ROUND, PILL_BG]" aria-label="Search" @click="openSearch" />
    </UTooltip>

    <UDropdownMenu :items="moreMenu" :content="{ align: 'end' }">
      <UButton
        :icon="loading ? 'i-lucide-loader-circle' : 'i-lucide-ellipsis'"
        color="neutral"
        variant="ghost"
        :class="[ROUND, PILL_BG]"
        :ui="{ leadingIcon: loading ? 'animate-spin' : '' }"
        aria-label="More"
      />
    </UDropdownMenu>
  </div>
</template>
