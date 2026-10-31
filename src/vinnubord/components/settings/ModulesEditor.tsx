import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { deleteModule, setPositions, upsertModule } from '../../lib/api'
import { nextPosition, reorder, slugify, validateModuleName, validateModulePackage, validateSlug } from '../../lib/settings'
import type { Module, Package } from '../../lib/types'
import { Actions, ColorPicker, Field, OrderButtons } from './parts'

type Props = { projectId: string; packages: Package[]; modules: Module[]; onChange: () => void }

type Group = { id: string | null; name: string; modules: Module[] }

// Modules grouped under their package in board order, then the ones without
// a package (older rows: the board does not draw them, so saving one asks for
// a package). The order buttons move a module within its group.
export function ModulesEditor({ projectId, packages, modules, onChange }: Props) {
  const { t } = useTranslation()
  const order = useAsyncAction()
  const sortedPackages = [...packages].sort((a, b) => a.position - b.position)
  const known = new Set(packages.map((p) => p.id))
  const byPosition = (a: Module, b: Module) => a.position - b.position
  const groups: Group[] = sortedPackages.map((p) => ({
    id: p.id,
    name: p.name,
    modules: modules.filter((m) => m.package_id === p.id).sort(byPosition),
  }))
  const loose = modules.filter((m) => !m.package_id || !known.has(m.package_id)).sort(byPosition)
  if (loose.length > 0) groups.push({ id: null, name: t('vinnubord.settings.modules.noPackage'), modules: loose })

  async function move(group: Module[], id: string, delta: -1 | 1) {
    const changes = reorder(group, id, delta)
    if (changes.length === 0) return
    if (await order.run(() => setPositions('hg_modules', changes))) onChange()
  }

  return (
    <section className="hg-set-sec" aria-labelledby="hg-set-modules">
      <h2 id="hg-set-modules">{t('vinnubord.settings.modules.title')}</h2>
      <p className="hg-set-hint">{t('vinnubord.settings.modules.hint')}</p>
      {order.error && (
        <p className="hg-pn-error" role="alert">
          {order.error}
        </p>
      )}
      {groups.map((g) => (
        <div key={g.id ?? 'none'}>
          <h3>{g.name}</h3>
          {g.modules.length === 0 ? (
            <p className="hg-set-hint">{t('vinnubord.settings.modules.empty')}</p>
          ) : (
            <ul className="hg-set-list">
              {g.modules.map((m, i) => (
                <li key={m.id}>
                  <ModuleRow
                    key={[m.name, m.slug, m.package_id, m.status_line, m.color, m.is_ghost].join('|')}
                    projectId={projectId}
                    module={m}
                    modules={modules}
                    packages={sortedPackages}
                    first={i === 0}
                    last={i === g.modules.length - 1}
                    ordering={order.busy}
                    onMove={(d) => void move(g.modules, m.id, d)}
                    onChange={onChange}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <NewModule projectId={projectId} modules={modules} packages={sortedPackages} onSaved={onChange} />
    </section>
  )
}

type Draft = { name: string; slug: string; packageId: string; statusLine: string; color: string; ghost: boolean }

function draftOf(m: Module): Draft {
  return {
    name: m.name,
    slug: m.slug,
    packageId: m.package_id ?? '',
    statusLine: m.status_line ?? '',
    color: m.color,
    ghost: m.is_ghost,
  }
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (Object.keys(a) as (keyof Draft)[]).every((k) => a[k] === b[k])
}

// Name, slug and package checks, null when the draft can be saved.
function invalidReason(d: Draft, modules: Module[], packages: Package[], selfId?: string): string | null {
  return validateModuleName(d.name) ?? validateSlug(d.slug, modules, selfId) ?? validateModulePackage(d.packageId, packages)
}

// Position in the target package: unchanged when the package stays, last when it moves.
function positionFor(d: Draft, modules: Module[], self?: Module): number {
  const target = d.packageId === '' ? null : d.packageId
  if (self && self.package_id === target) return self.position
  return nextPosition(modules.filter((m) => m.package_id === target && m.id !== self?.id))
}

function ModuleFields({
  draft,
  setDraft,
  packages,
  busy,
  onName,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  packages: Package[]
  busy: boolean
  onName?: (name: string) => void
}) {
  const { t } = useTranslation()
  const knownPackage = packages.some((p) => p.id === draft.packageId)
  return (
    <>
      <Field label={t('vinnubord.settings.modules.name')}>
        <input
          value={draft.name}
          onChange={(e) => (onName ? onName(e.target.value) : setDraft({ ...draft, name: e.target.value }))}
          disabled={busy}
        />
      </Field>
      <Field label={t('vinnubord.settings.modules.slug')} hint={t('vinnubord.settings.modules.slugHint')}>
        <input
          value={draft.slug}
          onChange={(e) => setDraft({ ...draft, slug: e.target.value.trim() })}
          disabled={busy}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </Field>
      <Field label={t('vinnubord.settings.modules.package')}>
        <select
          value={knownPackage ? draft.packageId : ''}
          onChange={(e) => setDraft({ ...draft, packageId: e.target.value })}
          disabled={busy}
        >
          {/* A module needs a package in v1: the board draws modules only in package columns. */}
          {!knownPackage && (
            <option value="" disabled>
              {t('vinnubord.settings.modules.choosePackage')}
            </option>
          )}
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field className="hg-set-field-wide" label={t('vinnubord.settings.modules.statusLine')}>
        <input value={draft.statusLine} onChange={(e) => setDraft({ ...draft, statusLine: e.target.value })} disabled={busy} />
      </Field>
      <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} disabled={busy} />
      <label className="hg-check">
        <input
          type="checkbox"
          checked={draft.ghost}
          onChange={(e) => setDraft({ ...draft, ghost: e.target.checked })}
          disabled={busy}
        />
        <span>{t('vinnubord.settings.modules.ghost')}</span>
      </label>
    </>
  )
}

function ModuleRow({
  projectId,
  module,
  modules,
  packages,
  first,
  last,
  ordering,
  onMove,
  onChange,
}: {
  projectId: string
  module: Module
  modules: Module[]
  packages: Package[]
  first: boolean
  last: boolean
  ordering: boolean
  onMove: (delta: -1 | 1) => void
  onChange: () => void
}) {
  const { t } = useTranslation()
  const initial = draftOf(module)
  const [draft, setDraft] = useState(initial)
  const [invalid, setInvalid] = useState<string | null>(null)
  const { busy, error, run } = useAsyncAction()
  const dirty = !sameDraft(draft, initial)

  async function save() {
    const reason = invalidReason(draft, modules, packages, module.id)
    setInvalid(reason)
    if (reason) return
    const ok = await run(async () => {
      await upsertModule({
        id: module.id,
        projectId,
        packageId: draft.packageId === '' ? null : draft.packageId,
        slug: draft.slug,
        name: draft.name,
        statusLine: draft.statusLine,
        color: draft.color,
        isGhost: draft.ghost,
        position: positionFor(draft, modules, module),
      })
    })
    if (ok) onChange()
  }

  async function remove() {
    if (!window.confirm(t('vinnubord.settings.modules.deleteConfirm', { name: module.name }))) return
    if (await run(() => deleteModule(module.id))) onChange()
  }

  return (
    <form
      className="hg-set-row"
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty && !busy) void save()
      }}
    >
      <ModuleFields draft={draft} setDraft={setDraft} packages={packages} busy={busy} />
      <Actions error={invalid ?? error}>
        <OrderButtons name={module.name} first={first} last={last} disabled={ordering || busy} onMove={onMove} />
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

function NewModule({
  projectId,
  modules,
  packages,
  onSaved,
}: {
  projectId: string
  modules: Module[]
  packages: Package[]
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const empty: Draft = { name: '', slug: '', packageId: packages[0]?.id ?? '', statusLine: '', color: 'stone', ghost: false }
  const [draft, setDraft] = useState(empty)
  // The slug follows the name until it is edited by hand.
  const [slugTouched, setSlugTouched] = useState(false)
  const [invalid, setInvalid] = useState<string | null>(null)
  const { busy, error, run } = useAsyncAction()

  function update(next: Draft) {
    if (next.slug !== draft.slug) setSlugTouched(true)
    setDraft(next)
  }

  async function add() {
    const reason = invalidReason(draft, modules, packages)
    setInvalid(reason)
    if (reason) return
    const ok = await run(async () => {
      await upsertModule({
        projectId,
        packageId: draft.packageId === '' ? null : draft.packageId,
        slug: draft.slug,
        name: draft.name,
        statusLine: draft.statusLine,
        color: draft.color,
        isGhost: draft.ghost,
        position: positionFor(draft, modules),
      })
    })
    if (ok) {
      // Keep the package, the next module usually goes in the same one.
      setDraft({ ...empty, packageId: draft.packageId })
      setSlugTouched(false)
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
      <p className="hg-set-row-title">{t('vinnubord.settings.modules.newTitle')}</p>
      <ModuleFields
        draft={draft}
        setDraft={update}
        packages={packages}
        busy={busy}
        onName={(name) => setDraft({ ...draft, name, slug: slugTouched ? draft.slug : slugify(name) })}
      />
      <Actions error={invalid ?? error}>
        <button type="submit" className="hg-btn hg-btn-primary" disabled={busy || draft.name.trim() === ''}>
          {t('vinnubord.settings.add')}
        </button>
      </Actions>
    </form>
  )
}
