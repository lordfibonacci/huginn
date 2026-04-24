import { supabase } from '../../../shared/lib/supabase'
import type { Mention } from '../../../shared/lib/types'

// Pull mention user_ids out of a Tiptap-rendered HTML string. Mention nodes
// serialize as `<span data-type="mention" data-id="...">@Label</span>`.
export function extractMentionIdsFromHtml(html: string): string[] {
  if (!html || typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const nodes = doc.querySelectorAll('[data-type="mention"][data-id]')
  const ids = Array.from(nodes).map(n => n.getAttribute('data-id') ?? '').filter(Boolean)
  return Array.from(new Set(ids))
}

// Diff the description's current mention set against existing huginn_mentions
// rows for this task where comment_id IS NULL. Insert new ones, delete
// removed ones, leave unchanged ones alone. Skips self-mentions.
export async function syncDescriptionMentions(taskId: string, mentionerId: string, html: string) {
  const desiredIds = extractMentionIdsFromHtml(html).filter(id => id !== mentionerId)

  const { data: existingData, error: existingErr } = await supabase
    .from('huginn_mentions')
    .select('id, mentioned_user_id')
    .eq('task_id', taskId)
    .is('comment_id', null)
  if (existingErr) {
    console.error('Failed to load existing mentions:', existingErr)
    return
  }
  const existing = (existingData ?? []) as Pick<Mention, 'id' | 'mentioned_user_id'>[]
  const existingIds = new Set(existing.map(m => m.mentioned_user_id))
  const desiredSet = new Set(desiredIds)

  const toInsert = desiredIds.filter(id => !existingIds.has(id))
  const toDelete = existing.filter(m => !desiredSet.has(m.mentioned_user_id)).map(m => m.id)

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from('huginn_mentions')
      .insert(toInsert.map(uid => ({
        task_id: taskId,
        comment_id: null,
        mentioned_user_id: uid,
        mentioner_id: mentionerId,
      })))
    if (error) console.error('Failed to insert mentions:', error)
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('huginn_mentions')
      .delete()
      .in('id', toDelete)
    if (error) console.error('Failed to delete mentions:', error)
  }
}

// Insert mention rows for a freshly created comment. Skips self-mentions and
// dedupes the user_id list.
export async function insertCommentMentions(
  taskId: string,
  commentId: string,
  mentionerId: string,
  mentionedUserIds: string[],
) {
  const unique = Array.from(new Set(mentionedUserIds.filter(id => id !== mentionerId)))
  if (unique.length === 0) return
  const { error } = await supabase
    .from('huginn_mentions')
    .insert(unique.map(uid => ({
      task_id: taskId,
      comment_id: commentId,
      mentioned_user_id: uid,
      mentioner_id: mentionerId,
    })))
  if (error) console.error('Failed to insert comment mentions:', error)
}
