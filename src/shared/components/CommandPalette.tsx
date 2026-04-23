import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ModalShell } from './ModalShell'
import { useCommandPalette } from '../hooks/useCommandPalette'
import { useProjects } from '../../features/projects/hooks/useProjects'
import { ProjectGlyph } from '../../features/projects/components/ProjectGlyph'
import { supabase } from '../lib/supabase'

interface CardHit {
  id: string
  title: string
  project_id: string | null
}

type ResultKind = 'action' | 'board' | 'card'

interface ResultItem {
  kind: ResultKind
  id: string
  label: string
  subLabel?: string
  projectColor?: string
  onSelect: () => void
}

export function CommandPalette() {
  const { t } = useTranslation()
  const { isOpen, close } = useCommandPalette()
  const navigate = useNavigate()
  const { projects } = useProjects()
  const [query, setQuery] = useState('')
  const [cards, setCards] = useState<CardHit[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setCards([])
      setSelectedIdx(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  // Debounced card search. Only fires when there's a query — empty palette is
  // nav-only for fast access to Today/Inbox/Boards/Calendar/Settings.
  useEffect(() => {
    if (!isOpen) return
    const q = query.trim()
    if (!q) { setCards([]); return }
    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from('huginn_tasks')
        .select('id, title, project_id')
        .ilike('title', `%${q}%`)
        .eq('archived', false)
        .limit(10)
      if (!error) setCards((data ?? []) as CardHit[])
    }, 250)
    return () => clearTimeout(handle)
  }, [query, isOpen])

  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase()
    const out: ResultItem[] = []

    const navActions: Array<{ id: string; labelKey: string; path: string }> = [
      { id: 'today', labelKey: 'palette.actions.today', path: '/today' },
      { id: 'inbox', labelKey: 'palette.actions.inbox', path: '/inbox' },
      { id: 'projects', labelKey: 'palette.actions.projects', path: '/projects' },
      { id: 'calendar', labelKey: 'palette.actions.calendar', path: '/calendar' },
      { id: 'settings', labelKey: 'palette.actions.settings', path: '/settings' },
    ]
    for (const a of navActions) {
      const label = t(a.labelKey)
      if (!q || label.toLowerCase().includes(q)) {
        out.push({
          kind: 'action',
          id: `action-${a.id}`,
          label,
          onSelect: () => { navigate(a.path); close() },
        })
      }
    }

    if (q) {
      for (const p of projects) {
        if (p.name.toLowerCase().includes(q)) {
          out.push({
            kind: 'board',
            id: `board-${p.id}`,
            label: p.name,
            projectColor: p.color,
            onSelect: () => { navigate(`/projects/${p.id}`); close() },
          })
          if (out.filter(r => r.kind === 'board').length >= 5) break
        }
      }
    }

    for (const c of cards) {
      const proj = c.project_id ? projects.find(p => p.id === c.project_id) : undefined
      out.push({
        kind: 'card',
        id: `card-${c.id}`,
        label: c.title,
        subLabel: proj?.name ?? t('palette.inboxLabel'),
        projectColor: proj?.color,
        onSelect: () => {
          if (c.project_id) navigate(`/projects/${c.project_id}?card=${c.id}`)
          else navigate('/inbox')
          close()
        },
      })
    }

    return out
  }, [query, cards, projects, navigate, close, t])

  // Clamp selection when result list shrinks.
  useEffect(() => {
    if (selectedIdx >= results.length) setSelectedIdx(Math.max(0, results.length - 1))
  }, [results.length, selectedIdx])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, Math.max(0, results.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = results[selectedIdx]
      if (item) item.onSelect()
    }
  }

  if (!isOpen) return null

  // Group for rendering while keeping a flat index for keyboard navigation.
  const grouped: Record<ResultKind, ResultItem[]> = { action: [], board: [], card: [] }
  for (const r of results) grouped[r.kind].push(r)

  const flatIndex = (item: ResultItem) => results.indexOf(item)

  return (
    <ModalShell onDismiss={close}>
      <div className="flex items-center gap-3 border-b border-huginn-border pb-3 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-text-muted shrink-0">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.36 9.85l3.4 3.4a.75.75 0 0 0 1.06-1.06l-3.4-3.4A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('palette.placeholder')}
          className="flex-1 bg-transparent text-sm text-huginn-text-primary outline-none placeholder-huginn-text-muted pr-6"
        />
        <kbd className="hidden md:inline text-[10px] font-semibold text-huginn-text-muted bg-huginn-surface border border-huginn-border rounded px-1.5 py-0.5">
          ESC
        </kbd>
      </div>

      <div className="max-h-[50vh] overflow-y-auto -mx-2">
        {results.length === 0 && (
          <p className="text-xs text-huginn-text-muted px-3 py-6 text-center">
            {t('palette.empty')}
          </p>
        )}
        {(['action', 'board', 'card'] as ResultKind[]).map(kind => {
          const items = grouped[kind]
          if (items.length === 0) return null
          return (
            <div key={kind} className="mb-2">
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-huginn-text-muted">
                {t(`palette.sections.${kind}s`)}
              </p>
              <div className="space-y-0.5">
                {items.map(item => {
                  const idx = flatIndex(item)
                  const isActive = idx === selectedIdx
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onClick={item.onSelect}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors ${
                        isActive ? 'bg-huginn-accent/15 text-huginn-text-primary' : 'text-huginn-text-secondary hover:bg-huginn-hover'
                      }`}
                    >
                      {item.projectColor ? (
                        <ProjectGlyph color={item.projectColor} size={14} glow={false} />
                      ) : (
                        <span className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="text-sm flex-1 truncate">{item.label}</span>
                      {item.subLabel && (
                        <span className="text-[11px] text-huginn-text-muted truncate max-w-[120px]">{item.subLabel}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </ModalShell>
  )
}
