<script setup lang="ts">
// Shows or hides the left-hand pane (on wide windows; narrow ones use a menu)
const sidebar = useSidebar()
</script>

<template>
  <UTooltip text="Toggle Sidebar" :kbds="['meta', '\\']">
    <UButton
      icon="i-lucide-panel-left"
      color="neutral"
      variant="ghost"
      :class="ROUND_BUTTON"
      class="hidden lg:inline-flex"
      aria-label="Toggle Sidebar"
      @click="sidebar.toggle()"
    />
  </UTooltip>
</template>
