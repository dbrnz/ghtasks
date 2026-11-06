<script setup lang="ts">
// The details panel when no task is selected

const inspectorWidth = useInspectorWidth()

const TOOLS = [
  { icon: 'i-lucide-files', label: 'Copy' },
  { icon: 'i-lucide-compass', label: 'Open on GitHub' },
  { icon: 'i-lucide-square-arrow-out-up-right', label: 'Open in Window' }
]
</script>

<template>
  <UDashboardPanel id="inspector" class="lg:flex-none lg:w-(--inspector-width)" :style="inspectorWidth.style.value">
    <template #header>
      <InspectorResizeHandle />
      <!-- The same tools as for a task, dimmed as there's nothing to act on -->
      <div class="flex items-center justify-end gap-2 px-5 pt-3 pb-3">
        <div :class="BUTTON_PILL">
          <UButton
            v-for="tool in TOOLS"
            :key="tool.label"
            :icon="tool.icon"
            color="neutral"
            variant="ghost"
            class="rounded-full disabled:opacity-35"
            :aria-label="tool.label"
            disabled
          />
        </div>
        <UButton icon="i-lucide-pin" color="neutral" variant="ghost" :class="ROUND_BUTTON" class="disabled:opacity-35" aria-label="Pin to top" disabled />
        <UTooltip text="Toggle Inspector" :kbds="['i']">
          <UButton icon="i-lucide-panel-right" color="neutral" variant="ghost" :class="ROUND_BUTTON" class="-me-1" aria-label="Toggle Inspector" @click="inspectorWidth.toggle()" />
        </UTooltip>
      </div>
    </template>
    <template #body>
      <div class="flex-1 flex items-center justify-center text-lg text-dimmed select-none">
        No Tasks Selected
      </div>
    </template>
    <template #footer>
      <div :class="STATUS_BAR" />
    </template>
  </UDashboardPanel>
</template>
