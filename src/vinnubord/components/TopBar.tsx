import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../shared/hooks/useAuth'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { LanguageToggle } from '../../shared/components/LanguageToggle'
import type { FilterApi } from '../hooks/useFilter'
import { markAllRead } from '../lib/api'
import type { FilterOption } from '../lib/filters'
import { BUCKET_TONE, type Counts } from '../lib/status'
import type { Participant, Project } from '../lib/types'
import { FilterMenu, useDismiss } from './FilterMenu'

type Props = {
  project: Project
  projects: Project[]
  counts: Counts
  filter: FilterApi
  tags: FilterOption[]
  packages: FilterOption[]
  participants: Participant[]
  viewer: { userId: string; participant: Participant | null; email: string | null }
  live: boolean
  viewMenu: ReactNode
  filterSheetOpen: boolean
  onOpenFilters: () => void
  // Chosen packages and tags, plus one when a view is active.
  picks: number
  onNewItem: () => void
  listOpen: boolean
  onToggleList: () => void
}

// Pill order follows the mockup: unread first, then new, waiting on you, waiting on others, in build, on hold.
const COUNT_ORDER: (keyof Counts)[] = ['unread', 'new', 'mine', 'others', 'build', 'parked']

// The top bar above the board: brand, project switcher, the counters (which
// are the status filter), search, package and tag menus, the view menu, "Hreinsa" while a
// filter is on, the live dot, participants, the viewer menu and "+ Nýtt verk".
// From 1024 px one row; below it two rows, the counters alone in the second
// row scrolling sideways, search behind a magnifier button and the package,
// tag and view menus behind a filter button that opens the filter sheet. It
// sits outside the board element, so its clicks never reach the board's pan
// or deselect.
export function TopBar({
  project,
  projects,
  counts,
  filter,
  tags,
  packages,
  participants,
  viewer,
  live,
  viewMenu,
  filterSheetOpen,
  onOpenFilters,
  picks,
  onNewItem,
  listOpen,
  onToggleList,
}: Props) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const narrow = useMediaQuery('(max-width: 1023px)')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const f = filter.filter
  const searching = searchOpen || f.q !== ''

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    // The field mounts visible in this render, focus it after paint.
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [])

  // A pill shows when it counts something or is switched on, so an active
  // tone whose count drops to 0 can still be switched off.
  const pills = COUNT_ORDER.filter((k) => counts[k] > 0 || (k === 'unread' ? f.unread : f.tones.has(BUCKET_TONE[k])))
  const others = participants.filter((p) => p.user_id !== viewer.userId)

  return (
    <header className={`hg-top${searching ? ' hg-top-searching' : ''}`}>
      <div className="hg-top-a">
        <span className="hg-brand">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 14c3-6 8-9 15-9-1 2-1 4 0 5-3 0-5 1-6 3 2 0 3 1 4 3-4 0-7-1-9-3-1 1-2 2-4 1z" />
            <circle cx="15.5" cy="8.5" r=".9" />
          </svg>
          <span className="hg-brand-name">Huginn</span>
        </span>
        {projects.length > 1 ? (
          <label className="hg-proj hg-proj-select">
            <span className="hg-sr">{t('vinnubord.top.project')}</span>
            <select value={project.slug} onChange={(e) => navigate(`/p/${e.target.value}`)}>
              {projects.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5l3 3 3-3" />
            </svg>
          </label>
        ) : (
          <span className="hg-proj">{project.name}</span>
        )}
      </div>

      <div className="hg-counts" role="group" aria-label={t('vinnubord.top.counters')}>
        {pills.map((k) => {
          const tone = BUCKET_TONE[k]
          const isUnread = k === 'unread'
          const on = isUnread ? f.unread : f.tones.has(tone)
          const label = t(`vinnubord.board.counts.${k}`).toLocaleLowerCase(i18n.language)
          return (
            <button
              key={k}
              type="button"
              className={`hg-count hg-tone-${tone}${isUnread ? ' hg-count-unread' : ''}${on ? ' hg-on' : ''}`}
              aria-pressed={on}
              onClick={() => (isUnread ? filter.toggleUnread() : filter.toggleTone(tone))}
            >
              <i aria-hidden="true" />
              <b>{counts[k]}</b>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      <div className="hg-top-s">
        <svg className="hg-search-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <input
          ref={searchRef}
          className="hg-search"
          type="search"
          value={f.q}
          placeholder={t('vinnubord.top.search')}
          aria-label={t('vinnubord.top.search')}
          onChange={(e) => filter.setQuery(e.target.value)}
          onBlur={() => setSearchOpen(false)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            // Esc in the field leaves it, it does not close the side panel.
            e.stopPropagation()
            e.currentTarget.blur()
          }}
        />
      </div>

      {!narrow && (
        <div className="hg-top-g">
          <FilterMenu
            label={t('vinnubord.top.package')}
            options={packages}
            selected={f.packages}
            onToggle={filter.togglePackage}
            empty={t('vinnubord.top.noPackages')}
          />
          <FilterMenu
            label={t('vinnubord.top.tags')}
            options={tags}
            selected={f.tags}
            onToggle={filter.toggleTag}
            empty={t('vinnubord.top.noTags')}
          />
          {viewMenu}
          {filter.active && (
            <button type="button" className="hg-clear" onClick={filter.clear}>
              {t('vinnubord.top.clear')}
            </button>
          )}
        </div>
      )}

      <div className="hg-top-b">
        <button
          type="button"
          className={`hg-icon-btn hg-list-btn${listOpen ? ' hg-on' : ''}`}
          aria-label={t('vinnubord.top.list')}
          aria-pressed={listOpen}
          onClick={onToggleList}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="3" cy="4" r="1.2" />
            <path d="M6.5 4H14" />
            <circle cx="3" cy="8" r="1.2" />
            <path d="M6.5 8H14" />
            <circle cx="3" cy="12" r="1.2" />
            <path d="M6.5 12H14" />
          </svg>
        </button>
        <span
          className={`hg-live${live ? '' : ' hg-live-off'}`}
          role="status"
          title={live ? t('vinnubord.top.liveHint') : t('vinnubord.top.connectingHint')}
        >
          <i aria-hidden="true" />
          <span>{live ? t('vinnubord.top.live') : t('vinnubord.top.connecting')}</span>
        </span>
        <button
          type="button"
          className={`hg-icon-btn hg-search-btn${f.q !== '' ? ' hg-on' : ''}`}
          aria-label={t('vinnubord.top.openSearch')}
          aria-expanded={searching}
          onClick={openSearch}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
        </button>
        {narrow && (
          <button
            type="button"
            className={`hg-icon-btn hg-filter-btn${picks > 0 ? ' hg-on' : ''}`}
            aria-label={t('vinnubord.top.filters')}
            aria-expanded={filterSheetOpen}
            onClick={onOpenFilters}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 4h12M2 8h12M2 12h12" />
              <circle cx="5" cy="4" r="1.6" />
              <circle cx="11" cy="8" r="1.6" />
              <circle cx="7" cy="12" r="1.6" />
            </svg>
            {picks > 0 && <em>{picks}</em>}
          </button>
        )}
        {others.length > 0 && (
          <ul className="hg-who" aria-label={t('vinnubord.top.participants')}>
            {others.map((p) => (
              <li key={p.id} className={`hg-top-av${p.is_service ? ' hg-top-av-service' : ''}`} title={p.display_name}>
                <span aria-hidden="true">{p.short}</span>
                <span className="hg-sr">{p.display_name}</span>
              </li>
            ))}
          </ul>
        )}
        <ViewerMenu slug={project.slug} projectId={project.id} viewer={viewer} />
        <button type="button" className="hg-new" onClick={onNewItem} aria-label={t('vinnubord.top.newItem')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
          <span>{t('vinnubord.top.newItem')}</span>
        </button>
      </div>
    </header>
  )
}

// The viewer's own avatar (ruling R4): project settings, language and sign out.
function ViewerMenu({ slug, projectId, viewer }: { slug: string; projectId: string; viewer: Props['viewer'] }) {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [marking, setMarking] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)
  const menuId = useId()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(root, open, close)
  const p = viewer.participant
  const name = p?.display_name ?? viewer.email ?? ''

  async function handleSignOut() {
    setBusy(true)
    try {
      // The protected route sends a signed out user to /login.
      await signOut()
    } catch (e) {
      console.error(e)
      setBusy(false)
    }
  }

  async function handleMarkAll() {
    setMarking(true)
    try {
      await markAllRead(projectId)
      close()
    } catch (e) {
      // The menu stays open so the viewer can try again.
      console.error(e)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div ref={root} className="hg-dd hg-dd-end">
      <button
        type="button"
        className={`hg-top-av hg-viewer${p?.is_service ? ' hg-top-av-service' : ''}`}
        aria-label={t('vinnubord.top.viewerMenu', { name })}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{p?.short ?? '?'}</span>
      </button>
      {open && (
        <div id={menuId} className="hg-menu hg-viewer-menu" role="group" aria-label={t('vinnubord.top.viewerMenu', { name })}>
          <p className="hg-menu-who">
            <b>{name}</b>
            {viewer.email && viewer.email !== name && <span>{viewer.email}</span>}
          </p>
          <Link className="hg-chip" to={`/p/${slug}/stillingar`} onClick={close}>
            {t('vinnubord.top.settings')}
          </Link>
          <button type="button" className="hg-chip" disabled={marking} onClick={() => void handleMarkAll()}>
            {t('vinnubord.top.markAllRead')}
          </button>
          <div className="hg-menu-row">
            <span>{t('vinnubord.top.language')}</span>
            <LanguageToggle className="hg-lang" />
          </div>
          <button type="button" className="hg-chip" onClick={() => void handleSignOut()} disabled={busy}>
            {t('vinnubord.top.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
