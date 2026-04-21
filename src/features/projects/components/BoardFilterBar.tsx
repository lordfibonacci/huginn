import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Label, ThoughtPriority } from '../../../shared/lib/types'
import { getContrastTextColor } from '../../../shared/lib/contrast'

export interface BoardFilters {
  labelIds: string[]
  priority: ThoughtPriority | null
  dueStatus: 'all' | 'overdue' | 'due-soon' | 'no-date'
  search: string
}

export const DEFAULT_FILTERS: BoardFilters = {
  labelIds: [],
  priority: null,
  dueStatus: 'all',
  search: '',
}

interface BoardFilterBarProps {
  filters: BoardFilters
  onChange: (filters: BoardFilters) => void
  labels: Label[]
  isActive: boolean
}

export function BoardFilterBar({ filters, onChange, labels, isActive }: BoardFilterBarProps) {
  const { t } = useTranslation()
  const [showPanel, setShowPanel] = useState(false)

  const priorityLabel = (p: ThoughtPriority) =>
    p === 'high' ? t('board.filter.priorityHigh')
    : p === 'medium' ? t('board.filter.priorityMedium')
    : t('board.filter.priorityLow')

  function toggleLabel(labelId: string) {
    const newIds = filters.labelIds.includes(labelId)
      ? filters.labelIds.filter(id => id !== labelId)
      : [...filters.labelIds, labelId]
    onChange({ ...filters, labelIds: newIds })
  }

  function setPriority(p: ThoughtPriority | null) {
    onChange({ ...filters, priority: filters.priority === p ? null : p })
  }

  function setDueStatus(status: typeof filters.dueStatus) {
    onChange({ ...filters, dueStatus: filters.dueStatus === status ? 'all' : status })
  }

  function clearAll() {
    onChange(DEFAULT_FILTERS)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-1.5 text-xs rounded-md px-2.5 py-1.5 transition-colors ${
          isActive
            ? 'bg-huginn-accent text-white'
            : 'text-huginn-text-secondary hover:text-white hover:bg-huginn-card'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M14 2H2a1 1 0 0 0-1 1v1.5a.5.5 0 0 0 .146.354L6 9.707V13.5a.5.5 0 0 0 .276.447l3 1.5A.5.5 0 0 0 10 15V9.707l4.854-4.853A.5.5 0 0 0 15 4.5V3a1 1 0 0 0-1-1Z" />
        </svg>
        {t('board.filter.trigger')}
        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      </button>

      {showPanel && (
        <div className="absolute top-full right-0 mt-2 bg-huginn-card border border-huginn-border rounded-xl shadow-2xl p-4 z-50 w-72" onClick={(e) => e.stopPropagation()}>
          {/* Search within board */}
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder={t('board.filter.searchPlaceholder')}
            className="w-full bg-huginn-surface text-sm text-huginn-text-primary rounded-lg px-3 py-2 outline-none border border-huginn-border focus:border-huginn-accent placeholder-huginn-text-muted mb-3"
          />

          {/* Labels */}
          {labels.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-huginn-text-muted mb-1.5">{t('board.filter.labels')}</p>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => {
                  const active = filters.labelIds.includes(label.id)
                  return (
                    <button
                      key={label.id}
                      onClick={() => toggleLabel(label.id)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                        active ? 'ring-1 ring-white/50' : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: label.color, color: getContrastTextColor(label.color) }}
                    >
                      {label.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Priority */}
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-huginn-text-muted mb-1.5">{t('board.filter.priority')}</p>
            <div className="flex gap-1.5">
              {(['high', 'medium', 'low'] as ThoughtPriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    filters.priority === p
                      ? p === 'high' ? 'bg-huginn-danger text-white' : p === 'medium' ? 'bg-huginn-warning text-black' : 'bg-gray-500 text-white'
                      : 'bg-huginn-surface text-huginn-text-secondary hover:bg-huginn-hover'
                  }`}
                >
                  {priorityLabel(p)}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-huginn-text-muted mb-1.5">{t('board.filter.dueDate')}</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { value: 'overdue' as const, label: t('board.filter.overdue') },
                { value: 'due-soon' as const, label: t('board.filter.dueSoon') },
                { value: 'no-date' as const, label: t('board.filter.noDate') },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDueStatus(opt.value)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    filters.dueStatus === opt.value
                      ? 'bg-huginn-accent text-white'
                      : 'bg-huginn-surface text-huginn-text-secondary hover:bg-huginn-hover'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {isActive && (
            <button
              onClick={clearAll}
              className="text-xs text-huginn-text-muted hover:text-white transition-colors"
            >
              {t('board.filter.clearAll')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Helper to apply filters to a task array
export function applyBoardFilters(
  tasks: { title: string; priority: string | null; due_date: string | null }[],
  filters: BoardFilters,
  taskLabelMap?: Record<string, string[]>
) {
  return tasks.filter((task: any) => {
    // Search
    if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }

    // Priority
    if (filters.priority && task.priority !== filters.priority) {
      return false
    }

    // Due status
    if (filters.dueStatus !== 'all') {
      if (filters.dueStatus === 'no-date' && task.due_date) return false
      if (filters.dueStatus === 'overdue') {
        if (!task.due_date) return false
        const due = new Date(task.due_date + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (due >= today) return false
      }
      if (filters.dueStatus === 'due-soon') {
        if (!task.due_date) return false
        const due = new Date(task.due_date + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const threeDays = new Date(today)
        threeDays.setDate(threeDays.getDate() + 3)
        if (due < today || due > threeDays) return false
      }
    }

    // Labels
    if (filters.labelIds.length > 0 && taskLabelMap) {
      const cardLabels = taskLabelMap[task.id] || []
      if (!filters.labelIds.some(id => cardLabels.includes(id))) return false
    }

    return true
  })
}
