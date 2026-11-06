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
const anyOpen = computed(() => props.issues.some(i => i.state === 'open'))
</script>

<template>
  <UDashboardPanel id="inspector" class="lg:flex-none lg:w-(--inspector-width)" :style="inspectorWidth.style.value">
    <template #header>
      <InspectorResizeHandle />
      <UDashboardNavbar :toggle="false" :title="`${issues.length} tasks selected`">
        <template #leading>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" aria-label="Clear selection" @click="emit('close')" />
        </template>
        <template #right>
          <UIcon v-if="busy" name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 items-center text-sm">
          <template v-if="data.store.issueTypes.length">
            <dt class="text-muted">
              Type
            </dt>
            <dd>
              <PickerMenu
                :items="typeItems"
                :model-value="[]"
                :multiple="false"
                placeholder="Set type…"
                variant="outline"
                @commit="v => run(() => actions.setType(issues, !v[0] || v[0] === NO_TYPE ? null : v[0]))"
              />
            </dd>
          </template>

          <dt class="text-muted">
            Priority
          </dt>
          <dd>
            <PickerMenu
              :items="priorityItems"
              :model-value="[]"
              :multiple="false"
              placeholder="Set priority…"
              variant="outline"
              @commit="v => run(() => actions.setPriority(issues, PRIORITIES.find(p => p.key === v[0])))"
            />
          </dd>

          <dt class="text-muted">
            Assignees
          </dt>
          <dd>
            <PickerMenu
              :items="assigneeItems"
              :model-value="commonAssignees"
              placeholder="Add or remove…"
              variant="outline"
              @commit="v => applyDiff(commonAssignees, v, u => actions.addAssignee(issues, u), u => actions.removeAssignee(issues, u))"
            />
          </dd>

          <dt class="text-muted">
            Labels
          </dt>
          <dd>
            <PickerMenu
              :items="labelItems"
              :model-value="commonLabels"
              placeholder="Add or remove…"
              variant="outline"
              creatable
              @commit="v => applyDiff(commonLabels, v, l => actions.addLabel(issues, l), l => actions.removeLabel(issues, l))"
            />
          </dd>

          <dt class="text-muted">
            Milestone
          </dt>
          <dd>
            <PickerMenu
              :items="milestoneItems"
              :model-value="[]"
              :multiple="false"
              placeholder="Set milestone…"
              variant="outline"
              @commit="v => run(() => actions.setMilestone(issues, !v[0] || v[0] === NO_MILESTONE ? null : Number(v[0])))"
            />
          </dd>
        </dl>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="anyOpen"
            icon="i-lucide-circle-check"
            label="Close all"
            color="neutral"
            variant="outline"
            @click="run(() => actions.setState(issues, 'closed'))"
          />
          <UButton
            v-else
            icon="i-lucide-rotate-ccw"
            label="Reopen all"
            color="neutral"
            variant="outline"
            @click="run(() => actions.setState(issues, 'open'))"
          />
          <UButton
            :icon="allPinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
            :label="allPinned ? 'Unpin all' : 'Pin all'"
            color="neutral"
            variant="outline"
            @click="pins.setPinned(issues.map(i => i.number), !allPinned)"
          />
        </div>

        <USeparator />

        <ul class="space-y-1 text-sm">
          <li v-for="issue in issues" :key="issue.number" class="flex items-center gap-2 truncate">
            <UIcon
              :name="issue.state === 'open' ? 'i-lucide-circle-dot' : 'i-lucide-circle-check'"
              class="size-4 shrink-0"
              :class="issue.state === 'open' ? 'text-success' : 'text-primary'"
            />
            <span class="text-dimmed">#{{ issue.number }}</span>
            <span class="truncate">{{ issue.title }}</span>
          </li>
        </ul>
      </div>
    </template>
  </UDashboardPanel>
</template>
