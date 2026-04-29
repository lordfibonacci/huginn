import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabase'
import { RUNES } from './index'
import type { RuneDefinition } from './types'
import type { BoardRune } from '../shared/lib/types'

export function useEnabledRunes(projectId: string | undefined) {
  const [rows, setRows] = useState<BoardRune[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRunes = useCallback(async () => {
    if (!projectId) { setRows([]); setLoading(false); return }
    const { data, error } = await supabase
      .from('huginn_board_runes')
      .select('*')
      .eq('project_id', projectId)
    if (error) { console.error('Failed to fetch board runes:', error); return }
    setRows((data ?? []) as BoardRune[])
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchRunes() }, [fetchRunes])

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`huginn_board_runes_${projectId}_${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'huginn_board_runes',
        filter: `project_id=eq.${projectId}`,
      }, () => fetchRunes())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchRunes])

  const enabled = useMemo<RuneDefinition[]>(
    () => rows
      .filter(r => r.enabled)
      .map(r => RUNES.find(def => def.id === r.rune_id))
      .filter((d): d is RuneDefinition => !!d),
    [rows],
  )

  const settingsById = useMemo(
    () => new Map(rows.map(r => [r.rune_id, r.settings])),
    [rows],
  )

  const toggle = useCallback(async (runeId: string, next: boolean) => {
    if (!projectId) return
    const def = RUNES.find(r => r.id === runeId)
    const { error } = await supabase
      .from('huginn_board_runes')
      .upsert({ project_id: projectId, rune_id: runeId, enabled: next }, { onConflict: 'project_id,rune_id' })
    if (error) { console.error('Failed to toggle rune:', error); return }
    if (next && def?.onEnable) await def.onEnable(projectId)
    if (!next && def?.onDisable) await def.onDisable(projectId)
  }, [projectId])

  return { enabled, rows, settingsById, loading, toggle }
}
