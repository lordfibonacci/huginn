// Deno edge function. Exchanges an OAuth code for a long-lived Page token,
// discovers the IG Business ID, and upserts an encrypted row in huginn_social_accounts.
//
// Two-mode contract:
//   Mode A (first call, has the OAuth code): { project_id, code, redirect_uri }
//     - Exchanges code → short → long user token (one-shot; OAuth codes are single-use).
//     - If the user has exactly 1 manageable Page → auto-pick + finalize, return {step:'done'}.
//     - Otherwise → return {step:'select_page', pages, user_access_token} so the UI can render
//       a picker. The user_access_token is round-tripped through the browser so the second call
//       does NOT need to re-exchange the now-burned code.
//   Mode B (after picker): { project_id, user_access_token, selected_fb_page_id }
//     - Looks up the chosen page via the long-lived user token, finalizes.
//
// redirect_uri is supplied by the client (must match the OAuth dialog), so the same edge
// function works across localhost:* dev and prod without a Supabase secret per environment.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_APP_ID = Deno.env.get('META_APP_ID')!
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const HUGINN_TOKEN_ENCRYPTION_KEY_HEX = Deno.env.get('HUGINN_TOKEN_ENCRYPTION_KEY_HEX')!
const GRAPH = 'https://graph.facebook.com/v21.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReqBody {
  project_id: string
  code?: string
  redirect_uri?: string
  user_access_token?: string
  selected_fb_page_id?: string
}

interface FbPage { id: string; name: string; access_token: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  // Two clients: userClient runs as the authenticated user (overrides Authorization
  // header → PostgREST role = `authenticated`); serviceClient runs as service_role
  // (no auth override) for RPCs gated to service_role like huginn_encrypt_token.
  const authHeader = req.headers.get('Authorization') ?? ''
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const body = await req.json() as ReqBody
  const { project_id, code, redirect_uri, user_access_token, selected_fb_page_id } = body
  if (!project_id) return jsonError('bad_request', 'project_id required')

  const { data: canManage, error: canManageErr } = await userClient.rpc('huginn_can_manage_board', {
    p_project_id: project_id, p_user_id: user.id,
  })
  if (canManageErr) return jsonError('rpc_error', `huginn_can_manage_board: ${canManageErr.message}`)
  if (!canManage) return jsonError('forbidden', 'Not an admin/owner of this project.')

  let userToken: string
  if (code && redirect_uri) {
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', META_APP_ID)
    tokenUrl.searchParams.set('client_secret', META_APP_SECRET)
    tokenUrl.searchParams.set('redirect_uri', redirect_uri)
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
    if (!longRes.ok) return jsonError('long_token_exchange_failed', await longRes.text())
    const longJson = await longRes.json() as { access_token: string }
    userToken = longJson.access_token
  } else if (user_access_token) {
    userToken = user_access_token
  } else {
    return jsonError('bad_request', 'Need {code, redirect_uri} on first call or user_access_token on picker callback.')
  }

  const pagesRes = await fetch(`${GRAPH}/me/accounts?access_token=${userToken}`)
  if (!pagesRes.ok) return jsonError('list_pages_failed', await pagesRes.text())
  const pagesJson = await pagesRes.json() as { data: FbPage[] }
  if (!pagesJson.data?.length) return jsonError('no_pages', 'No manageable Facebook Pages found.')

  let page: FbPage | undefined
  if (selected_fb_page_id) {
    page = pagesJson.data.find(p => p.id === selected_fb_page_id)
    if (!page) return jsonError('page_not_found', 'Selected page not in the authorized list.')
  } else if (pagesJson.data.length === 1) {
    page = pagesJson.data[0]
  } else {
    return json({
      step: 'select_page',
      pages: pagesJson.data.map(p => ({ id: p.id, name: p.name })),
      user_access_token: userToken,
    })
  }

  const igRes = await fetch(`${GRAPH}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`)
  const igJson = await igRes.json() as { instagram_business_account?: { id: string; username: string } }

  const { data: enc, error: encErr } = await serviceClient.rpc('huginn_encrypt_token', {
    plain: page.access_token, key_hex: HUGINN_TOKEN_ENCRYPTION_KEY_HEX,
  })
  if (encErr) return jsonError('encrypt_failed', `huginn_encrypt_token: ${encErr.message}`)

  const { error: upsertErr } = await serviceClient
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
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
function jsonError(code: string, message: string) {
  return json({ error: code, message }, 400)
}
