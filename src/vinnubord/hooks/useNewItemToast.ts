import { useCallback, useEffect, useRef, useState } from 'react'
import { newItemEvents, toastFor, type NewItemToast } from '../lib/toast'
import type { BoardData } from '../lib/types'

// The new item toast for one board (ruling R22). Every board load and
// realtime reload brings the event log; the ids of the first load of a
// project are only remembered, so nothing that was there at load ever
// toasts. After that, an item.created event by someone else that was not
// seen yet raises a toast for the newest such item.
export function useNewItemToast(data: BoardData | null, viewerId: string) {
  const [toast, setToast] = useState<NewItemToast | null>(null)
  const seen = useRef<{ projectId: string; ids: Set<string> } | null>(null)

  useEffect(() => {
    if (!data) return
    const projectId = data.project.id
    if (seen.current?.projectId !== projectId) {
      seen.current = { projectId, ids: new Set(data.events.map((e) => e.id)) }
      setToast(null)
      return
    }
    const ids = seen.current.ids
    const fresh = newItemEvents(ids, data.events, viewerId)
    for (const e of data.events) ids.add(e.id)
    for (let i = fresh.length - 1; i >= 0; i--) {
      const next = toastFor(fresh[i], data.items, data.participants)
      if (next) {
        setToast(next)
        break
      }
    }
  }, [data, viewerId])

  const dismiss = useCallback(() => setToast(null), [])
  return { toast, dismiss }
}
