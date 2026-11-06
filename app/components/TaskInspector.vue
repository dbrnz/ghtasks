<script setup lang="ts">
import type { GhIssue } from '~/utils/types'

const props = defineProps<{ issue: GhIssue }>()

const emit = defineEmits<{ close: [] }>()

const { data, actions, pins } = useTasksContext()
const inspectorWidth = useInspectorWidth()
const { labelItems, assigneeItems, milestoneItems, priorityItems, typeItems } = usePickerItems(data.store)

const priority = computed(() => priorityOf(props.issue))
const labels = computed(() => props.issue.labels.filter(l => !isPriorityLabel(l.name)))
const pinned = computed(() => pins.isPinned(props.issue.number))

// Title
const title = ref(props.issue.title)
watch(() => props.issue.title, (t) => { title.value = t })
function saveTitle() {
  if (title.value.trim() && title.value !== props.issue.title) {
    actions.rename(props.issue, title.value)
  } else {
    title.value = props.issue.title
  }
}

// Description
const editingBody = ref(false)
const bodyDraft = ref('')
const savingBody = ref(false)
const loadingBody = ref(false)

// Fetch the full issue (with rendered body) whenever the selection changes.
// NB. `immediate`, so this must come after the refs it uses are declared.
watch(() => props.issue.number, async (number) => {
  editingBody.value = false
  if (!data.find(number)?.body_html) {
    loadingBody.value = true
    await actions.attempt('Unable to load task', () => data.fetchIssue(number))
    loadingBody.value = false
  }
}, { immediate: true })

function editBody() {
  bodyDraft.value = props.issue.body ?? ''
  editingBody.value = true
}

async function saveBody() {
  savingBody.value = true
  const result = await actions.setBody(props.issue, bodyDraft.value)
  savingBody.value = false
  if (result) {
    editingBody.value = false
  }
}

const stateMenu = computed(() => props.issue.state === 'open'
  ? [[
      { label: 'Close as completed', icon: 'i-lucide-circle-check', onSelect: () => actions.setState([props.issue], 'closed', 'completed') },
      { label: 'Close as not planned', icon: 'i-lucide-circle-slash', onSelect: () => actions.setState([props.issue], 'closed', 'not_planned') }
    ]]
  : [[
      { label: 'Reopen', icon: 'i-lucide-rotate-ccw', onSelect: () => actions.setState([props.issue], 'open') }
    ]])

const stateBadge = computed(() => {
  if (props.issue.state === 'open') {
    return { label: 'Open', color: 'success' as const, icon: 'i-lucide-circle-dot' }
  }
  return props.issue.state_reason === 'not_planned'
    ? { label: 'Not planned', color: 'neutral' as const, icon: 'i-lucide-circle-slash' }
    : { label: 'Completed', color: 'primary' as const, icon: 'i-lucide-circle-check' }
})

function setMilestone(values: string[]) {
  const v = values[0]
  actions.setMilestone([props.issue], !v || v === NO_MILESTONE ? null : Number(v))
}

function setType(values: string[]) {
  const v = values[0]
  actions.setType([props.issue], !v || v === NO_TYPE ? null : v)
}

function setPriority(values: string[]) {
  actions.setPriority([props.issue], PRIORITIES.find(p => p.key === values[0]))
}
</script>

<template>
  <UDashboardPanel id="inspector" class="lg:flex-none lg:w-(--inspector-width)" :style="inspectorWidth.style.value">
    <template #header>
      <InspectorResizeHandle />
      <UDashboardNavbar :toggle="false">
        <template #leading>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" aria-label="Close inspector" @click="emit('close')" />
        </template>
        <template #title>
          <span class="text-muted font-normal">#{{ issue.number }}</span>
        </template>
        <template #right>
          <UTooltip :text="pinned ? 'Unpin' : 'Pin to top'">
            <UButton
              :icon="pinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
              color="neutral"
              variant="ghost"
              @click="pins.togglePin(issue.number)"
            />
          </UTooltip>
          <UTooltip text="Open on GitHub">
            <UButton icon="i-lucide-external-link" color="neutral" variant="ghost" @click="openExternal(issue.html_url)" />
          </UTooltip>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UTextarea
          v-model="title"
          autoresize
          :rows="1"
          variant="none"
          class="w-full"
          :ui="{ base: 'text-lg font-semibold p-0 resize-none' }"
          @blur="saveTitle"
          @keydown.enter.prevent="($event.target as HTMLTextAreaElement).blur()"
          @keydown.esc="title = issue.title; ($event.target as HTMLTextAreaElement).blur()"
        />

        <div class="flex items-center gap-2 text-xs text-muted -mt-4">
          <UAvatar :src="issue.user?.avatar_url" size="3xs" />
          <span>{{ issue.user?.login }} opened {{ timeAgo(issue.created_at) }}</span>
          <span v-if="issue.closed_at">· closed {{ timeAgo(issue.closed_at) }}</span>
        </div>

        <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 items-center text-sm">
          <dt class="text-muted">
            Status
          </dt>
          <dd>
            <UDropdownMenu :items="stateMenu" :content="{ align: 'start' }">
              <UButton
                :label="stateBadge.label"
                :icon="stateBadge.icon"
                :color="stateBadge.color"
                variant="soft"
                size="sm"
                trailing-icon="i-lucide-chevron-down"
              />
            </UDropdownMenu>
          </dd>

          <template v-if="data.store.issueTypes.length || issue.type">
            <dt class="text-muted">
              Type
            </dt>
            <dd>
              <PickerMenu
                :items="typeItems"
                :model-value="[issue.type?.name ?? NO_TYPE]"
                :multiple="false"
                search-placeholder="Type…"
                @commit="setType"
              >
                <span v-if="issue.type" class="flex items-center gap-1.5">
                  <TypeDot :type="issue.type" />{{ issue.type.name }}
                </span>
                <span v-else class="text-dimmed">None</span>
              </PickerMenu>
            </dd>
          </template>

          <dt class="text-muted">
            Priority
          </dt>
          <dd>
            <PickerMenu
              :items="priorityItems"
              :model-value="[priority?.key ?? NO_PRIORITY]"
              :multiple="false"
              search-placeholder="Priority…"
              @commit="setPriority"
            >
              <span v-if="priority" class="flex items-center gap-1.5">
                <UIcon :name="priority.icon" class="size-4" :class="priority.class" />{{ priority.title }}
              </span>
              <span v-else class="text-dimmed">None</span>
            </PickerMenu>
          </dd>

          <dt class="text-muted">
            Assignees
          </dt>
          <dd>
            <PickerMenu
              :items="assigneeItems"
              :model-value="issue.assignees.map(a => a.login)"
              search-placeholder="Assignees…"
              @commit="users => actions.setAssignees(issue, users)"
            >
              <span v-if="issue.assignees.length" class="flex flex-wrap items-center gap-2">
                <span v-for="a in issue.assignees" :key="a.login" class="flex items-center gap-1">
                  <UAvatar :src="a.avatar_url" size="3xs" />{{ a.login }}
                </span>
              </span>
              <span v-else class="text-dimmed">No one</span>
            </PickerMenu>
          </dd>

          <dt class="text-muted">
            Labels
          </dt>
          <dd>
            <PickerMenu
              :items="labelItems"
              :model-value="labels.map(l => l.name)"
              creatable
              search-placeholder="Labels…"
              @commit="names => actions.setLabels(issue, priority ? [...names, priority.label] : names)"
            >
              <span v-if="labels.length" class="flex flex-wrap gap-1">
                <LabelBadge v-for="label in labels" :key="label.id" :label="label" />
              </span>
              <span v-else class="text-dimmed">None</span>
            </PickerMenu>
          </dd>

          <dt class="text-muted">
            Milestone
          </dt>
          <dd>
            <PickerMenu
              :items="milestoneItems"
              :model-value="[issue.milestone ? String(issue.milestone.number) : NO_MILESTONE]"
              :multiple="false"
              search-placeholder="Milestones…"
              @commit="setMilestone"
            >
              <span v-if="issue.milestone" class="flex items-center gap-1.5">
                <UIcon name="i-lucide-milestone" class="size-4 text-muted" />{{ issue.milestone.title }}
              </span>
              <span v-else class="text-dimmed">None</span>
            </PickerMenu>
          </dd>
        </dl>

        <USeparator />

        <section>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold">
              Description
            </h3>
            <UButton
              v-if="!editingBody"
              icon="i-lucide-pencil"
              label="Edit"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="editBody"
            />
          </div>
          <MarkdownEditor
            v-if="editingBody"
            v-model="bodyDraft"
            autofocus
            :rows="8"
            @submit="saveBody"
            @cancel="editingBody = false"
          >
            <template #actions>
              <UButton label="Cancel" color="neutral" variant="ghost" size="sm" @click="editingBody = false" />
              <UButton label="Save" size="sm" :loading="savingBody" @click="saveBody" />
            </template>
          </MarkdownEditor>
          <USkeleton v-else-if="loadingBody" class="h-20 w-full" />
          <!-- eslint-disable-next-line vue/no-v-html -- sanitised by GitHub -->
          <div v-else-if="issue.body_html" class="markdown-body" @click="interceptLinks" @dblclick="editBody" v-html="issue.body_html" />
          <button v-else type="button" class="text-sm text-dimmed italic" @click="editBody">
            No description — click to add one
          </button>
        </section>

        <USeparator />

        <CommentThread :issue="issue" />
      </div>
    </template>
  </UDashboardPanel>
</template>
