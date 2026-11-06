<script setup lang="ts">
// Write Markdown, with a formatting toolbar and a preview rendered by GitHub
import type { DropdownMenuItem } from '@nuxt/ui'

const props = withDefaults(defineProps<{
  placeholder?: string
  autofocus?: boolean
  rows?: number
}>(), {
  rows: 4
})

const model = defineModel<string>({ default: '' })

const emit = defineEmits<{
  submit: []
  cancel: []
}>()

const { data } = useTasksContext()
const attachments = useAttachments()
const toast = useToast()

// ---------------------------------------------------------------- Preview

const previewing = ref(false)
const preview = ref('')
const rendering = ref(false)

watch(previewing, async (value) => {
  if (!value) {
    nextTick(() => element()?.focus())
    return
  }
  if (!model.value.trim()) {
    preview.value = '<p class="text-dimmed">Nothing to preview</p>'
    return
  }
  rendering.value = true
  try {
    preview.value = await data.renderMarkdown(model.value)
  } catch (err) {
    preview.value = `<p class="text-error">${errorMessage(err)}</p>`
  } finally {
    rendering.value = false
  }
})

// ---------------------------------------------------------------- Editing

const textarea = useTemplateRef<{ textareaRef: HTMLTextAreaElement }>('textarea')

function element(): HTMLTextAreaElement | undefined {
  return textarea.value?.textareaRef
}

/**
 * Replace `start..end` of the text with `text` and then select
 * `selStart..selEnd` (offsets within the new text). `insertText` keeps the
 * change on the browser's undo stack.
 */
function replace(start: number, end: number, text: string, selStart = text.length, selEnd = selStart) {
  const el = element()
  if (!el) {
    return
  }
  el.focus()
  el.setSelectionRange(start, end)
  if (!document.execCommand('insertText', false, text)) {
    model.value = el.value.slice(0, start) + text + el.value.slice(end)
  }
  nextTick(() => el.setSelectionRange(start + selStart, start + selEnd))
}

/** Wrap the selection, e.g. in `**`, or insert a placeholder that is left selected. */
function wrap(before: string, after: string, placeholder: string) {
  const el = element()
  if (!el) return
  const { selectionStart: start, selectionEnd: end, value } = el
  const selected = value.slice(start, end)
  // Toggle off if already wrapped
  if (value.slice(start - before.length, start) === before && value.slice(end, end + after.length) === after) {
    replace(start - before.length, end + after.length, selected, 0, selected.length)
    return
  }
  const inner = selected || placeholder
  replace(start, end, before + inner + after, before.length, before.length + inner.length)
}

/** The start and end of the lines that the selection touches. */
function selectedLines() {
  const el = element()!
  const { selectionStart, selectionEnd, value } = el
  const start = value.lastIndexOf('\n', selectionStart - 1) + 1
  let end = value.indexOf('\n', selectionEnd - (selectionEnd > selectionStart && value[selectionEnd - 1] === '\n' ? 1 : 0))
  if (end < 0) end = value.length
  return { start, end, lines: value.slice(start, end).split('\n') }
}

/** Add (or, if every line has one, remove) a line prefix such as `- ` or `> `. */
function prefixLines(prefix: (index: number) => string, pattern: RegExp, isList = true) {
  if (!element()) return
  const { start, end, lines } = selectedLines()
  const all = lines.every(l => pattern.test(l))
  // Switching list type replaces any existing list marker
  const text = lines.map((l, i) => all ? l.replace(pattern, '') : prefix(i) + (isList ? l.replace(LIST_PREFIX, '$1') : l)).join('\n')
  replace(start, end, text, text.length)
}

const LIST_PREFIX = /^(\s*)([-*+] \[[ x]\] |[-*+] |\d+\. )/

function heading(level: number) {
  if (!element()) return
  const { start, end, lines } = selectedLines()
  const text = lines.map(l => (level ? `${'#'.repeat(level)} ` : '') + l.replace(/^#{1,6}\s+/, '')).join('\n')
  replace(start, end, text, text.length)
}

function code() {
  const el = element()
  if (!el) return
  const selected = el.value.slice(el.selectionStart, el.selectionEnd)
  if (selected.includes('\n')) {
    const atLineStart = el.selectionStart === 0 || el.value[el.selectionStart - 1] === '\n'
    const fence = `${atLineStart ? '' : '\n'}\`\`\`\n${selected.replace(/\n$/, '')}\n\`\`\`\n`
    replace(el.selectionStart, el.selectionEnd, fence)
  } else {
    wrap('`', '`', 'code')
  }
}

function link() {
  const el = element()
  if (!el) return
  const { selectionStart: start, selectionEnd: end, value } = el
  const selected = value.slice(start, end)
  if (/^https?:\/\/\S+$/.test(selected)) {
    replace(start, end, `[text](${selected})`, 1, 5)
  } else {
    const label = selected || 'text'
    // Leave `url` selected, ready to paste over
    replace(start, end, `[${label}](url)`, label.length + 3, label.length + 6)
  }
}

// The menu holds focus until it has closed, so apply the heading after that
let pendingHeading: number | null = null

const headingMenu: DropdownMenuItem[][] = [[
  { label: 'Normal text', onSelect: () => { pendingHeading = 0 } },
  { label: 'Heading 1', class: 'text-xl font-semibold', onSelect: () => { pendingHeading = 1 } },
  { label: 'Heading 2', class: 'text-lg font-semibold', onSelect: () => { pendingHeading = 2 } },
  { label: 'Heading 3', class: 'font-semibold', onSelect: () => { pendingHeading = 3 } }
]]

const headingMenuContent = {
  align: 'start' as const,
  onCloseAutoFocus: (event: Event) => {
    event.preventDefault()
    const level = pendingHeading
    pendingHeading = null
    if (level === null) {
      element()?.focus()
    } else {
      heading(level)
    }
  }
}

interface Tool {
  icon: string
  label: string
  kbd?: string[]
  action: () => void
}

const TOOLS: Tool[][] = [
  [
    { icon: 'i-lucide-bold', label: 'Bold', kbd: ['meta', 'b'], action: () => wrap('**', '**', 'bold text') },
    { icon: 'i-lucide-italic', label: 'Italic', kbd: ['meta', 'i'], action: () => wrap('_', '_', 'italic text') }
  ],
  [
    { icon: 'i-lucide-text-quote', label: 'Quote', action: () => prefixLines(() => '> ', /^> ?/, false) },
    { icon: 'i-lucide-code', label: 'Code', kbd: ['meta', 'e'], action: code },
    { icon: 'i-lucide-link', label: 'Link', kbd: ['meta', 'k'], action: link }
  ],
  [
    { icon: 'i-lucide-list', label: 'Bulleted list', action: () => prefixLines(() => '- ', /^[-*+] (?!\[[ x]\] )/) },
    { icon: 'i-lucide-list-ordered', label: 'Numbered list', action: () => prefixLines(i => `${i + 1}. `, /^\d+\. /) },
    { icon: 'i-lucide-list-todo', label: 'Task list', action: () => prefixLines(() => '- [ ] ', /^[-*+] \[[ x]\] /) }
  ],
  [
    { icon: 'i-lucide-image', label: 'Add image', action: () => imageInput.value?.click() },
    { icon: 'i-lucide-paperclip', label: 'Attach file', action: () => fileInput.value?.click() }
  ]
]

// ---------------------------------------------------------------- Attachments

const imageInput = useTemplateRef<HTMLInputElement>('imageInput')
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const uploading = ref(0)
const dragging = ref(false)

/** Upload files, showing a placeholder in the text until each one is done. */
async function attach(files: File[]) {
  const el = element()
  if (!el || !files.length) {
    return
  }
  for (const file of files) {
    const placeholder = `![Uploading ${file.name || 'file'}…]()`
    const { selectionStart: start, selectionEnd: end, value } = el
    const before = start > 0 && value[start - 1] !== '\n' ? '\n' : ''
    replace(start, end, `${before}${placeholder}\n`)
    uploading.value++
    attachments.upload(file)
      .then((attachment) => {
        model.value = model.value.replace(placeholder, attachmentMarkdown(file, attachment))
      })
      .catch((err) => {
        model.value = model.value.replace(`${placeholder}\n`, '').replace(placeholder, '')
        if (!(err instanceof AttachmentCancelled)) {
          toast.add({ title: `Unable to attach ${file.name}`, description: errorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
        }
      })
      .finally(() => { uploading.value-- })
  }
}

function onFilesChosen(event: Event) {
  const input = event.target as HTMLInputElement
  attach([...(input.files ?? [])])
  input.value = ''
}

function onPaste(event: ClipboardEvent) {
  const files = [...(event.clipboardData?.files ?? [])]
  if (files.length) {
    event.preventDefault()
    attach(files)
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const files = [...(event.dataTransfer?.files ?? [])]
  if (files.length) {
    event.preventDefault()
    element()?.focus()
    attach(files)
  }
}

function onDragOver(event: DragEvent) {
  if (event.dataTransfer?.types.includes('Files')) {
    event.preventDefault()
    dragging.value = true
  }
}

function onKeydown(event: KeyboardEvent) {
  const mod = event.metaKey || event.ctrlKey
  if (event.key === 'Enter' && mod) {
    event.preventDefault()
    emit('submit')
  } else if (event.key === 'Escape') {
    event.stopPropagation()
    emit('cancel')
  } else if (mod && !event.shiftKey && !event.altKey) {
    const tool = TOOLS.flat().find(t => t.kbd?.[1] === event.key.toLowerCase())
    if (tool) {
      event.preventDefault()
      tool.action()
    }
  }
}
</script>

<template>
  <div
    class="relative rounded-lg border overflow-hidden transition-colors"
    :class="dragging ? 'border-primary ring-1 ring-primary' : 'border-default'"
    @dragover="onDragOver"
    @dragleave.self="dragging = false"
    @drop="onDrop"
  >
    <input ref="imageInput" type="file" accept="image/*,video/*" multiple class="hidden" @change="onFilesChosen">
    <input ref="fileInput" type="file" multiple class="hidden" @change="onFilesChosen">
    <!-- Formatting toolbar -->
    <div class="flex items-start gap-1 p-1.5">
      <div class="flex flex-wrap items-center gap-0.5 px-1 py-0.5 rounded-lg bg-elevated min-w-0" :class="previewing ? 'opacity-50 pointer-events-none' : ''">
        <UDropdownMenu :items="headingMenu" :content="headingMenuContent">
          <UButton color="neutral" variant="ghost" size="xs" aria-label="Text size" title="Text size" class="font-semibold">
            <span class="text-[10px]">a</span><span class="text-sm -ms-0.5">A</span>
          </UButton>
        </UDropdownMenu>
        <template v-for="(group, g) in TOOLS" :key="g">
          <span class="w-px h-4 mx-1 bg-(--ui-border-accented)" />
          <UTooltip v-for="tool in group" :key="tool.label" :text="tool.label" :kbds="tool.kbd">
            <UButton
              :icon="tool.icon"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="tool.label"
              @mousedown.prevent
              @click="tool.action"
            />
          </UTooltip>
        </template>
      </div>
      <UTooltip :text="previewing ? 'Back to editing' : 'Preview'">
        <UButton
          :icon="previewing ? 'i-lucide-pencil' : 'i-lucide-eye'"
          :color="previewing ? 'primary' : 'neutral'"
          variant="ghost"
          size="xs"
          class="ms-auto"
          :aria-label="previewing ? 'Back to editing' : 'Preview'"
          @click="previewing = !previewing"
        />
      </UTooltip>
    </div>

    <UTextarea
      v-show="!previewing"
      ref="textarea"
      v-model="model"
      :placeholder="props.placeholder"
      :rows="rows"
      :autofocus="autofocus"
      autoresize
      :maxrows="24"
      variant="none"
      class="w-full"
      :ui="{ base: 'text-[15px] md:text-[15px] px-3 pt-0.5' }"
      @keydown="onKeydown"
      @paste="onPaste"
    />
    <p v-if="uploading" class="flex items-center gap-1.5 px-3 pb-2 text-xs text-muted">
      <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
      Uploading {{ uploading === 1 ? 'a file' : `${uploading} files` }} to GitHub…
    </p>
    <div v-if="previewing" class="px-3 pb-3 min-h-24">
      <USkeleton v-if="rendering" class="h-16 w-full" />
      <!-- eslint-disable-next-line vue/no-v-html -- sanitised by GitHub -->
      <div v-else class="markdown-body" @click="interceptLinks" v-html="preview" />
    </div>
    <div v-if="$slots.actions" class="flex items-center justify-end gap-2 p-2 border-t border-default bg-elevated/30">
      <slot name="actions" />
    </div>
  </div>
</template>
