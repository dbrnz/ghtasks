import { Octokit } from 'octokit'
import { useLocalStorage } from '@vueuse/core'
import type { GhUser } from '~/utils/types'

// NB. The token is kept in the webview's localStorage. See README for notes on
// moving it to the OS keychain.
const token = useLocalStorage<string>('ghtasks:token', '')
const viewer = ref<GhUser | null>(null)
const scopes = ref<string[]>([])

let client: Octokit | null = null
let clientToken = ''

function makeClient(auth: string): Octokit {
  return new Octokit({
    auth,
    userAgent: 'ghtasks',
    throttle: {
      // Retry once after hitting a rate limit
      onRateLimit: (_after: number, _options: unknown, _octokit: unknown, retryCount: number) => retryCount < 1,
      onSecondaryRateLimit: () => false
    }
  })
}

export function octokit(): Octokit {
  if (!client || clientToken !== token.value) {
    client = makeClient(token.value)
    clientToken = token.value
  }
  return client
}

export function useGitHub() {
  async function signIn(newToken: string) {
    const trimmed = newToken.trim()
    const response = await makeClient(trimmed).rest.users.getAuthenticated()
    token.value = trimmed
    viewer.value = response.data as GhUser
    scopes.value = (response.headers['x-oauth-scopes'] ?? '').split(',').map(s => s.trim()).filter(Boolean)
  }

  async function loadViewer() {
    if (!token.value || viewer.value) {
      return
    }
    try {
      const response = await octokit().rest.users.getAuthenticated()
      viewer.value = response.data as GhUser
      scopes.value = (response.headers['x-oauth-scopes'] ?? '').split(',').map(s => s.trim()).filter(Boolean)
    } catch (err) {
      // A revoked or expired token: ask for a new one
      if ((err as { status?: number }).status === 401) {
        signOut()
      }
      throw err
    }
  }

  function signOut() {
    token.value = ''
    viewer.value = null
    scopes.value = []
    client = null
  }

  return {
    token: readonly(token),
    viewer: readonly(viewer),
    scopes: readonly(scopes),
    isAuthenticated: computed(() => !!token.value),
    signIn,
    signOut,
    loadViewer
  }
}
