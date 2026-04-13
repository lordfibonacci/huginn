import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Project, Thought, ThoughtType, ThoughtPriority } from '../../../shared/lib/types'

interface ThoughtDetailDrawerProps {
  thought: Thought
  onUpdate: (id: string, updates: {
    body?: string
    type?: ThoughtType | null
    project_id?: string | null
    priority?: ThoughtPriority | null
    due_date?: string | null
  }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onArchive: (id: string) => Promise<boolean>
  onConvertToTask?: (id: string) => Promise<boolean>
  onDone: () => void
}

const TYPE_OPTIONS: { value: ThoughtType; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'task', label: 'Task' },
  { value: 'note', label: 'Note' },
]

const TYPE_BADGE: Record<ThoughtType, string> = {
  task: 'bg-huginn-accent text-white',
  idea: 'bg-huginn-warning text-black',
  note: 'bg-huginn-success text-white',
}

const PRIORITY_OPTIONS: { value: ThoughtPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-huginn-warning' },
  { value: 'high', label: 'High', color: 'bg-huginn-danger' },
]

export function ThoughtDetailDrawer({ thought, onUpdate, onDelete, onArchive, onConvertToTask, onDone }: ThoughtDetailDrawerProps) {
  const [body, setBody] = useState(thought.body)
  const [selectedType, setSelectedType] = useState<ThoughtType | null>(thought.type)
  const [selectedProject, setSelectedProject] = useState<string | null>(thought.project_id)
  const [selectedPriority, setSelectedPriority] = useState<ThoughtPriority | null>(thought.priority)
  const [dueDate, setDueDate] = useState<string>(thought.due_date ?? '')
  const [projects, setProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [visible, setVisible] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))

    supabase
      .from('huginn_projects')
      .select('*')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (data) setProjects(data as Project[])
      })

    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [body])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    const trimmed = body.trim()
    if (!trimmed || saving) return

    setSaving(true)
    await onUpdate(thought.id, {
      body: trimmed,
      type: selectedType,
      project_id: selectedProject,
      priority: selectedPriority,
      due_date: dueDate || null,
    })
    setSaving(false)
    dismiss()
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }

    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete(thought.id)
    dismiss()
  }

  function handleArchive() {
    onArchive(thought.id)
    dismiss()
  }

  async function handleConvertToTask() {
    if (!onConvertToTask) return
    await onConvertToTask(thought.id)
    dismiss()
  }

  const canSave = body.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-huginn-card rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.3)] p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 max-h-[85vh] overflow-y-auto ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

        {/* Editable body */}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full bg-huginn-surface text-white rounded-xl px-4 py-3 text-sm outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent placeholder-gray-500 resize-none mb-4"
          rows={3}
        />

        {/* Type chips */}
        <div className="flex gap-2 mb-4">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setSelectedType(selectedType === opt.value ? null : opt.value)
              }
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                selectedType === opt.value
                  ? TYPE_BADGE[opt.value]
                  : 'bg-huginn-surface text-gray-300 hover:bg-huginn-hover'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Project dropdown */}
        {projects.length > 0 && (
          <select
            value={selectedProject ?? ''}
            onChange={(e) => setSelectedProject(e.target.value || null)}
            className="w-full bg-huginn-surface text-white rounded-xl px-4 py-3 text-sm outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent mb-4 appearance-none"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {/* Priority chips */}
        <p className="text-xs text-huginn-text-muted font-semibold mb-2">Priority</p>
        <div className="flex gap-2 mb-4">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setSelectedPriority(selectedPriority === opt.value ? null : opt.value)
              }
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                selectedPriority === opt.value
                  ? `${opt.color} text-white`
                  : 'bg-huginn-surface text-gray-300 hover:bg-huginn-hover'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Due date */}
        <p className="text-xs text-huginn-text-muted font-semibold mb-2">Due date</p>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="flex-1 bg-huginn-surface text-white rounded-xl px-4 py-3 text-sm outline-none border border-huginn-border focus:border-huginn-accent focus:ring-2 focus:ring-huginn-accent [color-scheme:dark]"
          />
          {dueDate && (
            <button
              onClick={() => setDueDate('')}
              className="text-gray-400 hover:text-white text-sm px-2"
            >
              ✕
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onConvertToTask && selectedProject && (
            <button
              onClick={handleConvertToTask}
              className="text-sm py-2 px-3 rounded-xl text-huginn-accent bg-huginn-accent/10 font-medium hover:bg-huginn-accent/20 transition-colors"
            >
              Convert to task
            </button>
          )}
          <button
            onClick={handleArchive}
            className="text-sm py-2 px-3 rounded-xl text-gray-400 hover:text-white transition-colors"
          >
            Archive
          </button>
          <button
            onClick={handleDelete}
            className={`text-sm py-2 px-3 rounded-xl transition-colors ${
              confirmDelete
                ? 'text-red-400 bg-huginn-danger/10 font-semibold'
                : 'text-red-400 hover:bg-huginn-danger/10'
            }`}
          >
            {confirmDelete ? 'Are you sure?' : 'Delete'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="bg-huginn-accent text-white text-sm font-semibold rounded-xl py-2 px-6 disabled:opacity-50 shadow-md shadow-huginn-accent/30"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
