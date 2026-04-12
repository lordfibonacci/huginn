import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useTaskCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const fetchCounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_tasks')
      .select('project_id')
      .neq('status', 'done')

    if (error) {
      console.error('Failed to fetch task counts:', error)
      return
    }

    const map: Record<string, number> = {}
    for (const row of data) {
      map[row.project_id] = (map[row.project_id] || 0) + 1
    }
    setCounts(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  return { counts, loading }
}
