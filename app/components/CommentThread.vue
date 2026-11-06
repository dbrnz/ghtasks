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
    }
  }
  if (close) {
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

function commentMenu(comment: GhComment) {
  return [[
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => startEdit(comment) },
    { label: 'Copy link', icon: 'i-lucide-link', onSelect: () => navigator.clipboard.writeText(comment.html_url) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(comment) }
  ]]
}
</script>

<template>
  <section class="space-y-4">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
      Comments<span v-if="issue.comments"> ({{ issue.comments }})</span>
    </h3>

    <div v-if="loading && !comments.length" class="space-y-3">
      <USkeleton v-for="n in 2" :key="n" class="h-16 w-full" />
    </div>

    <article v-for="comment in comments" :key="comment.id" class="flex gap-3">
      <UAvatar :src="comment.user?.avatar_url" :alt="comment.user?.login" size="sm" class="mt-0.5" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 text-xs mb-1">
          <span class="font-semibold text-highlighted">{{ comment.user?.login }}</span>
          <span class="text-dimmed" :title="comment.created_at">{{ timeAgo(comment.created_at) }}</span>
          <span v-if="comment.updated_at !== comment.created_at" class="text-dimmed">· edited</span>
          <UDropdownMenu
            v-if="comment.user?.login === viewer?.login"
            :items="commentMenu(comment)"
            :content="{ align: 'end' }"
          >
            <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" class="ms-auto" />
          </UDropdownMenu>
        </div>
        <MarkdownEditor
          v-if="editingId === comment.id"
          v-model="editDraft"
          autofocus
          @submit="saveEdit(comment)"
          @cancel="editingId = null"
        >
          <template #actions>
            <UButton label="Cancel" color="neutral" variant="ghost" size="sm" @click="editingId = null" />
            <UButton label="Save" size="sm" :disabled="isUploading(editDraft)" @click="saveEdit(comment)" />
          </template>
        </MarkdownEditor>
        <!-- eslint-disable-next-line vue/no-v-html -- sanitised by GitHub -->
        <div v-else class="markdown-body" @click="interceptLinks" v-html="comment.body_html" />
      </div>
    </article>

    <div class="flex gap-3">
      <UAvatar :src="viewer?.avatar_url" :alt="viewer?.login" size="sm" class="mt-0.5" />
      <MarkdownEditor
        v-model="draft"
        class="flex-1"
        placeholder="Enter comment"
        :rows="3"
        @submit="post()"
      >
        <template #actions>
          <UButton
            :label="issue.state === 'open' ? (draft.trim() ? 'Close with comment' : 'Close task') : (draft.trim() ? 'Reopen with comment' : 'Reopen task')"
            :icon="issue.state === 'open' ? 'i-lucide-circle-check' : 'i-lucide-rotate-ccw'"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="posting"
            @click="post(true)"
          />
          <UButton label="Comment" size="sm" :loading="posting" :disabled="!draft.trim() || isUploading(draft)" @click="post()" />
        </template>
      </MarkdownEditor>
    </div>
  </section>
</template>
