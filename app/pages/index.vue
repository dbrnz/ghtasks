<script setup lang="ts">
const { repos } = useRepos()
const { viewer } = useGitHub()
const router = useRouter()
const addRepoOpen = useState('addRepoOpen', () => false)

// Go straight to the first repo if there is one
onMounted(() => {
  const first = repos.value[0]
  if (first) {
    router.replace(`/${first.owner}/${first.name}`)
  }
})
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="GitHub Tasks" />
    </template>
    <template #body>
      <UEmpty
        icon="i-lucide-book-marked"
        :title="viewer ? `Welcome, ${viewer.login}` : 'Welcome'"
        description="Add a GitHub repository to start managing its issues as tasks."
        :actions="[{ label: 'Add repository', icon: 'i-lucide-plus', onClick: () => { addRepoOpen = true } }]"
        class="my-auto"
      />
    </template>
  </UDashboardPanel>
</template>
