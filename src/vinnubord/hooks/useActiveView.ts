import { useCallback, useEffect, useState } from 'react'
import { activeViewKey, resolveActiveView } from '../lib/views'
import type { View } from '../lib/types'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, id: string | null) {
  try {
    if (id) localStorage.setItem(key, id)
    else localStorage.removeItem(key)
  } catch {
    // Storage can be blocked (private mode). The choice still holds for this page.
  }
}

// The view this browser has chosen for one project, kept in localStorage under
// hg.view.<projectId>. Other participants and other browsers choose their own.
// A stored id that no longer resolves (the view was deleted) is cleared, but
// only against a loaded, non empty list, so the empty placeholder before the
// board loads never wipes a valid key.
export function useActiveView(projectId: string, views: View[]) {
  const key = activeViewKey(projectId)
  const [state, setState] = useState(() => ({ key, id: projectId ? read(key) : null }))

  // A new project during render: adopt its stored choice before painting.
  let current = state
  if (state.key !== key) {
    current = { key, id: projectId ? read(key) : null }
    setState(current)
  }

  const view = resolveActiveView(current.id, views)

  useEffect(() => {
    if (projectId && current.id && views.length > 0 && !resolveActiveView(current.id, views)) {
      write(current.key, null)
      setState((s) => (s.key === current.key ? { key: s.key, id: null } : s))
    }
  }, [projectId, current.key, current.id, views])

  const choose = useCallback(
    (id: string | null) => {
      if (!projectId) return
      write(key, id)
      setState({ key, id })
    },
    [projectId, key],
  )

  return { view, choose }
}
