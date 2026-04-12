import { useEffect, useRef, useState } from 'react'
import type { Project, ProjectStatus } from '../../../shared/lib/types'

interface ProjectSettingsDrawerProps {
  project: Project
  onUpdate: (id: string, updates: { name?: string; description?: string | null; color?: string; status?: ProjectStatus }) => Promise<boolean>
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
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [visible, setVisible] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await onUpdate(project.id, {
      name: trimmed,
      description: description.trim() || null,
      color,
      status,
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
    onDelete(project.id)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-[#2a2a4a] rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 max-h-[85vh] overflow-y-auto ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-400 mb-3">Project settings</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 mb-3"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 resize-none mb-4"
        />
        <div className="flex gap-3 mb-4">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition-all ${
                color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2a2a4a]' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                status === opt.value
                  ? 'bg-[#6c5ce7] text-white'
                  : 'bg-[#1a1a2e] text-gray-300 hover:bg-[#3a3a5a]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className={`text-sm py-2 px-3 rounded-xl transition-colors ${
              confirmDelete ? 'text-red-400 bg-red-400/10 font-semibold' : 'text-red-400'
            }`}
          >
            {confirmDelete ? 'Are you sure?' : 'Delete project'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="bg-[#6c5ce7] text-white text-sm font-semibold rounded-xl py-2 px-6 disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
