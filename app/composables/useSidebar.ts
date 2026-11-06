import { useLocalStorage } from '@vueuse/core'

// Whether the left-hand pane (the repositories sidebar) is shown

const open = useLocalStorage<boolean>('ghtasks:sidebar-open', true)

export function useSidebar() {
  function toggle() {
    open.value = !open.value
  }
  return { open, toggle }
}
