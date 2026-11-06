<script setup lang="ts">
const { isAuthenticated, loadViewer } = useGitHub()
const toast = useToast()

watch(isAuthenticated, async (authenticated) => {
  if (authenticated) {
    try {
      await loadViewer()
    } catch (err) {
      toast.add({ title: 'Unable to reach GitHub', description: errorMessage(err), color: 'error' })
    }
  }
}, { immediate: true })

useHead({ title: 'GitHub Tasks' })
</script>

<template>
  <UApp :toaster="{ position: 'bottom-right' }">
    <NuxtLayout v-if="isAuthenticated">
      <NuxtPage />
    </NuxtLayout>
    <LoginScreen v-else />
  </UApp>
</template>
