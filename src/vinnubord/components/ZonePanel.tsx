import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { deleteZone, updateZone } from '../lib/api'
import { isTone } from '../lib/status'
import type { Zone } from '../lib/types'
import { normalizeNote } from '../lib/upload'
import { DEFAULT_ZONE_COLOR, ZONE_TITLE_MAX, normalizeZoneTitle } from '../lib/zones'
import { Actions, ColorPicker, Field } from './settings/parts'

type Props = {
  zone: Zone
  // A box that was just drawn: the name field gets focus with its text selected.
  focusTitle: boolean
  onDeleted: () => void
  onReload: () => Promise<void>
}

// The panel of one box: name, colour, note, save and delete. Keyed by zone id
// in BoardPage, so a refetch keeps the draft and another box resets it.
export function ZonePanel({ zone, focusTitle, onDeleted, onReload }: Props) {
  const { t } = useTranslation()
  const { busy, error, run } = useAsyncAction()
  const [title, setTitle] = useState(zone.title)
  const [color, setColor] = useState(zone.color)
  const [note, setNote] = useState(zone.note ?? '')
  const titleRef = useRef<HTMLInputElement | null>(null)
  const focused = useRef(false)
  useEffect(() => {
    if (!focusTitle || focused.current) return
    focused.current = true
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [focusTitle])

  const checked = normalizeZoneTitle(title)
  const noteChecked = normalizeNote(note)
  const dirty =
    (checked.ok ? checked.title : title) !== zone.title || color !== zone.color || (noteChecked.ok ? noteChecked.note : note) !== zone.note
  const valid = checked.ok && noteChecked.ok
  const reason = !checked.ok ? checked.reason : !noteChecked.ok ? noteChecked.reason : null

  const save = async () => {
    if (!checked.ok || !noteChecked.ok) return
    const ok = await run(() => updateZone(zone.id, { title: checked.title, color, note: noteChecked.note }))
    if (ok) await onReload()
  }

  const remove = async () => {
    if (!window.confirm(t('vinnubord.zone.deleteConfirm', { title: zone.title }))) return
    const ok = await run(() => deleteZone(zone.id))
    if (!ok) return
    onDeleted()
    void onReload()
  }

  return (
    <div className={`hg-pn hg-tone-${isTone(zone.color) ? zone.color : DEFAULT_ZONE_COLOR}`}>
      <header className="hg-pn-head">
        <div className="hg-pn-st">
          <i aria-hidden="true" />
          {t('vinnubord.zone.kind')}
        </div>
        <h2 className="hg-pn-title">{zone.title}</h2>
      </header>
      <div className="hg-pn-body hg-pn-body-top">
        <section className="hg-pn-sec">
          <div className="hg-set-row">
            <Field className="hg-set-field-wide" label={t('vinnubord.zone.title')}>
              <input
                ref={titleRef}
                value={title}
                maxLength={ZONE_TITLE_MAX}
                disabled={busy}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <ColorPicker value={color} onChange={setColor} disabled={busy} />
            <Field className="hg-set-field-wide" label={t('vinnubord.zone.note')} hint={t('vinnubord.zone.noteHint')}>
              <textarea value={note} rows={2} disabled={busy} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Actions error={dirty && reason ? reason : error}>
              <button
                type="button"
                className="hg-btn hg-btn-ghost hg-btn-danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                {t('vinnubord.settings.delete')}
              </button>
              <button
                type="button"
                className="hg-btn hg-btn-primary"
                disabled={busy || !dirty || !valid}
                onClick={() => void save()}
              >
                {t('vinnubord.settings.save')}
              </button>
            </Actions>
          </div>
        </section>
      </div>
    </div>
  )
}
