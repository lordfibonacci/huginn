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
}

// "Spurningar": unanswered ones first with an answer field, answered ones
// read only with their answer (ruling R6).
export function QuestionsTab({ questions, participants }: Props) {
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
            {open.map((q) => (
              <li key={q.id} className="hg-q hg-q-open">
                <QuestionHead question={q} asker={who(q.asked_by)} askedTo={who(q.asked_to)} />
                <AnswerBox questionId={q.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {answered.length > 0 && (
        <section className="hg-pn-sec">
          <h3>{t('vinnubord.panel.questions.answered')}</h3>
          <ul className="hg-pn-list">
            {answered.map((q) => {
              const by = who(q.answered_by)
              return (
                <li key={q.id} className="hg-q">
                  <QuestionHead question={q} asker={who(q.asked_by)} askedTo={who(q.asked_to)} />
                  <p className="hg-q-answer">{q.answer}</p>
                  <p className="hg-pn-meta">
                    <span className="hg-av" aria-hidden="true">
                      {by?.short ?? '?'}
                    </span>
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

function QuestionHead({ question, asker, askedTo }: { question: Question; asker: Participant | null; askedTo: Participant | null }) {
  const { t } = useTranslation()
  return (
    <>
      <p className="hg-pn-meta">
        <span className="hg-av" aria-hidden="true">
          {asker?.short ?? '?'}
        </span>
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
    const ok = await run(() => answerQuestion(questionId, answer))
    if (ok) setDraft('')
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
