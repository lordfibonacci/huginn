import { useCallback, useEffect, useState } from 'react'
import {
  emptyFilter,
  filterStorageKey,
  isActive,
  parseFilter,
  prunePackages,
  serializeFilter,
  toggleFilter,
  toggleUnread as toggleUnreadFilter,
  withoutPicks,
  withQuery,
  type Filter,
} from '../lib/filters'
import type { Tone } from '../lib/status'

function read(key: string): Filter {
  try {
    return parseFilter(sessionStorage.getItem(key))
  } catch {
    return emptyFilter()
  }
}

function write(key: string, f: Filter) {
  try {
    if (isActive(f)) sessionStorage.setItem(key, serializeFilter(f))
    else sessionStorage.removeItem(key)
  } catch {
    // Storage can be blocked (private mode). The filter still works for this page.
  }
}

// The board filter of one project, kept in sessionStorage under
// hg.filter.<projectId> so it survives a reload but not a new tab. Switching
// project reads that project's own filter.
export function useFilter(projectId: string) {
  const key = filterStorageKey(projectId)
  const [state, setState] = useState(() => ({ key, filter: read(key) }))

  // A new project during render: adopt its stored filter before painting.
  let current = state
  if (state.key !== key) {
    current = { key, filter: read(key) }
    setState(current)
  }

  useEffect(() => {
    write(state.key, state.filter)
  }, [state])

  const update = useCallback(
    (fn: (f: Filter) => Filter) =>
      setState((s) => {
        if (s.key !== key) return s
        const filter = fn(s.filter)
        return filter === s.filter ? s : { key, filter }
      }),
    [key],
  )
  const toggleTone = useCallback((tone: Tone) => update((f) => toggleFilter(f, 'tones', tone)), [update])
  const togglePackage = useCallback((id: string) => update((f) => toggleFilter(f, 'packages', id)), [update])
  const toggleTag = useCallback((tag: string) => update((f) => toggleFilter(f, 'tags', tag)), [update])
  const toggleUnread = useCallback(() => update((f) => toggleUnreadFilter(f)), [update])
  const setQuery = useCallback((q: string) => update((f) => withQuery(f, q)), [update])
  const clear = useCallback(() => update(() => emptyFilter()), [update])
  // Clear the chosen packages and tags only, what the filter button counts.
  const clearPicks = useCallback(() => update(withoutPicks), [update])
  // Forget package ids that are not on the board (called when packages load).
  const keepPackages = useCallback((known: Set<string>) => update((f) => prunePackages(f, known)), [update])

  const filter = current.filter
  return { filter, toggleTone, togglePackage, toggleTag, toggleUnread, setQuery, clear, clearPicks, keepPackages, active: isActive(filter) }
}

export type FilterApi = ReturnType<typeof useFilter>
