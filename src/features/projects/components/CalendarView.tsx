import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../../../shared/lib/types'
import { colorPrimary } from './ProjectGlyph'

interface CalendarViewProps {
  tasks: Task[]
  onTaskTap: (task: Task) => void
  // When provided, cross-board mode: prefix each cell's task with a dot in the
  // owning project's color.
  projectColorByTaskId?: Record<string, string>
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarView({ tasks, onTaskTap, projectColorByTaskId }: CalendarViewProps) {
  const { t } = useTranslation()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Group tasks by due_date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const task of tasks) {
      if (task.due_date) {
        if (!map[task.due_date]) map[task.due_date] = []
        map[task.due_date].push(task)
      }
    }
    return map
  }, [tasks])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  // Build calendar grid
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevMonth} className="text-huginn-text-muted hover:text-white p-1 rounded hover:bg-huginn-card transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.22 8.53a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06.25Z" />
          </svg>
        </button>
        <h2 className="text-sm font-bold text-huginn-text-primary">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button onClick={nextMonth} className="text-huginn-text-muted hover:text-white p-1 rounded hover:bg-huginn-card transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>
        <button onClick={goToday} className="text-xs text-huginn-accent hover:text-white ml-2">
          {t('calendar.today')}
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_NAMES.map((day) => (
          <div key={day} className="text-[10px] font-bold uppercase text-huginn-text-muted text-center py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px flex-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="bg-huginn-base/30 rounded-md min-h-[80px]" />
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayTasks = tasksByDate[dateStr] || []
          const isToday = dateStr === todayStr

          return (
            <div
              key={dateStr}
              className={`bg-huginn-base/50 rounded-md min-h-[80px] p-1 ${
                isToday ? 'ring-1 ring-huginn-accent' : ''
              }`}
            >
              <span className={`text-[10px] font-semibold block mb-0.5 ${
                isToday ? 'text-huginn-accent' : 'text-huginn-text-muted'
              }`}>
                {day}
              </span>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => {
                  const dotColor = projectColorByTaskId?.[task.id]
                  return (
                    <button
                      key={task.id}
                      onClick={() => onTaskTap(task)}
                      className="w-full text-left text-[10px] text-huginn-text-primary bg-huginn-card hover:bg-huginn-hover rounded px-1 py-0.5 truncate transition-colors flex items-center gap-1"
                    >
                      {dotColor && (
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: colorPrimary(dotColor) }}
                        />
                      )}
                      <span className="truncate">{task.title}</span>
                    </button>
                  )
                })}
                {dayTasks.length > 3 && (
                  <span className="text-[9px] text-huginn-text-muted px-1">{t('calendar.moreCount', { count: dayTasks.length - 3 })}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
