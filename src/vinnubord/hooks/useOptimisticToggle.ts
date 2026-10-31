import { useEffect, useState } from 'react'
import { useAsyncAction } from './useAsyncAction'

// A check box backed by the database: it flips at once, then follows the live
// value again when the realtime refetch brings the saved value, or right
// away when the save fails.
export function useOptimisticToggle(value: boolean, save: (next: boolean) => Promise<void>) {
  const [pending, setPending] = useState<boolean | null>(null)
  const { busy, error, run } = useAsyncAction()

  useEffect(() => {
    setPending(null)
  }, [value])

  const toggle = async () => {
    const next = !(pending ?? value)
    setPending(next)
    const ok = await run(() => save(next))
    if (!ok) setPending(null)
  }

  return { checked: pending ?? value, busy, error, toggle }
}
