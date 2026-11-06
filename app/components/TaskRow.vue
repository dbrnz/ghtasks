<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui'
import type { GhIssue, GroupBy } from '~/utils/types'

const props = defineProps<{
  issue: GhIssue
  selected: boolean
  groupBy: GroupBy
}>()

const emit = defineEmits<{
  select: [event: MouseEvent]
}>()

const { data, actions, pins } = useTasksContext()
const { labelItems, assigneeItems, typeItems } = usePickerItems(data.store)
const hasTypes = computed(() => data.store.issueTypes.length > 0)

const priority = computed(() => priorityOf(props.issue))
const labels = computed(() => props.issue.labels.filter(l => !isPriorityLabel(l.name)))
const closed = computed(() => props.issue.state === 'closed')
const pinned = computed(() => pins.isPinned(props.issue.number))

// Inline title editing
const editing = ref(false)
const draftTitle = ref('')
const titleInput = useTemplateRef<{ inputRef: HTMLInputElement }>('titleInput')

function startEdit() {
  draftTitle.value = props.issue.title
  editing.value = true
  nextTick(() => titleInput.value?.inputRef?.select())
}

async function finishEdit(save: boolean) {
  if (!editing.value) {
    return
  }
  editing.value = false
  if (save) {
    await actions.rename(props.issue, draftTitle.value)
  }
}

const row = useTemplateRef<HTMLElement>('row')
watch(() => props.selected, (selected) => {
  if (selected) {
    row.value?.scrollIntoView({ block: 'nearest' })
  }
})

const menu = computed<ContextMenuItem[][]>(() => [
  [
    { label: pinned.value ? 'Unpin' : 'Pin to top', icon: pinned.value ? 'i-lucide-pin-off' : 'i-lucide-pin', onSelect: () => pins.togglePin(props.issue.number) },
    { label: 'Rename', icon: 'i-lucide-pencil', onSelect: startEdit }
  ],
  [
    ...(hasTypes.value
      ? [{
          label: 'Type',
          icon: 'i-lucide-circle-dot',
          children: [
            ...data.store.issueTypes.map(t => ({
              label: t.name,
              type: 'checkbox' as const,
              checked: props.issue.type?.name === t.name,
              onSelect: () => actions.setType([props.issue], t.name)
            })),
            { label: 'None', icon: 'i-lucide-minus', onSelect: () => actions.setType([props.issue], null) }
          ]
        }]
      : []),
    {
      label: 'Priority',
      icon: 'i-lucide-signal',
      children: [
        ...PRIORITIES.map(p => ({
          label: p.title,
          icon: p.icon,
          type: 'checkbox' as const,
          checked: priority.value?.key === p.key,
          onSelect: () => actions.setPriority([props.issue], p)
        })),
        { label: 'None', icon: 'i-lucide-minus', onSelect: () => actions.setPriority([props.issue], undefined) }
      ]
    }
  ],
  closed.value
    ? [{ label: 'Reopen', icon: 'i-lucide-rotate-ccw', onSelect: () => actions.setState([props.issue], 'open') }]
    : [
        { label: 'Close as completed', icon: 'i-lucide-circle-check', onSelect: () => actions.setState([props.issue], 'closed', 'completed') },
        { label: 'Close as not planned', icon: 'i-lucide-circle-slash', onSelect: () => actions.setState([props.issue], 'closed', 'not_planned') }
      ],
  [
    { label: 'Open on GitHub', icon: 'i-lucide-external-link', onSelect: () => openExternal(props.issue.html_url) },
    { label: 'Copy link', icon: 'i-lucide-link', onSelect: () => navigator.clipboard.writeText(props.issue.html_url) }
  ]
])
</script>

<template>
  <UContextMenu :items="menu">
    <div
      ref="row"
      class="group flex items-center gap-2 pe-3 h-8 cursor-default select-none"
      :class="selected ? 'bg-primary/15' : 'hover:bg-elevated/50'"
      :data-number="issue.number"
      @click="emit('select', $event)"
      @dblclick="startEdit"
    >
      <!-- Pin, number and type; pinned tasks get a tab-shaped marker -->
      <div
        class="flex items-center justify-end gap-1.5 h-5 w-24 ps-1.5 pe-3 shrink-0 text-xs font-medium tabular-nums"
        :class="pinned ? 'bg-primary text-inverted' : 'text-muted'"
        :style="pinned ? { clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%)' } : undefined"
      >
        <UIcon v-if="pinned" name="i-lucide-pin" class="size-3 me-auto" />
        <span>#{{ issue.number }}</span>
        <PickerMenu
          v-if="hasTypes"
          :items="typeItems"
          :model-value="[issue.type?.name ?? NO_TYPE]"
          :multiple="false"
          variant="none"
          size="xs"
          search-placeholder="Type…"
          trigger-class="p-0"
          @commit="v => actions.setType([issue], !v[0] || v[0] === NO_TYPE ? null : v[0])"
        >
          <TypeDot :type="issue.type" />
        </PickerMenu>
        <TypeDot v-else-if="issue.type" :type="issue.type" />
      </div>

      <UCheckbox
        :model-value="closed"
        :ui="{ base: 'rounded-[4px]' }"
        :aria-label="closed ? 'Reopen' : 'Close'"
        @click.stop
        @update:model-value="actions.toggleState(issue)"
      />

      <UTooltip v-if="priority" :text="`${priority.title} priority`">
        <UIcon :name="priority.icon" class="size-4 shrink-0" :class="priority.class" />
      </UTooltip>

      <div class="flex-1 min-w-0 flex items-center gap-2">
        <UInput
          v-if="editing"
          ref="titleInput"
          v-model="draftTitle"
          size="sm"
          class="flex-1"
          @click.stop
          @keydown.enter.prevent="finishEdit(true)"
          @keydown.esc.stop.prevent="finishEdit(false)"
          @blur="finishEdit(true)"
        />
        <template v-else>
          <span
            class="truncate text-sm"
            :class="closed ? 'line-through text-muted' : 'text-highlighted'"
          >{{ issue.title }}</span>
        </template>

        <PickerMenu
          v-if="!editing"
          :items="labelItems"
          :model-value="labels.map(l => l.name)"
          variant="none"
          size="xs"
          creatable
          search-placeholder="Labels…"
          trigger-class="p-0 min-w-0 shrink"
          @commit="names => actions.setLabels(issue, priority ? [...names, priority.label] : names)"
        >
          <span class="flex items-center gap-1 min-w-0 overflow-hidden">
            <LabelBadge v-for="label in labels" :key="label.id" :label="label" />
            <UIcon
              v-if="!labels.length"
              name="i-lucide-tag"
              class="size-3.5 text-dimmed opacity-0 group-hover:opacity-100"
            />
          </span>
        </PickerMenu>
      </div>

      <UBadge
        v-if="issue.milestone && groupBy !== 'milestone'"
        :label="issue.milestone.title"
        icon="i-lucide-milestone"
        color="neutral"
        variant="outline"
        size="sm"
        class="hidden md:inline-flex max-w-36 truncate"
      />

      <span v-if="issue.comments" class="hidden sm:flex items-center gap-1 text-xs text-muted">
        <UIcon name="i-lucide-message-square" class="size-3.5" />{{ issue.comments }}
      </span>

      <!-- Assignees (change them by clicking the avatars, or in the inspector) -->
      <PickerMenu
        v-if="issue.assignees.length"
        :items="assigneeItems"
        :model-value="issue.assignees.map(a => a.login)"
        variant="none"
        size="xs"
        search-placeholder="Assignees…"
        trigger-class="p-0 w-16 justify-end"
        @commit="users => actions.setAssignees(issue, users)"
      >
        <UAvatarGroup size="2xs" :max="3">
          <UAvatar v-for="a in issue.assignees" :key="a.login" :src="a.avatar_url" :alt="a.login" />
        </UAvatarGroup>
      </PickerMenu>
      <span v-else class="w-16 shrink-0" />
    </div>
  </UContextMenu>
</template>
