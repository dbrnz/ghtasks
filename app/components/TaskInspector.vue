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
    return { label: 'Open', icon: 'i-lucide-circle-dot', iconClass: 'text-success' }
  }
  return props.issue.state_reason === 'not_planned'
    ? { label: 'Not planned', icon: 'i-lucide-circle-slash', iconClass: 'text-muted' }
    : { label: 'Completed', icon: 'i-lucide-circle-check', iconClass: 'text-primary' }
})

const HEADING = PANEL_HEADING
const commentThread = useTemplateRef<{ compose: () => void }>('commentThread')
const NEW_MILESTONE = { label: 'New Milestone…', icon: 'i-lucide-circle-plus' }
const SELECT = PANEL_SELECT
const CHIP = PANEL_CHIP

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
      <!-- Title and assignees -->
      <div class="px-5 pt-4 pb-4 border-b border-default">
        <div class="flex items-start gap-2">
          <UTextarea
            v-model="title"
            autoresize
            :rows="1"
            variant="none"
            class="flex-1"
            :ui="{ base: 'text-2xl md:text-2xl font-normal leading-snug p-0 resize-none' }"
            @blur="saveTitle"
            @keydown.enter.prevent="($event.target as HTMLTextAreaElement).blur()"
            @keydown.esc="title = issue.title; ($event.target as HTMLTextAreaElement).blur()"
          />
          <div class="flex items-center -me-2 shrink-0">
            <UTooltip :text="pinned ? 'Unpin' : 'Pin to top'">
              <UButton
                :icon="pinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="pins.togglePin(issue.number)"
              />
            </UTooltip>
            <UTooltip :text="`Open #${issue.number} on GitHub`">
              <UButton icon="i-lucide-external-link" color="neutral" variant="ghost" size="sm" @click="openExternal(issue.html_url)" />
            </UTooltip>
            <UTooltip text="Close" :kbds="['escape']">
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" aria-label="Close details" @click="emit('close')" />
            </UTooltip>
          </div>
        </div>

        <PickerMenu
          :items="assigneeItems"
          :model-value="issue.assignees.map(a => a.login)"
          variant="none"
          search-placeholder="Assignees…"
          trigger-class="p-0 mt-2"
          @commit="users => actions.setAssignees(issue, users)"
        >
          <span v-if="issue.assignees.length" class="flex flex-wrap gap-1.5">
            <span v-for="a in issue.assignees" :key="a.login" :class="CHIP">
              <UAvatar :src="a.avatar_url" :alt="a.login" size="3xs" />{{ a.login }}
            </span>
          </span>
          <span v-else class="text-sm text-dimmed">Assign someone</span>
        </PickerMenu>
      </div>
    </template>

    <template #body>
      <div class="space-y-5">
        <section>
          <h3 :class="HEADING">
            Opened
          </h3>
          <p class="flex flex-wrap items-center gap-1.5 text-[15px] text-default">
            <span>{{ formatDateTime(issue.created_at) }} by</span>
            <span :class="CHIP">
              <UAvatar :src="issue.user?.avatar_url" :alt="issue.user?.login" size="3xs" />{{ issue.user?.login }}
            </span>
          </p>
          <p v-if="issue.closed_at" class="mt-1 text-sm text-muted">
            Closed {{ formatDateTime(issue.closed_at) }}
          </p>
        </section>

        <div class="grid grid-cols-2 gap-x-4 gap-y-4">
          <section v-if="data.store.issueTypes.length || issue.type">
            <h3 :class="HEADING">
              Type
            </h3>
            <PickerMenu
              :items="typeItems"
              :model-value="[issue.type?.name ?? NO_TYPE]"
              :multiple="false"
              v-bind="SELECT"
              search-placeholder="Type…"
              @commit="setType"
            >
              <span v-if="issue.type" class="flex items-center gap-2">
                <TypeDot :type="issue.type" />{{ issue.type.name }}
              </span>
              <span v-else class="text-dimmed">None</span>
            </PickerMenu>
          </section>

          <section>
            <h3 :class="HEADING">
              Milestone
            </h3>
            <PickerMenu
              :items="milestoneItems"
              :model-value="[issue.milestone ? String(issue.milestone.number) : NO_MILESTONE]"
              :multiple="false"
              v-bind="SELECT"
              search-placeholder="Milestones…"
              :action="NEW_MILESTONE"
              @commit="setMilestone"
              @action="actions.newMilestone([issue])"
            >
              <span v-if="issue.milestone" class="truncate">{{ issue.milestone.title }}</span>
              <span v-else class="text-dimmed">None</span>
            </PickerMenu>
          </section>

          <section>
            <h3 :class="HEADING">
              Priority
            </h3>
            <PickerMenu
              :items="priorityItems"
              :model-value="[priority?.key ?? NO_PRIORITY]"
              :multiple="false"
              v-bind="SELECT"
              search-placeholder="Priority…"
              @commit="setPriority"
            >
              <span v-if="priority" class="flex items-center gap-2">
                <UIcon :name="priority.icon" class="size-4" :class="priority.class" />{{ priority.title }}
              </span>
              <span v-else class="text-dimmed">None</span>
            </PickerMenu>
          </section>

          <section>
            <h3 :class="HEADING">
              Status
            </h3>
            <UDropdownMenu :items="stateMenu" :content="{ align: 'start' }">
              <UButton
                color="neutral"
                variant="soft"
                block
                trailing-icon="i-lucide-chevrons-up-down"
                class="justify-start font-normal"
                :ui="{ trailingIcon: 'ms-auto text-default' }"
              >
                <UIcon :name="stateBadge.icon" class="size-4" :class="stateBadge.iconClass" />{{ stateBadge.label }}
              </UButton>
            </UDropdownMenu>
          </section>
        </div>

        <section>
          <h3 :class="HEADING">
            Labels
          </h3>
          <PickerMenu
            :items="labelItems"
            :model-value="labels.map(l => l.name)"
            variant="none"
            creatable
            search-placeholder="Labels…"
            trigger-class="p-0 w-full"
            @commit="names => actions.setLabels(issue, priority ? [...names, priority.label] : names)"
          >
            <span v-if="labels.length" class="flex flex-wrap gap-1.5">
              <LabelBadge v-for="label in labels" :key="label.id" :label="label" />
            </span>
            <span v-else class="text-[15px] text-dimmed">Enter labels</span>
          </PickerMenu>
        </section>

        <section>
          <div class="flex items-center justify-between">
            <h3 :class="HEADING">
              Description
            </h3>
            <UTooltip v-if="!editingBody" text="Edit description">
              <UButton icon="i-lucide-pencil-line" size="xs" color="primary" variant="link" class="-me-1 -mt-1.5" @click="editBody" />
            </UTooltip>
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
              <UButton label="Save" size="sm" :loading="savingBody" :disabled="isUploading(bodyDraft)" @click="saveBody" />
            </template>
          </MarkdownEditor>
          <USkeleton v-else-if="loadingBody" class="h-20 w-full" />
          <!-- eslint-disable-next-line vue/no-v-html -- sanitised by GitHub -->
          <div v-else-if="issue.body_html" class="markdown-body text-[15px]" @click="interceptLinks" @dblclick="editBody" v-html="issue.body_html" />
          <button v-else type="button" class="text-[15px] text-dimmed" @click="editBody">
            Add a description
          </button>
        </section>

        <USeparator />

        <CommentThread ref="commentThread" :issue="issue" />
      </div>
    </template>

    <template #footer>
      <div :class="STATUS_BAR">
        <UButton
          label="New Comment"
          icon="i-lucide-message-square-plus"
          color="primary"
          variant="link"
          @click="commentThread?.compose()"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
