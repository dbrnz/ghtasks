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

export function formatDateTime(date: string | null | undefined): string {
  return date ? new Date(date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : ''
}

/** e.g. "Today at 9:31 AM", "Yesterday at 9:56 PM" or "5 Nov 2026 at 10:02 AM" */
export function formatDayTime(date: string | Date | null | undefined): string {
  if (!date) {
    return ''
  }
  const d = new Date(date)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  if (d >= startOfToday) {
    return `Today at ${time}`
  }
  if (d >= startOfYesterday) {
    return `Yesterday at ${time}`
  }
  return `${d.toLocaleDateString(undefined, { dateStyle: 'medium' })} at ${time}`
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
