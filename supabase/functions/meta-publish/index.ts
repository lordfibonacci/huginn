// Deno edge function. Publishes a scheduled social post to Meta (FB Page + IG Business).
// Called by pg_cron with a shared-secret bearer. Uses service-role to read encrypted token + mark status.
//
// No CORS handlers — invoked server-side by pg_cron (Task 14), never from a browser.
// Service-role only — runs as service_role for full DB access; no end-user JWT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_PUBLISH_SECRET = Deno.env.get('META_PUBLISH_SECRET')!
const HUGINN_TOKEN_ENCRYPTION_KEY_HEX = Deno.env.get('HUGINN_TOKEN_ENCRYPTION_KEY_HEX')!
const GRAPH = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const auth = req.headers.get('Authorization') ?? ''
  if (auth !== `Bearer ${META_PUBLISH_SECRET}`) return new Response('Unauthorized', { status: 401 })

  const { post_id } = await req.json() as { post_id: string }
  if (!post_id) return new Response('Missing post_id', { status: 400 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // Load post + task + account + media URLs.
    const { data: post, error: postErr } = await supabase
      .from('huginn_social_posts').select('*').eq('task_id', post_id).single()
    if (postErr || !post) throw new Error(`post_not_found: ${postErr?.message}`)

    const { data: task, error: taskErr } = await supabase
      .from('huginn_tasks').select('project_id').eq('id', post.task_id).single()
    if (taskErr || !task?.project_id) throw new Error('task_not_found')

    const { data: account, error: accErr } = await supabase
      .from('huginn_social_accounts')
      .select('fb_page_id, ig_business_id, access_token_encrypted')
      .eq('project_id', task.project_id).eq('provider', 'meta').single()
    if (accErr || !account) throw new Error('account_not_found')

    const { data: token, error: decErr } = await supabase.rpc('huginn_decrypt_token', {
      cipher: account.access_token_encrypted, key_hex: HUGINN_TOKEN_ENCRYPTION_KEY_HEX,
    })
    if (decErr || !token) throw new Error(`decrypt_failed: ${decErr?.message}`)

    // Resolve media URLs (ordered).
    const { data: atts, error: attErr } = await supabase
      .from('huginn_attachments')
      .select('id, url, type, mime_type')
      .in('id', post.media_attachment_ids)
    if (attErr) throw new Error(`attachments_lookup: ${attErr.message}`)
    const attIndex = new Map(atts!.map(a => [a.id, a]))
    const ordered = post.media_attachment_ids
      .map((id: string) => attIndex.get(id))
      .filter((a: any) => !!a)
    if (ordered.length === 0) throw new Error('no_media')

    const fbCaption = post.caption_fb ?? post.caption_base
    const igCaption = post.caption_ig ?? post.caption_base

    let fb_post_id: string | null = null
    let ig_post_id: string | null = null

    // --- FB publish ---
    if (post.platforms.fb) {
      fb_post_id = await publishFb({
        pageId: account.fb_page_id, token, media: ordered, message: fbCaption,
      })
    }

    // --- IG publish ---
    if (post.platforms.ig && account.ig_business_id) {
      ig_post_id = await publishIg({
        igUser: account.ig_business_id, token, media: ordered, caption: igCaption,
        firstComment: post.first_comment_ig,
      })
    }

    await supabase.from('huginn_social_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      fb_post_id, ig_post_id,
      error_message: null,
    }).eq('task_id', post_id)

    return json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabase.from('huginn_social_posts').update({
      status: 'failed', error_message: msg.slice(0, 500),
    }).eq('task_id', post_id)
    return json({ ok: false, error: msg }, 500)
  }
})

// ---- platform helpers ----

async function publishFb({ pageId, token, media, message }: {
  pageId: string, token: string, media: Array<{ url: string, type: string, mime_type?: string }>, message: string,
}): Promise<string> {
  const isVideo = media.length === 1 && (media[0].type === 'video' || media[0].mime_type?.startsWith('video/'))
  if (isVideo) {
    const form = new FormData()
    form.set('file_url', media[0].url); form.set('description', message); form.set('access_token', token)
    const res = await fetch(`${GRAPH}/${pageId}/videos`, { method: 'POST', body: form })
    const json = await res.json()
    if (!res.ok) throw new Error(`fb_video: ${JSON.stringify(json)}`)
    return json.id
  }
  if (media.length === 1) {
    const form = new FormData()
    form.set('url', media[0].url); form.set('message', message); form.set('access_token', token)
    const res = await fetch(`${GRAPH}/${pageId}/photos`, { method: 'POST', body: form })
    const json = await res.json()
    if (!res.ok) throw new Error(`fb_photo: ${JSON.stringify(json)}`)
    return json.post_id ?? json.id
  }
  // Multi-image: unpublished children + feed post with attached_media.
  const childIds: string[] = []
  for (const m of media) {
    const form = new FormData()
    form.set('url', m.url); form.set('published', 'false'); form.set('access_token', token)
    const r = await fetch(`${GRAPH}/${pageId}/photos`, { method: 'POST', body: form })
    const j = await r.json()
    if (!r.ok) throw new Error(`fb_child_photo: ${JSON.stringify(j)}`)
    childIds.push(j.id)
  }
  const feedForm = new FormData()
  feedForm.set('message', message)
  feedForm.set('access_token', token)
  feedForm.set('attached_media', JSON.stringify(childIds.map(id => ({ media_fbid: id }))))
  const r = await fetch(`${GRAPH}/${pageId}/feed`, { method: 'POST', body: feedForm })
  const j = await r.json()
  if (!r.ok) throw new Error(`fb_feed: ${JSON.stringify(j)}`)
  return j.id
}

async function publishIg({ igUser, token, media, caption, firstComment }: {
  igUser: string, token: string, media: Array<{ url: string, type: string, mime_type?: string }>,
  caption: string, firstComment: string | null,
}): Promise<string> {
  const isVideo = media.length === 1 && (media[0].type === 'video' || media[0].mime_type?.startsWith('video/'))
  let creationId: string

  if (isVideo) {
    creationId = await waitForContainer(await createIgContainer({
      igUser, token, body: { media_type: 'REELS', video_url: media[0].url, caption },
    }), token)
  } else if (media.length === 1) {
    creationId = await createIgContainer({
      igUser, token, body: { image_url: media[0].url, caption },
    })
  } else {
    // Carousel: create child containers (no caption), then parent with children ids.
    const children: string[] = []
    for (const m of media) {
      const id = await createIgContainer({ igUser, token, body: { image_url: m.url, is_carousel_item: true } })
      children.push(id)
    }
    creationId = await createIgContainer({
      igUser, token,
      body: { media_type: 'CAROUSEL', children: children.join(','), caption },
    })
  }

  // Publish the container.
  const pubForm = new FormData()
  pubForm.set('creation_id', creationId); pubForm.set('access_token', token)
  const pubRes = await fetch(`${GRAPH}/${igUser}/media_publish`, { method: 'POST', body: pubForm })
  const pubJson = await pubRes.json()
  if (!pubRes.ok) throw new Error(`ig_publish: ${JSON.stringify(pubJson)}`)
  const mediaId = pubJson.id as string

  if (firstComment) {
    const cf = new FormData()
    cf.set('message', firstComment); cf.set('access_token', token)
    await fetch(`${GRAPH}/${mediaId}/comments`, { method: 'POST', body: cf })
    // Swallow errors on first-comment — the post itself succeeded.
  }
  return mediaId
}

async function createIgContainer({ igUser, token, body }: {
  igUser: string, token: string, body: Record<string, string | boolean>,
}): Promise<string> {
  const form = new FormData()
  for (const [k, v] of Object.entries(body)) form.set(k, String(v))
  form.set('access_token', token)
  const res = await fetch(`${GRAPH}/${igUser}/media`, { method: 'POST', body: form })
  const json = await res.json()
  if (!res.ok) throw new Error(`ig_container: ${JSON.stringify(json)}`)
  return json.id
}

// Poll container status for video (Reels) until FINISHED or timeout.
async function waitForContainer(id: string, token: string): Promise<string> {
  const deadline = Date.now() + 5 * 60 * 1000  // 5 min
  while (Date.now() < deadline) {
    const res = await fetch(`${GRAPH}/${id}?fields=status_code&access_token=${token}`)
    const json = await res.json()
    if (json.status_code === 'FINISHED') return id
    if (json.status_code === 'ERROR') throw new Error(`ig_reels_transcode_error: ${JSON.stringify(json)}`)
    await new Promise(r => setTimeout(r, 5000))
  }
  throw new Error('ig_reels_transcode_timeout')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
