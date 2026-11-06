<script setup lang="ts">
import type { GhComment, GhIssue } from '~/utils/types'

const props = defineProps<{ issue: GhIssue }>()

const { data, actions, viewer } = useTasksContext()
const dialogs = useDialogs()

const comments = ref<GhComment[]>([])
const loading = ref(false)
const draft = ref('')
const posting = ref(false)
const editingId = ref<number | null>(null)
const editDraft = ref('')
const composing = ref(false)
const composer = useTemplateRef<HTMLElement>('composer')

/** Show the new comment editor (from the details panel's status bar). */
function compose() {
  composing.value = true
  nextTick(() => {
    composer.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    composer.value?.querySelector('textarea')?.focus()
  })
}

/** Esc: hide the editor, keeping any text for next time. */
function cancelCompose() {
  composing.value = false
}

defineExpose({ compose })

async function load() {
  loading.value = true
  const result = await actions.attempt('Unable to load comments', () => data.listComments(props.issue.number))
  comments.value = result ?? []
  loading.value = false
}

watch(() => props.issue.number, () => {
  comments.value = []
  draft.value = ''
  editingId.value = null
  composing.value = false
  load()
}, { immediate: true })

// Reload when someone else adds a comment (seen on sync)
watch(() => props.issue.comments, (count) => {
  if (count !== comments.value.length && !posting.value && !loading.value) {
    load()
  }
})

async function post(close = false) {
  const body = draft.value.trim()
  if (!body && !close) {
    return
  }
  posting.value = true
  if (body) {
    const comment = await actions.attempt('Unable to add comment', () => data.addComment(props.issue.number, body))
    if (comment) {
      comments.value.push(comment)
      draft.value = ''
      composing.value = false
    }
  }
  if (close && (body ? !draft.value : true)) {
    await actions.setState([props.issue], props.issue.state === 'open' ? 'closed' : 'open')
  }
  posting.value = false
}

function startEdit(comment: GhComment) {
  editingId.value = comment.id
  editDraft.value = comment.body ?? ''
}

async function saveEdit(comment: GhComment) {
  const updated = await actions.attempt('Unable to update comment', () => data.updateComment(comment.id, editDraft.value))
  if (updated) {
    const index = comments.value.findIndex(c => c.id === comment.id)
    comments.value.splice(index, 1, updated)
    editingId.value = null
  }
}

async function remove(comment: GhComment) {
  if (!await dialogs.confirm('Delete this comment?', { confirmLabel: 'Delete', danger: true })) {
    return
  }
  const ok = await actions.attempt('Unable to delete comment', async () => {
    await data.deleteComment(props.issue.number, comment.id)
    return true
  })
  if (ok) {
    comments.value = comments.value.filter(c => c.id !== comment.id)
  }
}

const canPost = computed(() => !!draft.value.trim() && !isUploading(draft.value) && !posting.value)

const postMenu = computed(() => [[
  { label: 'Comment', icon: 'i-lucide-message-square', kbds: ['meta', 'enter'], disabled: !canPost.value, onSelect: () => post() },
  props.issue.state === 'open'
    ? { label: 'Comment and Close', icon: 'i-lucide-circle-check', disabled: !canPost.value, onSelect: () => post(true) }
    : { label: 'Comment and Reopen', icon: 'i-lucide-rotate-ccw', disabled: !canPost.value, onSelect: () => post(true) }
]])

function commentMenu(comment: GhComment) {
  return [[
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => startEdit(comment) },
    { label: 'Copy link', icon: 'i-lucide-link', onSelect: () => navigator.clipboard.writeText(comment.html_url) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(comment) }
  ]]
}
</script>

<template>
  <section class="space-y-3">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
      Comments<span v-if="issue.comments"> ({{ issue.comments }})</span>
    </h3>

    <div v-if="loading && !comments.length" class="space-y-3">
      <USkeleton v-for="n in 2" :key="n" class="h-20 w-full rounded-xl" />
    </div>
    <p v-else-if="!comments.length && !composing" class="text-[15px] text-dimmed">
      No comments yet.
    </p>

    <!-- Each comment uses the full width of the panel -->
    <article v-for="comment in comments" :key="comment.id" class="group/comment rounded-xl bg-elevated/60 px-4 py-3">
      <header class="flex items-center gap-2 mb-2 text-sm">
        <UAvatar :src="comment.user?.avatar_url" :alt="comment.user?.login" size="xs" />
        <span class="font-medium text-muted">{{ comment.user?.login }}</span>
        <span class="ms-auto text-dimmed" :title="new Date(comment.created_at).toLocaleString()">
          {{ formatDayTime(comment.created_at) }}<span v-if="comment.updated_at !== comment.created_at"> · edited</span>
        </span>
        <UDropdownMenu
          v-if="comment.user?.login === viewer?.login"
          :items="commentMenu(comment)"
          :content="{ align: 'end' }"
        >
          <UButton
            icon="i-lucide-ellipsis"
            size="xs"
            color="neutral"
            variant="ghost"
            class="-me-2 opacity-0 group-hover/comment:opacity-100 data-[state=open]:opacity-100"
            aria-label="Comment actions"
          />
        </UDropdownMenu>
      </header>
      <MarkdownEditor
        v-if="editingId === comment.id"
        v-model="editDraft"
        autofocus
        class="bg-default"
        @submit="saveEdit(comment)"
        @cancel="editingId = null"
      >
        <template #actions>
          <UButton label="Cancel" color="neutral" variant="ghost" size="sm" @click="editingId = null" />
          <UButton label="Save" size="sm" :disabled="isUploading(editDraft)" @click="saveEdit(comment)" />
        </template>
      </MarkdownEditor>
      <!-- eslint-disable-next-line vue/no-v-html -- sanitised by GitHub -->
      <div v-else class="markdown-body text-[15px]" @click="interceptLinks" v-html="comment.body_html" />
    </article>

    <!-- New comment, opened from the status bar below -->
    <div v-if="composing" ref="composer">
      <MarkdownEditor
        v-model="draft"
        placeholder="Enter comment"
        :rows="4"
        autofocus
        @submit="canPost && post()"
        @cancel="cancelCompose"
      >
        <template #toolbar-end>
          <div class="flex items-center">
            <UButton
              label="Comment"
              color="primary"
              variant="link"
              size="sm"
              :loading="posting"
              :disabled="!canPost"
              class="pe-1 font-semibold"
              @click="post()"
            />
            <UDropdownMenu :items="postMenu" :content="{ align: 'end' }">
              <UButton
                icon="i-lucide-circle-chevron-down"
                color="primary"
                variant="link"
                size="sm"
                class="ps-0"
                aria-label="Comment options"
              />
            </UDropdownMenu>
          </div>
        </template>
      </MarkdownEditor>
      <p class="mt-1.5 text-xs text-dimmed">
        <UKbd value="meta" size="sm" /> <UKbd value="enter" size="sm" /> to comment · <UKbd value="escape" size="sm" /> to cancel
      </p>
    </div>
  </section>
</template>
