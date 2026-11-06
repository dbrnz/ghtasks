<script setup lang="ts">
// Add a task to a group by typing, e.g. `Fix login @alice #bug !high`

const props = defineProps<{
  defaults: { labels?: string[], assignees?: string[], milestone?: number | null }
}>()

const emit = defineEmits<{
  created: [number: number]
}>()

const { data, actions } = useTasksContext()

const active = ref(false)
const text = ref('')
const busy = ref(false)
const input = useTemplateRef<{ focus: () => void }>('input')

function open() {
  active.value = true
  nextTick(() => input.value?.focus())
}

async function submit() {
  if (!text.value.trim() || busy.value) {
    return
  }
  busy.value = true
  const issue = await actions.create(text.value, props.defaults)
  busy.value = false
  if (issue) {
    text.value = ''
    emit('created', issue.number)
    nextTick(() => input.value?.focus())
  }
}

function cancel() {
  text.value = ''
  active.value = false
}

defineExpose({ open })
</script>

<template>
  <div class="px-3 py-1.5 border-b border-default/60">
    <TokenInput
      v-if="active"
      ref="input"
      v-model="text"
      :users="data.store.assignees"
      :labels="data.store.labels"
      placeholder="New task — @assignee #label !priority, Enter to add"
      icon="i-lucide-plus"
      size="sm"
      variant="soft"
      @submit="submit"
      @escape="cancel"
      @blur="!text && cancel()"
    >
      <template #trailing>
        <UIcon v-if="busy" name="i-lucide-loader-circle" class="size-4 animate-spin text-muted" />
        <UKbd v-else value="enter" />
      </template>
    </TokenInput>
    <button
      v-else
      type="button"
      class="flex items-center gap-2 text-sm text-dimmed hover:text-default h-7"
      @click="open"
    >
      <UIcon name="i-lucide-plus" class="size-4" />
      New task
    </button>
  </div>
</template>
