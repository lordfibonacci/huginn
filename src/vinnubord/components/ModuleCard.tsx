import { useTranslation } from 'react-i18next'
import type { Tone } from '../lib/status'
import type { Module } from '../lib/types'

type Props = {
  module: Module
  openCount: number
  tone: Tone
  hot?: boolean
  ghost?: boolean
  dim?: boolean
  onClick: () => void
}

export function ModuleCard({ module, openCount, tone, hot = false, ghost = false, dim = false, onClick }: Props) {
  const { t } = useTranslation()
  const cls = ['hg-mod', `hg-tone-${tone}`, hot ? 'hg-mod-hot' : '', ghost ? 'hg-mod-ghost' : '', dim ? 'hg-mod-dim' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={cls} data-module={module.id} onClick={onClick}>
      <span className="hg-mod-row">
        <span className="hg-mod-name">{module.name}</span>
        <span className="hg-mod-count">
          {openCount > 0 ? t('vinnubord.board.open', { count: openCount }) : t('vinnubord.board.noneOpen')}
        </span>
      </span>
      {module.status_line && <span className="hg-mod-line">{module.status_line}</span>}
    </button>
  )
}
