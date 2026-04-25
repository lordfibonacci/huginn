import { useTranslation } from 'react-i18next'
import type { Attachment } from '../../shared/lib/types'

interface Props {
  attachments: Attachment[]
  selectedIds: string[]
  onChange: (next: string[]) => void
  invalidIds: Set<string>
}

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i

function isImage(a: Attachment): boolean {
  return a.type === 'image'
}

function isVideo(a: Attachment): boolean {
  return a.type === 'video' || (a.type !== 'image' && a.type !== 'link' && VIDEO_EXT_RE.test(a.url))
}

export function MediaPicker({ attachments, selectedIds, onChange, invalidIds }: Props) {
  const { t } = useTranslation()
  const mediaAttachments = attachments.filter(a => isImage(a) || isVideo(a))

  if (mediaAttachments.length === 0) {
    return (
      <div className="text-xs text-huginn-text-secondary">
        {t('runes.meta-social.mediaPickerEmpty')}
      </div>
    )
  }

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {mediaAttachments.map(a => {
        const isSelected = selectedIds.includes(a.id)
        const isInvalid = invalidIds.has(a.id)
        const video = isVideo(a)
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            className={[
              'relative aspect-square rounded-md overflow-hidden border-2',
              isSelected ? 'border-huginn-accent' : 'border-huginn-border',
              isInvalid ? 'ring-2 ring-huginn-danger' : '',
            ].join(' ')}
          >
            {video
              ? <video src={a.url} className="w-full h-full object-cover" muted />
              : <img src={a.url} alt="" className="w-full h-full object-cover" />
            }
            {isSelected && (
              <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-huginn-accent text-white text-[10px] flex items-center justify-center">
                {selectedIds.indexOf(a.id) + 1}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
