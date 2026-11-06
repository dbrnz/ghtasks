import { invoke } from '@tauri-apps/api/core'

// Attach files the way github.com does, via a signed-in github.com session
// (see src-tauri/src/github_web.rs). Uploaded files are stored by GitHub at
// https://github.com/user-attachments/assets/…

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024

export interface Attachment {
  href: string
  name: string
}

export class AttachmentCancelled extends Error {}

/** The Markdown github.com inserts for an attachment. */
export function attachmentMarkdown(file: File, attachment: Attachment): string {
  const name = attachment.name.replace(/[[\]]/g, '')
  if (file.type.startsWith('image/')) {
    return `![${name}](${attachment.href})`
  }
  if (file.type.startsWith('video/')) {
    return `\n${attachment.href}\n` // GitHub shows a player for a bare video link
  }
  return `[${name}](${attachment.href})`
}

/** Whether some text still has an upload placeholder in it. */
export function isUploading(text: string): boolean {
  return text.includes('![Uploading ')
}

export function useAttachments() {
  const { data } = useTasksContext()
  const dialogs = useDialogs()

  async function signIn(reason: string): Promise<boolean> {
    const ok = await dialogs.confirm('Sign in to github.com', {
      description: `${reason} A GitHub window will open for you to sign in; it closes by itself once you have. `
        + 'Passkeys don\'t work in that window (macOS only allows them in browsers), so use your password and two-factor code.',
      confirmLabel: 'Sign in'
    })
    return ok && await invoke<boolean>('github_web_sign_in')
  }

  async function ensureSignedIn(): Promise<void> {
    if (await invoke<boolean>('github_web_signed_in')) {
      return
    }
    if (!await signIn('GitHub only accepts attachments from a github.com session.')) {
      throw new AttachmentCancelled('Not signed in to github.com')
    }
  }

  async function upload(file: File): Promise<Attachment> {
    if (!inTauri) {
      throw new Error('Attachments need the desktop app')
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`${file.name} is larger than GitHub's 25 MB limit`)
    }
    await ensureSignedIn()
    const meta = {
      owner: data.store.owner,
      repo: data.store.name,
      repoId: await data.repositoryId(),
      name: file.name || 'pasted-file',
      contentType: file.type || 'application/octet-stream'
    }
    const body = new Uint8Array(await file.arrayBuffer())
    const send = () => invoke<Attachment>('github_web_upload', body, {
      headers: { 'x-upload': encodeURIComponent(JSON.stringify(meta)) }
    })
    try {
      return await send()
    } catch (err) {
      // An expired session: sign in again and retry once
      if (String(err).includes('NOT_SIGNED_IN')) {
        if (!await signIn('Your github.com session has expired.')) {
          throw new AttachmentCancelled('Not signed in to github.com')
        }
        return await send()
      }
      throw new Error(String(err))
    }
  }

  return { upload }
}
