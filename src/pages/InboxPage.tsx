import { useMemo, useState } from 'react'
import { useAuth } from '../shared/hooks/useAuth'
import { ThoughtInput, ThoughtList, ClassifyDrawer, ThoughtDetailDrawer, FilterBar, useThoughts } from '../features/inbox'
import { useProjects } from '../features/projects'
import type { Thought } from '../shared/lib/types'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function InboxPage() {
  const { signOut } = useAuth()
  const { thoughts, loading, addThought, classifyThought, updateThought, deleteThought, archiveThought, convertToTask, count } = useThoughts()
  const { projects } = useProjects()
  const [classifyThoughtId, setClassifyThoughtId] = useState<string | null>(null)
  const [editingThought, setEditingThought] = useState<Thought | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'idea' | 'task' | 'note'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'priority'>('newest')

  const projectsById = useMemo(() => {
    const map: Record<string, typeof projects[number]> = {}
    for (const p of projects) map[p.id] = p
    return map
  }, [projects])

  const filteredThoughts = useMemo(() => {
    let result = thoughts
    if (activeFilter !== 'all') {
      result = result.filter((t) => t.type === activeFilter)
    }
    if (sortBy === 'priority') {
      result = [...result].sort((a, b) => {
        const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3
        const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3
        if (pa !== pb) return pa - pb
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }
    return result
  }, [thoughts, activeFilter, sortBy])

  async function handleSubmit(body: string, source: 'text' | 'voice') {
    const thought = await addThought(body, source)
    if (thought) {
      setClassifyThoughtId(thought.id)
    }
    return thought
  }

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border">
        <div>
          <h1 className="text-xl font-bold">Huginn</h1>
          <p className="text-xs text-gray-500">
            {count} thought{count !== 1 ? 's' : ''} in inbox
          </p>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-gray-500 hover:text-white"
        >
          Sign out
        </button>
      </header>

      {/* Filter bar */}
      <FilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Thought list */}
      <ThoughtList
        thoughts={filteredThoughts}
        loading={loading}
        onThoughtTap={setEditingThought}
        projectsById={projectsById}
      />

      {/* Input bar */}
      <ThoughtInput onSubmit={handleSubmit} />

      {/* Classify drawer (post-save) */}
      {classifyThoughtId && (
        <ClassifyDrawer
          thoughtId={classifyThoughtId}
          onClassify={classifyThought}
          onDone={() => setClassifyThoughtId(null)}
        />
      )}

      {/* Detail drawer (tap to edit) */}
      {editingThought && (
        <ThoughtDetailDrawer
          thought={editingThought}
          onUpdate={updateThought}
          onDelete={deleteThought}
          onArchive={archiveThought}
          onConvertToTask={convertToTask}
          onDone={() => setEditingThought(null)}
        />
      )}
    </>
  )
}
