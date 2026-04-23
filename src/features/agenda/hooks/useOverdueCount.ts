import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'

function localDateIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Lightweight count for the BottomNav Today tab badge. Separate from
// useAgendaTasks so the BottomNav doesn't pay for the full agenda fetch.
export function useOverdueCount(): number {
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    const today = localDateIso(new Date())
    const { count: c, error } = await supabase
      .from('huginn_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('archived', false)
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .lte('due_date', today)
      .not('project_id', 'is', null)

    if (error) {
      console.error('Failed to count overdue tasks:', error)
      return
    }
    setCount(c ?? 0)
  }, [])

  useEffect(() => { fetchCount() }, [fetchCount])

  useEffect(() => {
    const channel = supabase
      .channel(`huginn_overdue_${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_tasks' }, () => fetchCount())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCount])

  return count
}
