import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { Rect } from '../lib/geometry'
import { isTone } from '../lib/status'
import type { Zone as ZoneRow } from '../lib/types'
import { DEFAULT_ZONE_COLOR } from '../lib/zones'

type Props = {
  zone: ZoneRow
  // Where the box rests: its place in the view or its own, and its size.
  // Board writes left, top, width and height directly while it drags or resizes.
  rect: Rect
  lifted: boolean
  setEl: (id: string, el: HTMLElement | null) => void
  onOpen: (id: string) => void
}

// A box on the board. The name is the move grip (data-grip="zone"), the
// corner is the resize grip (data-grip="zone-resize"); both are read by
// useCardDrag on the world layer. The click after a drag is swallowed there,
// so a plain click or tap on the name opens the panel and a drag does not.
export const Zone = memo(function Zone({ zone, rect, lifted, setEl, onOpen }: Props) {
  const { t } = useTranslation()
  const { id } = zone
  const ref = useCallback((el: HTMLDivElement | null) => setEl(id, el), [id, setEl])
  const tone = isTone(zone.color) ? zone.color : DEFAULT_ZONE_COLOR
  return (
    <div
      ref={ref}
      className={`hg-zone hg-tone-${tone}${lifted ? ' hg-zone-lift' : ''}`}
      data-zone={id}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <button type="button" className="hg-zone-title" data-grip="zone" aria-label={t('vinnubord.zone.open', { title: zone.title })} onClick={() => onOpen(id)}>
        {zone.title}
      </button>
      {zone.note && <div className="hg-zone-note">{zone.note}</div>}
      <i className="hg-zone-resize" data-grip="zone-resize" aria-hidden="true" />
    </div>
  )
})
