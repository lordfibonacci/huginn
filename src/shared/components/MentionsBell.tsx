import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGlobalMentions } from '../../features/projects/hooks/useMentions'
import { Avatar } from './Avatar'
import { ProjectGlyph } from '../../features/projects/components/ProjectGlyph'
import { timeAgo } from '../lib/dateUtils'

// Bell button + dropdown for unread @-mentions across all boards. Click a row
// to deep-link to the mentioned card via `?card=<id>`. Mark-as-read happens
// automatically when CardPopup mounts.
//
// The dropdown is portaled to document.body — GlobalTopBar uses
// `backdrop-blur-sm` which creates a stacking context that would otherwise
// trap an absolutely-positioned panel behind the board cards.
export function MentionsBell() {
  const { t } = useTranslation()
  const { count, rows } = useGlobalMentions()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    if (!open) {
      setAnchor(null)
      return
    }
    function recompute() {
      const btn = buttonRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      setAnchor({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-7 h-7 rounded-full text-huginn-text-muted hover:text-white hover:bg-huginn-hover transition-colors"
        title={t('mentions.bell.title', { count })}
        aria-label={t('mentions.bell.title', { count })}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6Zm-3.5 14a3.5 3.5 0 1 0 7 0h-7Z" clipRule="evenodd" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-huginn-danger text-white text-[9px] font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && anchor && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[80] w-80 max-h-[420px] overflow-y-auto bg-huginn-card border border-huginn-border rounded-xl shadow-2xl py-1"
          style={{ top: anchor.top, right: anchor.right }}
        >
          <div className="px-3 py-2 border-b border-huginn-border/60 text-[10px] uppercase tracking-wider font-bold text-huginn-text-muted">
            {t('mentions.bell.heading')}
          </div>
          {rows.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-huginn-text-muted">
              {t('mentions.bell.empty')}
            </div>
          )}
          {rows.map(({ mention, task, project, mentioner }) => (
            <Link
              key={mention.id}
              to={project ? `/projects/${project.id}?card=${task.id}` : `/inbox?card=${task.id}`}
              onClick={() => setOpen(false)}
              className="flex items-start gap-2 px-3 py-2 hover:bg-huginn-hover transition-colors"
            >
              <Avatar
                url={mentioner?.avatar_url}
                name={mentioner?.display_name}
                email={mentioner?.email ?? undefined}
                size={28}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-huginn-text-muted mb-0.5">
                  {project && <ProjectGlyph color={project.color} size={10} />}
                  <span className="truncate">{project?.name ?? t('mentions.bell.inbox')}</span>
                  <span>·</span>
                  <span className="shrink-0">{timeAgo(mention.created_at)}</span>
                </div>
                <p className="text-xs text-huginn-text-primary leading-snug">
                  <span className="font-semibold">{mentioner?.display_name ?? t('mentions.bell.someone')}</span>
                  {' '}
                  {t('mentions.bell.mentionedYouOn')}
                  {' '}
                  <span className="font-medium">{task.title}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
