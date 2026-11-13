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

// Stamp with the clock: "í dag 10:15", "í gær 14:32", "30. október, 14:32"
// earlier this year, "30. október 2025, 14:32" in another year. The comma
// keeps a day number and the clock apart ("November 12, 14:32").
export function formatStamp(dateString: string, now: Date = new Date()): string {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  const near = nearDay(d, now)
  return near ? `${near} ${clock(d)}` : `${formatDate(d, now)}, ${clock(d)}`
}

// The same stamp where the row is tight (board card, list row): the clock
// today and yesterday, an older day is the date alone.
export function formatStampShort(dateString: string, now: Date = new Date()): string {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  const near = nearDay(d, now)
  return near ? `${near} ${clock(d)}` : formatDate(d, now)
}

// "í dag" or "í gær" when the date falls on that local day, else null.
function nearDay(d: Date, now: Date): string | null {
  const day = d.toDateString()
  if (day === now.toDateString()) return i18n.t('dates.today')
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (day === yesterday.toDateString()) return i18n.t('dates.yesterday')
  return null
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

// Day heading for the chat: "í dag", "í gær", else the date alone.
export function formatDay(dateString: string, now: Date = new Date()): string {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return nearDay(d, now) ?? formatDate(d, now)
}
