import { useCallback, useState } from 'react'
import { listKey, listOpen, parseListPrefs, serializeListPrefs, type ListPrefs, type Sort } from '../lib/list'

function read(key: string): ListPrefs {
  try {
    return parseListPrefs(localStorage.getItem(key))
  } catch {
    return parseListPrefs(null)
  }
}

function write(key: string, prefs: ListPrefs) {
  try {
    localStorage.setItem(key, serializeListPrefs(prefs))
  } catch {
    // Storage can be blocked (private mode). The choice still holds for this page.
  }
}

// The list drawer of one project in this browser, kept in localStorage under
// hg.list.<projectId>: open or closed, and the sort. Switching project reads
// that project's own choice. The narrow board is wired later; for now every
// board reads the stored state and a narrow one reads closed.
export function useListPrefs(projectId: string, narrow: boolean) {
  const key = listKey(projectId)
  const [state, setState] = useState(() => ({ key, prefs: projectId ? read(key) : parseListPrefs(null) }))

  // A new project during render: adopt its stored choice before painting.
  let current = state
  if (state.key !== key) {
    current = { key, prefs: projectId ? read(key) : parseListPrefs(null) }
    setState(current)
  }

  // Writing in the updater is idempotent, so a repeated call writes the same value.
  const update = useCallback(
    (fn: (p: ListPrefs) => ListPrefs) =>
      setState((s) => {
        if (s.key !== key || !projectId) return s
        const prefs = fn(s.prefs)
        write(key, prefs)
        return { key, prefs }
      }),
    [key, projectId],
  )
  const setOpen = useCallback((open: boolean) => update((p) => ({ ...p, open })), [update])
  const toggle = useCallback(() => update((p) => ({ ...p, open: !p.open })), [update])
  const setSort = useCallback((sort: Sort) => update((p) => ({ ...p, sort })), [update])

  return { open: listOpen(current.prefs, narrow, false), sort: current.prefs.sort, setOpen, toggle, setSort }
}
