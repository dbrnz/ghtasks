<script setup lang="ts">
// A task's sub-issues, with their progress, in the details panel
import type { GhIssue } from '~/utils/types'

const props = defineProps<{ issue: GhIssue }>()

const { data, actions, open } = useTasksContext()

const subIssues = ref<GhIssue[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  subIssues.value = await actions.attempt('Unable to load sub-issues', () => data.listSubIssues(props.issue.number)) ?? []
  loading.value = false
}

// Reload for another task, or when one is added (here or elsewhere)
watch(() => [props.issue.number, props.issue.sub_issues_summary?.total], load, { immediate: true })

const completed = computed(() => subIssues.value.filter(i => i.state === 'closed').length)

// Keep the task's progress (shown in its row) in step with the list
watch([() => subIssues.value.length, completed], ([total, done]) => {
  const task = data.find(props.issue.number)
  if (task && !loading.value && (task.sub_issues_summary?.total !== total || task.sub_issues_summary?.completed !== done)) {
    task.sub_issues_summary = { total, completed: done, percent_completed: total ? Math.round(100 * done / total) : 0 }
  }
})

async function toggle(sub: GhIssue) {
  const updated = await actions.setState([sub], sub.state === 'open' ? 'closed' : 'open')
  const result = updated?.[0]
  if (result) {
    const index = subIssues.value.findIndex(i => i.number === sub.number)
    subIssues.value.splice(index, 1, { ...sub, state: result.state, state_reason: result.state_reason })
  }
}
</script>

<template>
  <section>
    <div class="flex items-center gap-2 mb-1.5">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
        Sub-issues
      </h3>
      <template v-if="subIssues.length">
        <span class="text-xs text-dimmed tabular-nums">{{ completed }} of {{ subIssues.length }}</span>
        <UProgress :model-value="completed" :max="subIssues.length" size="xs" class="w-16" />
      </template>
      <UTooltip text="New Sub-issue">
        <UButton
          icon="i-lucide-plus"
          size="xs"
          color="primary"
          variant="link"
          class="ms-auto -me-1"
          aria-label="New Sub-issue"
          @click="actions.newSubIssue(issue)"
        />
      </UTooltip>
    </div>

    <USkeleton v-if="loading && !subIssues.length" class="h-6 w-2/3" />
    <ul v-else-if="subIssues.length" class="space-y-1">
      <li v-for="sub in subIssues" :key="sub.id" class="flex items-start gap-2 text-[15px] leading-5">
        <UCheckbox
          :model-value="sub.state === 'closed'"
          :ui="{ base: 'rounded-[4px] bg-elevated border-default' }"
          :aria-label="sub.state === 'closed' ? 'Reopen' : 'Close'"
          class="mt-0.5"
          @update:model-value="toggle(sub)"
        />
        <button
          type="button"
          class="flex-1 min-w-0 text-start hover:underline"
          :class="sub.state === 'closed' ? 'line-through text-muted' : 'text-default'"
          :disabled="!open"
          @click="open?.(sub.number)"
        >
          <span class="text-xs font-semibold text-muted tabular-nums me-1.5">#{{ sub.number }}</span>{{ sub.title }}
        </button>
      </li>
    </ul>
    <p v-else class="text-[15px] text-dimmed">
      None
    </p>
  </section>
</template>
