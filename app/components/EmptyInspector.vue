<script setup lang="ts">
// The details panel when no task is selected

const inspectorWidth = useInspectorWidth()
</script>

<template>
  <UDashboardPanel id="inspector" class="lg:flex-none lg:w-(--inspector-width)" :style="inspectorWidth.style.value">
    <template #header>
      <InspectorResizeHandle />
      <div class="flex items-center justify-end px-5 pt-3 pb-3">
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
