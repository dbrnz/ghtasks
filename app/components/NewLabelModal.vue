<script setup lang="ts">
// Asks for a new label's name, colour and description

import type { NewLabel } from '~/utils/types'

const emit = defineEmits<{ close: [value: NewLabel | null] }>()

// GitHub's own label colours
const PALETTE = [
  'b60205', 'd93f0b', 'fbca04', '0e8a16', '006b75', '1d76db', '0052cc', '5319e7',
  'e99695', 'f9d0c4', 'fef2c0', 'c2e0c6', 'bfdadc', 'c5def5', 'bfd4f2', 'd4c5f9'
]

const name = ref('')
const color = ref(PALETTE[Math.floor(Math.random() * PALETTE.length)]!)
const description = ref('')

const hex = computed({
  get: () => `#${color.value}`,
  set: (value: string) => {
    const v = value.replace(/^#/, '').toLowerCase()
    if (/^[0-9a-f]{6}$/.test(v)) {
      color.value = v
    }
  }
})

const valid = computed(() => !!name.value.trim())
const preview = computed(() => ({ id: 0, name: name.value.trim() || 'Label preview', color: color.value }))

function create() {
  if (valid.value) {
    emit('close', { name: name.value.trim(), color: color.value, description: description.value.trim() })
  }
}
</script>

<template>
  <UModal title="New Label" :ui="{ footer: 'justify-end' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="create">
        <UFormField label="Name">
          <UInput v-model="name" placeholder="e.g. documentation" class="w-full" autofocus />
        </UFormField>

        <UFormField label="Colour">
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="c in PALETTE"
              :key="c"
              type="button"
              class="size-6 rounded-full ring-offset-2 ring-offset-(--ui-bg) transition"
              :class="c === color ? 'ring-2 ring-primary' : 'hover:scale-110'"
              :style="{ backgroundColor: `#${c}` }"
              :aria-label="`Colour #${c}`"
              @click="color = c"
            />
            <UInput v-model.lazy="hex" size="sm" class="w-24 ms-1" :ui="{ base: 'font-mono' }" />
          </div>
        </UFormField>

        <UFormField label="Description" hint="Optional">
          <UInput v-model="description" placeholder="What the label is for" class="w-full" />
        </UFormField>

        <div class="flex items-center gap-2 text-sm text-muted">
          Preview <LabelBadge :label="preview" />
        </div>
        <!-- Lets Enter in any field create the label -->
        <button type="submit" class="hidden" />
      </form>
    </template>
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('close', null)" />
      <UButton label="Create" :disabled="!valid" @click="create" />
    </template>
  </UModal>
</template>
