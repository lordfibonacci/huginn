import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { loadBoard } from '../lib/api'
import type { BoardData } from '../lib/types'

// Tables in the supabase_realtime publication. hg_projects and hg_participants
// are not published, so they are not subscribed to.
const REALTIME_TABLES = [
  'hg_items',
  'hg_plans',
  'hg_files',
  'hg_questions',
  'hg_actions',
  'hg_rulings',
  'hg_comments',
  'hg_events',
  'hg_reads',
  'hg_modules',
  'hg_packages',
] as const

const RELOAD_DEBOUNCE_MS = 150

export function useBoardData(projectId: string | null | undefined) {
  const [data, setData] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Whether the realtime channel is subscribed (ruling R17), for the "Lifandi" dot.
  const [live, setLive] = useState(false)
  // Only the newest request may write state, so a slow older response
  // cannot overwrite a newer board.
  const requestRef = useRef(0)

  const reload = useCallback(async () => {
    if (!projectId) return
    const request = ++requestRef.current
    try {
      const board = await loadBoard(projectId)
      if (request !== requestRef.current) return
      setData(board)
      setError(null)
    } catch (e) {
      if (request !== requestRef.current) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setData(null)
    setError(null)
    setLive(false)
    if (!projectId) {
      requestRef.current++
      setLoading(false)
      return
    }
    setLoading(true)
    void reload()

    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleReload = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void reload()
      }, RELOAD_DEBOUNCE_MS)
    }

    const channel = supabase.channel(`hg_${projectId}_${crypto.randomUUID()}`)
    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `project_id=eq.${projectId}` },
        scheduleReload,
      )
    }
    let active = true
    channel.subscribe((status) => {
      if (!active) return
      if (status === 'SUBSCRIBED') setLive(true)
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setLive(false)
    })

    return () => {
      active = false
      if (timer) clearTimeout(timer)
      requestRef.current++
      void supabase.removeChannel(channel)
    }
  }, [projectId, reload])

  return { data, loading, error, reload, live }
}
