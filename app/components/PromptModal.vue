<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  placeholder?: string
  initial?: string
  confirmLabel?: string
}>(), {
  confirmLabel: 'Save',
  initial: ''
})

const emit = defineEmits<{ close: [value: string | null] }>()

const value = ref(props.initial)
</script>

<template>
  <UModal :title="title" :ui="{ footer: 'justify-end' }">
    <template #body>
      <form @submit.prevent="value.trim() && emit('close', value.trim())">
        <UInput v-model="value" :placeholder="placeholder" class="w-full" autofocus />
      </form>
    </template>
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('close', null)" />
      <UButton :label="confirmLabel" :disabled="!value.trim()" @click="emit('close', value.trim())" />
    </template>
  </UModal>
</template>
