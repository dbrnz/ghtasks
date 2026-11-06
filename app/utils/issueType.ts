import type { GhIssueType } from './types'

// GitHub's named issue type colours, as hex
const COLORS: Record<string, string> = {
  gray: '#8c959f',
  blue: '#0969da',
  green: '#1a7f37',
  yellow: '#d4a72c',
  orange: '#e16f24',
  red: '#cf222e',
  pink: '#bf3989',
  purple: '#8250df'
}

export function issueTypeColor(type: Pick<GhIssueType, 'color'> | null | undefined): string {
  return COLORS[type?.color ?? 'gray'] ?? COLORS.gray!
}
