// Deno edge function. Exchanges an OAuth code for a long-lived Page token,
// discovers the IG Business ID, and upserts an encrypted row in huginn_social_accounts.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_APP_ID = Deno.env.get('META_APP_ID')!
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const META_OAUTH_REDIRECT_URI = Deno.env.get('META_OAUTH_REDIRECT_URI')!
const HUGINN_TOKEN_ENCRYPTION_KEY_HEX = Deno.env.get('HUGINN_TOKEN_ENCRYPTION_KEY_HEX')!
const GRAPH = 'https://graph.facebook.com/v21.0'

interface ReqBody {
  code: string
  project_id: string
  selected_fb_page_id?: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json() as ReqBody
  const { code, project_id, selected_fb_page_id } = body
  if (!code || !project_id) return new Response('Missing params', { status: 400 })

  const { data: canManage } = await supabase.rpc('huginn_can_manage_board', {
    project_id, user_id: user.id,
  })
  if (!canManage) return new Response('Forbidden', { status: 403 })

  const tokenUrl = new URL(`${GRAPH}/oauth/access_token`)
  tokenUrl.searchParams.set('client_id', META_APP_ID)
  tokenUrl.searchParams.set('client_secret', META_APP_SECRET)
  tokenUrl.searchParams.set('redirect_uri', META_OAUTH_REDIRECT_URI)
  tokenUrl.searchParams.set('code', code)
  const shortRes = await fetch(tokenUrl)
  if (!shortRes.ok) return jsonError('oauth_exchange_failed', await shortRes.text())
  const shortJson = await shortRes.json() as { access_token: string }

  const longUrl = new URL(`${GRAPH}/oauth/access_token`)
  longUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longUrl.searchParams.set('client_id', META_APP_ID)
  longUrl.searchParams.set('client_secret', META_APP_SECRET)
  longUrl.searchParams.set('fb_exchange_token', shortJson.access_token)
  const longRes = await fetch(longUrl)
  const longJson = await longRes.json() as { access_token: string }

  const pagesRes = await fetch(`${GRAPH}/me/accounts?access_token=${longJson.access_token}`)
  const pagesJson = await pagesRes.json() as {
    data: Array<{ id: string, name: string, access_token: string }>
  }
  if (!pagesJson.data?.length) return jsonError('no_pages', 'No manageable Facebook Pages found.')

  if (!selected_fb_page_id) {
    return json({ step: 'select_page', pages: pagesJson.data.map(p => ({ id: p.id, name: p.name })) })
  }

  const page = pagesJson.data.find(p => p.id === selected_fb_page_id)
  if (!page) return jsonError('page_not_found', 'Selected page not in the authorized list.')

  const igRes = await fetch(`${GRAPH}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`)
  const igJson = await igRes.json() as { instagram_business_account?: { id: string, username: string } }

  const { data: enc, error: encErr } = await supabase.rpc('huginn_encrypt_token', {
    plain: page.access_token, key_hex: HUGINN_TOKEN_ENCRYPTION_KEY_HEX,
  })
  if (encErr) return jsonError('encrypt_failed', encErr.message)

  const { error: upsertErr } = await supabase
    .from('huginn_social_accounts')
    .upsert({
      project_id,
      provider: 'meta',
      fb_page_id: page.id,
      fb_page_name: page.name,
      ig_business_id: igJson.instagram_business_account?.id ?? null,
      ig_username: igJson.instagram_business_account?.username ?? null,
      access_token_encrypted: enc,
      // Page tokens from long-lived exchange do not expire.
      token_expires_at: null,
      connected_by: user.id,
    }, { onConflict: 'project_id,fb_page_id' })
  if (upsertErr) return jsonError('upsert_failed', upsertErr.message)

  return json({ step: 'done' })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
function jsonError(code: string, message: string) {
  return json({ error: code, message }, 400)
}
