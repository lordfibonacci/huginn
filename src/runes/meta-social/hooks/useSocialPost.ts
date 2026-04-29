import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { SocialPost, SocialPostStatus } from '../../../shared/lib/types'

export function useSocialPost(taskId: string | undefined) {
  const [post, setPost] = useState<SocialPost | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPost = useCallback(async () => {
    if (!taskId) { setPost(null); setLoading(false); return }
    const { data, error } = await supabase
      .from('huginn_social_posts')
      .select('*')
      .eq('task_id', taskId)
      .maybeSingle()
    if (error) { console.error('Failed to fetch social post:', error); return }
    setPost((data as SocialPost) ?? null)
    setLoading(false)
  }, [taskId])

  useEffect(() => { fetchPost() }, [fetchPost])

  useEffect(() => {
    if (!taskId) return
    const channel = supabase
      .channel(`huginn_social_posts_${taskId}_${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'huginn_social_posts',
        filter: `task_id=eq.${taskId}`,
      }, () => fetchPost())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [taskId, fetchPost])

  async function upsert(patch: Partial<SocialPost>) {
    if (!taskId) return
    const prev = post
    const next = { ...(post ?? makeEmpty(taskId)), ...patch }
    setPost(next)
    const { error } = await supabase
      .from('huginn_social_posts')
      .upsert({ ...next }, { onConflict: 'task_id' })
    if (error) { console.error('Failed to upsert social post:', error); setPost(prev); return false }
    return true
  }

  async function setStatus(status: SocialPostStatus, extra: Partial<SocialPost> = {}) {
    return upsert({ status, ...extra })
  }

  return { post, loading, upsert, setStatus }
}

function makeEmpty(taskId: string): SocialPost {
  return {
    task_id: taskId,
    platforms: { fb: false, ig: false },
    scheduled_at: null,
    timezone: 'UTC',
    caption_base: '',
    caption_ig: null,
    caption_fb: null,
    first_comment_ig: null,
    media_attachment_ids: [],
    status: 'draft',
    published_at: null,
    fb_post_id: null,
    ig_post_id: null,
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
