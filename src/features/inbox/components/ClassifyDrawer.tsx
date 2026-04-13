import { useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Project, ThoughtType } from '../../../shared/lib/types'

interface ClassifyDrawerProps {
  thoughtId: string
  onClassify: (thoughtId: string, updates: { type?: 'idea' | 'task' | 'note'; project_id?: string }) => Promise<boolean>
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

export function ClassifyDrawer({ thoughtId, onClassify, onDone }: ClassifyDrawerProps) {
  const [selectedType, setSelectedType] = useState<ThoughtType | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger slide-up animation
    requestAnimationFrame(() => setVisible(true))

    supabase
      .from('huginn_projects')
      .select('*')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (data) setProjects(data as Project[])
      })
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    if (!selectedType && !selectedProject) {
      dismiss()
      return
    }

    setSaving(true)
    const updates: { type?: 'idea' | 'task' | 'note'; project_id?: string } = {}
    if (selectedType) updates.type = selectedType
    if (selectedProject) updates.project_id = selectedProject

    await onClassify(thoughtId, updates)
    setSaving(false)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-huginn-card rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.3)] p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

        <p className="text-sm text-gray-400 mb-3">Classify this thought</p>

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

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={dismiss}
            className="flex-1 text-sm text-gray-400 py-2"
          >
            Do later
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-huginn-accent text-white text-sm font-semibold rounded-xl py-2 disabled:opacity-50 shadow-md shadow-huginn-accent/30"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
