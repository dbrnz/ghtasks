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

/** Show a task on its own, in a new window (or a browser tab outside Tauri). */
export async function openTaskWindow(owner: string, repo: string, number: number, title: string) {
  const path = `/task/${owner}/${repo}/${number}`
  if (!inTauri) {
    window.open(path, '_blank')
    return
  }
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const label = `task-${owner}-${repo}-${number}`.replace(/[^\w-]/g, '_')
  const existing = await WebviewWindow.getByLabel(label)
  if (existing) {
    await existing.setFocus()
    return
  }
  new WebviewWindow(label, {
    url: path,
    title: `#${number} ${title}`,
    width: 560,
    height: 760,
    minWidth: 380,
    minHeight: 400
  })
}
