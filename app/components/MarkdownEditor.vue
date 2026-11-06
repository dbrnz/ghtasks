<script setup lang="ts">
// Write Markdown with a preview rendered by GitHub

const props = withDefaults(defineProps<{
  placeholder?: string
  autofocus?: boolean
  rows?: number
}>(), {
  rows: 4
})

const model = defineModel<string>({ default: '' })

const emit = defineEmits<{
  submit: []
  cancel: []
}>()

const { data } = useTasksContext()

const tab = ref<'write' | 'preview'>('write')
const preview = ref('')
const rendering = ref(false)

const tabs = [
  { label: 'Write', value: 'write', icon: 'i-lucide-pencil' },
  { label: 'Preview', value: 'preview', icon: 'i-lucide-eye' }
]

watch(tab, async (value) => {
  if (value !== 'preview') {
    return
  }
  if (!model.value.trim()) {
    preview.value = '<p class="text-dimmed">Nothing to preview</p>'
    return
  }
  rendering.value = true
  try {
    preview.value = await data.renderMarkdown(model.value)
  } catch (err) {
    preview.value = `<p class="text-error">${errorMessage(err)}</p>`
  } finally {
    rendering.value = false
  }
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    emit('submit')
  } else if (event.key === 'Escape') {
    event.stopPropagation()
    emit('cancel')
  }
}
</script>

<template>
  <div class="rounded-md border border-default overflow-hidden">
    <div class="flex items-center justify-between bg-elevated/50 border-b border-default px-1">
      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        variant="link"
        size="xs"
      />
      <span class="text-xs text-dimmed pe-2 hidden sm:inline">Markdown supported</span>
    </div>
    <UTextarea
      v-if="tab === 'write'"
      v-model="model"
      :placeholder="props.placeholder"
      :rows="rows"
      :autofocus="autofocus"
      autoresize
      :maxrows="24"
      variant="none"
      class="w-full"
      :ui="{ base: 'font-mono text-sm' }"
      @keydown="onKeydown"
    />
    <div v-else class="p-3 min-h-24">
      <USkeleton v-if="rendering" class="h-16 w-full" />
      <!-- eslint-disable-next-line vue/no-v-html -- sanitised by GitHub -->
      <div v-else class="markdown-body" @click="interceptLinks" v-html="preview" />
    </div>
    <div v-if="$slots.actions" class="flex items-center justify-end gap-2 p-2 border-t border-default bg-elevated/30">
      <slot name="actions" />
    </div>
  </div>
</template>
