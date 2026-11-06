const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60]
]

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) {
    return ''
  }
  const seconds = (new Date(date).getTime() - Date.now()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return rtf.format(Math.round(seconds / size), unit)
    }
  }
  return 'just now'
}

export function formatDate(date: string | null | undefined): string {
  return date ? new Date(date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''
}

/** A readable text colour for a GitHub label's background colour. */
export function labelTextColor(hex: string): string {
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1f2328' : '#ffffff'
}

export function repoKey(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase()
}

export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { message?: string } }, message?: string }
    return e.response?.data?.message || e.message || String(err)
  }
  return String(err)
}
