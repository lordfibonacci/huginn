import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { useInbox } from '../features/inbox/hooks/useInbox'
import { useVoiceRecorder } from '../features/inbox/hooks/useVoiceRecorder'
import { CardPopup } from '../features/projects/components/CardPopup'
import { Mark, Wordmark, EmptyState } from '../shared/components/Logo'
import { supabase } from '../shared/lib/supabase'
import type { Task } from '../shared/lib/types'

export function InboxPage() {
  const { t } = useTranslation()
  const { cards, loading, addCard, deleteCard, count } = useInbox()
  const [selectedCard, setSelectedCard] = useState<Task | null>(null)
  const currentSelected = selectedCard
    ? cards.find(c => c.id === selectedCard.id) ?? selectedCard
    : null

  async function updateInboxCard(taskId: string, updates: Record<string, unknown>) {
    const { error } = await supabase.from('huginn_tasks').update(updates).eq('id', taskId)
    if (error) {
      console.error('Failed to update inbox card:', error)
      return false
    }
    return true
  }

  async function deleteInboxCard(taskId: string) {
    await deleteCard(taskId)
    return true
  }
  const { isRecording, transcript, duration, startRecording, stopRecording, isSupported } = useVoiceRecorder()
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Stream the live transcript into the input while recording. Stop = the user
  // can review/edit before tapping Add — never auto-save.
  useEffect(() => {
    if (isRecording) {
      setText(transcript)
    }
  }, [isRecording, transcript])

  async function handleSave(value?: string) {
    const trimmed = (value ?? text).trim()
    if (!trimmed || adding) return
    setAdding(true)
    await addCard(trimmed)
    setText('')
    setAdding(false)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSave()
    }
  }

  function toggleRecording() {
    if (isRecording) stopRecording()
    else startRecording()
  }

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border md:px-6 shrink-0">
        <Link to="/projects" className="flex items-center gap-3 group">
          <Mark size={32} />
          <div className="flex flex-col">
            <Wordmark height={20} />
            <p className="text-[11px] text-huginn-text-secondary mt-0.5">
              {count > 0 ? t('inbox.header.labelWithCount', { count }) : t('inbox.header.label')}
            </p>
          </div>
        </Link>
        <Link
          to="/projects"
          className="text-xs text-huginn-text-muted hover:text-white transition-colors"
        >
          {t('inbox.header.projectsLink')}
        </Link>
      </header>

      {/* Capture surface — always above the fold */}
      <div className="px-4 pt-4 pb-2 md:px-6 shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className={`relative rounded-2xl bg-huginn-card border transition-colors ${
            isRecording ? 'border-huginn-accent ring-2 ring-huginn-accent/30' : 'border-huginn-border focus-within:border-huginn-accent'
          }`}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? t('inbox.capture.listening') : t('inbox.capture.placeholder')}
              rows={3}
              autoFocus
              className="w-full bg-transparent text-white text-base leading-relaxed rounded-2xl px-4 pt-3.5 pb-12 resize-none outline-none placeholder-huginn-text-muted"
            />

            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              {isSupported ? (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    isRecording
                      ? 'bg-huginn-accent text-white'
                      : 'bg-huginn-surface text-huginn-text-secondary hover:text-white hover:bg-huginn-hover'
                  }`}
                  aria-label={isRecording ? t('inbox.capture.stopVoice') : t('inbox.capture.startVoice')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`}>
                    <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V4Z" />
                    <path d="M5.5 9.5a.75.75 0 0 1 .75.75 3.75 3.75 0 0 0 7.5 0 .75.75 0 1 1 1.5 0 5.25 5.25 0 0 1-4.5 5.197V17h2a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5h2v-1.553A5.25 5.25 0 0 1 4.75 10.25.75.75 0 0 1 5.5 9.5Z" />
                  </svg>
                  {isRecording ? t('inbox.capture.stopWithDuration', { duration: formatDuration(duration) }) : t('inbox.capture.voice')}
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => handleSave()}
                disabled={!text.trim() || adding}
                className="bg-huginn-accent hover:bg-huginn-accent-hover text-white text-xs font-semibold px-4 py-1.5 rounded-full disabled:opacity-40 transition-colors"
              >
                {adding ? t('inbox.capture.adding') : t('inbox.capture.add')}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-huginn-text-muted mt-2 px-1 hidden sm:block">
            <Trans
              i18nKey="inbox.capture.enterHint"
              components={{
                0: <kbd className="bg-huginn-surface border border-huginn-border rounded px-1 py-0.5 text-[10px] font-mono" />,
                1: <kbd className="bg-huginn-surface border border-huginn-border rounded px-1 py-0.5 text-[10px] font-mono" />,
                2: <kbd className="bg-huginn-surface border border-huginn-border rounded px-1 py-0.5 text-[10px] font-mono" />,
              }}
            />
          </p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 md:px-6">
        <div className="max-w-2xl mx-auto pt-2">
          {loading ? (
            <p className="text-xs text-huginn-text-muted py-4 text-center">{t('common.loading')}</p>
          ) : cards.length === 0 ? (
            <EmptyState
              title={t('inbox.empty.title')}
              hint={t('inbox.empty.hint')}
            />
          ) : (
            <ul className="space-y-2">
              {cards.map((card) => (
                <li key={card.id}>
                  <button
                    onClick={() => setSelectedCard(card)}
                    className="w-full text-left bg-huginn-card border border-huginn-border/60 hover:border-huginn-accent/40 rounded-xl px-4 py-3 flex items-start gap-3 group transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-huginn-text-primary whitespace-pre-wrap break-words">
                        {card.title}
                      </p>
                      <p className="text-[11px] text-huginn-text-muted mt-1">
                        {formatRelativeTime(card.created_at, t)}
                      </p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(t('inbox.list.deleteConfirm'))) deleteCard(card.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          if (window.confirm(t('inbox.list.deleteConfirm'))) deleteCard(card.id)
                        }
                      }}
                      className="text-huginn-text-muted hover:text-huginn-danger opacity-50 group-hover:opacity-100 transition-opacity shrink-0 -mr-1 p-1"
                      aria-label={t('inbox.list.deleteAria')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2h12a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9Z" />
                        <path fillRule="evenodd" d="M4.5 7a.5.5 0 0 1 .5.5v9.5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7.5a.5.5 0 0 1 1 0v9.5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7.5a.5.5 0 0 1 .5-.5Z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {currentSelected && (
        <CardPopup
          task={currentSelected}
          projectId=""
          lists={[]}
          onUpdate={updateInboxCard}
          onDelete={deleteInboxCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatRelativeTime(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return t('inbox.list.justNow')
  const min = Math.floor(sec / 60)
  if (min < 60) return t('inbox.list.minAgo', { count: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t('inbox.list.hrAgo', { count: hr })
  const days = Math.floor(hr / 24)
  if (days < 7) return t('inbox.list.daysAgo', { count: days })
  return new Date(iso).toLocaleDateString()
}
