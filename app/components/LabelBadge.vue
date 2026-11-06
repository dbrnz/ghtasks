<script setup lang="ts">
import type { GhLabel } from '~/utils/types'

defineProps<{ label: GhLabel }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 h-5 px-1.5 rounded-full bg-elevated text-[13px] text-default whitespace-nowrap max-w-56"
    :title="label.description || label.name"
  >
    <span class="size-2 rounded-full shrink-0" :style="{ backgroundColor: `#${label.color}` }" />
    <span class="truncate">{{ label.name }}</span>
  </span>
</template>
