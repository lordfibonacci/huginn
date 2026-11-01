import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../shared/lib/dateUtils'
import { addComment, markRead } from '../lib/api'
import { fileCountsByItem } from '../lib/panel'
import { latestForeignAt } from '../lib/reads'
import { itemStatusLabel, itemTone } from '../lib/status'
import type { BoardData, Item } from '../lib/types'
import { CommentBox } from './panel/CommentBox'
import { FilesTab } from './panel/FilesTab'
import { HistoryTab } from './panel/HistoryTab'
import { QuestionsTab } from './panel/QuestionsTab'
import { StatusTab } from './panel/StatusTab'

type Props = {
  data: BoardData
  item: Item
  viewerId: string
}

type Tab = 'status' | 'files' | 'questions' | 'history'
const TABS: Tab[] = ['status', 'files', 'questions', 'history']

// The panel of one item. Everything shown is derived from data on each
// render; the tab, drafts and scroll position are local state, so the parent
// keys this component by item id and a realtime refetch keeps them. All tab
// bodies stay mounted, so switching tabs keeps them too.
export function ItemPanel({ data, item, viewerId }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('status')
  const bodyRef = useRef<HTMLDivElement | null>(null)

  // Read on open, and again whenever someone else adds an event to the item
  // while it is open. Own changes do not move foreignAt, so they cost no write.
  const itemId = item.id
  const foreignAt = latestForeignAt(data.events, itemId, viewerId)
  useEffect(() => {
    markRead(itemId).catch((e: unknown) => console.error(e))
  }, [itemId, foreignAt, viewerId])

  const choose = (next: Tab) => {
    setTab(next)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }

  const tone = itemTone(item, viewerId, data.participants)
  const label = itemStatusLabel(item, viewerId, data.participants)
  const module = data.modules.find((m) => m.id === item.module_id) ?? null
  const files = data.files.filter((f) => f.item_id === item.id)
  const plans = data.plans.filter((p) => p.item_id === item.id)
  const fileCount = fileCountsByItem(data.files, data.plans).get(item.id) ?? 0
  const questions = data.questions.filter((q) => q.item_id === item.id)
  const openQuestions = questions.filter((q) => q.answer === null).length
  const moverId = item.updated_by ?? item.created_by
  const mover = data.participants.find((p) => p.user_id === moverId)
  const moduleName = module ? module.name : t('vinnubord.panel.noModule')

  const tabLabel = (k: Tab) => {
    if (k === 'files' && fileCount > 0) return t('vinnubord.panel.tabs.filesCount', { count: fileCount })
    if (k === 'questions' && openQuestions > 0) return t('vinnubord.panel.tabs.questionsCount', { count: openQuestions })
    return t(`vinnubord.panel.tabs.${k}`)
  }

  return (
    <div className={`hg-pn hg-tone-${tone}`}>
      <header className="hg-pn-head">
        <div className="hg-pn-st">
          <i aria-hidden="true" />
          {label}
        </div>
        <h2 className="hg-pn-title">{item.title}</h2>
        <p className="hg-pn-sub">
          {mover
            ? t('vinnubord.panel.sub', { module: moduleName, name: mover.display_name, when: formatStamp(item.updated_at) })
            : t('vinnubord.panel.subNoMover', { module: moduleName })}
        </p>
        {item.tags.length > 0 && (
          <div className="hg-pn-tags">
            {item.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
      </header>
      <div className="hg-pn-tabs" role="tablist">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`hg-tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`hg-tabpanel-${k}`}
            className={`hg-pn-tab${tab === k ? ' hg-pn-tab-on' : ''}`}
            onClick={() => choose(k)}
          >
            {tabLabel(k)}
          </button>
        ))}
      </div>
      {/* Every tab stays mounted and inactive ones are hidden, so drafts, an
          open file and a touched status control survive switching tabs. */}
      <div ref={bodyRef} className="hg-pn-body">
        <div role="tabpanel" id="hg-tabpanel-status" aria-labelledby="hg-tab-status" hidden={tab !== 'status'}>
          <StatusTab data={data} item={item} module={module} tone={tone} label={label} />
        </div>
        <div role="tabpanel" id="hg-tabpanel-files" aria-labelledby="hg-tab-files" hidden={tab !== 'files'}>
          <FilesTab files={files} plans={plans} participants={data.participants} />
        </div>
        <div role="tabpanel" id="hg-tabpanel-questions" aria-labelledby="hg-tab-questions" hidden={tab !== 'questions'}>
          <QuestionsTab questions={questions} participants={data.participants} />
        </div>
        <div role="tabpanel" id="hg-tabpanel-history" aria-labelledby="hg-tab-history" hidden={tab !== 'history'}>
          <HistoryTab itemId={item.id} events={data.events} comments={data.comments} participants={data.participants} />
        </div>
      </div>
      <CommentBox onSend={(body) => addComment({ projectId: item.project_id, itemId: item.id, body })} />
    </div>
  )
}
