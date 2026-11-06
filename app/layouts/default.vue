<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const { viewer, signOut } = useGitHub()
const { repos, removeRepo } = useRepos()
const route = useRoute()
const router = useRouter()
const colorMode = useColorMode()

const addRepoOpen = useState('addRepoOpen', () => false)

const repoItems = computed<NavigationMenuItem[]>(() => repos.value.map(r => ({
  label: r.name,
  icon: 'i-lucide-book-marked',
  to: `/${r.owner}/${r.name}`,
  badge: r.owner,
  active: repoKey(String(route.params.owner ?? ''), String(route.params.repo ?? '')) === repoKey(r.owner, r.name)
})))

function repoMenu(index: number): DropdownMenuItem[] {
  const r = repos.value[index]!
  return [
    { label: 'Open on GitHub', icon: 'i-lucide-external-link', onSelect: () => openExternal(`https://github.com/${r.owner}/${r.name}/issues`) },
    { type: 'separator' },
    {
      label: 'Remove from sidebar',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => {
        const current = repoKey(String(route.params.owner ?? ''), String(route.params.repo ?? '')) === repoKey(r.owner, r.name)
        removeRepo(r.owner, r.name)
        if (current) {
          router.push('/')
        }
      }
    }
  ]
}

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ label: viewer.value?.login ?? '', avatar: { src: viewer.value?.avatar_url }, type: 'label' }],
  [
    { label: 'Your GitHub profile', icon: 'i-simple-icons-github', onSelect: () => openExternal(`https://github.com/${viewer.value?.login}`) },
    {
      label: colorMode.value === 'dark' ? 'Light mode' : 'Dark mode',
      icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
      onSelect: () => { colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark' }
    }
  ],
  [{ label: 'Sign out', icon: 'i-lucide-log-out', onSelect: signOut }]
])

const sidebar = useSidebar()

defineShortcuts({
  meta_o: () => { addRepoOpen.value = true },
  'meta_\\': () => sidebar.toggle() // ⌘\
})
</script>

<template>
  <UDashboardGroup storage-key="ghtasks-layout">
    <UDashboardSidebar
      id="sidebar"
      collapsible
      resizable
      :default-size="16"
      :min-size="12"
      :max-size="28"
      class="bg-elevated/30"
      :class="sidebar.open.value ? '' : 'lg:hidden'"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold truncate">
          <UIcon name="i-lucide-list-checks" class="size-5 text-primary shrink-0" />
          <span v-if="!collapsed">GitHub Tasks</span>
        </NuxtLink>
        <SidebarToggle v-if="!collapsed" class="ms-auto -me-1.5" />
      </template>

      <template #default="{ collapsed }">
        <div v-if="!collapsed" class="flex items-center justify-between px-2.5 pt-1 text-xs font-medium text-muted">
          <span>Repositories</span>
          <UTooltip text="Add repository" :kbds="['meta', 'o']">
            <UButton icon="i-lucide-plus" size="xs" color="neutral" variant="ghost" @click="addRepoOpen = true" />
          </UTooltip>
        </div>

        <div v-if="repos.length" class="flex flex-col gap-0.5">
          <UContextMenu v-for="(item, index) in repoItems" :key="item.to as string" :items="repoMenu(index)">
            <UNavigationMenu
              :items="[item]"
              orientation="vertical"
              :collapsed="collapsed"
              :tooltip="collapsed"
              :ui="{ linkTrailingBadge: 'font-normal' }"
            />
          </UContextMenu>
        </div>
        <UButton
          v-else-if="!collapsed"
          icon="i-lucide-plus"
          label="Add a repository"
          color="neutral"
          variant="soft"
          block
          @click="addRepoOpen = true"
        />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu :items="userMenu" :content="{ align: 'start' }" class="w-full">
          <UButton
            :avatar="{ src: viewer?.avatar_url, alt: viewer?.login }"
            :label="collapsed ? undefined : viewer?.login"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            trailing-icon="i-lucide-chevrons-up-down"
            :ui="{ trailingIcon: 'text-dimmed ms-auto' }"
          />
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <slot />

    <AddRepoModal v-model:open="addRepoOpen" />
  </UDashboardGroup>
</template>
