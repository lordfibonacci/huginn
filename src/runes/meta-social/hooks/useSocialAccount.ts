import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { SocialAccount } from '../../../shared/lib/types'

export function useSocialAccount(projectId: string | undefined) {
  const [account, setAccount] = useState<SocialAccount | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAccount = useCallback(async () => {
    if (!projectId) { setAccount(null); setLoading(false); return }
    const { data, error } = await supabase
      .from('huginn_social_accounts')
      .select('id, project_id, provider, fb_page_id, fb_page_name, ig_business_id, ig_username, token_expires_at, connected_by, created_at, updated_at')
      .eq('project_id', projectId)
      .eq('provider', 'meta')
      .maybeSingle()
    if (error) { console.error('Failed to fetch social account:', error); return }
    setAccount((data as SocialAccount) ?? null)
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAccount() }, [fetchAccount])

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`huginn_social_accounts_${projectId}_${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'huginn_social_accounts',
        filter: `project_id=eq.${projectId}`,
      }, () => fetchAccount())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchAccount])

  async function disconnect() {
    if (!account) return
    const { error } = await supabase.rpc('huginn_disconnect_social_account', { account_id: account.id })
    if (error) console.error('Failed to disconnect:', error)
  }

  return { account, loading, disconnect }
}
