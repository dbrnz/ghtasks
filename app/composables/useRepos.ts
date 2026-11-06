import { useLocalStorage } from '@vueuse/core'
import type { RepoRef, SmartFilter } from '~/utils/types'

// Local, per-user state: the repos in the sidebar, pinned tasks and saved views

const repos = useLocalStorage<RepoRef[]>('ghtasks:repos', [])
const pins = useLocalStorage<Record<string, number[]>>('ghtasks:pins', {})
const smartFilters = useLocalStorage<Record<string, SmartFilter[]>>('ghtasks:filters', {})

export function useRepos() {
  function addRepo(owner: string, name: string) {
    if (!repos.value.some(r => repoKey(r.owner, r.name) === repoKey(owner, name))) {
      repos.value = [...repos.value, { owner, name }]
    }
  }

  function removeRepo(owner: string, name: string) {
    const key = repoKey(owner, name)
    repos.value = repos.value.filter(r => repoKey(r.owner, r.name) !== key)
  }

  function moveRepo(from: number, to: number) {
    const list = [...repos.value]
    const [item] = list.splice(from, 1)
    if (item) {
      list.splice(to, 0, item)
      repos.value = list
    }
  }

  return { repos, addRepo, removeRepo, moveRepo }
}

export function usePins(key: MaybeRefOrGetter<string>) {
  const pinned = computed(() => new Set(pins.value[toValue(key)] ?? []))

  function isPinned(number: number) {
    return pinned.value.has(number)
  }

  function setPinned(numbers: number[], value: boolean) {
    const set = new Set(pinned.value)
    for (const n of numbers) {
      if (value) {
        set.add(n)
      } else {
        set.delete(n)
      }
    }
    pins.value = { ...pins.value, [toValue(key)]: [...set] }
  }

  function togglePin(number: number) {
    setPinned([number], !isPinned(number))
  }

  return { pinned, isPinned, setPinned, togglePin }
}

export function useSmartFilters(key: MaybeRefOrGetter<string>) {
  const filters = computed(() => smartFilters.value[toValue(key)] ?? [])

  function save(filter: Omit<SmartFilter, 'id'>): SmartFilter {
    const saved = { ...filter, id: crypto.randomUUID() }
    smartFilters.value = { ...smartFilters.value, [toValue(key)]: [...filters.value, saved] }
    return saved
  }

  function remove(id: string) {
    smartFilters.value = { ...smartFilters.value, [toValue(key)]: filters.value.filter(f => f.id !== id) }
  }

  return { filters, save, remove }
}
