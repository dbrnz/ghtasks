import type { GhComment, GhIssue, GhIssueType, GhLabel, GhMilestone, GhUser, IssuePatch } from '~/utils/types'

// A cache of each repository's issues, labels, milestones and assignable users.
// Everything is read from and written straight to GitHub -- nothing is stored
// elsewhere -- so the data stays compatible with other GitHub clients.

const CLOSED_PAGES = 3          // How many pages (of 100) of closed issues to load
const FULL = { format: 'full' } // Ask for `body_html` as well as `body`

export interface RepoStore {
  owner: string
  name: string
  issues: GhIssue[]
  labels: GhLabel[]
  milestones: GhMilestone[]
  assignees: GhUser[]
  issueTypes: GhIssueType[] // empty unless the owner is an organisation with issue types
  loading: boolean
  loaded: boolean
  closedLoaded: boolean
  error: string | null
  lastSync: string | null
  repoId: number | null // GitHub's numeric id for the repo, needed for attachments
}

const stores = new Map<string, RepoStore>()

function isIssue(item: GhIssue): boolean {
  return !item.pull_request
}

function newStore(owner: string, name: string): RepoStore {
  return reactive({
    owner,
    name,
    issues: [],
    labels: [],
    milestones: [],
    assignees: [],
    issueTypes: [],
    loading: false,
    loaded: false,
    closedLoaded: false,
    error: null,
    lastSync: null,
    repoId: null
  }) as RepoStore
}

export function useRepoData(owner: string, name: string) {
  const key = repoKey(owner, name)
  let store = stores.get(key)
  if (!store) {
    store = newStore(owner, name)
    stores.set(key, store)
  }
  const s = store
  const base = { owner, repo: name }

  function upsert(issue: GhIssue) {
    if (!isIssue(issue)) {
      return
    }
    const index = s.issues.findIndex(i => i.number === issue.number)
    if (index >= 0) {
      const old = s.issues[index]!
      // Keep rendered HTML if the update didn't include it and the body is unchanged
      if (!issue.body_html && old.body_html && old.body === issue.body) {
        issue.body_html = old.body_html
      }
      s.issues.splice(index, 1, issue)
    } else {
      s.issues.push(issue)
    }
  }

  async function loadMeta() {
    const gh = octokit()
    const [labels, milestones, assignees] = await Promise.all([
      gh.paginate(gh.rest.issues.listLabelsForRepo, { ...base, per_page: 100 }),
      gh.paginate(gh.rest.issues.listMilestones, { ...base, state: 'open', per_page: 100 }),
      gh.paginate(gh.rest.issues.listAssignees, { ...base, per_page: 100 })
    ])
    s.labels = (labels as GhLabel[]).sort((a, b) => a.name.localeCompare(b.name))
    s.milestones = (milestones as GhMilestone[]).sort((a, b) => {
      // Milestones with due dates first, soonest first
      if (a.due_on && b.due_on) return a.due_on.localeCompare(b.due_on)
      if (a.due_on) return -1
      if (b.due_on) return 1
      return a.title.localeCompare(b.title)
    })
    s.assignees = (assignees as GhUser[]).sort((a, b) => a.login.localeCompare(b.login))
  }

  async function loadIssueTypes(): Promise<GhIssueType[]> {
    try {
      const { data } = await octokit().rest.orgs.listIssueTypes({ org: owner })
      return (data as GhIssueType[]).filter(t => t.is_enabled !== false)
    } catch {
      // Personal repos, or organisations without issue types
      return []
    }
  }

  async function loadOpen() {
    const gh = octokit()
    const started = new Date().toISOString()
    const open = await gh.paginate(gh.rest.issues.listForRepo, { ...base, state: 'open', per_page: 100 })
    const closed = s.issues.filter(i => i.state === 'closed')
    s.issues = [...(open as GhIssue[]).filter(isIssue), ...closed]
    s.lastSync = started
  }

  async function loadClosed() {
    if (s.closedLoaded) {
      return
    }
    const gh = octokit()
    let pages = 0
    const closed = await gh.paginate(
      gh.rest.issues.listForRepo,
      { ...base, state: 'closed', sort: 'updated', direction: 'desc', per_page: 100 },
      (response, done) => {
        if (++pages >= CLOSED_PAGES) {
          done()
        }
        return response.data
      }
    )
    for (const issue of closed as GhIssue[]) {
      upsert(issue)
    }
    s.closedLoaded = true
  }

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    s.loading = true
    s.error = null
    try {
      return await fn()
    } catch (err) {
      s.error = errorMessage(err)
      throw err
    } finally {
      s.loading = false
    }
  }

  /** Load everything (once), unless `force`d. */
  async function load(force = false) {
    if (s.loaded && !force) {
      return
    }
    await run(async () => {
      // Issue types are only looked up on a full load, as personal repos 404
      await Promise.all([loadMeta(), loadOpen(), loadIssueTypes().then((types) => { s.issueTypes = types })])
      s.loaded = true
    })
  }

  async function ensureClosed() {
    await run(loadClosed)
  }

  /** Fetch issues changed since the last sync. */
  async function sync() {
    if (!s.loaded || !s.lastSync) {
      return load()
    }
    await run(async () => {
      const gh = octokit()
      const started = new Date().toISOString()
      const changed = await gh.paginate(gh.rest.issues.listForRepo, {
        ...base, state: 'all', since: s.lastSync!, per_page: 100
      })
      for (const issue of changed as GhIssue[]) {
        upsert(issue)
      }
      s.lastSync = started
      await loadMeta()
    })
  }

  function find(number: number): GhIssue | undefined {
    return s.issues.find(i => i.number === number)
  }

  /** Get an issue with its rendered body. */
  async function fetchIssue(number: number): Promise<GhIssue> {
    const gh = octokit()
    const { data } = await gh.rest.issues.get({ ...base, issue_number: number, mediaType: FULL })
    upsert(data as GhIssue)
    return find(number)!
  }

  async function updateIssue(number: number, patch: IssuePatch): Promise<GhIssue> {
    const gh = octokit()
    const existing = find(number)
    const previous = existing ? { ...existing } : undefined
    // Optimistically show title and open/closed changes
    if (existing) {
      if (patch.title !== undefined) existing.title = patch.title
      if (patch.state !== undefined) existing.state = patch.state
    }
    try {
      const { data } = await gh.rest.issues.update({
        ...base,
        issue_number: number,
        ...patch,
        mediaType: FULL
      } as Parameters<typeof gh.rest.issues.update>[0])
      upsert(data as GhIssue)
      return find(number)!
    } catch (err) {
      if (existing && previous) {
        Object.assign(existing, previous)
      }
      throw err
    }
  }

  async function createIssue(issue: { title: string, body?: string, labels?: string[], assignees?: string[], milestone?: number | null, type?: string | null }): Promise<GhIssue> {
    const gh = octokit()
    const { data } = await gh.rest.issues.create({
      ...base,
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
      assignees: issue.assignees,
      milestone: issue.milestone ?? undefined,
      ...(issue.type ? { type: issue.type } : {}),
      mediaType: FULL
    } as Parameters<typeof gh.rest.issues.create>[0])
    upsert(data as GhIssue)
    return find(data.number)!
  }

  async function createMilestone(title: string, dueOn?: string): Promise<GhMilestone> {
    const gh = octokit()
    const { data } = await gh.rest.issues.createMilestone({ ...base, title, due_on: dueOn })
    const milestone = data as GhMilestone
    s.milestones = [...s.milestones, milestone]
    return milestone
  }

  async function createLabel(name: string, color: string, description?: string): Promise<GhLabel> {
    const gh = octokit()
    const { data } = await gh.rest.issues.createLabel({ ...base, name, color, description: description || undefined })
    const label = data as GhLabel
    s.labels = [...s.labels, label].sort((a, b) => a.name.localeCompare(b.name))
    return label
  }

  /** Make sure labels exist in the repo, creating any that don't. */
  async function ensureLabels(labels: { name: string, color?: string }[]) {
    const gh = octokit()
    for (const label of labels) {
      if (!s.labels.some(l => l.name.toLowerCase() === label.name.toLowerCase())) {
        const { data } = await gh.rest.issues.createLabel({
          ...base,
          name: label.name,
          color: label.color ?? 'ededed'
        })
        s.labels = [...s.labels, data as GhLabel].sort((a, b) => a.name.localeCompare(b.name))
      }
    }
  }

  async function listComments(number: number): Promise<GhComment[]> {
    const gh = octokit()
    const comments = await gh.paginate(gh.rest.issues.listComments, {
      ...base, issue_number: number, per_page: 100, mediaType: FULL
    })
    return comments as GhComment[]
  }

  async function addComment(number: number, body: string): Promise<GhComment> {
    const gh = octokit()
    const { data } = await gh.rest.issues.createComment({ ...base, issue_number: number, body, mediaType: FULL })
    const issue = find(number)
    if (issue) {
      issue.comments += 1
    }
    return data as GhComment
  }

  async function updateComment(id: number, body: string): Promise<GhComment> {
    const gh = octokit()
    const { data } = await gh.rest.issues.updateComment({ ...base, comment_id: id, body, mediaType: FULL })
    return data as GhComment
  }

  async function deleteComment(number: number, id: number) {
    const gh = octokit()
    await gh.rest.issues.deleteComment({ ...base, comment_id: id })
    const issue = find(number)
    if (issue) {
      issue.comments = Math.max(0, issue.comments - 1)
    }
  }

  /** Render Markdown as GitHub would, in the context of this repo. */
  async function renderMarkdown(text: string): Promise<string> {
    const gh = octokit()
    const { data } = await gh.rest.markdown.render({ text, mode: 'gfm', context: `${owner}/${name}` })
    return data as unknown as string
  }

  async function repositoryId(): Promise<number> {
    if (!s.repoId) {
      const { data } = await octokit().rest.repos.get(base)
      s.repoId = data.id
    }
    return s.repoId
  }

  return {
    store: s,
    repositoryId,
    load,
    sync,
    ensureClosed,
    find,
    fetchIssue,
    updateIssue,
    createIssue,
    ensureLabels,
    createMilestone,
    createLabel,
    listComments,
    addComment,
    updateComment,
    deleteComment,
    renderMarkdown
  }
}

export type RepoData = ReturnType<typeof useRepoData>
