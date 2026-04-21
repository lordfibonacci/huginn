import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../shared/lib/supabase'
import type { Project, Thought, ThoughtPriority } from '../../../shared/lib/types'
import { ModalShell } from '../../../shared/components/ModalShell'

interface ThoughtDetailDrawerProps {
  thought: Thought
  onUpdate: (id: string, updates: {
    body?: string
    project_id?: string | null
    priority?: ThoughtPriority | null
    due_date?: string | null
  }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onArchive: (id: string) => Promise<boolean>
  onConvertToTask?: (id: string) => Promise<boolean>
  onDone: () => void
}

export function ThoughtDetailDrawer({ thought, onUpdate, onDelete, onArchive, onConvertToTask, onDone }: ThoughtDetailDrawerProps) {
  const { t } = useTranslation()
  const PRIORITY_OPTIONS = useMemo<{ value: ThoughtPriority; label: string; color: string }[]>(() => [
    { value: 'low', label: t('inbox.thought.priority.low'), color: 'bg-gray-500' },
    { value: 'medium', label: t('inbox.thought.priority.medium'), color: 'bg-huginn-warning' },
    { value: 'high', label: t('inbox.thought.priority.high'), color: 'bg-huginn-danger' },
  ], [t])
  const [body, setBody] = useState(thought.body)
  const [selectedProject, setSelectedProject] = useState<string | null>(thought.project_id)
  const [selectedPriority, setSelectedPriority] = useState<ThoughtPriority | null>(thought.priority)
  const [dueDate, setDueDate] = useState<string>(thought.due_date ?? '')
  const [projects, setProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
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

  async function handleSave() {
    const trimmed = body.trim()
    if (!trimmed || saving) return

    setSaving(true)
    await onUpdate(thought.id, {
      body: trimmed,
      project_id: selectedProject,
      priority: selectedPriority,
      due_date: dueDate || null,
    })
    setSaving(false)
    onDone()
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete(thought.id)
    onDone()
  }

  function handleArchive() {
    onArchive(thought.id)
    onDone()
  }

  async function handleConvertToTask() {
    if (!onConvertToTask) return
    await onConvertToTask(thought.id)
    onDone()
  }

  const canSave = body.trim().length > 0

  return (
    <ModalShell onDismiss={onDone}>
      {/* Editable body */}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full bg-huginn-surface text-white rounded-lg px-4 py-3 text-sm outline-none border border-huginn-border focus:border-huginn-accent resize-none mb-4 leading-relaxed"
        rows={3}
      />

      {/* Project dropdown */}
      {projects.length > 0 && (
        <select
          value={selectedProject ?? ''}
          onChange={(e) => setSelectedProject(e.target.value || null)}
          className="w-full bg-huginn-surface text-white rounded-lg px-3 py-2.5 text-sm outline-none border border-huginn-border focus:border-huginn-accent mb-4 appearance-none"
        >
          <option value="">{t('inbox.thought.noProject')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {/* Priority chips */}
      <p className="text-xs text-huginn-text-muted font-semibold mb-2">{t('inbox.thought.priorityLabel')}</p>
      <div className="flex gap-2 mb-4">
        {PRIORITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedPriority(selectedPriority === opt.value ? null : opt.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
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
      <p className="text-xs text-huginn-text-muted font-semibold mb-2">{t('inbox.thought.dueDate')}</p>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="flex-1 bg-huginn-surface text-white rounded-lg px-3 py-2.5 text-sm outline-none border border-huginn-border focus:border-huginn-accent [color-scheme:dark]"
        />
        {dueDate && (
          <button onClick={() => setDueDate('')} aria-label={t('inbox.thought.clearDate')} className="text-huginn-text-muted hover:text-white text-sm px-2">✕</button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-huginn-border">
        {onConvertToTask && selectedProject && (
          <button
            onClick={handleConvertToTask}
            className="text-xs py-1.5 px-3 rounded-md text-huginn-accent bg-huginn-accent/10 font-semibold hover:bg-huginn-accent/20 transition-colors"
          >
            {t('inbox.thought.convertToTask')}
          </button>
        )}
        <button onClick={handleArchive} className="text-xs py-1.5 px-3 rounded-md text-huginn-text-muted hover:text-white transition-colors">
          {t('inbox.thought.archive')}
        </button>
        <button
          onClick={handleDelete}
          className={`text-xs py-1.5 px-3 rounded-md transition-colors ${
            confirmDelete ? 'text-red-400 bg-huginn-danger/10 font-semibold' : 'text-red-400 hover:bg-huginn-danger/10'
          }`}
        >
          {confirmDelete ? t('inbox.thought.confirmDelete') : t('inbox.thought.delete')}
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="bg-huginn-accent text-white text-xs font-semibold rounded-md py-1.5 px-5 disabled:opacity-50"
        >
          {saving ? t('inbox.thought.saving') : t('inbox.thought.save')}
        </button>
      </div>
    </ModalShell>
  )
}
