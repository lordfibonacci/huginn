import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createItem, uploadFile } from '../lib/api'
import type { FilterOption } from '../lib/filters'
import { packLayout } from '../lib/layout'
import { fileEntry, formatBytes, parseTags, toggleTagText, uploadSummary, type FileEntry } from '../lib/newItem'
import type { BoardData, Item } from '../lib/types'

type Props = {
  open: boolean
  data: BoardData
  // Tags already in use, offered as quick picks.
  tags: FilterOption[]
  // Where the new card lands, from the board (beside its module or mid view).
  place: (moduleId: string | null) => { x: number; y: number } | null
  onClose: () => void
  // The created item, to select it so it opens in the panel.
  onCreated: (item: Item) => void
}

type Picked = FileEntry & { file: File }

const QUICK_TAGS = 10

// "+ Nýtt verk": title (required), markdown text, module, tags and files
// (several, drag and drop or the button). Creates the item with status new,
// then uploads the accepted files one at a time with a state per file (ruling
// R18). Files that validateUpload rejects show the reason and are skipped; the
// item is created with the rest. On full success the sheet closes and the new
// item is selected; if any file failed it stays open to show which, and
// closing it then opens the item.
export function NewItemSheet(props: Props) {
  // Mounted only while open, so every open starts with an empty form.
  if (!props.open) return null
  return <Sheet {...props} />
}

function Sheet({ data, tags, place, onClose, onCreated }: Props) {
  const { t, i18n } = useTranslation()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [tagText, setTagText] = useState('')
  const [files, setFiles] = useState<Picked[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Item | null>(null)
  const [over, setOver] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const titleRef = useRef<HTMLInputElement | null>(null)
  const nextId = useRef(0)
  const headingId = useId()

  const rows = useMemo(() => packLayout(data.packages, data.modules), [data.packages, data.modules])
  const chosenTags = parseTags(tagText)
  const dirty = title.trim() !== '' || body.trim() !== '' || tagText.trim() !== '' || files.length > 0

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // After the item exists, closing opens it.
  const finish = useCallback(() => {
    if (created) onCreated(created)
    else onClose()
  }, [created, onCreated, onClose])

  // Esc leaves a field first, then closes. Caught in the capture phase so the
  // side panel behind the sheet does not close too. Nothing closes mid save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input, textarea, select')) {
        target.blur()
        return
      }
      if (!busy) finish()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [busy, finish])

  function addFiles(list: FileList | null) {
    if (!list || created) return
    const picked = Array.from(list).map((file) => ({ ...fileEntry(`f${nextId.current++}`, file), file }))
    setFiles((prev) => [...prev, ...picked])
  }

  function setFileState(id: string, state: FileEntry['state'], reason: string | null = null) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, state, reason } : f)))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || created) return
    if (title.trim() === '') {
      setError(t('vinnubord.newItem.titleRequired'))
      titleRef.current?.focus()
      return
    }
    setBusy(true)
    setError(null)
    let item: Item
    try {
      const mod = moduleId || null
      item = await createItem({
        projectId: data.project.id,
        title: title.trim(),
        body: body.trim() === '' ? undefined : body,
        moduleId: mod,
        tags: chosenTags,
        pos: place(mod) ?? undefined,
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
      return
    }
    setCreated(item)

    // One file at a time, so the states read in order and a slow line is not
    // split between several large uploads.
    const results: FileEntry[] = []
    for (const f of files) {
      if (f.state === 'error') {
        results.push(f)
        continue
      }
      setFileState(f.id, 'uploading')
      try {
        await uploadFile({ projectId: data.project.id, itemId: item.id, file: f.file })
        setFileState(f.id, 'done')
        results.push({ ...f, state: 'done' })
      } catch (err) {
        console.error(err)
        const reason = err instanceof Error ? err.message : String(err)
        setFileState(f.id, 'error', reason)
        results.push({ ...f, state: 'error', reason })
      }
    }
    setBusy(false)
    if (uploadSummary(results).allOk) onCreated(item)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setOver(false)
    addFiles(e.dataTransfer.files)
  }

  const summary = uploadSummary(files)
  const locked = busy || created !== null

  return (
    <div className="hg-sheet-wrap" data-panel="">
      <div
        className="hg-sheet-backdrop"
        aria-hidden="true"
        onClick={() => {
          // A stray click must not throw away a half written item.
          if (!busy && (!dirty || created)) finish()
        }}
      />
      <form className="hg-new-sheet" role="dialog" aria-modal="true" aria-labelledby={headingId} onSubmit={submit} noValidate>
        <div className="hg-new-head">
          <h2 id={headingId}>{t('vinnubord.newItem.heading')}</h2>
        </div>
        <div className="hg-new-body">
          <label className="hg-new-field">
            <span>{t('vinnubord.newItem.title')}</span>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('vinnubord.newItem.titlePlaceholder')}
              required
              disabled={locked}
            />
          </label>

          <label className="hg-new-field">
            <span>
              {t('vinnubord.newItem.body')} <small>{t('vinnubord.newItem.bodyHint')}</small>
            </span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} disabled={locked} />
          </label>

          <label className="hg-new-field">
            <span>{t('vinnubord.newItem.module')}</span>
            <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} disabled={locked}>
              <option value="">{t('vinnubord.newItem.noModule')}</option>
              {rows.map(({ pkg, modules }) =>
                modules.length === 0 ? null : (
                  <optgroup key={pkg.id} label={pkg.name}>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </select>
          </label>

          <div className="hg-new-field">
            <label>
              <span>
                {t('vinnubord.newItem.tags')} <small>{t('vinnubord.newItem.tagsHint')}</small>
              </span>
              <input value={tagText} onChange={(e) => setTagText(e.target.value)} disabled={locked} />
            </label>
            {tags.length > 0 && !locked && (
              <div className="hg-new-tags">
                {tags.slice(0, QUICK_TAGS).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    className={`hg-tag-pick${chosenTags.includes(o.key) ? ' hg-on' : ''}`}
                    aria-pressed={chosenTags.includes(o.key)}
                    onClick={() => setTagText((v) => toggleTagText(v, o.key))}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hg-new-field">
            <span>{t('vinnubord.newItem.files')}</span>
            {!locked && (
              <div
                className={`hg-drop${over ? ' hg-on' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(true)
                }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
              >
                <span>{t('vinnubord.newItem.drop')}</span>
                <button type="button" className="hg-btn" onClick={() => fileInput.current?.click()}>
                  {t('vinnubord.newItem.pick')}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>
            )}
            {files.length > 0 && (
              <ul className="hg-new-files">
                {files.map((f) => (
                  <li key={f.id} className={`hg-new-file hg-file-${f.state}`}>
                    <div className="hg-new-file-row">
                      <span className="hg-new-file-name">{f.name}</span>
                      <span className="hg-new-file-size">{formatBytes(f.size, i18n.language)}</span>
                      <span className="hg-pill">{t(`vinnubord.newItem.state.${f.state}`)}</span>
                      {!locked && (
                        <button
                          type="button"
                          className="hg-new-file-remove"
                          aria-label={t('vinnubord.newItem.remove', { name: f.name })}
                          onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M4 4l8 8M12 4l-8 8" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {f.reason && <p className="hg-pn-error">{f.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="hg-pn-error" role="alert">
              {error}
            </p>
          )}
          {created && !busy && summary.failed > 0 && (
            <p className="hg-new-note" role="status">
              {t('vinnubord.newItem.createdWithErrors', { count: summary.failed })}
            </p>
          )}
        </div>

        <div className="hg-new-foot">
          {created ? (
            <button type="button" className="hg-btn hg-btn-primary" onClick={finish} disabled={busy}>
              {busy ? t('vinnubord.newItem.uploading') : t('vinnubord.newItem.openItem')}
            </button>
          ) : (
            <>
              <button type="button" className="hg-btn hg-btn-ghost" onClick={onClose} disabled={busy}>
                {t('vinnubord.newItem.cancel')}
              </button>
              <button type="submit" className="hg-btn hg-btn-primary" disabled={busy || title.trim() === ''}>
                {busy ? t('vinnubord.newItem.creating') : t('vinnubord.newItem.create')}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
