import { useTranslation } from 'react-i18next'
import { RUNES } from './index'
import { useEnabledRunes } from './useEnabledRunes'
import { useBoardRole } from '../features/projects/hooks/useBoardRole'

interface Props {
  projectId: string
}

export function RunesSettingsSection({ projectId }: Props) {
  const { t } = useTranslation()
  const { rows, toggle, loading } = useEnabledRunes(projectId)
  const { canManage } = useBoardRole(projectId)

  if (RUNES.length === 0) return null

  return (
    <section className="pt-6 border-t border-huginn-border">
      <h3 className="text-sm font-semibold text-huginn-text-primary mb-1">
        {t('runes.sectionTitle')}
      </h3>
      <p className="text-xs text-huginn-text-secondary mb-4">
        {t('runes.sectionHint')}
      </p>

      <div className="space-y-3">
        {RUNES.map(def => {
          const row = rows.find(r => r.rune_id === def.id)
          const isOn = !!row?.enabled
          const ActiveSubPanel = isOn ? def.surfaces.boardSettings : undefined
          return (
            <div key={def.id} className="rounded-lg bg-huginn-card border border-huginn-border overflow-hidden">
              <label className="flex items-center gap-3 p-3 cursor-pointer">
                <div className="w-8 h-8 rounded-md bg-huginn-accent-soft flex items-center justify-center text-huginn-accent shrink-0">
                  {def.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-huginn-text-primary font-medium">{t(def.nameKey)}</div>
                  <div className="text-xs text-huginn-text-secondary">{t(def.taglineKey)}</div>
                </div>
                <input
                  type="checkbox"
                  checked={isOn}
                  disabled={loading || !canManage}
                  onChange={e => toggle(def.id, e.target.checked)}
                  className="w-10 h-5 shrink-0 accent-huginn-accent"
                  title={!canManage ? t('runes.adminOnly') : undefined}
                />
              </label>
              {ActiveSubPanel && (
                <div className="px-3 pb-3 pt-1 border-t border-huginn-border/50">
                  <ActiveSubPanel projectId={projectId} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
