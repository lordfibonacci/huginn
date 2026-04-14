import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface SearchResult {
  type: 'thought' | 'task'
  id: string
  title: string
  projectId?: string | null
  projectName?: string
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const navigate = useNavigate()

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }

    setSearching(true)
    const searchTerm = `%${q.trim()}%`

    const [thoughtsRes, tasksRes] = await Promise.all([
      supabase
        .from('huginn_thoughts')
        .select('id, body, project_id')
        .ilike('body', searchTerm)
        .neq('status', 'archived')
        .limit(5),
      supabase
        .from('huginn_tasks')
        .select('id, title, project_id')
        .ilike('title', searchTerm)
        .limit(5),
    ])

    const items: SearchResult[] = []

    if (thoughtsRes.data) {
      for (const t of thoughtsRes.data) {
        items.push({ type: 'thought', id: t.id, title: t.body.slice(0, 80), projectId: t.project_id })
      }
    }

    if (tasksRes.data) {
      for (const t of tasksRes.data) {
        items.push({ type: 'task', id: t.id, title: t.title, projectId: t.project_id })
      }
    }

    setResults(items)
    setSearching(false)
  }, [])

  function handleInputChange(value: string) {
    setQuery(value)
    setShowResults(true)
    // Debounce
    const timer = setTimeout(() => search(value), 300)
    return () => clearTimeout(timer)
  }

  function handleSelect(result: SearchResult) {
    if (result.type === 'task' && result.projectId) {
      navigate(`/projects/${result.projectId}`)
    } else {
      navigate('/')
    }
    setQuery('')
    setShowResults(false)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-huginn-surface rounded-lg px-3 py-1.5 border border-huginn-border focus-within:border-huginn-accent transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-huginn-text-muted shrink-0">
          <path fillRule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clipRule="evenodd" />
        </svg>
        <input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => query && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Search..."
          className="bg-transparent text-xs text-huginn-text-primary outline-none placeholder-huginn-text-muted w-full"
        />
      </div>

      {showResults && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-huginn-card border border-huginn-border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          {searching && (
            <p className="text-xs text-huginn-text-muted p-3">Searching...</p>
          )}
          {!searching && results.length === 0 && (
            <p className="text-xs text-huginn-text-muted p-3">No results</p>
          )}
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 hover:bg-huginn-hover transition-colors flex items-center gap-2"
            >
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                r.type === 'thought' ? 'bg-huginn-accent/20 text-huginn-accent' : 'bg-huginn-success/20 text-huginn-success'
              }`}>
                {r.type === 'thought' ? 'thought' : 'task'}
              </span>
              <span className="text-xs text-huginn-text-primary truncate flex-1">{r.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
