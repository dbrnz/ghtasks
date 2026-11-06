<script setup lang="ts">
// A drag handle on the left edge of the details panel. (Nuxt UI puts a
// panel's handle on its right edge, which for the last panel is the window edge.)

const { set, reset } = useInspectorWidth()

const handle = useTemplateRef<HTMLElement>('handle')
const dragging = ref(false)

function start(startX: number) {
  const panel = handle.value?.closest('[data-slot=root]') as HTMLElement | null
  const parent = panel?.parentElement
  if (!panel || !parent) {
    return
  }
  const startWidth = panel.offsetWidth
  const parentWidth = parent.offsetWidth || 1
  dragging.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const move = (x: number) => set(100 * (startWidth + startX - x) / parentWidth)
  const onMouseMove = (e: MouseEvent) => move(e.clientX)
  const onTouchMove = (e: TouchEvent) => move(e.touches[0]!.clientX)
  const stop = () => {
    dragging.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('mouseup', stop)
    window.removeEventListener('touchend', stop)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('touchmove', onTouchMove)
  window.addEventListener('mouseup', stop)
  window.addEventListener('touchend', stop)
}
</script>

<template>
  <div
    ref="handle"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize task details"
    title="Drag to resize, double-click to reset"
    class="group/handle hidden lg:block absolute inset-y-0 -start-1 w-2 z-20 cursor-col-resize"
    @mousedown.prevent="start($event.clientX)"
    @touchstart.passive="start($event.touches[0]!.clientX)"
    @dblclick="reset"
  >
    <div
      class="mx-auto h-full w-px transition-colors"
      :class="dragging ? 'bg-primary' : 'group-hover/handle:bg-primary'"
    />
  </div>
</template>
