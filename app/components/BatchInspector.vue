<script setup lang="ts">
// Change several tasks at once
import type { GhIssue } from '~/utils/types'

const props = defineProps<{ issues: GhIssue[] }>()

const emit = defineEmits<{ close: [] }>()

const { data, actions, pins } = useTasksContext()
const inspectorWidth = useInspectorWidth()
const { labelItems, assigneeItems, milestoneItems, priorityItems, typeItems } = usePickerItems(data.store)

const busy = ref(false)

async function run(fn: () => Promise<unknown>) {
  busy.value = true
  await fn()
  busy.value = false
}

// Values that every selected task shares, shown as ticked
const commonLabels = computed(() => labelItems.value
  .map(i => i.value)
  .filter(name => props.issues.every(issue => issue.labels.some(l => l.name === name))))

const commonAssignees = computed(() => assigneeItems.value
  .map(i => i.value)
  .filter(login => props.issues.every(issue => issue.assignees.some(a => a.login === login))))

/** Turn a picker's new value into adds and removes relative to the common values. */
function applyDiff(before: string[], after: string[], add: (v: string) => Promise<unknown>, remove: (v: string) => Promise<unknown>) {
  return run(async () => {
    for (const v of after.filter(v => !before.includes(v))) {
      await add(v)
    }
    for (const v of before.filter(v => !after.includes(v))) {
      await remove(v)
    }
  })
}

const allPinned = computed(() => props.issues.every(i => pins.isPinned(i.number)))
const openCount = computed(() => props.issues.filter(i => i.state === 'open').length)

const stateMenu = computed(() => [[
  { label: 'Close as completed', icon: 'i-lucide-circle-check', disabled: !openCount.value, onSelect: () => run(() => actions.setState(props.issues, 'closed', 'completed')) },
  { label: 'Close as not planned', icon: 'i-lucide-circle-slash', disabled: !openCount.value, onSelect: () => run(() => actions.setState(props.issues, 'closed', 'not_planned')) },
  { label: 'Reopen', icon: 'i-lucide-rotate-ccw', disabled: openCount.value === props.issues.length, onSelect: () => run(() => actions.setState(props.issues, 'open')) }
]])

const stateSummary = computed(() => {
  const open = openCount.value
  const closed = props.issues.length - open
  return [open && `${open} open`, closed && `${closed} closed`].filter(Boolean).join(', ')
})

const HEADING = PANEL_HEADING
const SELECT = PANEL_SELECT
const CHIP = PANEL_CHIP
</script>

<template>
  <UDashboardPanel id="inspector" class="lg:flex-none lg:w-(--inspector-width)" :style="inspectorWidth.style.value">
    <template #header>
      <InspectorResizeHandle />
      <!-- Selection summary -->
      <div class="px-5 pt-4 pb-4 border-b border-default">
        <div class="flex items-start gap-2">
          <h2 class="flex-1 text-2xl leading-snug text-highlighted">
            {{ issues.length }} tasks selected
          </h2>
          <div class="flex items-center -me-2 shrink-0">
            <UIcon v-if="busy" name="i-lucide-loader-circle" class="size-4 mx-2 animate-spin text-muted" />
            <UTooltip :text="allPinned ? 'Unpin all' : 'Pin all to top'">
              <UButton
                :icon="allPinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="pins.setPinned(issues.map(i => i.number), !allPinned)"
              />
            </UTooltip>
            <UTooltip text="Clear selection" :kbds="['escape']">
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" aria-label="Clear selection" @click="emit('close')" />
            </UTooltip>
          </div>
        </div>
        <p class="mt-2 text-sm text-muted">
          {{ stateSummary }} · changes apply to every selected task
        </p>
      </div>
    </template>

    <template #body>
      <div class="space-y-5">
        <div class="grid grid-cols-2 gap-x-4 gap-y-4">
          <section v-if="data.store.issueTypes.length">
            <h3 :class="HEADING">
              Type
            </h3>
            <PickerMenu
              :items="typeItems"
              :model-value="[]"
              :multiple="false"
              v-bind="SELECT"
              placeholder="Set type…"
              search-placeholder="Type…"
              @commit="v => run(() => actions.setType(issues, !v[0] || v[0] === NO_TYPE ? null : v[0]))"
            />
          </section>

          <section>
            <h3 :class="HEADING">
              Milestone
            </h3>
            <PickerMenu
              :items="milestoneItems"
              :model-value="[]"
              :multiple="false"
              v-bind="SELECT"
              placeholder="Set milestone…"
              search-placeholder="Milestones…"
              :action="{ label: 'New Milestone…', icon: 'i-lucide-circle-plus' }"
              @action="run(() => actions.newMilestone(issues))"
              @commit="v => run(() => actions.setMilestone(issues, !v[0] || v[0] === NO_MILESTONE ? null : Number(v[0])))"
            />
          </section>

          <section>
            <h3 :class="HEADING">
              Priority
            </h3>
            <PickerMenu
              :items="priorityItems"
              :model-value="[]"
              :multiple="false"
              v-bind="SELECT"
              placeholder="Set priority…"
              search-placeholder="Priority…"
              @commit="v => run(() => actions.setPriority(issues, PRIORITIES.find(p => p.key === v[0])))"
            />
          </section>

          <section>
            <h3 :class="HEADING">
              Status
            </h3>
            <UDropdownMenu :items="stateMenu" :content="{ align: 'start' }">
              <UButton
                label="Set status…"
                color="neutral"
                variant="soft"
                block
                trailing-icon="i-lucide-chevrons-up-down"
                class="justify-start font-normal text-dimmed"
                :ui="{ trailingIcon: 'ms-auto text-default' }"
              />
            </UDropdownMenu>
          </section>
        </div>

        <section>
          <h3 :class="HEADING">
            Assignees
          </h3>
          <PickerMenu
            :items="assigneeItems"
            :model-value="commonAssignees"
            variant="none"
            search-placeholder="Assignees…"
            trigger-class="p-0 w-full"
            @commit="v => applyDiff(commonAssignees, v, u => actions.addAssignee(issues, u), u => actions.removeAssignee(issues, u))"
          >
            <span v-if="commonAssignees.length" class="flex flex-wrap gap-1.5">
              <span v-for="login in commonAssignees" :key="login" :class="CHIP">
                <UAvatar :src="data.store.assignees.find(a => a.login === login)?.avatar_url" :alt="login" size="3xs" />{{ login }}
              </span>
            </span>
            <span v-else class="text-[15px] text-dimmed">Add or remove assignees</span>
          </PickerMenu>
        </section>

        <section>
          <h3 :class="HEADING">
            Labels
          </h3>
          <PickerMenu
            :items="labelItems"
            :model-value="commonLabels"
            variant="none"
            creatable
            search-placeholder="Labels…"
            trigger-class="p-0 w-full"
            @commit="v => applyDiff(commonLabels, v, l => actions.addLabel(issues, l), l => actions.removeLabel(issues, l))"
          >
            <span v-if="commonLabels.length" class="flex flex-wrap gap-1.5">
              <template v-for="name in commonLabels" :key="name">
                <LabelBadge v-if="data.store.labels.find(l => l.name === name)" :label="data.store.labels.find(l => l.name === name)!" />
              </template>
            </span>
            <span v-else class="text-[15px] text-dimmed">Add or remove labels</span>
          </PickerMenu>
        </section>

        <USeparator />

        <section>
          <h3 :class="HEADING">
            Selected tasks
          </h3>
          <ul class="space-y-1.5">
            <li v-for="issue in issues" :key="issue.number" class="flex items-start gap-2 text-[15px] leading-5">
              <span class="flex items-center justify-end gap-1.5 w-14 h-5 shrink-0 text-xs font-semibold text-muted tabular-nums">
                #{{ issue.number }}<TypeDot v-if="issue.type" :type="issue.type" size="sm" />
              </span>
              <span :class="issue.state === 'closed' ? 'line-through text-muted' : 'text-highlighted'">{{ issue.title }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
