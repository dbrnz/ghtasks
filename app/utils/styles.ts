// Classes shared by the task details and batch edit panels

/** Small uppercase section heading */
export const PANEL_HEADING = 'mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted'

/** PickerMenu props that make it look like a grey select box */
export const PANEL_SELECT = {
  variant: 'soft' as const,
  size: 'md' as const,
  trailingIcon: 'i-lucide-chevrons-up-down',
  triggerClass: 'w-full'
}

/** A pale pill for people and labels */
export const PANEL_CHIP = 'inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-elevated text-sm text-default whitespace-nowrap'

/** The status bars along the bottom of the task list and details panels */
export const STATUS_BAR = 'flex items-center justify-center h-10 shrink-0 px-4 border-t border-default bg-elevated/40 text-sm text-muted'
