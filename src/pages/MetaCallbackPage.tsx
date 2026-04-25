import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../shared/lib/supabase'

type Phase = 'verifying' | 'picking' | 'saving' | 'done' | 'error'

interface PageOpt { id: string; name: string }

export default function MetaCallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [phase, setPhase] = useState<Phase>('verifying')
  const [pages, setPages] = useState<PageOpt[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [code, setCode] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    void (async () => {
      const codeParam = params.get('code')
      const stateParam = params.get('state')
      const errorParam = params.get('error_description') || params.get('error')
      if (errorParam) { setError(errorParam); setPhase('error'); return }
      if (!codeParam || !stateParam) { setError('missing_params'); setPhase('error'); return }

      let parsed: { project_id: string; csrf: string }
      try { parsed = JSON.parse(atob(stateParam)) } catch { setError('bad_state'); setPhase('error'); return }
      const expectedCsrf = sessionStorage.getItem('huginn.meta.oauth.csrf')
      if (!expectedCsrf || expectedCsrf !== parsed.csrf) { setError('csrf_mismatch'); setPhase('error'); return }

      setCode(codeParam)
      setProjectId(parsed.project_id)

      const { data, error: fnErr } = await supabase.functions.invoke('meta-oauth-complete', {
        body: { code: codeParam, project_id: parsed.project_id },
      })
      if (fnErr || !data) { setError(fnErr?.message ?? 'invoke_failed'); setPhase('error'); return }
      if ((data as { error?: string }).error) { setError((data as { message?: string }).message ?? 'unknown_error'); setPhase('error'); return }
      if ((data as { step: string }).step === 'select_page') {
        setPages((data as { pages: PageOpt[] }).pages)
        setPhase('picking')
      } else {
        sessionStorage.removeItem('huginn.meta.oauth.csrf')
        setPhase('done')
        setTimeout(() => navigate(`/projects/${parsed.project_id}`), 800)
      }
    })()
  }, [params, navigate])

  async function choosePage(pageId: string) {
    setPhase('saving')
    const { data, error: fnErr } = await supabase.functions.invoke('meta-oauth-complete', {
      body: { code, project_id: projectId, selected_fb_page_id: pageId },
    })
    if (fnErr || (data as { error?: string })?.error) {
      setError((data as { message?: string })?.message ?? fnErr?.message ?? 'save_failed')
      setPhase('error'); return
    }
    sessionStorage.removeItem('huginn.meta.oauth.csrf')
    setPhase('done')
    setTimeout(() => navigate(`/projects/${projectId}`), 800)
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-huginn-danger text-lg">{t('runes.meta-social.oauthError')}</div>
          <div className="text-xs text-huginn-text-secondary break-words">{error}</div>
          <button onClick={() => navigate('/projects')}
            className="px-3 py-1.5 rounded-md bg-huginn-accent hover:bg-huginn-accent-hover text-white text-sm transition-colors">
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'picking') {
    return (
      <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-3">
          <div className="text-huginn-text-primary">{t('runes.meta-social.pickPage')}</div>
          <div className="space-y-2">
            {pages.map(p => (
              <button key={p.id} onClick={() => choosePage(p.id)}
                className="w-full text-left px-3 py-2 rounded-md bg-huginn-card border border-huginn-border hover:border-huginn-accent text-sm text-huginn-text-primary transition-colors">
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-huginn-surface flex items-center justify-center p-6">
      <div className="text-huginn-text-secondary">{t('common.loading')}</div>
    </div>
  )
}
