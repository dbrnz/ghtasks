<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

const open = defineModel<boolean>('open', { default: false })

const { repos, addRepo } = useRepos()
const router = useRouter()
const toast = useToast()

interface RepoSummary {
  full_name: string
  name: string
  owner: { login: string, avatar_url: string }
  description: string | null
  private: boolean
  open_issues_count: number
  has_issues: boolean
}

const searchTerm = ref('')
const loading = ref(false)
const available = ref<RepoSummary[]>([])
let loaded = false

watch(open, async (isOpen) => {
  if (!isOpen || loaded) {
    return
  }
  loading.value = true
  try {
    const gh = octokit()
    const list = await gh.paginate(gh.rest.repos.listForAuthenticatedUser, { per_page: 100, sort: 'pushed' })
    available.value = (list as RepoSummary[]).filter(r => r.has_issues)
    loaded = true
  } catch (err) {
    toast.add({ title: 'Unable to list repositories', description: errorMessage(err), color: 'error' })
  } finally {
    loading.value = false
  }
})

const added = computed(() => new Set(repos.value.map(r => repoKey(r.owner, r.name))))

async function choose(owner: string, name: string) {
  try {
    // Check that the repo exists and get its canonical name
    const { data } = await octokit().rest.repos.get({ owner, repo: name })
    if (!data.has_issues) {
      toast.add({ title: `${data.full_name} has issues turned off`, color: 'warning' })
      return
    }
    addRepo(data.owner.login, data.name)
    open.value = false
    searchTerm.value = ''
    router.push(`/${data.owner.login}/${data.name}`)
  } catch (err) {
    toast.add({ title: `Unable to open ${owner}/${name}`, description: errorMessage(err), color: 'error' })
  }
}

const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const result: CommandPaletteGroup<CommandPaletteItem>[] = []
  const typed = searchTerm.value.trim().replace(/^https:\/\/github\.com\//, '').match(/^([\w.-]+)\/([\w.-]+)$/)
  if (typed) {
    const [, owner, name] = typed
    result.push({
      id: 'typed',
      label: 'Open repository',
      ignoreFilter: true,
      items: [{
        label: `${owner}/${name}`,
        icon: 'i-lucide-arrow-right',
        onSelect: () => choose(owner!, name!)
      }]
    })
  }
  result.push({
    id: 'yours',
    label: 'Your repositories',
    items: available.value.map(r => ({
      label: r.full_name,
      suffix: r.description ?? undefined,
      avatar: { src: r.owner.avatar_url, alt: r.owner.login },
      icon: r.private ? 'i-lucide-lock' : undefined,
      disabled: added.value.has(repoKey(r.owner.login, r.name)),
      onSelect: () => choose(r.owner.login, r.name)
    }))
  })
  return result
})
</script>

<template>
  <UModal v-model:open="open" title="Add repository" :ui="{ content: 'max-w-xl' }">
    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
        :loading="loading"
        placeholder="Search your repositories, or type owner/name…"
        :fuse="{ resultLimit: 50 }"
        class="h-96"
        close
        @update:open="open = $event"
      />
    </template>
  </UModal>
</template>
