import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Attachment } from '../../../shared/lib/types'

export function useAttachments(taskId: string) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAttachments = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch attachments:', error)
      return
    }
    setAttachments(data as Attachment[])
    setLoading(false)
  }, [taskId])

  useEffect(() => { fetchAttachments() }, [fetchAttachments])

  useEffect(() => {
    const channelName = `huginn_attachments_${taskId}_${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huginn_attachments', filter: `task_id=eq.${taskId}` }, () => {
        fetchAttachments()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId, fetchAttachments])

  async function uploadFile(file: File) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Upload to storage
    const filePath = `${user.id}/${taskId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('huginn-attachments')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Failed to upload file:', uploadError)
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('huginn-attachments')
      .getPublicUrl(filePath)

    // Insert record
    const { data, error } = await supabase
      .from('huginn_attachments')
      .insert({
        task_id: taskId,
        user_id: user.id,
        name: file.name,
        url: urlData.publicUrl,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        size: file.size,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save attachment:', error)
      return null
    }

    return data as Attachment
  }

  async function addUrl(name: string, url: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('huginn_attachments')
      .insert({
        task_id: taskId,
        user_id: user.id,
        name,
        url,
        type: 'link',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to add URL attachment:', error)
      return null
    }

    return data as Attachment
  }

  async function deleteAttachment(attachmentId: string) {
    const attachment = attachments.find(a => a.id === attachmentId)
    if (!attachment) return

    // Delete from storage if it's a file/image (not a link)
    if (attachment.type !== 'link' && attachment.url.includes('huginn-attachments')) {
      const path = attachment.url.split('huginn-attachments/')[1]
      if (path) {
        await supabase.storage.from('huginn-attachments').remove([path])
      }
    }

    const { error } = await supabase
      .from('huginn_attachments')
      .delete()
      .eq('id', attachmentId)

    if (error) {
      console.error('Failed to delete attachment:', error)
      return
    }

    // Clean up the matching "attached" activity entry so the feed doesn't
    // keep referencing a file that no longer exists.
    await supabase
      .from('huginn_activity')
      .delete()
      .eq('task_id', taskId)
      .eq('action', 'attached')
      .eq('details->>url', attachment.url)
  }

  async function setCover(attachmentId: string) {
    // Unset all covers first
    for (const a of attachments.filter(a => a.is_cover)) {
      await supabase.from('huginn_attachments').update({ is_cover: false }).eq('id', a.id)
    }
    // Set new cover
    await supabase.from('huginn_attachments').update({ is_cover: true }).eq('id', attachmentId)
  }

  const coverImage = attachments.find(a => a.is_cover && a.type === 'image')

  return { attachments, loading, uploadFile, addUrl, deleteAttachment, setCover, coverImage }
}
