import type { Attachment } from '../../shared/lib/types'

export interface MediaIssue {
  attachmentId: string
  reason: string
}

const IG_IMAGE_MAX_BYTES = 8 * 1024 * 1024
const IG_VIDEO_MAX_BYTES = 100 * 1024 * 1024

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i

function isImage(a: Attachment): boolean {
  return a.type === 'image'
}

function isVideo(a: Attachment): boolean {
  return a.type === 'video' || (a.type !== 'image' && a.type !== 'link' && VIDEO_EXT_RE.test(a.url))
}

export function validateForMeta(
  attachments: Attachment[],
  selectedIds: string[],
  platforms: { fb: boolean; ig: boolean },
): MediaIssue[] {
  const issues: MediaIssue[] = []
  const selected = selectedIds
    .map(id => attachments.find(a => a.id === id))
    .filter(Boolean) as Attachment[]
  if (selected.length === 0) return [{ attachmentId: '', reason: 'noMedia' }]

  const images = selected.filter(isImage)
  const videos = selected.filter(isVideo)

  if (videos.length > 1) issues.push({ attachmentId: videos[1].id, reason: 'multiVideoNotSupported' })
  if (videos.length > 0 && images.length > 0) issues.push({ attachmentId: videos[0].id, reason: 'mixedMediaNotSupported' })

  if (platforms.ig) {
    for (const a of selected) {
      if (isImage(a) && a.size && a.size > IG_IMAGE_MAX_BYTES) {
        issues.push({ attachmentId: a.id, reason: 'igImageTooLarge' })
      }
      if (isVideo(a) && a.size && a.size > IG_VIDEO_MAX_BYTES) {
        issues.push({ attachmentId: a.id, reason: 'igVideoTooLarge' })
      }
    }
    if (images.length > 10) issues.push({ attachmentId: images[10].id, reason: 'igCarouselMax10' })
  }
  return issues
}
