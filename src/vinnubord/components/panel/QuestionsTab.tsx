import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../../shared/lib/dateUtils'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { answerQuestion } from '../../lib/api'
import { splitQuestions } from '../../lib/panel'
import type { Participant, Question } from '../../lib/types'

type Props = {
  questions: Question[]
  participants: Participant[]
  fresh: (createdAt: string | null, author: string | null) => boolean
}

// "Spurningar": unanswered ones first with an answer field, answered ones
// read only with their answer (ruling R6). A question someone else asked since
// the viewer last opened the item is marked new; when its answer is the new
// part, the mark sits on the answer instead.
export function QuestionsTab({ questions, participants, fresh }: Props) {
  const { t } = useTranslation()
  const { open, answered } = splitQuestions(questions)
  const who = (id: string | null) => participants.find((p) => p.user_id === id) ?? null

  if (questions.length === 0) return <p className="hg-pn-muted">{t('vinnubord.panel.questions.empty')}</p>

  return (
    <>
      {open.length > 0 && (
        <section className="hg-pn-sec">
          <h3>{t('vinnubord.panel.questions.open')}</h3>
          <ul className="hg-pn-list">
            {open.map((q) => {
              const isNew = fresh(q.created_at, q.asked_by)
              return (
                <li key={q.id} className={`hg-q hg-q-open${isNew ? ' hg-fresh' : ''}`}>
                  <QuestionHead question={q} asker={who(q.asked_by)} askedTo={who(q.asked_to)} isNew={isNew} />
                  <AnswerBox questionId={q.id} />
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {answered.length > 0 && (
        <section className="hg-pn-sec">
          <h3>{t('vinnubord.panel.questions.answered')}</h3>
          <ul className="hg-pn-list">
            {answered.map((q) => {
              const by = who(q.answered_by)
              const newAnswer = fresh(q.answered_at, q.answered_by)
              const newQuestion = fresh(q.created_at, q.asked_by)
              return (
                <li key={q.id} className={`hg-q${newAnswer || newQuestion ? ' hg-fresh' : ''}`}>
                  <QuestionHead
                    question={q}
                    asker={who(q.asked_by)}
                    askedTo={who(q.asked_to)}
                    isNew={newQuestion && !newAnswer}
                  />
                  <p className="hg-q-answer">{q.answer}</p>
                  <p className="hg-pn-meta">
                    <span className="hg-av" aria-hidden="true">
                      {by?.short ?? '?'}
                    </span>
                    {newAnswer && <span className="hg-fresh-mark">{t('vinnubord.panel.fresh')}</span>}
                    {t('vinnubord.panel.questions.answerBy', {
                      name: by?.display_name ?? '?',
                      when: q.answered_at ? formatStamp(q.answered_at) : '',
                    })}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}

type HeadProps = { question: Question; asker: Participant | null; askedTo: Participant | null; isNew: boolean }

function QuestionHead({ question, asker, askedTo, isNew }: HeadProps) {
  const { t } = useTranslation()
  return (
    <>
      <p className="hg-pn-meta">
        <span className="hg-av" aria-hidden="true">
          {asker?.short ?? '?'}
        </span>
        {isNew && <span className="hg-fresh-mark">{t('vinnubord.panel.fresh')}</span>}
        {t('vinnubord.panel.questions.asked', { name: asker?.display_name ?? '?' })}
        {askedTo && <> {t('vinnubord.panel.questions.to', { name: askedTo.display_name })}</>}
      </p>
      <p className="hg-q-body">{question.body}</p>
    </>
  )
}

// The answer draft lives here, keyed by question id, so a refetch keeps it.
function AnswerBox({ questionId }: { questionId: string }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const { busy, error, run } = useAsyncAction()
  const answer = draft.trim()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!answer || busy) return
    const sent = answer
    const ok = await run(() => answerQuestion(questionId, sent))
    // Clear only what was sent: text typed while it was on the way stays.
    if (ok) setDraft((d) => (d.trim() === sent ? '' : d))
  }

  return (
    <form className="hg-answer" onSubmit={(e) => void onSubmit(e)}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('vinnubord.panel.questions.placeholder')}
        aria-label={t('vinnubord.panel.questions.placeholder')}
        rows={2}
      />
      <button type="submit" className="hg-btn hg-btn-primary" disabled={!answer || busy}>
        {t('vinnubord.panel.questions.send')}
      </button>
      {error && (
        <p className="hg-pn-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
