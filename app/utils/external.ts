// Open links in the user's browser. Inside Tauri the webview can't open new
// windows itself, so use the opener plugin.

export const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function openExternal(url: string) {
  if (inTauri) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

/** Click handler for rendered HTML: send links to the browser. */
export function interceptLinks(event: MouseEvent) {
  const anchor = (event.target as HTMLElement | null)?.closest('a')
  if (anchor?.href && /^https?:/.test(anchor.href)) {
    event.preventDefault()
    openExternal(anchor.href)
  }
}
