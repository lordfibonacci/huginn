import { useState } from 'react'

interface DatePickerProps {
  dueDate: string
  onSave: (dueDate: string | null) => void
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

export function DatePicker({ dueDate, onSave, onClose }: DatePickerProps) {
  const today = new Date()
  const initial = dueDate ? new Date(dueDate + 'T00:00:00') : today

  const [year, setYear] = useState(initial.getFullYear())
  const [month, setMonth] = useState(initial.getMonth())
  const [selectedDate, setSelectedDate] = useState(dueDate)

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  // Build calendar grid
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
    setSelectedDate(dateStr)
  }

  function handleSave() {
    onSave(selectedDate || null)
    onClose()
  }

  function handleRemove() {
    onSave(null)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} />

      <div className="fixed z-[61] bg-huginn-card border border-huginn-border rounded-xl shadow-2xl w-80" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-bold text-huginn-text-primary">Dates</h3>
          <button onClick={onClose} className="text-huginn-text-muted hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 pb-2">
          <button onClick={prevMonth} className="text-huginn-text-muted hover:text-white p-1 rounded hover:bg-huginn-hover transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.22 8.53a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06.25Z" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-huginn-text-primary">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="text-huginn-text-muted hover:text-white p-1 rounded hover:bg-huginn-hover transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-4">
          {DAY_NAMES.map((day) => (
            <div key={day} className="text-[10px] font-bold text-huginn-text-muted text-center py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 px-4 pb-3">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-8" />
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate

            return (
              <button
                key={dateStr}
                onClick={() => selectDay(day)}
                className={`h-8 w-8 mx-auto rounded-full text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-huginn-accent text-white'
                    : isToday
                      ? 'bg-huginn-accent/20 text-huginn-accent font-bold'
                      : 'text-huginn-text-primary hover:bg-huginn-hover'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Due date display */}
        <div className="px-4 pb-3">
          <p className="text-xs font-semibold text-huginn-text-muted mb-1.5">Due date</p>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedDate ? 'bg-huginn-accent border-huginn-accent' : 'border-huginn-text-muted'}`}>
              {selectedDate && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white" className="w-3 h-3">
                  <path fillRule="evenodd" d="M12.4 4.7a.75.75 0 0 1 .1 1.06l-5.25 6a.75.75 0 0 1-1.1.02L3.6 9.1a.75.75 0 1 1 1.1-1.02l2.05 2.22 4.7-5.37a.75.75 0 0 1 1.06-.1l-.1-.13Z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className="text-sm text-huginn-text-primary">
              {selectedDate
                ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'No due date'
              }
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 space-y-2">
          <button
            onClick={handleSave}
            className="w-full bg-huginn-accent text-white text-sm font-semibold rounded-lg py-2.5 hover:bg-huginn-accent-hover transition-colors"
          >
            Save
          </button>
          {selectedDate && (
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
