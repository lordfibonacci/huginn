import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectStatus } from '../../../shared/lib/types'
import { ModalShell } from '../../../shared/components/ModalShell'
import { ProjectColorPicker } from './ProjectColorPicker'

interface NewProjectDrawerProps {
  onSave: (name: string, color: string, status: ProjectStatus) => Promise<void>
  onDone: () => void
}

export function NewProjectDrawer({ onSave, onDone }: NewProjectDrawerProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6c5ce7')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed || saving) return

    setSaving(true)
    await onSave(trimmed, color, 'active')
    setSaving(false)
    onDone()
  }

  return (
    <ModalShell onDismiss={onDone} title={t('projects.new.title')}>
      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('projects.new.namePlaceholder')}
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
        className="w-full bg-huginn-surface text-white rounded-lg px-4 py-3 text-sm outline-none border border-huginn-border focus:border-huginn-accent placeholder-gray-500 mb-4"
      />

      {/* Color */}
      <p className="text-xs text-huginn-text-muted font-semibold mb-2">{t('projects.new.colorLabel')}</p>
      <div className="mb-5">
        <ProjectColorPicker value={color} onChange={setColor} />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onDone} className="flex-1 text-sm text-gray-400 py-2">
          {t('projects.new.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="flex-1 bg-huginn-accent text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-50"
        >
          {saving ? t('projects.new.saving') : t('projects.new.create')}
        </button>
      </div>
    </ModalShell>
  )
}
