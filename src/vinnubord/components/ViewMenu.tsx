import { useCallback, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createView, deleteView, updateView } from '../lib/api'
import type { Filter, FilterOption } from '../lib/filters'
import { BUCKET_TONE, type Counts, type Tone } from '../lib/status'
import type { View } from '../lib/types'
import { normalizeViewFilter, viewFilterJson, viewFilterOf } from '../lib/views'
import { useDismiss } from './FilterMenu'

type Props = {
  projectId: string
  views: View[]
  active: View | null
  counts: Map<string, number>
  boardCount: number
  packages: FilterOption[]
  tags: FilterOption[]
  filter: Filter
  onChoose: (id: string | null) => void
  onReload: () => Promise<void>
}

// The counter buckets in top bar order, without unread: a view never keeps it.
const BUCKETS: Exclude<keyof Counts, 'unread'>[] = ['new', 'mine', 'others', 'build', 'parked']

type Mode = 'list' | { mode: 'edit'; view: View | null }
type Draft = { name: string; tones: Set<Tone>; packages: Set<string>; tags: Set<string> }

function toggled<T>(set: Set<T>, key: T): Set<T> {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// The "Sýn" menu: the list of shared views with Aðalborð first, choosing one
// closes the menu. "Ný sýn" and "Breyta sýn" open the editor in the same menu,
// "Eyða sýn" asks first and returns to Aðalborð.
export function ViewMenu({ projectId, views, active, counts, boardCount, packages, tags, filter, onChoose, onReload }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('list')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement | null>(null)
  const menuId = useId()
  const close = useCallback(() => {
    setOpen(false)
    setMode('list')
    setError(null)
  }, [])
  useDismiss(root, open, close)

  function choose(id: string | null) {
    onChoose(id)
    close()
  }

  async function remove(view: View) {
    if (!window.confirm(t('vinnubord.views.deleteConfirm', { name: view.name }))) return
    setBusy(true)
    setError(null)
    try {
      await deleteView(view.id)
      onChoose(null)
      await onReload()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={root} className="hg-dd">
      <button
        type="button"
        className={`hg-ddb hg-view-ddb${active ? ' hg-on' : ''}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {t('vinnubord.views.menu')}
        {active && <em title={active.name}>{active.name}</em>}
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div id={menuId} className="hg-menu hg-view-menu" role="group" aria-label={t('vinnubord.views.menu')}>
          {mode === 'list' ? (
            <>
              <button
                type="button"
                className={`hg-chip${active === null ? ' hg-on' : ''}`}
                aria-pressed={active === null}
                onClick={() => choose(null)}
              >
                <span className="hg-chip-label">{t('vinnubord.views.main')}</span>
                <span className="hg-chip-count">{boardCount}</span>
              </button>
              {views.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`hg-chip${active?.id === v.id ? ' hg-on' : ''}`}
                  aria-pressed={active?.id === v.id}
                  onClick={() => choose(v.id)}
                >
                  <span className="hg-chip-label">{v.name}</span>
                  <span className="hg-chip-count">{counts.get(v.id) ?? 0}</span>
                </button>
              ))}
              <div className="hg-menu-sep" aria-hidden="true" />
              <button type="button" className="hg-chip" disabled={busy} onClick={() => setMode({ mode: 'edit', view: null })}>
                {t('vinnubord.views.new')}
              </button>
              {active && (
                <>
                  <button
                    type="button"
                    className="hg-chip"
                    disabled={busy}
                    onClick={() => setMode({ mode: 'edit', view: active })}
                  >
                    {t('vinnubord.views.edit')}
                  </button>
                  <button type="button" className="hg-chip" disabled={busy} onClick={() => void remove(active)}>
                    {t('vinnubord.views.delete')}
                  </button>
                </>
              )}
              {error && (
                <p className="hg-pn-error" role="alert">
                  {error}
                </p>
              )}
              <p className="hg-menu-empty">{t('vinnubord.views.sharedHint')}</p>
            </>
          ) : (
            <ViewEditor
              key={mode.view?.id ?? 'new'}
              projectId={projectId}
              view={mode.view}
              packages={packages}
              tags={tags}
              filter={filter}
              onChoose={onChoose}
              onReload={onReload}
              onDone={() => setMode('list')}
            />
          )}
        </div>
      )}
    </div>
  )
}

type EditorProps = {
  projectId: string
  view: View | null
  packages: FilterOption[]
  tags: FilterOption[]
  filter: Filter
  onChoose: (id: string | null) => void
  onReload: () => Promise<void>
  onDone: () => void
}

// A new view starts from what the viewer sees now (never search or unread),
// an existing one from its saved filter.
function initialDraft(view: View | null, filter: Filter): Draft {
  const f = view ? viewFilterOf(view) : filter
  return { name: view?.name ?? '', tones: new Set(f.tones), packages: new Set(f.packages), tags: new Set(f.tags) }
}

function ViewEditor({ projectId, view, packages, tags, filter, onChoose, onReload, onDone }: EditorProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Draft>(() => initialDraft(view, filter))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = draft.name.trim()
  const offeredTags = new Set(tags.map((o) => o.key))
  const extraTags = [...draft.tags].filter((k) => !offeredTags.has(k))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy || name === '') return
    setBusy(true)
    setError(null)
    const json = normalizeViewFilter(
      viewFilterJson({ ...draft, q: '', unread: false }),
      packages.map((o) => o.key),
      tags.map((o) => o.key),
    )
    try {
      if (view) {
        await updateView(view.id, { name, filter: json })
        await onReload()
      } else {
        const created = await createView(projectId, name, json)
        // Reload first, so the board switches straight to the new view.
        await onReload()
        onChoose(created.id)
      }
      onDone()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const chip = (key: string, label: string, on: boolean, toggle: () => void) => (
    <button key={key} type="button" className={`hg-chip${on ? ' hg-on' : ''}`} aria-pressed={on} onClick={toggle}>
      <span className="hg-chip-label">{label}</span>
    </button>
  )

  return (
    <form className="hg-view-editor" onSubmit={(e) => void save(e)}>
      <label className="hg-field hg-new-field">
        <span>{t('vinnubord.views.name')}</span>
        <input
          type="text"
          required
          maxLength={60}
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </label>
      <p className="hg-view-group">{t('vinnubord.views.show')}</p>
      <div className="hg-view-chips">
        {BUCKETS.map((b) => {
          const tone = BUCKET_TONE[b]
          return chip(b, t(`vinnubord.board.counts.${b}`), draft.tones.has(tone), () =>
            setDraft((d) => ({ ...d, tones: toggled(d.tones, tone) })),
          )
        })}
      </div>
      {packages.length > 0 && (
        <>
          <p className="hg-view-group">{t('vinnubord.views.packages')}</p>
          <div className="hg-view-chips">
            {packages.map((o) =>
              chip(o.key, o.label, draft.packages.has(o.key), () =>
                setDraft((d) => ({ ...d, packages: toggled(d.packages, o.key) })),
              ),
            )}
          </div>
        </>
      )}
      {tags.length + extraTags.length > 0 && (
        <>
          <p className="hg-view-group">{t('vinnubord.views.tags')}</p>
          <div className="hg-view-chips">
            {[...tags.map((o) => o.key), ...extraTags].map((k) =>
              chip(k, k, draft.tags.has(k), () => setDraft((d) => ({ ...d, tags: toggled(d.tags, k) }))),
            )}
          </div>
        </>
      )}
      {error && (
        <p className="hg-pn-error" role="alert">
          {error}
        </p>
      )}
      <div className="hg-view-actions">
        <button type="submit" className="hg-btn hg-btn-primary" disabled={busy || name === ''}>
          {t('vinnubord.views.save')}
        </button>
        <button type="button" className="hg-btn" disabled={busy} onClick={onDone}>
          {t('vinnubord.views.cancel')}
        </button>
      </div>
    </form>
  )
}
