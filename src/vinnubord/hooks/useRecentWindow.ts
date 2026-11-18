import { useCallback, useState } from 'react'
import { RECENT_KEY, parseRecentHours, type RecentHours } from '../lib/recent'

function read(): RecentHours {
  try {
    return parseRecentHours(localStorage.getItem(RECENT_KEY))
  } catch {
    return parseRecentHours(null)
  }
}

// The viewer's "nýlega breytt" window in hours, kept in localStorage under
// hg.recent: one choice per browser for every project.
export function useRecentWindow() {
  const [hours, setState] = useState<RecentHours>(read)
  const setHours = useCallback((next: RecentHours) => {
    try {
      localStorage.setItem(RECENT_KEY, String(next))
    } catch {
      // Storage can be blocked (private mode). The choice still holds for this page.
    }
    setState(next)
  }, [])
  return { hours, setHours }
}
