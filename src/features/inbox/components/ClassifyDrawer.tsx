import { useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Project, ThoughtType } from '../../../shared/lib/types'
import { ModalShell } from '../../../shared/components/ModalShell'

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

  useEffect(() => {
    supabase
      .from('huginn_projects')
      .select('*')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (data) setProjects(data as Project[])
      })
  }, [])

  async function handleSave() {
    if (!selectedType && !selectedProject) {
      onDone()
      return
    }

    setSaving(true)
    const updates: { type?: 'idea' | 'task' | 'note'; project_id?: string } = {}
    if (selectedType) updates.type = selectedType
    if (selectedProject) updates.project_id = selectedProject

    await onClassify(thoughtId, updates)
    setSaving(false)
    onDone()
  }

  return (
    <ModalShell onDismiss={onDone} title="Classify this thought">
      {/* Type chips */}
      <div className="flex gap-2 mb-4">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedType(selectedType === opt.value ? null : opt.value)}
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
          className="w-full bg-huginn-surface text-white rounded-lg px-3 py-2.5 text-sm outline-none border border-huginn-border focus:border-huginn-accent mb-4 appearance-none"
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onDone} className="flex-1 text-sm text-gray-400 py-2">
          Do later
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-huginn-accent text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-50"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
    </ModalShell>
  )
}
