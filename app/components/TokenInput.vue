<script setup lang="ts">
// A text input that suggests completions for `@user`, `#label` and `!priority`
import type { GhLabel, GhUser } from '~/utils/types'

const props = withDefaults(defineProps<{
  users: GhUser[]
  labels: GhLabel[]
  placeholder?: string
  icon?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'outline' | 'soft' | 'subtle' | 'ghost' | 'none'
  autofocus?: boolean
  ui?: Record<string, string>
}>(), {
  size: 'md',
  variant: 'outline'
})

const model = defineModel<string>({ default: '' })

const emit = defineEmits<{
  submit: [value: string]
  escape: []
  blur: []
}>()

interface Suggestion {
  value: string
  label: string
  avatar?: string
  color?: string
  icon?: string
  iconClass?: string
}

const input = useTemplateRef('input')
const caret = ref(0)
const highlighted = ref(0)
const dismissed = ref(false)

function element(): HTMLInputElement | undefined {
  return input.value?.inputRef as HTMLInputElement | undefined
}

function updateCaret() {
  caret.value = element()?.selectionStart ?? model.value.length
}

const token = computed(() => dismissed.value ? null : activeToken(model.value, caret.value))

const suggestions = computed<Suggestion[]>(() => {
  const t = token.value
  if (!t) {
    return []
  }
  const q = t.query.toLowerCase()
  let list: Suggestion[] = []
  if (t.sigil === '@') {
    list = props.users
      .filter(u => u.login.toLowerCase().includes(q))
      .map(u => ({ value: u.login, label: u.login, avatar: u.avatar_url }))
  } else if (t.sigil === '#') {
    list = props.labels
      .filter(l => !isPriorityLabel(l.name) && l.name.toLowerCase().includes(q.replace(/-/g, ' ')))
      .map(l => ({ value: l.name, label: l.name, color: l.color }))
  } else {
    list = PRIORITIES
      .filter(p => p.key.startsWith(q))
      .map(p => ({ value: p.key, label: p.title, icon: p.icon, iconClass: p.class }))
  }
  return list.slice(0, 8)
})

watch(suggestions, () => { highlighted.value = 0 })
watch(model, () => { dismissed.value = false })

function complete(s: Suggestion) {
  const t = token.value
  if (!t) {
    return
  }
  const text = `${tokenFor(t.sigil, s.value)} `
  model.value = model.value.slice(0, t.start) + text + model.value.slice(t.end).replace(/^\s+/, '')
  const position = t.start + text.length
  nextTick(() => {
    element()?.setSelectionRange(position, position)
    caret.value = position
  })
}

function onKeydown(event: KeyboardEvent) {
  const open = suggestions.value.length > 0
  if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault()
    const n = suggestions.value.length
    highlighted.value = (highlighted.value + (event.key === 'ArrowDown' ? 1 : n - 1)) % n
  } else if (open && (event.key === 'Tab' || event.key === 'Enter')) {
    event.preventDefault()
    complete(suggestions.value[highlighted.value]!)
  } else if (event.key === 'Escape') {
    if (open) {
      event.stopPropagation()
      dismissed.value = true
    } else {
      emit('escape')
    }
  } else if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault()
    emit('submit', model.value)
  }
}

function focus() {
  element()?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="relative">
    <UInput
      ref="input"
      v-model="model"
      :placeholder="placeholder"
      :icon="icon"
      :size="size"
      :variant="variant"
      :autofocus="autofocus"
      :ui="ui"
      class="w-full"
      autocomplete="off"
      spellcheck="false"
      @keydown="onKeydown"
      @keyup="updateCaret"
      @click="updateCaret"
      @input="updateCaret"
      @blur="emit('blur')"
    >
      <template v-if="$slots.trailing" #trailing>
        <slot name="trailing" />
      </template>
    </UInput>

    <div
      v-if="suggestions.length"
      class="absolute z-50 mt-1 min-w-56 max-w-sm rounded-md border border-default bg-default shadow-lg p-1"
      @mousedown.prevent
    >
      <button
        v-for="(s, index) in suggestions"
        :key="s.value"
        type="button"
        class="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-start"
        :class="index === highlighted ? 'bg-elevated' : ''"
        @mouseenter="highlighted = index"
        @click="complete(s)"
      >
        <UAvatar v-if="s.avatar" :src="s.avatar" size="3xs" />
        <span v-else-if="s.color" class="size-3 rounded-full shrink-0" :style="{ backgroundColor: `#${s.color}` }" />
        <UIcon v-else-if="s.icon" :name="s.icon" class="size-4" :class="s.iconClass" />
        <span class="truncate">{{ s.label }}</span>
      </button>
    </div>
  </div>
</template>
