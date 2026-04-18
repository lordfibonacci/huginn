import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

export function useProfileSearch(query: string, excludeIds: string[] = []) {
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const handle = setTimeout(async () => {
      const escaped = trimmed.replace(/[%_]/g, (c) => `\\${c}`)
      const { data, error } = await supabase
        .from('huginn_profiles')
        .select('*')
        .or(`email.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
        .limit(8)

      if (cancelled) return
      if (error) {
        console.error('Profile search failed:', error)
        setResults([])
      } else {
        const filtered = (data as Profile[]).filter(p => !excludeIds.includes(p.id))
        setResults(filtered)
      }
      setLoading(false)
    }, 220)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, excludeIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  return { results, loading }
}
