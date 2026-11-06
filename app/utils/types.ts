// Minimal shapes of the GitHub REST objects that the app uses

export interface GhUser {
  login: string
  avatar_url: string
  html_url?: string
  name?: string | null
}

export interface GhLabel {
  id: number
  name: string
  color: string
  description?: string | null
}

export interface GhMilestone {
  number: number
  title: string
  state: 'open' | 'closed'
  due_on: string | null
  open_issues?: number
  closed_issues?: number
}

// GitHub issue types (Task, Bug, Feature, ...) are defined per organisation
export interface GhIssueType {
  id: number
  name: string
  color: string | null // gray, blue, green, yellow, orange, red, pink, purple
  description?: string | null
  is_enabled?: boolean
}

export interface GhIssue {
  id: number
  number: number
  title: string
  body?: string | null
  body_html?: string
  state: 'open' | 'closed'
  state_reason?: string | null
  labels: GhLabel[]
  assignees: GhUser[]
  milestone: GhMilestone | null
  type?: GhIssueType | null
  user: GhUser | null
  comments: number
  created_at: string
  updated_at: string
  closed_at: string | null
  html_url: string
  pull_request?: unknown
}

export interface GhComment {
  id: number
  body?: string
  body_html?: string
  user: GhUser | null
  created_at: string
  updated_at: string
  html_url: string
}

export interface RepoRef {
  owner: string
  name: string
}

export interface IssuePatch {
  title?: string
  body?: string
  state?: 'open' | 'closed'
  state_reason?: 'completed' | 'not_planned' | 'reopened' | null
  labels?: string[]
  assignees?: string[]
  milestone?: number | null
  type?: string | null // issue type name, null to remove
}

export type StateFilter = 'open' | 'closed' | 'all'
export type GroupBy = 'none' | 'type' | 'milestone' | 'label' | 'priority' | 'assignee'
export type SortBy = 'priority' | 'state' | 'created' | 'updated' | 'assignee' | 'title' | 'number'
export type AssigneeFilter = 'anyone' | 'me' | 'unassigned'

export interface ViewSettings {
  search: string
  state: StateFilter
  groupBy: GroupBy
  sortBy: SortBy
  reverse: boolean        // reverse the sort order
  assignee: AssigneeFilter
  openedByMe: boolean
  hideEmpty: boolean      // hide groups with no tasks
  hidden: string[]        // keys of groups not shown
}

export interface SmartFilter extends ViewSettings {
  id: string
  name: string
}

export interface PickerItem {
  value: string
  label: string
  avatar?: { src: string, alt?: string }
  color?: string // hex, no '#'
  ringColor?: string // CSS colour, shown as an issue-type ring
  icon?: string
  iconClass?: string
  description?: string
}
