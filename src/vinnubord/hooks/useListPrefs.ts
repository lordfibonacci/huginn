import { useCallback, useEffect, useState } from 'react'
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
// that project's own choice. A narrow board (below 1024 px) keeps its open
// state in memory only: it starts closed, a narrow open or close never writes
// storage, and a wide board always reads the stored choice.
export function useListPrefs(projectId: string, narrow: boolean) {
  const key = listKey(projectId)
  const [state, setState] = useState(() => ({ key, prefs: projectId ? read(key) : parseListPrefs(null) }))
  const [narrowOpen, setNarrowOpen] = useState(false)

  // A new project during render: adopt its stored choice before painting.
  let current = state
  if (state.key !== key) {
    current = { key, prefs: projectId ? read(key) : parseListPrefs(null) }
    setState(current)
  }

  // Closed whenever the width crosses 1024 px either way, so a narrow board
  // starts closed and a list opened there is gone by the next narrow visit.
  useEffect(() => {
    setNarrowOpen(false)
  }, [narrow])

  // Writes from the current state, then sets it, never inside an updater.
  const prefs = current.prefs
  const save = useCallback(
    (next: ListPrefs) => {
      if (!projectId) return
      write(key, next)
      setState({ key, prefs: next })
    },
    [key, projectId],
  )
  const setOpen = useCallback(
    (open: boolean) => {
      if (narrow) setNarrowOpen(open)
      else save({ ...prefs, open })
    },
    [narrow, prefs, save],
  )
  const toggle = useCallback(() => {
    if (narrow) setNarrowOpen((o) => !o)
    else save({ ...prefs, open: !prefs.open })
  }, [narrow, prefs, save])
  const setSort = useCallback((sort: Sort) => save({ ...prefs, sort }), [prefs, save])

  return { open: listOpen(prefs, narrow, narrowOpen), sort: prefs.sort, setOpen, toggle, setSort }
}
