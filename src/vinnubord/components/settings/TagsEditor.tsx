import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { addTag, deleteTag, mergeTag, renameTag } from '../../lib/api'
import { normalizeTag, tagNameTaken, tagRows, type TagRow as Row } from '../../lib/tags'
import type { Item, Tag } from '../../lib/types'
import { Actions, Field } from './parts'

type Props = { projectId: string; tags: Tag[]; items: Item[]; onChange: () => void }

// The fixed tag list of the project (spec 4.4), most used first. Rename,
// merge and delete run through the silent RPCs, so no card turns unread.
export function TagsEditor({ projectId, tags, items, onChange }: Props) {
  const { t } = useTranslation()
  const rows = tagRows(tags, items)

  return (
    <section className="hg-set-sec" aria-labelledby="hg-set-tags">
      <h2 id="hg-set-tags">{t('vinnubord.settings.tags.title')}</h2>
      <p className="hg-set-hint">{t('vinnubord.settings.tags.hint')}</p>
      {rows.length === 0 ? (
        <p className="hg-set-hint">{t('vinnubord.settings.tags.empty')}</p>
      ) : (
        <ul className="hg-set-list">
          {rows.map((row) => (
            <li key={row.id}>
              <TagRow key={`${row.id}|${row.name}`} row={row} tags={tags} onChange={onChange} />
            </li>
          ))}
        </ul>
      )}
      <NewTag projectId={projectId} tags={tags} onSaved={onChange} />
    </section>
  )
}

function TagRow({ row, tags, onChange }: { row: Row; tags: Tag[]; onChange: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState(row.name)
  const [targetId, setTargetId] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const { busy, error, run } = useAsyncAction()
  const dirty = name !== row.name
  const others = tags.filter((tag) => tag.id !== row.id).sort((a, b) => a.name.localeCompare(b.name, 'is'))
  // A target that left the list by realtime is no target.
  const target = others.find((tag) => tag.id === targetId) ?? null

  async function save() {
    const n = normalizeTag(name)
    const reason = n.ok ? tagNameTaken(n.name, tags, row.id) : n.reason
    setInvalid(reason)
    if (reason || !n.ok) return
    if (await run(() => renameTag(row.id, n.name))) onChange()
  }

  async function merge() {
    if (!target) return
    if (!window.confirm(t('vinnubord.settings.tags.mergeConfirm', { from: row.name, into: target.name }))) return
    setInvalid(null)
    if (await run(() => mergeTag(row.id, target.id))) onChange()
  }

  async function remove() {
    if (!window.confirm(t('vinnubord.settings.tags.deleteConfirm', { name: row.name, count: row.count }))) return
    setInvalid(null)
    if (await run(() => deleteTag(row.id))) onChange()
  }

  return (
    <form
      className="hg-set-row"
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty && !busy) void save()
      }}
    >
      <Field label={t('vinnubord.settings.tags.name')}>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </Field>
      <p className="hg-set-meta">{t('vinnubord.settings.tags.count', { count: row.count })}</p>
      <Field label={t('vinnubord.settings.tags.mergeInto')}>
        <select value={target ? target.id : ''} onChange={(e) => setTargetId(e.target.value)} disabled={busy}>
          <option value="">{t('vinnubord.settings.tags.choose')}</option>
          {others.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </Field>
      <Actions error={invalid ?? error}>
        <button type="button" className="hg-btn hg-btn-ghost" disabled={busy || !target} onClick={() => void merge()}>
          {t('vinnubord.settings.tags.merge')}
        </button>
        <button type="button" className="hg-btn hg-btn-ghost hg-btn-danger" disabled={busy} onClick={() => void remove()}>
          {t('vinnubord.settings.delete')}
        </button>
        <button type="submit" className="hg-btn" disabled={!dirty || busy}>
          {t('vinnubord.settings.save')}
        </button>
      </Actions>
    </form>
  )
}

function NewTag({ projectId, tags, onSaved }: { projectId: string; tags: Tag[]; onSaved: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const { busy, error, run } = useAsyncAction()

  async function add() {
    const n = normalizeTag(name)
    const reason = n.ok ? tagNameTaken(n.name, tags) : n.reason
    setInvalid(reason)
    if (reason || !n.ok) return
    const ok = await run(async () => {
      await addTag(projectId, n.name)
    })
    if (ok) {
      setName('')
      onSaved()
    }
  }

  return (
    <form
      className="hg-set-row hg-set-row-new"
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy) void add()
      }}
    >
      <p className="hg-set-row-title">{t('vinnubord.settings.tags.newTitle')}</p>
      <Field label={t('vinnubord.settings.tags.name')}>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </Field>
      <Actions error={invalid ?? error}>
        <button type="submit" className="hg-btn hg-btn-primary" disabled={busy || name.trim() === ''}>
          {t('vinnubord.settings.add')}
        </button>
      </Actions>
    </form>
  )
}
