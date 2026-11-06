<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
}>(), {
  confirmLabel: 'OK'
})

const emit = defineEmits<{ close: [value: boolean] }>()
</script>

<template>
  <UModal :title="title" :description="description" :close="false" :ui="{ footer: 'justify-end' }">
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('close', false)" />
      <UButton :label="confirmLabel" :color="danger ? 'error' : 'primary'" autofocus @click="emit('close', true)" />
    </template>
  </UModal>
</template>
