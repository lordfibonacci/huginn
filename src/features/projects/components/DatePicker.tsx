import { useState } from 'react'

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
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const RECURRING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export function DatePicker({ startDate: initialStart, dueDate: initialDue, recurring: initialRecurring, onSave, onClose }: DatePickerProps) {
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

  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />

      <div className="fixed z-[61] bg-huginn-card border border-huginn-border rounded-xl shadow-2xl w-80 max-h-[90vh] overflow-y-auto" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-sm font-bold text-huginn-text-primary">Dates</h3>
          <button onClick={onClose} className="text-huginn-text-muted hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between px-5 pb-2">
          <button onClick={prevMonth} className="text-huginn-text-muted hover:text-white p-1 rounded hover:bg-huginn-hover">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.22 8.53a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06.25Z" />
            </svg>
          </button>
          <span className="text-sm font-bold text-huginn-text-primary">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="text-huginn-text-muted hover:text-white p-1 rounded hover:bg-huginn-hover">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-4">
          {DAY_NAMES.map((day) => (
            <div key={day} className="text-[10px] font-bold text-huginn-text-muted text-center py-1">{day}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 px-4 pb-3">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} className="h-8" />

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const isStart = dateStr === startDate && startEnabled
            const isDue = dateStr === dueDate && dueEnabled
            const inRange = isInRange(dateStr)

            return (
              <button
                key={dateStr}
                onClick={() => selectDay(day)}
                className={`h-8 w-8 mx-auto rounded-full text-xs font-medium transition-colors ${
                  isDue ? 'bg-huginn-accent text-white'
                  : isStart ? 'bg-huginn-accent/60 text-white'
                  : inRange ? 'bg-huginn-accent/15 text-huginn-accent'
                  : isToday ? 'bg-huginn-accent/20 text-huginn-accent font-bold'
                  : 'text-huginn-text-primary hover:bg-huginn-hover'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Start date */}
        <div className="px-5 pb-3">
          <p className="text-xs font-semibold text-huginn-text-muted mb-1.5">Start date</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStartEnabled(!startEnabled); setSelecting('start') }}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                startEnabled ? 'bg-huginn-accent border-huginn-accent' : 'border-huginn-text-muted'
              }`}
            >
              {startEnabled && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white" className="w-3 h-3">
                  <path fillRule="evenodd" d="M12.4 4.7a.75.75 0 0 1 .1 1.06l-5.25 6a.75.75 0 0 1-1.1.02L3.6 9.1a.75.75 0 1 1 1.1-1.02l2.05 2.22 4.7-5.37a.75.75 0 0 1 1.06-.1l-.1-.13Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setSelecting('start')}
              className={`text-sm px-3 py-1 rounded-md border transition-colors ${
                selecting === 'start' ? 'border-huginn-accent text-huginn-text-primary' : 'border-huginn-border text-huginn-text-secondary'
              } ${startEnabled ? '' : 'opacity-50'}`}
            >
              {startEnabled && startDate ? formatDate(startDate) : 'M/D/YYYY'}
            </button>
          </div>
        </div>

        {/* Due date */}
        <div className="px-5 pb-3">
          <p className="text-xs font-semibold text-huginn-text-muted mb-1.5">Due date</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setDueEnabled(!dueEnabled); setSelecting('due') }}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                dueEnabled ? 'bg-huginn-accent border-huginn-accent' : 'border-huginn-text-muted'
              }`}
            >
              {dueEnabled && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white" className="w-3 h-3">
                  <path fillRule="evenodd" d="M12.4 4.7a.75.75 0 0 1 .1 1.06l-5.25 6a.75.75 0 0 1-1.1.02L3.6 9.1a.75.75 0 1 1 1.1-1.02l2.05 2.22 4.7-5.37a.75.75 0 0 1 1.06-.1l-.1-.13Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setSelecting('due')}
              className={`text-sm px-3 py-1 rounded-md border transition-colors ${
                selecting === 'due' ? 'border-huginn-accent text-huginn-text-primary' : 'border-huginn-border text-huginn-text-secondary'
              } ${dueEnabled ? '' : 'opacity-50'}`}
            >
              {dueEnabled && dueDate ? formatDate(dueDate) : 'M/D/YYYY'}
            </button>
          </div>
        </div>

        {/* Recurring */}
        <div className="px-5 pb-3">
          <p className="text-xs font-semibold text-huginn-text-muted mb-1.5">Recurring</p>
          <select
            value={recurring}
            onChange={(e) => setRecurring(e.target.value)}
            className="w-full bg-huginn-surface text-sm text-huginn-text-primary rounded-lg px-3 py-2 outline-none border border-huginn-border focus:border-huginn-accent appearance-none"
          >
            {RECURRING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Reminder note */}
        <div className="px-5 pb-3">
          <p className="text-[11px] text-huginn-text-muted italic">
            Reminders coming soon.
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 space-y-2">
          <button
            onClick={handleSave}
            className="w-full bg-huginn-accent text-white text-sm font-semibold rounded-lg py-2.5 hover:bg-huginn-accent-hover transition-colors"
          >
            Save
          </button>
          {(startDate || dueDate) && (
            <button
              onClick={handleRemove}
              className="w-full bg-huginn-surface text-huginn-text-secondary text-sm font-medium rounded-lg py-2 hover:text-white hover:bg-huginn-hover transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </>
  )
}
