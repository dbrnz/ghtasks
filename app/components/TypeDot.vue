<script setup lang="ts">
import type { GhIssueType } from '~/utils/types'

const props = withDefaults(defineProps<{
  type?: GhIssueType | null
  size?: 'sm' | 'md'
}>(), {
  size: 'md'
})

const color = computed(() => issueTypeColor(props.type))
</script>

<template>
  <span
    class="inline-block rounded-full border-2 shrink-0"
    :class="[size === 'sm' ? 'size-3' : 'size-3.5', type ? '' : 'border-dashed opacity-40']"
    :style="type
      ? { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 30%, transparent)` }
      : { borderColor: 'var(--ui-border-accented)' }"
    :title="type ? (type.description ? `${type.name}: ${type.description}` : type.name) : 'No type'"
  />
</template>
