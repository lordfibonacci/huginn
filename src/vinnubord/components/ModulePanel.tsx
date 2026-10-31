import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../shared/lib/dateUtils'
import { addComment } from '../lib/api'
import { moduleTone } from '../lib/layout'
import { moduleItems } from '../lib/panel'
import { itemStatusLabel, itemTone } from '../lib/status'
import type { BoardData, Item, Module } from '../lib/types'
import { CommentBox } from './panel/CommentBox'

type Props = {
  data: BoardData
  module: Module
  viewerId: string
  // Opens an item of this module in the panel.
  onSelectItem: (itemId: string) => void
}

// The panel of one module: its status line, open items, items done and items
// dropped in the last 90 days under their own headings, and its comments.
export function ModulePanel({ data, module, viewerId, onSelectItem }: Props) {
  const { t } = useTranslation()
  const tone = moduleTone(module.id, data.items, viewerId, data.participants)
  const { open, done, dropped } = useMemo(() => moduleItems(data.items, module.id), [data.items, module.id])
  const comments = data.comments.filter((c) => c.module_id === module.id)

  const row = (item: Item) => (
    <li key={item.id}>
      <button
        type="button"
        className={`hg-mod-item hg-tone-${itemTone(item, viewerId, data.participants)}`}
        onClick={() => onSelectItem(item.id)}
      >
        <i aria-hidden="true" />
        <span className="hg-mod-item-title">{item.title}</span>
        <span className="hg-mod-item-st">
          {itemStatusLabel(item, viewerId, data.participants)}
          {item.closed_at && `, ${formatStamp(item.closed_at)}`}
        </span>
      </button>
    </li>
  )

  return (
    <div className={`hg-pn hg-tone-${tone}`}>
      <header className="hg-pn-head">
        <div className="hg-pn-st">
          <i aria-hidden="true" />
          {t('vinnubord.panel.modulePanel.kind')}
        </div>
        <h2 className="hg-pn-title">{module.name}</h2>
        {module.status_line && <p className="hg-pn-sub">{module.status_line}</p>}
      </header>
      <div className="hg-pn-body hg-pn-body-top">
        <section className="hg-pn-sec">
          <h3>{t('vinnubord.panel.modulePanel.open')}</h3>
          {open.length > 0 ? (
            <ul className="hg-pn-list">{open.map(row)}</ul>
          ) : (
            <p className="hg-pn-muted">{t('vinnubord.panel.modulePanel.noneOpen')}</p>
          )}
        </section>
        {done.length > 0 && (
          <section className="hg-pn-sec">
            <h3>{t('vinnubord.panel.modulePanel.done')}</h3>
            <ul className="hg-pn-list">{done.map(row)}</ul>
          </section>
        )}
        {dropped.length > 0 && (
          <section className="hg-pn-sec">
            <h3>{t('vinnubord.panel.modulePanel.dropped')}</h3>
            <ul className="hg-pn-list">{dropped.map(row)}</ul>
          </section>
        )}
        <section className="hg-pn-sec">
          <h3>{t('vinnubord.panel.modulePanel.comments')}</h3>
          {comments.length > 0 ? (
            <ol className="hg-history">
              {comments.map((c) => {
                const by = data.participants.find((p) => p.user_id === c.user_id)
                return (
                  <li key={c.id} className="hg-hist hg-hist-comment">
                    <span className="hg-av" title={by?.display_name}>
                      {by?.short ?? '?'}
                    </span>
                    <div className="hg-hist-main">
                      <p className="hg-hist-line">
                        <b>{by?.display_name ?? '?'}</b>
                        {c.created_at && <span className="hg-hist-when"> {formatStamp(c.created_at)}</span>}
                      </p>
                      <p className="hg-hist-comment">{c.body}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="hg-pn-muted">{t('vinnubord.panel.modulePanel.noComments')}</p>
          )}
        </section>
      </div>
      <CommentBox onSend={(body) => addComment({ projectId: module.project_id, moduleId: module.id, body })} />
    </div>
  )
}
