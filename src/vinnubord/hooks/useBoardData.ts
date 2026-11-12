import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'
import { loadBoard } from '../lib/api'
import { channelStep, healDelay, isPostgresReady, wakePlan } from '../lib/realtime'
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
  'hg_views',
  'hg_tags',
  'hg_view_positions',
  'hg_view_pack_positions',
  'hg_zones',
  'hg_view_zone_positions',
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
  // When the last load began, or 0 after one that failed, for the wake rule.
  const loadAtRef = useRef(0)

  const reload = useCallback(async () => {
    if (!projectId) return
    const request = ++requestRef.current
    loadAtRef.current = Date.now()
    try {
      const board = await loadBoard(projectId)
      if (request !== requestRef.current) return
      setData(board)
      setError(null)
    } catch (e) {
      if (request !== requestRef.current) return
      // A failed load counts as no load, so the next wake tries again.
      loadAtRef.current = 0
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

    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleReload = () => {
      if (!active) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void reload()
      }, RELOAD_DEBOUNCE_MS)
    }

    // The one current channel. A channel the server closes (CLOSED) never
    // rejoins on its own, so it is replaced, never revived.
    let channel: RealtimeChannel | null = null
    let isLive = false
    let lost = false
    // After a gap: one more reload when the server says the stream is on.
    let recheck = false
    let connectAt = 0
    // Only the newest connect may build a channel.
    let generation = 0
    let healTimer: ReturnType<typeof setTimeout> | null = null
    let healAttempt = 0

    // Runs connect again unless the channel goes live first.
    const armHeal = () => {
      if (healTimer) clearTimeout(healTimer)
      healTimer = setTimeout(() => {
        healTimer = null
        void connect(true)
      }, healDelay(healAttempt++))
    }

    // refresh false builds the channel in this tick, with the token realtime
    // already holds. The first connect of an effect must do that: on a project
    // change the cleanup just before it removed the last channel, and
    // removeChannel disconnects the socket a moment later unless a channel
    // exists again by then. Every later connect is a rebuild and reads the
    // session first.
    const connect = async (refresh: boolean) => {
      const mine = ++generation
      connectAt = Date.now()
      armHeal()
      if (refresh) {
        // The socket itself is down: a new channel could only queue its join.
        // The client rejoins a channel that errored when the socket opens, and
        // a closed one is replaced by the next heal once the socket is up.
        if (channel && !supabase.realtime.isConnected()) {
          try {
            supabase.realtime.connect()
          } catch {
            // The next heal tries again.
          }
          return
        }
        try {
          // A hidden tab stops refreshing the session, and realtime only gets a
          // new token when a refresh happens: read the session, which
          // refreshes an expired one, then hand the token over.
          const { data: auth } = await supabase.auth.getSession()
          if (auth.session) await supabase.realtime.setAuth(auth.session.access_token)
        } catch {
          // The join fails without a valid token and the heal timer tries again.
        }
        if (!active || mine !== generation) return
        // The channel recovered by itself while the session was read.
        if (isLive && channel) {
          if (healTimer) {
            clearTimeout(healTimer)
            healTimer = null
          }
          return
        }
      }

      const old = channel
      const next = supabase.channel(`hg_${projectId}_${crypto.randomUUID()}`)
      for (const table of REALTIME_TABLES) {
        next.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `project_id=eq.${projectId}` },
          scheduleReload,
        )
      }
      next.on('system', {}, (payload: unknown) => {
        if (channel !== next || !recheck || !isPostgresReady(payload)) return
        recheck = false
        scheduleReload()
      })
      channel = next
      if (old) {
        // Changes between the two channels are fetched when the new one subscribes.
        lost = true
        void supabase.removeChannel(old)
      }
      next.subscribe((status) => {
        // A replaced channel still reports CLOSED when it is removed.
        if (!active || channel !== next) return
        const step = channelStep(lost, status)
        lost = step.lost
        if (step.live !== null) {
          isLive = step.live
          setLive(step.live)
        }
        if (step.live === true) {
          healAttempt = 0
          if (healTimer) {
            clearTimeout(healTimer)
            healTimer = null
          }
        }
        if (step.live === false && !healTimer) armHeal()
        // Back after a gap: fetch what changed while the channel was down, and
        // once more when the stream is on (the system notice above).
        if (step.reload) {
          recheck = true
          scheduleReload()
        }
      })
    }

    // The tab is shown again, the window gets focus, the network returns, or
    // a press lands while the board is not live.
    const wake = (show: boolean) => {
      if (!active || document.visibilityState === 'hidden') return
      const now = Date.now()
      const plan = wakePlan(isLive, now - loadAtRef.current, now - connectAt, show)
      if (plan.reconnect) {
        healAttempt = 0
        void connect(true)
      }
      if (plan.reload) scheduleReload()
    }
    const onShow = () => wake(true)
    const onPress = () => wake(false)
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    window.addEventListener('online', onShow)
    // Capture phase: the board stops some presses before they bubble.
    window.addEventListener('pointerdown', onPress, true)

    // No await before the first channel, see connect.
    void connect(false)

    return () => {
      active = false
      if (timer) clearTimeout(timer)
      if (healTimer) clearTimeout(healTimer)
      document.removeEventListener('visibilitychange', onShow)
      window.removeEventListener('focus', onShow)
      window.removeEventListener('online', onShow)
      window.removeEventListener('pointerdown', onPress, true)
      requestRef.current++
      if (channel) void supabase.removeChannel(channel)
    }
  }, [projectId, reload])

  return { data, loading, error, reload, live }
}
