import { useCallback, useEffect, useRef, useState } from 'react'
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
// only against a loaded, non empty list of this project's views, so neither
// the empty placeholder before load nor the old project's views after a
// switch wipe a valid key. An id set by choose is spared until it has shown up
// in views once (createView, choose, then the reload lands a moment later).
export function useActiveView(projectId: string, views: View[]) {
  const key = activeViewKey(projectId)
  const [state, setState] = useState(() => ({ key, id: projectId ? read(key) : null }))

  // A new project during render: adopt its stored choice before painting.
  let current = state
  if (state.key !== key) {
    current = { key, id: projectId ? read(key) : null }
    setState(current)
  }

  // The id chosen in this session that views has not shown yet.
  const unseen = useRef<string | null>(null)

  const view = resolveActiveView(current.id, views)

  useEffect(() => {
    if (current.id && current.id === unseen.current && view) unseen.current = null
    if (
      projectId &&
      current.id &&
      current.id !== unseen.current &&
      views.length > 0 &&
      views.every((v) => v.project_id === projectId) &&
      !view
    ) {
      write(current.key, null)
      setState((s) => (s.key === current.key ? { key: s.key, id: null } : s))
    }
  }, [projectId, current.key, current.id, views, view])

  const choose = useCallback(
    (id: string | null) => {
      if (!projectId) return
      unseen.current = id
      write(key, id)
      setState({ key, id })
    },
    [projectId, key],
  )

  return { view, choose }
}
