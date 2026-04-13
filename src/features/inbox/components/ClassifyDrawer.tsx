import { useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Project } from '../../../shared/lib/types'
import { ModalShell } from '../../../shared/components/ModalShell'

interface ClassifyDrawerProps {
  thoughtId: string
  onClassify: (thoughtId: string, updates: { project_id?: string }) => Promise<boolean>
  onDone: () => void
}

export function ClassifyDrawer({ thoughtId, onClassify, onDone }: ClassifyDrawerProps) {
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
    if (!selectedProject) {
      onDone()
      return
    }

    setSaving(true)
    const updates: { project_id?: string } = {}
    if (selectedProject) updates.project_id = selectedProject

    await onClassify(thoughtId, updates)
    setSaving(false)
    onDone()
  }

  return (
    <ModalShell onDismiss={onDone} title="Assign to project">
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
