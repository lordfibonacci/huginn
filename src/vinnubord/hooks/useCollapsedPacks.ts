import { useCallback, useState } from 'react'
import { packsKey, parseCollapsed, serializeCollapsed } from '../lib/packs'

function read(key: string): Set<string> {
  try {
    return parseCollapsed(localStorage.getItem(key))
  } catch {
    return new Set()
  }
}

function write(key: string, ids: ReadonlySet<string>) {
  try {
    localStorage.setItem(key, serializeCollapsed(ids))
  } catch {
    // Storage can be blocked (private mode). The fold still holds for this page.
  }
}

// The folded pack columns of one project in this browser, kept in localStorage
// under hg.packs.<projectId>. Switching project reads that project's own set.
// Every toggle writes at once; expand of a pack that is not folded does nothing.
export function useCollapsedPacks(projectId: string) {
  const key = packsKey(projectId)
  const [state, setState] = useState(() => ({ key, ids: projectId ? read(key) : new Set<string>() }))

  // A new project during render: adopt its stored set before painting.
  let current = state
  if (state.key !== key) {
    current = { key, ids: projectId ? read(key) : new Set<string>() }
    setState(current)
  }

  // Writes from the current state, then sets it, never inside an updater.
  const ids = current.ids
  const save = useCallback(
    (next: Set<string>) => {
      if (!projectId) return
      write(key, next)
      setState({ key, ids: next })
    },
    [key, projectId],
  )
  const toggle = useCallback(
    (packId: string) => {
      const next = new Set(ids)
      if (next.has(packId)) next.delete(packId)
      else next.add(packId)
      save(next)
    },
    [ids, save],
  )
  const expand = useCallback(
    (packId: string) => {
      if (!ids.has(packId)) return
      const next = new Set(ids)
      next.delete(packId)
      save(next)
    },
    [ids, save],
  )

  return { collapsed: ids as ReadonlySet<string>, toggle, expand }
}
