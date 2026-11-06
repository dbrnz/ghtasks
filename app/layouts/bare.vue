<script setup lang="ts">
// For a task opened in its own window: no sidebar
</script>

<template>
  <UDashboardGroup storage-key="ghtasks-task-window">
    <slot />
  </UDashboardGroup>
</template>
