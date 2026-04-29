import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useScheduledPosts, type ScheduledPostRow } from './hooks/useScheduledPosts'

// Month grid showing scheduled social posts grouped by day. Click a chip to
// open the source card via ?card=<id> (handled in ProjectDetailPage).
export function MetaCalendarView({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation()
  const { rows, loading } = useScheduledPosts(projectId)
  const navigate = useNavigate()
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const days = useMemo(() => buildMonthGrid(monthStart), [monthStart])

  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPostRow[]>()
    for (const r of rows) {
      if (!r.post.scheduled_at) continue
      const key = new Date(r.post.scheduled_at).toDateString()
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    // Sort each day's chips chronologically.
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const at = a.post.scheduled_at ? new Date(a.post.scheduled_at).getTime() : 0
        const bt = b.post.scheduled_at ? new Date(b.post.scheduled_at).getTime() : 0
        return at - bt
      })
    }
    return map
  }, [rows])

  if (loading) {
    return <div className="p-6 text-huginn-text-secondary text-sm">{t('common.loading')}</div>
  }

  const monthLabel = monthStart.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-label="Previous month"
          className="px-2 py-1 text-sm rounded-md bg-huginn-card text-huginn-text-primary hover:bg-huginn-hover"
          onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
        >
          {'\u2039'}
        </button>
        <div className="text-sm font-semibold text-huginn-text-primary capitalize">{monthLabel}</div>
        <button
          type="button"
          aria-label="Next month"
          className="px-2 py-1 text-sm rounded-md bg-huginn-card text-huginn-text-primary hover:bg-huginn-hover"
          onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
        >
          {'\u203A'}
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs flex-1 min-h-0">
        {weekdayLabels(i18n.language).map(d => (
          <div key={d} className="text-huginn-text-secondary py-1 text-center font-medium">{d}</div>
        ))}
        {days.map(d => {
          const key = d.toDateString()
          const inMonth = d.getMonth() === monthStart.getMonth()
          const items = postsByDay.get(key) ?? []
          const isToday = key === new Date().toDateString()
          return (
            <div
              key={key}
              className={[
                'min-h-[84px] rounded-md p-1 flex flex-col gap-1',
                inMonth ? 'bg-huginn-card border' : 'bg-huginn-base/40 border border-transparent',
                isToday ? 'border-huginn-accent' : inMonth ? 'border-huginn-border' : '',
              ].join(' ')}
            >
              <div className={[
                'text-[10px]',
                isToday ? 'text-huginn-accent font-semibold' : 'text-huginn-text-secondary',
              ].join(' ')}>
                {d.getDate()}
              </div>
              {items.slice(0, 3).map(r => {
                const time = r.post.scheduled_at
                  ? new Date(r.post.scheduled_at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
                  : ''
                const platforms = [
                  r.post.platforms.fb ? 'F' : null,
                  r.post.platforms.ig ? 'I' : null,
                ].filter(Boolean).join('/')
                return (
                  <button
                    key={r.post.task_id}
                    type="button"
                    onClick={() => navigate(`/projects/${projectId}?card=${r.task.id}`)}
                    className="text-left px-1 py-0.5 rounded bg-huginn-accent-soft text-huginn-accent text-[10px] truncate hover:bg-huginn-accent/30"
                    title={r.task.title}
                  >
                    {platforms && <span className="font-semibold mr-1">{platforms}</span>}
                    {time}
                  </button>
                )
              })}
              {items.length > 3 && (
                <div className="text-[9px] text-huginn-text-secondary px-1">+{items.length - 3}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Monday-first 6-row grid (42 cells) starting from the Monday on/before the
// first of the month so the trailing days of the previous month fill the lead.
function buildMonthGrid(firstOfMonth: Date): Date[] {
  const first = new Date(firstOfMonth)
  const shift = (first.getDay() + 6) % 7 // 0 = Mon ... 6 = Sun
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - shift)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return days
}

// Localised Mon..Sun headers. Uses a known Monday (2024-01-01 was a Monday)
// and walks forward 7 days.
function weekdayLabels(locale: string): string[] {
  const monday = new Date(2024, 0, 1)
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return fmt.format(d)
  })
}
