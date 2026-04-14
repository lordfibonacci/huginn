import { useRef, useState } from 'react'
import type { Project, ProjectStatus } from '../../../shared/lib/types'
import { ModalShell } from '../../../shared/components/ModalShell'
import { BOARD_BACKGROUNDS, getBackground } from '../../../shared/lib/boardBackgrounds'

interface ProjectSettingsDrawerProps {
  project: Project
  onUpdate: (id: string, updates: { name?: string; description?: string | null; color?: string; status?: ProjectStatus; background?: string }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onDone: () => void
}

const PRESET_COLORS = [
  '#6c5ce7', '#00b894', '#fdcb6e', '#e17055',
  '#0984e3', '#e84393', '#636e72', '#2d3436',
]

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'idea', label: 'Idea' },
  { value: 'hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
]

export function ProjectSettingsDrawer({ project, onUpdate, onDelete, onDone }: ProjectSettingsDrawerProps) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [color, setColor] = useState(project.color)
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [background, setBackground] = useState(project.background ?? 'default')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await onUpdate(project.id, {
      name: trimmed,
      description: description.trim() || null,
      color,
      status,
      background,
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
    onDelete(project.id)
    onDone()
  }

  return (
    <ModalShell onDismiss={onDone} title="Project settings">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        className="w-full bg-huginn-surface text-white rounded-lg px-4 py-3 text-sm outline-none border border-huginn-border focus:border-huginn-accent placeholder-huginn-text-muted mb-3"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={3}
        className="w-full bg-huginn-surface text-white rounded-lg px-4 py-3 text-sm outline-none border border-huginn-border focus:border-huginn-accent placeholder-huginn-text-muted resize-none mb-4"
      />

      {/* Project color */}
      <p className="text-xs text-huginn-text-muted font-semibold mb-2">Color</p>
      <div className="flex gap-3 mb-4">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-7 h-7 rounded-full transition-all ${
              color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-huginn-card' : ''
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Board background */}
      <p className="text-xs text-huginn-text-muted font-semibold mb-2">Board background</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {BOARD_BACKGROUNDS.map((bg) => (
          <button
            key={bg.id}
            onClick={() => setBackground(bg.id)}
            className={`h-12 rounded-lg transition-all ${
              background === bg.id ? 'ring-2 ring-huginn-accent ring-offset-1 ring-offset-huginn-card' : ''
            }`}
            style={{ background: bg.style }}
            title={bg.name}
          >
            <span className="text-[10px] font-medium text-white/70">{bg.name}</span>
          </button>
        ))}
      </div>

      {/* Status */}
      <p className="text-xs text-huginn-text-muted font-semibold mb-2">Status</p>
      <div className="flex gap-2 mb-4">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatus(opt.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              status === opt.value
                ? 'bg-huginn-accent text-white'
                : 'bg-huginn-surface text-gray-300 hover:bg-huginn-hover'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-huginn-border">
        <button
          onClick={handleDelete}
          className={`text-xs py-1.5 px-3 rounded-md transition-colors ${
            confirmDelete ? 'text-red-400 bg-huginn-danger/10 font-semibold' : 'text-red-400 hover:bg-huginn-danger/10'
          }`}
        >
          {confirmDelete ? 'Are you sure?' : 'Delete project'}
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="bg-huginn-accent text-white text-xs font-semibold rounded-md py-1.5 px-5 disabled:opacity-50"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
    </ModalShell>
  )
}
