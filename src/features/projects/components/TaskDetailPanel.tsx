import { useEffect, useRef, useState } from 'react'
import type { Task, TaskStatus, ThoughtPriority } from '../../../shared/lib/types'
import { timeAgo, formatDueDate } from '../../../shared/lib/dateUtils'
import { ChecklistSection } from './ChecklistSection'
import { LabelBadges } from './LabelBadges'
import { LabelPicker } from './LabelPicker'
import { useChecklists } from '../hooks/useChecklists'
import { useLabels } from '../hooks/useLabels'
import { useTaskLabels } from '../hooks/useTaskLabels'

interface TaskDetailPanelProps {
  task: Task
  projectId: string
  onUpdate: (id: string, updates: { title?: string; notes?: string | null; status?: TaskStatus; priority?: ThoughtPriority | null; due_date?: string | null }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onClose: () => void
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'todo', label: 'To Do', color: 'bg-huginn-text-muted' },
  { value: 'doing', label: 'In Progress', color: 'bg-huginn-accent' },
  { value: 'done', label: 'Done', color: 'bg-huginn-success' },
]

const PRIORITY_OPTIONS: { value: ThoughtPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-huginn-warning' },
  { value: 'high', label: 'High', color: 'bg-huginn-danger' },
]

export function TaskDetailPanel({ task, projectId, onUpdate, onDelete, onClose }: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<ThoughtPriority | null>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { checklists, addChecklist, deleteChecklist, renameChecklist, addItem, toggleItem, updateItemText, deleteItem } = useChecklists(task.id)
  const { labels: projectLabels, createLabel } = useLabels(projectId)
  const { labelIds, addLabel, removeLabel, hasLabel } = useTaskLabels(task.id)
  const [showLabelPicker, setShowLabelPicker] = useState(false)

  const taskLabels = projectLabels.filter(l => labelIds.includes(l.id))

  // Reset when task changes
  useEffect(() => {
    setTitle(task.title)
    setNotes(task.notes ?? '')
    setStatus(task.status)
    setPriority(task.priority)
    setDueDate(task.due_date ?? '')
    setConfirmDelete(false)
  }, [task.id, task.title, task.notes, task.status, task.priority, task.due_date])

  useEffect(() => {
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }
  }, [])

  // Auto-grow notes
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [notes])

  async function handleSave() {
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await onUpdate(task.id, {
      title: trimmed,
      notes: notes.trim() || null,
      status,
      priority,
      due_date: dueDate || null,
    })
    setSaving(false)
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete(task.id)
    onClose()
  }

  // Quick status change
  function handleStatusChange(newStatus: TaskStatus) {
    setStatus(newStatus)
    onUpdate(task.id, { status: newStatus })
  }

  const dueInfo = task.due_date ? formatDueDate(task.due_date) : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-huginn-border">
        <p className="text-xs text-huginn-text-muted">
          Created {timeAgo(task.created_at)}
          {dueInfo && <span className={dueInfo.urgent ? ' · text-huginn-danger font-medium' : ''}> · {dueInfo.text}</span>}
        </p>
        <button onClick={onClose} className="text-huginn-text-muted hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Title — large editable */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-xl font-bold text-huginn-text-primary outline-none placeholder-huginn-text-muted border-b border-transparent focus:border-huginn-border pb-2"
            placeholder="Task title"
          />

          {/* Labels */}
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-huginn-text-muted font-semibold">Labels</p>
              <button
                onClick={() => setShowLabelPicker(!showLabelPicker)}
                className="text-xs text-huginn-accent hover:text-white transition-colors"
              >
                {showLabelPicker ? 'Close' : '+ Add'}
              </button>
            </div>
            <LabelBadges labels={taskLabels} />
            {showLabelPicker && (
              <LabelPicker
                labels={projectLabels}
                activeLabelIds={labelIds}
                onToggle={(labelId) => hasLabel(labelId) ? removeLabel(labelId) : addLabel(labelId)}
                onCreate={createLabel}
                onClose={() => setShowLabelPicker(false)}
              />
            )}
          </div>

          {/* Status row — inline buttons */}
          <div>
            <p className="text-xs text-huginn-text-muted font-semibold mb-2">Status</p>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    status === opt.value
                      ? `${opt.color} text-white`
                      : 'bg-huginn-surface text-huginn-text-secondary hover:bg-huginn-hover'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <p className="text-xs text-huginn-text-muted font-semibold mb-2">Priority</p>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    const newPriority = priority === opt.value ? null : opt.value
                    setPriority(newPriority)
                    onUpdate(task.id, { priority: newPriority })
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    priority === opt.value
                      ? `${opt.color} text-white`
                      : 'bg-huginn-surface text-huginn-text-secondary hover:bg-huginn-hover'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div>
            <p className="text-xs text-huginn-text-muted font-semibold mb-2">Due date</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-huginn-surface text-white rounded-lg px-3 py-2 text-sm outline-none border border-huginn-border focus:border-huginn-accent [color-scheme:dark]"
              />
              {dueDate && (
                <button onClick={() => setDueDate('')} className="text-huginn-text-muted hover:text-white text-sm">✕</button>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs text-huginn-text-muted font-semibold mb-2">Description</p>
            <textarea
              ref={textareaRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a more detailed description..."
              rows={notes ? 4 : 2}
              className="w-full bg-huginn-surface text-sm text-huginn-text-primary rounded-lg px-4 py-3 outline-none border border-huginn-border focus:border-huginn-accent resize-none leading-relaxed placeholder-huginn-text-muted"
            />
          </div>

          {/* Checklists */}
          <ChecklistSection
            checklists={checklists}
            onAddChecklist={addChecklist}
            onDeleteChecklist={deleteChecklist}
            onRenameChecklist={renameChecklist}
            onAddItem={addItem}
            onToggleItem={toggleItem}
            onUpdateItemText={updateItemText}
            onDeleteItem={deleteItem}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-huginn-border flex items-center gap-2">
        <button
          onClick={handleDelete}
          className={`text-xs py-1.5 px-3 rounded-md transition-colors ${
            confirmDelete ? 'text-red-400 bg-huginn-danger/10 font-semibold' : 'text-red-400 hover:bg-huginn-danger/10'
          }`}
        >
          {confirmDelete ? 'Are you sure?' : 'Delete'}
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="bg-huginn-accent text-white text-xs font-semibold rounded-md py-1.5 px-5 disabled:opacity-50"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
