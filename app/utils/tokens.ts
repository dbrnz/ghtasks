import type { GhLabel, GhUser } from './types'
import { findPriority, type Priority } from './priority'

// Text such as `Fix login @alice #bug !high` is split into a title and
// assignees, labels and a priority. Labels containing spaces can be quoted:
// `#"good first issue"`, or written with dashes: `#good-first-issue`.

const TOKEN_RE = /(^|\s)([@#!])("[^"]*"?|\S*)/g

export interface ParsedText {
  text: string
  assignees: string[]
  labels: string[]
  priority?: Priority
  unknown: string[]
}

function unquote(s: string): string {
  return s.replace(/^"/, '').replace(/"$/, '')
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[-_\s]+/g, ' ').trim()
}

export function matchLabel(name: string, labels: GhLabel[]): GhLabel | undefined {
  const n = normalise(name)
  return labels.find(l => normalise(l.name) === n)
}

export function matchUser(login: string, users: GhUser[]): GhUser | undefined {
  const l = login.toLowerCase()
  return users.find(u => u.login.toLowerCase() === l)
}

/**
 * Pull `@user`, `#label` and `!priority` tokens out of some text.
 * With `strict`, tokens that don't match a known user/label are left in the text.
 */
export function parseTokens(input: string, users: GhUser[], labels: GhLabel[], strict = true): ParsedText {
  const result: ParsedText = { text: '', assignees: [], labels: [], unknown: [] }
  result.text = input.replace(TOKEN_RE, (match, space: string, sigil: string, raw: string) => {
    const value = unquote(raw)
    if (!value) {
      return match
    }
    if (sigil === '@') {
      const user = matchUser(value, users)
      if (user || !strict) {
        result.assignees.push(user?.login ?? value)
        return space
      }
    } else if (sigil === '#') {
      if (/^\d+$/.test(value)) {
        return match // an issue number, not a label
      }
      const label = matchLabel(value, labels)
      if (label || !strict) {
        result.labels.push(label?.name ?? value)
        return space
      }
    } else if (sigil === '!') {
      const p = findPriority(value)
      if (p) {
        result.priority = p
        return space
      }
    }
    result.unknown.push(match.trim())
    return match
  }).replace(/\s+/g, ' ').trim()
  return result
}

export interface ActiveToken {
  sigil: '@' | '#' | '!'
  query: string
  start: number
  end: number
}

/** The `@`/`#`/`!` token (if any) that the caret is currently in. */
export function activeToken(text: string, caret: number): ActiveToken | null {
  let start = caret
  while (start > 0 && !/\s/.test(text[start - 1]!)) {
    start--
  }
  const word = text.slice(start, caret)
  const sigil = word[0]
  if (sigil !== '@' && sigil !== '#' && sigil !== '!') {
    return null
  }
  let end = caret
  while (end < text.length && !/\s/.test(text[end]!)) {
    end++
  }
  return { sigil, query: unquote(word.slice(1)), start, end }
}

export function tokenFor(sigil: string, value: string): string {
  return /\s/.test(value) ? `${sigil}"${value}"` : `${sigil}${value}`
}
