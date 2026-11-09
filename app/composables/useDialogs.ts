import ConfirmModal from '~/components/ConfirmModal.vue'
import PromptModal from '~/components/PromptModal.vue'
import NewLabelModal from '~/components/NewLabelModal.vue'
import type { NewLabel } from '~/utils/types'

// Promise-based replacements for window.confirm()/prompt(), which aren't
// available in every Tauri webview.

export function useDialogs() {
  const overlay = useOverlay()
  const confirmModal = overlay.create(ConfirmModal)
  const promptModal = overlay.create(PromptModal)
  const newLabelModal = overlay.create(NewLabelModal)

  async function confirm(title: string, options: { description?: string, confirmLabel?: string, danger?: boolean } = {}): Promise<boolean> {
    return !!(await confirmModal.open({ title, ...options }).result)
  }

  async function prompt(title: string, options: { placeholder?: string, initial?: string, confirmLabel?: string } = {}): Promise<string | null> {
    return (await promptModal.open({ title, ...options }).result) ?? null
  }

  async function newLabel(): Promise<NewLabel | null> {
    return (await newLabelModal.open().result) ?? null
  }

  return { confirm, prompt, newLabel }
}
