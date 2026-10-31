import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../../shared/lib/dateUtils'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { updateProject } from '../../lib/api'
import { projectPatch, validateProjectName, type ProjectFieldsForm } from '../../lib/settings'
import type { Project } from '../../lib/types'
import { Actions, Field } from './parts'

// Name, repo path and the context bundle of the project. Saving a changed
// bundle stamps context_bundle_at, shown as "last updated".
export function ProjectFields({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ProjectFieldsForm>({
    name: project.name,
    repo_path: project.repo_path ?? '',
    context_bundle: project.context_bundle ?? '',
  })
  const [saved, setSaved] = useState(false)
  const { busy, error, run } = useAsyncAction()
  const dirty = Object.keys(projectPatch(project, form, '')).length > 0
  // An emptied name is never saved, so say why instead of leaving Save just disabled.
  const nameError = validateProjectName(form.name)

  const set = (key: keyof ProjectFieldsForm) => (e: { target: { value: string } }) => {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function save() {
    const ok = await run(() => updateProject(project.id, projectPatch(project, form, new Date().toISOString())))
    if (ok) {
      setSaved(true)
      onSaved()
    }
  }

  return (
    <section className="hg-set-sec" aria-labelledby="hg-set-project">
      <h2 id="hg-set-project">{t('vinnubord.settings.project.title')}</h2>
      <form
        className="hg-set-row"
        onSubmit={(e) => {
          e.preventDefault()
          if (dirty && !busy && !nameError) void save()
        }}
      >
        <Field label={t('vinnubord.settings.project.name')}>
          <input value={form.name} onChange={set('name')} required aria-invalid={nameError !== null} disabled={busy} />
        </Field>
        <Field label={t('vinnubord.settings.project.repoPath')} hint={t('vinnubord.settings.project.repoHint')}>
          <input value={form.repo_path} onChange={set('repo_path')} disabled={busy} spellCheck={false} />
        </Field>
        <Field
          className="hg-set-field-wide"
          label={t('vinnubord.settings.project.bundle')}
          hint={t('vinnubord.settings.project.bundleHint')}
        >
          <textarea value={form.context_bundle} onChange={set('context_bundle')} disabled={busy} spellCheck={false} />
        </Field>
        <p className="hg-set-meta">
          {project.context_bundle_at
            ? t('vinnubord.settings.project.updated', { when: formatStamp(project.context_bundle_at) })
            : t('vinnubord.settings.project.never')}
        </p>
        <Actions error={nameError ?? error} saved={saved && !dirty}>
          <button type="submit" className="hg-btn hg-btn-primary" disabled={!dirty || busy || nameError !== null}>
            {t('vinnubord.settings.save')}
          </button>
        </Actions>
      </form>
    </section>
  )
}
