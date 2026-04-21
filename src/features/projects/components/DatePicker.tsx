import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

interface DatePickerProps {
  startDate: string
  dueDate: string
  recurring: string
  onSave: (dates: { start_date?: string | null; due_date?: string | null; recurring?: string | null }) => void
  onClose: () => void
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const RECURRING_OPTIONS = [
  { value: 'never', labelKey: 'dates.picker.recurring.never' },
  { value: 'daily', labelKey: 'dates.picker.recurring.daily' },
  { value: 'weekly', labelKey: 'dates.picker.recurring.weekly' },
  { value: 'monthly', labelKey: 'dates.picker.recurring.monthly' },
  { value: 'yearly', labelKey: 'dates.picker.recurring.yearly' },
]

export function DatePicker({ startDate: initialStart, dueDate: initialDue, recurring: initialRecurring, onSave, onClose }: DatePickerProps) {
  const { t } = useTranslation()
  const today = new Date()
  const initial = initialDue ? new Date(initialDue + 'T00:00:00') : today

  const [year, setYear] = useState(initial.getFullYear())
  const [month, setMonth] = useState(initial.getMonth())
  const [startEnabled, setStartEnabled] = useState(!!initialStart)
  const [startDate, setStartDate] = useState(initialStart)
  const [dueEnabled, setDueEnabled] = useState(!!initialDue)
  const [dueDate, setDueDate] = useState(initialDue)
  const [recurring, setRecurring] = useState(initialRecurring || 'never')
  const [selecting, setSelecting] = useState<'start' | 'due'>('due')

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (selecting === 'start') {
      setStartDate(dateStr)
      setStartEnabled(true)
    } else {
      setDueDate(dateStr)
      setDueEnabled(true)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
  }

  function isInRange(dateStr: string) {
    if (!startDate || !dueDate || !startEnabled || !dueEnabled) return false
    return dateStr > startDate && dateStr < dueDate
  }

  function handleSave() {
    onSave({
      start_date: startEnabled ? startDate || null : null,
      due_date: dueEnabled ? dueDate || null : null,
      recurring: recurring !== 'never' ? recurring : null,
    })
    onClose()
  }

  function handleRemove() {
    onSave({ start_date: null, due_date: null, recurring: null })
    onClose()
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-black/40" onClick={onClose} />

      <div
        className="fixed z-[71] bg-huginn-card border border-huginn-border rounded-xl shadow-2xl w-72 p-3"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="text-huginn-text-secondary hover:text-white p-1 rounded hover:bg-huginn-hover">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.22 8.53a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06.25Z" />
            </svg>
          </button>
          <span className="text-xs font-bold text-huginn-text-primary">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="text-huginn-text-secondary hover:text-white p-1 rounded hover:bg-huginn-hover">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((day, i) => (
            <div key={i} className="text-[10px] font-bold text-huginn-text-muted text-center">{day}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-y-0.5 mb-3">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} className="h-7" />

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const isStart = dateStr === startDate && startEnabled
            const isDue = dateStr === dueDate && dueEnabled
            const inRange = isInRange(dateStr)

            return (
              <button
                key={dateStr}
                onClick={() => selectDay(day)}
                className={`h-7 w-7 mx-auto rounded-full text-xs font-medium transition-colors ${
                  isDue ? 'bg-huginn-accent text-white'
                  : isStart ? 'bg-huginn-accent/60 text-white'
                  : inRange ? 'bg-huginn-accent/15 text-huginn-accent'
                  : isToday ? 'ring-1 ring-huginn-accent/60 text-huginn-accent font-bold'
                  : 'text-huginn-text-primary hover:bg-huginn-hover'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Start / Due rows */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStartEnabled(!startEnabled); if (!startEnabled) setSelecting('start') }}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                startEnabled ? 'bg-huginn-accent border-huginn-accent' : 'border-huginn-text-muted'
              }`}
              aria-label={t('dates.picker.enableStart')}
            >
              {startEnabled && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white" className="w-3 h-3">
                  <path fillRule="evenodd" d="M12.4 4.7a.75.75 0 0 1 .1 1.06l-5.25 6a.75.75 0 0 1-1.1.02L3.6 9.1a.75.75 0 1 1 1.1-1.02l2.05 2.22 4.7-5.37a.75.75 0 0 1 1.06-.1l-.1-.13Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <span className="text-[11px] uppercase tracking-wider font-bold text-huginn-text-secondary w-10 shrink-0">{t('dates.picker.start')}</span>
            <button
              onClick={() => setSelecting('start')}
              className={`flex-1 text-xs px-2.5 py-1 rounded-md border text-left transition-colors ${
                selecting === 'start' ? 'border-huginn-accent text-huginn-text-primary' : 'border-huginn-border text-huginn-text-secondary hover:border-huginn-text-muted'
              } ${startEnabled ? '' : 'opacity-50'}`}
            >
              {startEnabled && startDate ? formatDate(startDate) : t('dates.picker.placeholder')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setDueEnabled(!dueEnabled); if (!dueEnabled) setSelecting('due') }}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                dueEnabled ? 'bg-huginn-accent border-huginn-accent' : 'border-huginn-text-muted'
              }`}
              aria-label={t('dates.picker.enableDue')}
            >
              {dueEnabled && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white" className="w-3 h-3">
                  <path fillRule="evenodd" d="M12.4 4.7a.75.75 0 0 1 .1 1.06l-5.25 6a.75.75 0 0 1-1.1.02L3.6 9.1a.75.75 0 1 1 1.1-1.02l2.05 2.22 4.7-5.37a.75.75 0 0 1 1.06-.1l-.1-.13Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <span className="text-[11px] uppercase tracking-wider font-bold text-huginn-text-secondary w-10 shrink-0">{t('dates.picker.due')}</span>
            <button
              onClick={() => setSelecting('due')}
              className={`flex-1 text-xs px-2.5 py-1 rounded-md border text-left transition-colors ${
                selecting === 'due' ? 'border-huginn-accent text-huginn-text-primary' : 'border-huginn-border text-huginn-text-secondary hover:border-huginn-text-muted'
              } ${dueEnabled ? '' : 'opacity-50'}`}
            >
              {dueEnabled && dueDate ? formatDate(dueDate) : t('dates.picker.placeholder')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-4 shrink-0" />
            <span className="text-[11px] uppercase tracking-wider font-bold text-huginn-text-secondary w-10 shrink-0">{t('dates.picker.repeat')}</span>
            <select
              value={recurring}
              onChange={(e) => setRecurring(e.target.value)}
              className="flex-1 bg-huginn-surface text-xs text-huginn-text-primary rounded-md px-2 py-1 outline-none border border-huginn-border focus:border-huginn-accent appearance-none cursor-pointer"
            >
              {RECURRING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-huginn-accent text-white text-xs font-semibold rounded-md py-1.5 hover:bg-huginn-accent-hover transition-colors"
          >
            {t('dates.picker.save')}
          </button>
          {(startDate || dueDate) && (
            <button
              onClick={handleRemove}
              className="px-3 bg-huginn-surface text-huginn-text-secondary text-xs font-medium rounded-md py-1.5 hover:text-white hover:bg-huginn-hover transition-colors"
            >
              {t('dates.picker.remove')}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
