<script setup lang="ts">
// A select menu that edits a draft value and only `commit`s it when the menu
// closes, so ticking several labels makes one GitHub request rather than many.

import type { PickerItem } from '~/utils/types'

const props = withDefaults(defineProps<{
  items: PickerItem[]
  modelValue: string[]
  multiple?: boolean
  placeholder?: string
  creatable?: boolean
  size?: 'xs' | 'sm' | 'md'
  variant?: 'outline' | 'soft' | 'subtle' | 'ghost' | 'none'
  triggerClass?: string
  searchPlaceholder?: string
}>(), {
  multiple: true,
  size: 'sm',
  variant: 'ghost'
})

const emit = defineEmits<{
  commit: [value: string[]]
}>()

const draft = ref<string[]>([...props.modelValue])
watch(() => props.modelValue, (v) => { draft.value = [...v] })

const extra = ref<PickerItem[]>([])
const allItems = computed(() => [...props.items, ...extra.value])

const model = computed({
  get: () => props.multiple ? draft.value : (draft.value[0] ?? undefined),
  set: (v: string | string[] | undefined) => {
    draft.value = Array.isArray(v) ? v : (v ? [v] : [])
    if (!props.multiple) {
      commitIfChanged()
    }
  }
})

function sameValues(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000')
}

function commitIfChanged() {
  if (!sameValues(draft.value, props.modelValue)) {
    emit('commit', [...draft.value])
  }
}

function onOpen(open: boolean) {
  if (!open && props.multiple) {
    commitIfChanged()
  }
}

function onCreate(name: string) {
  extra.value.push({ value: name, label: name, color: 'ededed' })
  draft.value = props.multiple ? [...draft.value, name] : [name]
  if (!props.multiple) {
    commitIfChanged()
  }
}
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="allItems"
    value-key="value"
    label-key="label"
    :multiple="multiple"
    :placeholder="placeholder"
    :size="size"
    :variant="variant"
    :create-item="creatable ? 'always' : false"
    :search-input="{ placeholder: searchPlaceholder ?? 'Filter…' }"
    :trailing-icon="variant === 'none' ? '' : undefined"
    :content="{ align: 'start' }"
    :ui="{ content: 'min-w-60' }"
    :class="triggerClass"
    @update:open="onOpen"
    @create="onCreate"
    @click.stop
  >
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
    <template #item-leading="{ item }">
      <UAvatar v-if="item.avatar" v-bind="item.avatar" size="3xs" />
      <span v-else-if="item.color" class="size-3 rounded-full shrink-0 ms-0.5" :style="{ backgroundColor: `#${item.color}` }" />
      <UIcon v-else-if="item.icon" :name="item.icon" class="size-4" :class="item.iconClass" />
    </template>
  </USelectMenu>
</template>
