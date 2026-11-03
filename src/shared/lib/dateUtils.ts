import i18n from '../i18n'

function activeLocale(): string {
  const lang = i18n.language || 'is'
  return lang === 'is' ? 'is-IS' : 'en-US'
}

export function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(activeLocale(), { numeric: 'auto' })

  if (seconds < 60) {
    return i18n.t('dates.justNow')
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  return rtf.format(-days, 'day')
}

export function formatDueDate(dateString: string): { text: string; urgent: boolean } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateString + 'T00:00:00')
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { text: i18n.t('dates.overdue', { count: Math.abs(diffDays) }), urgent: true }
  }
  if (diffDays === 0) return { text: i18n.t('dates.dueToday'), urgent: true }
  if (diffDays === 1) return { text: i18n.t('dates.dueTomorrow'), urgent: false }
  if (diffDays <= 7) return { text: i18n.t('dates.dueInDays', { count: diffDays }), urgent: false }

  const formatter = new Intl.DateTimeFormat(activeLocale(), { day: 'numeric', month: 'short' })
  return { text: i18n.t('dates.dueOn', { date: formatter.format(due) }), urgent: false }
}

// Short stamp for "last moved": "í dag 10:15" today, "30. október" earlier
// this year, "30. október 2025" in another year.
export function formatStamp(dateString: string, now: Date = new Date()): string {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  if (d.toDateString() === now.toDateString()) return `${i18n.t('dates.today')} ${clock(d)}`
  return formatDate(d, now)
}

// "10:15", 24 hour clock in the active locale.
function clock(d: Date): string {
  return new Intl.DateTimeFormat(activeLocale(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

// Clock time alone, for a chat bubble whose day is carried by the day row.
// Empty on an invalid date.
export function formatTime(dateString: string): string {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return clock(d)
}

// "30. október" this year, "30. október 2025" in another year.
function formatDate(d: Date, now: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
  return new Intl.DateTimeFormat(activeLocale(), opts).format(d)
}

// Day heading for the chat: "í dag", "í gær", else the date as formatStamp
// writes an older day.
export function formatDay(dateString: string, now: Date = new Date()): string {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.toDateString()
  if (day === now.toDateString()) return i18n.t('dates.today')
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (day === yesterday.toDateString()) return i18n.t('dates.yesterday')
  return formatDate(d, now)
}
