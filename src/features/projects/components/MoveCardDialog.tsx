import { useEffect, useState } from 'react'
import { ModalShell } from '../../../shared/components/ModalShell'
import { supabase } from '../../../shared/lib/supabase'
import { useProjects } from '../hooks/useProjects'
import type { List } from '../../../shared/lib/types'

interface MoveCardDialogProps {
  currentProjectId: string
  currentListId: string | null
  onMove: (targetProjectId: string, targetListId: string) => Promise<void> | void
  onDone: () => void
}

export function MoveCardDialog({ currentProjectId, currentListId, onMove, onDone }: MoveCardDialogProps) {
  const { projects } = useProjects()
  const [selectedBoardId, setSelectedBoardId] = useState<string>(currentProjectId)
  const [lists, setLists] = useState<List[]>([])
  const [selectedListId, setSelectedListId] = useState<string>(currentListId ?? '')
  const [loadingLists, setLoadingLists] = useState(false)
  const [moving, setMoving] = useState(false)

  // Fetch the target board's lists whenever selection changes.
  useEffect(() => {
    if (!selectedBoardId) return
    setLoadingLists(true)
    supabase
      .from('huginn_lists')
      .select('*')
      .eq('project_id', selectedBoardId)
      .order('position')
      .then(({ data, error }) => {
        setLoadingLists(false)
        if (error) {
          console.error('Failed to fetch lists for move:', error)
          setLists([])
          return
        }
        const fetched = (data ?? []) as List[]
        setLists(fetched)
        // If the previously-selected list doesn't exist on the new board, pick the first one.
        if (!fetched.some(l => l.id === selectedListId)) {
          setSelectedListId(fetched[0]?.id ?? '')
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBoardId])

  const sameLocation = selectedBoardId === currentProjectId && selectedListId === currentListId
  const canSubmit = !!selectedBoardId && !!selectedListId && !sameLocation && !moving

  async function handleSubmit() {
    if (!canSubmit) return
    setMoving(true)
    await onMove(selectedBoardId, selectedListId)
    setMoving(false)
    onDone()
  }

  return (
    <ModalShell onDismiss={onDone} title="Move card">
      <p className="text-xs text-huginn-text-muted mb-4">
        Pick a destination project and list. The card's position is reset to the top of the chosen list.
      </p>

      <label className="block text-xs font-semibold text-huginn-text-muted mb-1.5">Project</label>
      <select
        value={selectedBoardId}
        onChange={(e) => setSelectedBoardId(e.target.value)}
        className="w-full bg-huginn-surface text-white text-sm rounded-lg px-3 py-2 outline-none border border-huginn-border focus:border-huginn-accent mb-4 appearance-none"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}{p.id === currentProjectId ? ' (current)' : ''}
          </option>
        ))}
      </select>

      <label className="block text-xs font-semibold text-huginn-text-muted mb-1.5">List</label>
      <select
        value={selectedListId}
        onChange={(e) => setSelectedListId(e.target.value)}
        disabled={loadingLists || lists.length === 0}
        className="w-full bg-huginn-surface text-white text-sm rounded-lg px-3 py-2 outline-none border border-huginn-border focus:border-huginn-accent mb-5 appearance-none disabled:opacity-50"
      >
        {loadingLists && <option>Loading lists…</option>}
        {!loadingLists && lists.length === 0 && <option value="">(no lists on this project)</option>}
        {!loadingLists && lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}{l.id === currentListId && selectedBoardId === currentProjectId ? ' (current)' : ''}
          </option>
        ))}
      </select>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-huginn-text-secondary hover:text-white px-4 py-2 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-huginn-accent hover:bg-huginn-accent-hover text-white text-sm font-semibold rounded-lg px-5 py-2 disabled:opacity-50"
        >
          {moving ? '…' : 'Move'}
        </button>
      </div>
    </ModalShell>
  )
}
