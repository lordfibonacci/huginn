export type UploadCheck = { ok: true } | { ok: false; reason: string }

export type FileKind = 'MD' | 'HTML' | 'ZIP' | 'MP4' | 'PDF' | 'MYND' | 'TXT' | 'SKRÁ'

export const MAX_UPLOAD_BYTES = 52428800
export const MAX_NAME_LENGTH = 180

const TEXT_EXTENSIONS = new Set(['md', 'txt', 'html', 'json', 'sql', 'csv', 'yaml', 'ts', 'tsx', 'js', 'css'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'])

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return name.slice(dot + 1).toLowerCase()
}

export function validateUpload(file: { name: string; size: number }): UploadCheck {
  if (file.size <= 0) return { ok: false, reason: 'Skráin er tóm.' }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'Skráin er stærri en 50 MB. Stærri skrár bíða Pro-áskriftar.' }
  }
  if (file.name.length > MAX_NAME_LENGTH) {
    return { ok: false, reason: 'Nafn skrárinnar er of langt. Hámark er 180 stafir.' }
  }
  return { ok: true }
}

export function isTextLike(name: string): boolean {
  return TEXT_EXTENSIONS.has(extensionOf(name))
}

export function fileKindLabel(name: string): FileKind {
  const ext = extensionOf(name)
  if (VIDEO_EXTENSIONS.has(ext)) return 'MP4'
  if (IMAGE_EXTENSIONS.has(ext)) return 'MYND'
  switch (ext) {
    case 'zip':
      return 'ZIP'
    case 'pdf':
      return 'PDF'
    case 'md':
      return 'MD'
    case 'html':
    case 'htm':
      return 'HTML'
    case 'txt':
      return 'TXT'
    default:
      return 'SKRÁ'
  }
}
