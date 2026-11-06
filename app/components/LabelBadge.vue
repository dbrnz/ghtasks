<script setup lang="ts">
import type { GhLabel } from '~/utils/types'

const props = defineProps<{ label: GhLabel }>()

const style = computed(() => ({
  backgroundColor: `#${props.label.color}`,
  color: labelTextColor(props.label.color)
}))
</script>

<template>
  <span
    class="inline-flex items-center h-5 px-2 rounded-full text-xs font-medium whitespace-nowrap max-w-40 truncate"
    :style="style"
    :title="label.description || label.name"
  >{{ label.name }}</span>
</template>
