import { useLocalStorage } from '@vueuse/core'

// Width of the task details panel, as a percentage of the window

export const INSPECTOR_WIDTH = { default: 38, min: 25, max: 65 }

const width = useLocalStorage<number>('ghtasks:inspector-width', INSPECTOR_WIDTH.default)
// Whether the details panel is shown, with or without a selected task
const open = useLocalStorage<boolean>('ghtasks:inspector-open', true)

export function useInspectorWidth() {
  function set(value: number) {
    width.value = Math.round(Math.min(INSPECTOR_WIDTH.max, Math.max(INSPECTOR_WIDTH.min, value)) * 10) / 10
  }

  function reset() {
    width.value = INSPECTOR_WIDTH.default
  }

  // Applied as a CSS variable so narrow (mobile) layouts can ignore it
  const style = computed(() => ({ '--inspector-width': `${width.value}%` }))

  function toggle() {
    open.value = !open.value
  }

  return { width, style, set, reset, open, toggle }
}
