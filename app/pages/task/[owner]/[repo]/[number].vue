<script setup lang="ts">
// A single task's details, in its own window ("Open in Window")
import { useEventListener } from '@vueuse/core'
import type { GhIssue } from '~/utils/types'

definePageMeta({ layout: 'bare' })

const route = useRoute()
const owner = String(route.params.owner)
const name = String(route.params.repo)
const number = Number(route.params.number)

const { viewer } = useGitHub()
const data = useRepoData(owner, name)
const actions = useTaskActions(data)
const pins = usePins(repoKey(owner, name))

provide(TasksContextKey, {
  data,
  actions,
  pins,
  viewer: computed(() => viewer.value as GhIssue['user'])
})

const issue = computed(() => data.find(number))
const error = ref('')

onMounted(async () => {
  try {
    await data.load()
    if (!data.find(number)) {
      await data.fetchIssue(number) // e.g. a closed task
    }
  } catch (err) {
    error.value = errorMessage(err)
  }
})

// Pick up changes made elsewhere (e.g. in the main window)
useEventListener(window, 'focus', () => {
  if (data.store.loaded) {
    data.sync().catch(() => {})
  }
})

useHead(() => ({ title: issue.value ? `#${number} ${issue.value.title}` : `#${number} · GitHub Tasks` }))
</script>

<template>
  <TaskInspector v-if="issue" :issue="issue" standalone />
  <UDashboardPanel v-else id="task">
    <template #body>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="`Unable to load #${number}`"
        :description="error"
      />
      <div v-else class="space-y-3">
        <USkeleton class="h-8 w-24" />
        <USkeleton class="h-8 w-3/4" />
        <USkeleton class="h-40 w-full" />
      </div>
    </template>
  </UDashboardPanel>
</template>
