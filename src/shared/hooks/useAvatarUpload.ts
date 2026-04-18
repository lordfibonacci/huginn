import { useState } from 'react'
import { supabase } from '../lib/supabase'

const BUCKET = 'huginn-avatars'

export function useAvatarUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(userId: string, file: File): Promise<string | null> {
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('File must be an image')
      return null
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2 MB')
      return null
    }

    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${userId}/avatar-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return null
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    setUploading(false)
    return data.publicUrl
  }

  return { upload, uploading, error }
}
