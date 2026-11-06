<script setup lang="ts">
const { signIn } = useGitHub()

const token = ref('')
const error = ref('')
const busy = ref(false)

const TOKEN_URL = 'https://github.com/settings/tokens/new?description=GitHub%20Tasks&scopes=repo,read:org'

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await signIn(token.value)
  } catch (err) {
    error.value = (err as { status?: number }).status === 401
      ? 'GitHub rejected that token.'
      : errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-muted">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-simple-icons-github" class="size-8" />
          <div>
            <h1 class="text-lg font-semibold">
              GitHub Tasks
            </h1>
            <p class="text-sm text-muted">
              Manage GitHub issues as a task list
            </p>
          </div>
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="submit">
        <UFormField
          label="Personal access token"
          :error="error || undefined"
          help="Needs the “repo” scope (or a fine-grained token with Issues read & write)."
        >
          <UInput
            v-model="token"
            type="password"
            placeholder="ghp_… or github_pat_…"
            icon="i-lucide-key-round"
            class="w-full"
            autofocus
          />
        </UFormField>

        <div class="flex items-center justify-between gap-2">
          <UButton
            @click="openExternal(TOKEN_URL)"
            variant="link"
            color="neutral"
            trailing-icon="i-lucide-external-link"
            class="px-0"
          >
            Create a token
          </UButton>
          <UButton type="submit" :loading="busy" :disabled="!token.trim()">
            Sign in
          </UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>
