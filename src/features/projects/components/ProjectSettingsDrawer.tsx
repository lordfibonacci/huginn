import { useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { List, Project, ProjectStatus } from '../../../shared/lib/types'
import { ModalShell } from '../../../shared/components/ModalShell'
import { ProjectColorPicker } from './ProjectColorPicker'
import { BoardBackgroundPicker } from './BoardBackgroundPicker'
import { useBoardRole } from '../hooks/useBoardRole'
import { RunesSettingsSection } from '../../../runes/RunesSettingsSection'

interface ProjectSettingsDrawerProps {
  project: Project
  archivedLists?: List[]
  onUpdate: (id: string, updates: { name?: string; description?: string | null; color?: string; status?: ProjectStatus; background?: string }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onRestoreList?: (listId: string) => Promise<boolean>
  onDone: () => void
}

export function ProjectSettingsDrawer({ project, archivedLists, onUpdate, onDelete, onRestoreList, onDone }: ProjectSettingsDrawerProps) {
  const { t } = useTranslation()
  const { canManage, canDelete, role, loading: roleLoading } = useBoardRole(project.id)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [color, setColor] = useState(project.color)
  const [background, setBackground] = useState(project.background ?? 'default')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed || saving || !canManage) return
    setSaving(true)
    await onUpdate(project.id, {
      name: trimmed,
      description: description.trim() || null,
      color,
      background,
    })
    setSaving(false)
    onDone()
  }

  function handleDelete() {
    if (!canDelete) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete(project.id)
    onDone()
  }

  const readOnly = !canManage && !roleLoading

  return (
    <ModalShell onDismiss={onDone} title={readOnly ? t('settings.project.titleInfo') : t('settings.project.titleSettings')}>
      {readOnly && (
        <p className="text-xs text-huginn-text-muted bg-huginn-surface/60 border border-huginn-border/60 rounded-md px-3 py-2 mb-4">
          <Trans
            i18nKey="settings.project.readOnlyHint"
            values={{ role: role ?? '' }}
            components={{ 1: <span className="font-semibold text-huginn-text-secondary" /> }}
          />
        </p>
      )}

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('settings.project.namePlaceholder')}
        readOnly={readOnly}
        className={`w-full bg-huginn-surface text-white rounded-lg px-4 py-3 text-sm outline-none border border-huginn-border placeholder-huginn-text-muted mb-3 ${readOnly ? 'opacity-70 cursor-not-allowed' : 'focus:border-huginn-accent'}`}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('settings.project.descriptionPlaceholder')}
        rows={3}
        readOnly={readOnly}
        className={`w-full bg-huginn-surface text-white rounded-lg px-4 py-3 text-sm outline-none border border-huginn-border placeholder-huginn-text-muted resize-none mb-4 ${readOnly ? 'opacity-70 cursor-not-allowed' : 'focus:border-huginn-accent'}`}
      />

      {/* Project color */}
      <p className="text-xs text-huginn-text-muted font-semibold mb-2">{t('settings.project.colorLabel')}</p>
      <div className={`mb-5 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
        <ProjectColorPicker value={color} onChange={setColor} />
      </div>

      {/* Project background */}
      <p className="text-xs text-huginn-text-muted font-semibold mb-2">{t('settings.project.backgroundLabel')}</p>
      <div className={`mb-5 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
        <BoardBackgroundPicker value={background} onChange={setBackground} />
      </div>

      {/* Archived lists */}
      {canManage && archivedLists && archivedLists.length > 0 && onRestoreList && (
        <div className="mb-5">
          <p className="text-xs text-huginn-text-muted font-semibold mb-2">
            {t('settings.project.archivedLists', { count: archivedLists.length })}
          </p>
          <div className="space-y-1.5">
            {archivedLists.map((list) => (
              <div
                key={list.id}
                className="flex items-center gap-2 bg-huginn-surface/60 border border-huginn-border/60 rounded-md px-3 py-2"
              >
                <span className="flex-1 truncate text-xs text-huginn-text-secondary">{list.name}</span>
                <button
                  onClick={() => onRestoreList(list.id)}
                  className="text-xs text-huginn-accent hover:text-huginn-accent-hover font-semibold px-2 py-0.5 rounded hover:bg-huginn-accent-soft"
                >
                  {t('settings.project.restoreList')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <RunesSettingsSection projectId={project.id} />

      {/* Actions — only show what the user can actually do */}
      {(canManage || canDelete) && (
        <div className="flex items-center gap-2 pt-3 border-t border-huginn-border">
          {canDelete && (
            <button
              onClick={handleDelete}
              className={`text-xs py-1.5 px-3 rounded-md transition-colors ${
                confirmDelete ? 'text-red-400 bg-huginn-danger/10 font-semibold' : 'text-red-400 hover:bg-huginn-danger/10'
              }`}
            >
              {confirmDelete ? t('settings.project.deleteConfirm') : t('settings.project.delete')}
            </button>
          )}
          <div className="flex-1" />
          {canManage && (
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="bg-huginn-accent text-white text-xs font-semibold rounded-md py-1.5 px-5 disabled:opacity-50"
            >
              {saving ? t('settings.project.saving') : t('common.save')}
            </button>
          )}
        </div>
      )}
    </ModalShell>
  )
}
