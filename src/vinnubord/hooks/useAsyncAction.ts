import { useCallback, useEffect, useRef, useState } from 'react'

// One button's save: busy while it runs, the error message if it failed.
// Errors are shown next to the control and logged, never thrown into render.
export function useAsyncAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const run = useCallback(async (fn: () => Promise<void>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      console.error(e)
      if (alive.current) setError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      if (alive.current) setBusy(false)
    }
  }, [])

  return { busy, error, run }
}
