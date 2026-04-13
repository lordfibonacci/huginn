import { useMemo, useState } from 'react'
import { useAuth } from '../shared/hooks/useAuth'
import { ThoughtInput, ThoughtList, ClassifyDrawer, ThoughtDetailDrawer, ThoughtDetailPanel, FilterBar, useThoughts } from '../features/inbox'
import { useProjects } from '../features/projects'
import type { Thought } from '../shared/lib/types'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function InboxPage() {
  const { signOut } = useAuth()
  const { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, archiveThought, convertToTask, count } = useThoughts()
  const { projects } = useProjects()
  const [classifyThoughtId, setClassifyThoughtId] = useState<string | null>(null)
  const [editingThought, setEditingThought] = useState<Thought | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'priority'>('newest')

  const projectsById = useMemo(() => {
    const map: Record<string, typeof projects[number]> = {}
    for (const p of projects) map[p.id] = p
    return map
  }, [projects])

  const filteredThoughts = useMemo(() => {
    let result = thoughts
    if (sortBy === 'priority') {
      result = [...result].sort((a, b) => {
        const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3
        const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3
        if (pa !== pb) return pa - pb
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }
    return result
  }, [thoughts, sortBy])

  async function handleSubmit(body: string, source: 'text' | 'voice') {
    const thought = await addThought(body, source)
    if (thought) {
      setClassifyThoughtId(thought.id)
    }
    return thought
  }

  // Keep editingThought in sync with latest data
  const currentEditingThought = editingThought
    ? thoughts.find((t) => t.id === editingThought.id) ?? editingThought
    : null

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: list + input */}
      <div className={`flex flex-col min-h-0 ${currentEditingThought ? 'hidden md:flex md:w-1/2 lg:w-2/5 md:border-r md:border-huginn-border' : 'flex-1'}`}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border md:px-5">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Inbox</h1>
            <p className="text-xs text-huginn-text-secondary">
              {count} thought{count !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-white md:hidden"
          >
            Sign out
          </button>
        </header>

        {/* Filter bar */}
        <FilterBar
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Thought list */}
        <ThoughtList
          thoughts={filteredThoughts}
          loading={loading}
          onThoughtTap={setEditingThought}
          projectsById={projectsById}
          selectedId={currentEditingThought?.id}
        />

        {/* Input bar */}
        <ThoughtInput onSubmit={handleSubmit} />
      </div>

      {/* Right: detail panel (desktop only) */}
      {currentEditingThought && (
        <div className="hidden md:flex flex-1 bg-huginn-base">
          <div className="flex-1">
            <ThoughtDetailPanel
              thought={currentEditingThought}
              onUpdate={updateThought}
              onDelete={deleteThought}
              onArchive={archiveThought}
              onConvertToTask={convertToTask}
              onClose={() => setEditingThought(null)}
            />
          </div>
        </div>
      )}

      {/* Mobile: drawer */}
      {currentEditingThought && (
        <div className="md:hidden">
          <ThoughtDetailDrawer
            thought={currentEditingThought}
            onUpdate={updateThought}
            onDelete={deleteThought}
            onArchive={archiveThought}
            onConvertToTask={convertToTask}
            onDone={() => setEditingThought(null)}
          />
        </div>
      )}

      {/* Classify drawer (always mobile-style, appears after creating) */}
      {classifyThoughtId && (
        <ClassifyDrawer
          thoughtId={classifyThoughtId}
          onClassify={classifyThought}
          onDone={() => setClassifyThoughtId(null)}
        />
      )}
    </div>
  )
}
