import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { setPositions, upsertPackage } from '../../lib/api'
import { nextPosition, parseCoord, reorder } from '../../lib/settings'
import type { Package } from '../../lib/types'
import { Actions, Field, OrderButtons } from './parts'

type Props = { projectId: string; packages: Package[]; onChange: () => void }

// The package columns: name, order and where the column stands on the board.
export function PackagesEditor({ projectId, packages, onChange }: Props) {
  const { t } = useTranslation()
  const sorted = [...packages].sort((a, b) => a.position - b.position)
  const order = useAsyncAction()

  async function move(id: string, delta: -1 | 1) {
    const changes = reorder(sorted, id, delta)
    if (changes.length === 0) return
    if (await order.run(() => setPositions('hg_packages', changes))) onChange()
  }

  return (
    <section className="hg-set-sec" aria-labelledby="hg-set-packages">
      <h2 id="hg-set-packages">{t('vinnubord.settings.packages.title')}</h2>
      <p className="hg-set-hint">{t('vinnubord.settings.packages.hint')}</p>
      {order.error && (
        <p className="hg-pn-error" role="alert">
          {order.error}
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="hg-set-hint">{t('vinnubord.settings.packages.empty')}</p>
      ) : (
        <ul className="hg-set-list">
          {sorted.map((pkg, i) => (
            <li key={pkg.id}>
              <PackageRow
                key={`${pkg.name}|${pkg.pos_x}|${pkg.pos_y}`}
                projectId={projectId}
                pkg={pkg}
                first={i === 0}
                last={i === sorted.length - 1}
                ordering={order.busy}
                onMove={(d) => void move(pkg.id, d)}
                onSaved={onChange}
              />
            </li>
          ))}
        </ul>
      )}
      <NewPackage projectId={projectId} position={nextPosition(packages)} onSaved={onChange} />
    </section>
  )
}

type Draft = { name: string; x: string; y: string }

function check(d: Draft): { error: 'nameError' | 'coordError' } | { name: string; x: number; y: number } {
  const name = d.name.trim()
  if (name === '') return { error: 'nameError' }
  const x = parseCoord(d.x)
  const y = parseCoord(d.y)
  if (x === null || y === null) return { error: 'coordError' }
  return { name, x, y }
}

function PackageFields({ draft, setDraft, busy }: { draft: Draft; setDraft: (d: Draft) => void; busy: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      <Field label={t('vinnubord.settings.packages.name')}>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={busy} />
      </Field>
      <Field className="hg-set-field-coord" label={t('vinnubord.settings.packages.x')}>
        <input inputMode="numeric" value={draft.x} onChange={(e) => setDraft({ ...draft, x: e.target.value })} disabled={busy} />
      </Field>
      <Field className="hg-set-field-coord" label={t('vinnubord.settings.packages.y')}>
        <input inputMode="numeric" value={draft.y} onChange={(e) => setDraft({ ...draft, y: e.target.value })} disabled={busy} />
      </Field>
    </>
  )
}

function PackageRow({
  projectId,
  pkg,
  first,
  last,
  ordering,
  onMove,
  onSaved,
}: {
  projectId: string
  pkg: Package
  first: boolean
  last: boolean
  ordering: boolean
  onMove: (delta: -1 | 1) => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const initial: Draft = { name: pkg.name, x: String(pkg.pos_x), y: String(pkg.pos_y) }
  const [draft, setDraft] = useState(initial)
  const [invalid, setInvalid] = useState<string | null>(null)
  const { busy, error, run } = useAsyncAction()
  const dirty = draft.name !== initial.name || draft.x !== initial.x || draft.y !== initial.y

  async function save() {
    const v = check(draft)
    if ('error' in v) return setInvalid(t(`vinnubord.settings.packages.${v.error}`))
    setInvalid(null)
    const ok = await run(async () => {
      await upsertPackage({ id: pkg.id, projectId, name: v.name, position: pkg.position, pos_x: v.x, pos_y: v.y })
    })
    if (ok) onSaved()
  }

  return (
    <form
      className="hg-set-row"
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty && !busy) void save()
      }}
    >
      <PackageFields draft={draft} setDraft={setDraft} busy={busy} />
      <Actions error={invalid ?? error}>
        <OrderButtons name={pkg.name} first={first} last={last} disabled={ordering || busy} onMove={onMove} />
        <button type="submit" className="hg-btn" disabled={!dirty || busy}>
          {t('vinnubord.settings.save')}
        </button>
      </Actions>
    </form>
  )
}

function NewPackage({ projectId, position, onSaved }: { projectId: string; position: number; onSaved: () => void }) {
  const { t } = useTranslation()
  const empty: Draft = { name: '', x: '0', y: '0' }
  const [draft, setDraft] = useState(empty)
  const [invalid, setInvalid] = useState<string | null>(null)
  const { busy, error, run } = useAsyncAction()

  async function add() {
    const v = check(draft)
    if ('error' in v) return setInvalid(t(`vinnubord.settings.packages.${v.error}`))
    setInvalid(null)
    const ok = await run(async () => {
      await upsertPackage({ projectId, name: v.name, position, pos_x: v.x, pos_y: v.y })
    })
    if (ok) {
      setDraft(empty)
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
      <p className="hg-set-row-title">{t('vinnubord.settings.packages.newTitle')}</p>
      <PackageFields draft={draft} setDraft={setDraft} busy={busy} />
      <Actions error={invalid ?? error}>
        <button type="submit" className="hg-btn hg-btn-primary" disabled={busy || draft.name.trim() === ''}>
          {t('vinnubord.settings.add')}
        </button>
      </Actions>
    </form>
  )
}
