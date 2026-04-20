import { useEffect, useState } from 'react'
import type { Task, TaskStatus, ThoughtPriority, List, Profile } from '../../../shared/lib/types'
import { RichTextEditor } from './RichTextEditor'
import { ChecklistSection } from './ChecklistSection'
import { LabelBadges } from './LabelBadges'
import { LabelPicker } from './LabelPicker'
import { useChecklists } from '../hooks/useChecklists'
import { useLabels } from '../hooks/useLabels'
import { useTaskLabels } from '../hooks/useTaskLabels'
import { useComments } from '../hooks/useComments'
import { useActivity } from '../hooks/useActivity'
import { useAttachments } from '../hooks/useAttachments'
import { CommentSection } from './CommentSection'
import { MemberAvatars } from './MemberAvatars'
import { MemberPicker } from './MemberPicker'
import { CardThreeDotMenu } from './CardThreeDotMenu'
import { MoveCardDialog } from './MoveCardDialog'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useProfile } from '../../../shared/hooks/useProfile'
import { DatePicker } from './DatePicker'
import { useBoardMembers } from '../hooks/useBoardMembers'
import { useTaskMembers } from '../hooks/useTaskMembers'
import { supabase } from '../../../shared/lib/supabase'
import { timeAgo } from '../../../shared/lib/dateUtils'

interface CardPopupProps {
  task: Task
  projectId: string
  lists: List[]
  onUpdate: (id: string, updates: { title?: string; notes?: string | null; status?: TaskStatus; priority?: ThoughtPriority | null; due_date?: string | null; list_id?: string; position?: number }) => Promise<boolean>
  /** Optional optimistic-remove for when the card leaves the current project (inbox / archive / move to board). */
  onMovedAway?: (id: string) => void
  onDelete: (id: string) => Promise<boolean>
  /** Card menu actions — passed from parent so they can use hooks that live there. */
  onArchive?: (id: string) => Promise<boolean>
  onCopy?: (id: string) => Promise<Task | null>
  onMoveToBoard?: (id: string, projectId: string, listId: string) => Promise<boolean>
  onClose: () => void
}

const PRIORITY_OPTIONS: { value: ThoughtPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-huginn-warning' },
  { value: 'high', label: 'High', color: 'bg-huginn-danger' },
]

export function CardPopup({ task, projectId, lists, onUpdate, onDelete, onClose, onMovedAway, onArchive, onCopy, onMoveToBoard }: CardPopupProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.notes ?? '')
  const [descOriginal, setDescOriginal] = useState(task.notes ?? '')
  const [descEditing, setDescEditing] = useState(false)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [priority, setPriority] = useState<ThoughtPriority | null>(task.priority)
  const [visible, setVisible] = useState(false)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showListMenu, setShowListMenu] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)

  const { user } = useAuth()
  const { profile: selfProfile } = useProfile()
  const { checklists, addChecklist, deleteChecklist, renameChecklist, addItem, toggleItem, updateItemText, deleteItem } = useChecklists(task.id)
  const { labels: projectLabels, createLabel } = useLabels(projectId)
  const { labelIds, addLabel, removeLabel, hasLabel } = useTaskLabels(task.id)
  const { comments, addComment, deleteComment } = useComments(task.id)
  const { activities, logActivity } = useActivity(task.id)
  const { attachments, uploadFile, deleteAttachment, setCover, coverImage } = useAttachments(task.id)
  const { members: boardMembers } = useBoardMembers(projectId)
  const { memberIds: assignedIds, profiles: assignedProfiles, assignMember, unassignMember, isAssigned } = useTaskMembers(task.id)
  const taskLabels = projectLabels.filter(l => labelIds.includes(l.id))

  const currentList = lists.find(l => l.id === task.list_id)
  const isInboxCard = !task.project_id || !projectId

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // Escape closes the popup (lightbox handler uses capture-phase + stopImmediatePropagation
  // so it wins when the lightbox is open).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  // Lightbox state for image-attachment viewer
  const [lightbox, setLightbox] = useState<{ attachmentId: string | null; url: string; name: string } | null>(null)
  useEffect(() => {
    if (!lightbox) return
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setLightbox(null)
      }
    }
    document.addEventListener('keydown', onEsc, { capture: true })
    return () => document.removeEventListener('keydown', onEsc, { capture: true } as EventListenerOptions)
  }, [lightbox])

  function openImageInLightbox(url: string, name: string) {
    const att = attachments.find(a => a.url === url)
    setLightbox({ attachmentId: att?.id ?? null, url, name })
  }

  // Paste-to-attach
  const [pasting, setPasting] = useState(false)
  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      const imageFiles: File[] = []
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }
      if (imageFiles.length === 0) return
      e.preventDefault()
      setPasting(true)
      try {
        for (const f of imageFiles) {
          const named = f.name && f.name !== 'image.png'
            ? f
            : new File([f], `pasted-${Date.now()}.${(f.type.split('/')[1] || 'png')}`, { type: f.type })
          const result = await uploadFile(named)
          if (result) {
            await logActivity('attached', { name: result.name, url: result.url, type: result.type })
          }
        }
      } finally {
        setPasting(false)
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [uploadFile, logActivity])

  // Reset local state when switching to a different card.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.notes ?? '')
    setDescOriginal(task.notes ?? '')
    setDescEditing(false)
    setDueDate(task.due_date ?? '')
    setPriority(task.priority)
  }, [task.id])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  function handleTitleBlur() {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) {
      onUpdate(task.id, { title: trimmed })
    }
  }

  // Description: click-to-edit with Save/Cancel
  function handleEditDescription() {
    setDescOriginal(task.notes ?? '')
    setDescription(task.notes ?? '')
    setDescEditing(true)
  }
  async function handleSaveDescription() {
    const clean = description === '<p></p>' || description === '' ? null : description
    await onUpdate(task.id, { notes: clean })
    setDescEditing(false)
  }
  function handleCancelDescription() {
    setDescription(descOriginal)
    setDescEditing(false)
  }
  const descriptionDirty = descEditing && description !== descOriginal

  function handleMoveToList(listId: string) {
    if (listId !== task.list_id) {
      onUpdate(task.id, { list_id: listId })
    }
    setShowListMenu(false)
  }

  async function handleMoveToInbox() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return
    const { error } = await supabase
      .from('huginn_tasks')
      .update({ project_id: null, list_id: null, user_id: authUser.id, position: 0 })
      .eq('id', task.id)
    if (error) {
      console.error('Move-to-inbox failed:', error)
      return
    }
    onMovedAway?.(task.id)
    handleClose()
  }

  async function handleArchive() {
    if (!onArchive) return
    const ok = await onArchive(task.id)
    if (ok) handleClose()
  }

  async function handleCopy() {
    if (!onCopy) return
    await onCopy(task.id)
    // Stay open on the original card; the new copy appears in the board list.
  }

  async function handleMoveToBoard(targetProjectId: string, targetListId: string) {
    if (!onMoveToBoard) return
    const ok = await onMoveToBoard(task.id, targetProjectId, targetListId)
    if (ok) handleClose()
  }

  const profileById: Record<string, Profile> = (() => {
    const map: Record<string, Profile> = {}
    for (const m of boardMembers) if (m.profile) map[m.user_id] = m.profile
    if (selfProfile) map[selfProfile.id] = selfProfile
    return map
  })()

  const isDone = task.status === 'done'

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center pt-8 md:pt-12 px-4 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div
        className={`relative bg-huginn-card rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto transition-transform duration-200 ${
          visible ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover hero */}
        {coverImage && (
          <button
            type="button"
            onClick={() => openImageInLightbox(coverImage.url, coverImage.name)}
            className="block w-full bg-black/30 overflow-hidden"
            title="Open cover image"
          >
            <img
              src={coverImage.url}
              alt={coverImage.name}
              className="w-full max-h-64 object-cover select-none"
              draggable={false}
            />
          </button>
        )}

        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 px-6 pt-5">
          {/* List dropdown (board cards) or Inbox pill (inbox cards) */}
          {!isInboxCard && currentList ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowListMenu(o => !o)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-huginn-surface hover:bg-huginn-hover text-huginn-text-primary rounded-md px-3 py-1.5 transition-colors"
              >
                {currentList.name}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-70">
                  <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </button>
              {showListMenu && (
                <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-huginn-card border border-huginn-border rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto">
                  {lists.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => handleMoveToList(l.id)}
                      className={`w-full text-left text-sm px-3 py-1.5 transition-colors ${
                        l.id === task.list_id
                          ? 'bg-huginn-accent/15 text-huginn-accent font-semibold'
                          : 'text-huginn-text-primary hover:bg-huginn-hover'
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : isInboxCard ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold bg-huginn-surface text-huginn-text-primary rounded-md px-3 py-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M3.5 7.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v4a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-4Zm1 2v2a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-2H10a2.5 2.5 0 0 1-4 0H4.5Z" />
              </svg>
              Inbox
            </span>
          ) : <div />}

          <div className="flex items-center gap-1.5">
            {!isInboxCard && (
              <CardThreeDotMenu
                onMove={() => setShowMoveDialog(true)}
                onCopy={handleCopy}
                onArchive={handleArchive}
                onDelete={() => { onDelete(task.id); handleClose() }}
              />
            )}
            {isInboxCard && (
              <CardThreeDotMenu
                inboxMode
                onMove={() => { /* unused for inbox */ }}
                onCopy={handleCopy}
                onArchive={() => { /* unused for inbox */ }}
                onDelete={() => { onDelete(task.id); handleClose() }}
              />
            )}
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center text-huginn-text-muted hover:text-white bg-huginn-surface/80 hover:bg-huginn-hover rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex flex-col md:flex-row md:gap-0 p-6 md:pr-0">
          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-5 md:pr-6">
            {/* Title row */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => onUpdate(task.id, { status: isDone ? 'todo' : 'done' })}
                className={`mt-1.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                  isDone
                    ? 'bg-huginn-success border-huginn-success text-white'
                    : 'border-huginn-text-muted hover:border-huginn-accent'
                }`}
                aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
              >
                {isDone && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M13.3 4.3a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0l-3-3a1 1 0 0 1 1.4-1.4L6.6 9.6l5.3-5.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <textarea
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                rows={1}
                className={`w-full bg-transparent text-2xl font-bold outline-none placeholder-huginn-text-muted leading-snug resize-none overflow-hidden ${
                  isDone ? 'text-huginn-text-muted line-through' : 'text-huginn-text-primary'
                }`}
                placeholder="Card title"
              />
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {!isInboxCard && (
                <div className="relative">
                  <QuickButton onClick={() => setShowMemberPicker(o => !o)} icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.7 14a6.98 6.98 0 0 0-9.4 0 .5.5 0 0 0 .35.85h8.7a.5.5 0 0 0 .35-.85Z" /></svg>}>
                    Members
                  </QuickButton>
                  {showMemberPicker && (
                    <MemberPicker
                      boardMembers={boardMembers}
                      assignedIds={assignedIds}
                      onToggle={(userId) => isAssigned(userId) ? unassignMember(userId) : assignMember(userId)}
                      onClose={() => setShowMemberPicker(false)}
                    />
                  )}
                </div>
              )}
              {!isInboxCard && (
                <div className="relative">
                  <QuickButton onClick={() => setShowLabelPicker(o => !o)} icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M3.5 1A1.5 1.5 0 0 0 2 2.5v9.793a.5.5 0 0 0 .854.354l2.646-2.647 2.646 2.647a.5.5 0 0 0 .854-.354V2.5A1.5 1.5 0 0 0 7.5 1h-4Z" /></svg>}>
                    Labels
                  </QuickButton>
                  {showLabelPicker && (
                    <LabelPicker
                      labels={projectLabels}
                      activeLabelIds={labelIds}
                      onToggle={(labelId) => hasLabel(labelId) ? removeLabel(labelId) : addLabel(labelId)}
                      onCreate={createLabel}
                      onClose={() => setShowLabelPicker(false)}
                    />
                  )}
                </div>
              )}
              <QuickButton onClick={() => addChecklist('Checklist')} icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M12.4 4.7a.75.75 0 0 1 .1 1.06l-5.25 6a.75.75 0 0 1-1.1.02L3.6 9.1a.75.75 0 1 1 1.1-1.02l2.05 2.22 4.7-5.37a.75.75 0 0 1 1.06-.1l-.1-.13Z" clipRule="evenodd" /></svg>}>
                Checklist
              </QuickButton>
              <label className="flex items-center gap-1.5 text-xs font-semibold bg-huginn-surface hover:bg-huginn-hover text-huginn-text-primary rounded-md px-3 py-1.5 transition-colors cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M11.5 2a3.5 3.5 0 0 0-2.475 1.025L3.22 8.83a2.2 2.2 0 0 0 3.111 3.111l4.87-4.87a.75.75 0 1 1 1.06 1.06l-4.87 4.87a3.7 3.7 0 0 1-5.232-5.232l5.805-5.805A5 5 0 0 1 15.025 9.05l-5.805 5.805a3.2 3.2 0 0 1-4.525-4.525l4.87-4.87a.75.75 0 1 1 1.06 1.06l-4.87 4.87a1.7 1.7 0 0 0 2.404 2.404l5.805-5.805A3.5 3.5 0 0 0 11.5 2Z" /></svg>
                Attachment
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const result = await uploadFile(file)
                      if (result) await logActivity('attached', { name: result.name, url: result.url, type: result.type })
                    }
                    e.target.value = ''
                  }}
                />
              </label>
              <div className="relative">
                <QuickButton onClick={() => setShowDatePicker(true)} icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M5 4a.75.75 0 0 0-1.5 0v1H2.75A.75.75 0 0 0 2 5.75v.5c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75H12.5V4a.75.75 0 0 0-1.5 0v1h-5V4Z" /><path d="M2 9.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 .75.75v4a1.75 1.75 0 0 1-1.75 1.75H3.75A1.75 1.75 0 0 1 2 13.25v-4Z" /></svg>}>
                  Dates
                </QuickButton>
                {showDatePicker && (
                  <DatePicker
                    startDate={task.start_date ?? ''}
                    dueDate={dueDate}
                    recurring={task.recurring ?? 'never'}
                    onSave={(dates) => {
                      if (dates.due_date !== undefined) setDueDate(dates.due_date ?? '')
                      onUpdate(task.id, dates)
                    }}
                    onClose={() => setShowDatePicker(false)}
                  />
                )}
              </div>
            </div>

            {/* Chips row: Labels / Members / Last updated */}
            {(taskLabels.length > 0 || assignedProfiles.length > 0 || task.updated_at) && (
              <div className="flex items-start gap-6 flex-wrap">
                {taskLabels.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-huginn-text-muted mb-1.5">Labels</p>
                    <LabelBadges labels={taskLabels} />
                  </div>
                )}
                {assignedProfiles.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-huginn-text-muted mb-1.5">Members</p>
                    <MemberAvatars profiles={assignedProfiles} />
                  </div>
                )}
                {task.updated_at && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-huginn-text-muted mb-1.5">Last updated</p>
                    <p className="text-xs text-huginn-text-secondary">{timeAgo(task.updated_at)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-huginn-text-muted font-semibold flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h7A2.5 2.5 0 0 1 14 4.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 11.5v-7ZM4 5.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4ZM4 8a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4Zm0 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H4Z" />
                  </svg>
                  Description
                  {descriptionDirty && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-huginn-warning/20 text-huginn-warning px-1.5 py-0.5 rounded">
                      Unsaved
                    </span>
                  )}
                </p>
                {!descEditing && (
                  <button
                    type="button"
                    onClick={handleEditDescription}
                    className="text-xs text-huginn-text-secondary hover:text-white bg-huginn-surface hover:bg-huginn-hover rounded-md px-3 py-1 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
              {descEditing ? (
                <>
                  <RichTextEditor
                    content={description}
                    onChange={setDescription}
                    placeholder="Add a more detailed description..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={handleSaveDescription}
                      className="bg-huginn-accent hover:bg-huginn-accent-hover text-white text-xs font-semibold rounded-md px-4 py-1.5"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelDescription}
                      className="text-huginn-text-secondary hover:text-white text-xs px-3 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : task.notes ? (
                <div
                  className="prose prose-invert prose-sm max-w-none bg-huginn-surface/60 border border-huginn-border/60 rounded-lg px-4 py-3"
                  dangerouslySetInnerHTML={{ __html: task.notes }}
                />
              ) : (
                <button
                  type="button"
                  onClick={handleEditDescription}
                  className="w-full text-left text-sm text-huginn-text-muted bg-huginn-surface/60 hover:bg-huginn-hover border border-huginn-border/60 rounded-lg px-4 py-3 transition-colors"
                >
                  Add a more detailed description…
                </button>
              )}
            </div>

            {/* Priority chips (board cards only) */}
            {!isInboxCard && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-huginn-text-muted mb-2">Priority</p>
                <div className="flex gap-1.5">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        const newP = priority === opt.value ? null : opt.value
                        setPriority(newP)
                        onUpdate(task.id, { priority: newP })
                      }}
                      className={`text-xs py-1.5 px-3 rounded-md font-semibold transition-colors ${
                        priority === opt.value
                          ? `${opt.color} text-white`
                          : 'bg-huginn-surface text-huginn-text-secondary hover:text-white hover:bg-huginn-hover'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Checklists */}
            {checklists.length > 0 && (
              <ChecklistSection
                checklists={checklists}
                onAddChecklist={addChecklist}
                onDeleteChecklist={deleteChecklist}
                onRenameChecklist={renameChecklist}
                onAddItem={addItem}
                onToggleItem={toggleItem}
                onUpdateItemText={updateItemText}
                onDeleteItem={deleteItem}
              />
            )}

            {/* Attachments */}
            {(attachments.length > 0 || pasting) && (
              <div>
                <p className="text-sm text-huginn-text-muted font-semibold mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path d="M11.5 2a3.5 3.5 0 0 0-2.475 1.025L3.22 8.83a2.2 2.2 0 0 0 3.111 3.111l4.87-4.87a.75.75 0 1 1 1.06 1.06l-4.87 4.87a3.7 3.7 0 0 1-5.232-5.232l5.805-5.805A5 5 0 0 1 15.025 9.05l-5.805 5.805a3.2 3.2 0 0 1-4.525-4.525l4.87-4.87a.75.75 0 1 1 1.06 1.06l-4.87 4.87a1.7 1.7 0 0 0 2.404 2.404l5.805-5.805A3.5 3.5 0 0 0 11.5 2Z" />
                  </svg>
                  Attachments
                  {pasting && <span className="text-[10px] font-normal text-huginn-accent animate-pulse ml-1">uploading…</span>}
                </p>
                <div className="space-y-2">
                  {attachments.map((att) => {
                    const isImage = att.type === 'image'
                    return (
                      <div key={att.id} className="flex items-center gap-3 bg-huginn-surface/60 rounded-lg p-2.5 group">
                        {isImage ? (
                          <button
                            type="button"
                            onClick={() => setLightbox({ attachmentId: att.id, url: att.url, name: att.name })}
                            className="shrink-0 rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-huginn-accent"
                            title="Open"
                          >
                            <img src={att.url} alt={att.name} className="w-20 h-14 object-cover" />
                          </button>
                        ) : (
                          <div className="w-20 h-14 rounded bg-huginn-card flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-huginn-text-muted">
                              <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V6.621a1.5 1.5 0 0 0-.44-1.06L9.94 2.44A1.5 1.5 0 0 0 8.878 2H3.5Z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {isImage ? (
                            <button
                              type="button"
                              onClick={() => setLightbox({ attachmentId: att.id, url: att.url, name: att.name })}
                              className="text-sm font-medium text-huginn-text-primary hover:text-huginn-accent truncate block text-left w-full"
                            >
                              {att.name}
                            </button>
                          ) : (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-huginn-text-primary hover:text-huginn-accent truncate block">
                              {att.name}
                            </a>
                          )}
                          <p className="text-[11px] text-huginn-text-muted mt-0.5">
                            Added {timeAgo(att.created_at)}{' · '}{att.size ? `${(att.size / 1024).toFixed(0)} KB` : att.type === 'link' ? 'Link' : 'File'}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteAttachment(att.id)}
                          className="text-huginn-text-muted hover:text-huginn-danger opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          aria-label="Delete attachment"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Move to inbox (board cards only) */}
            {!isInboxCard && (
              <div className="pt-2 border-t border-huginn-border/60">
                <button
                  onClick={handleMoveToInbox}
                  className="flex items-center gap-2 text-xs text-huginn-text-secondary hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M3.5 7.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v4a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-4Zm1 2v2a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-2H10a2.5 2.5 0 0 1-4 0H4.5Z" />
                  </svg>
                  Move to Inbox
                </button>
              </div>
            )}
          </div>

          {/* Right column — comments & activity */}
          <div className="w-full mt-6 md:mt-0 md:w-[360px] md:shrink-0 md:border-l md:border-huginn-border/60 md:bg-huginn-base/30 md:pl-6 md:pr-6 md:-mr-6 md:rounded-r-xl pt-2 md:pt-6 pb-2">
            <CommentSection
              comments={comments}
              activities={activities}
              currentUserId={user?.id ?? ''}
              profileById={profileById}
              onOpenImage={openImageInLightbox}
              onAddComment={addComment}
              onDeleteComment={deleteComment}
            />
          </div>
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6"
          onClick={(e) => {
            // Swallow the click so it doesn't bubble up to the card popup's
            // backdrop, which would close the whole card.
            e.stopPropagation()
            setLightbox(null)
          }}
        >
          <img
            src={lightbox.url}
            alt={lightbox.name}
            className="max-w-[92vw] max-h-[78vh] object-contain rounded-md shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
          <div
            className="mt-4 flex items-center gap-3 text-xs text-white/80 flex-wrap justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="truncate max-w-[50vw]">{lightbox.name}</span>
            <a
              href={lightbox.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-huginn-accent hover:text-white transition-colors"
            >
              Open in new tab ↗
            </a>
            <a
              href={lightbox.url}
              download={lightbox.name}
              className="text-white/80 hover:text-white transition-colors"
            >
              Download
            </a>
            {lightbox.attachmentId && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    if (lightbox.attachmentId) await setCover(lightbox.attachmentId)
                  }}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  Make cover
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!lightbox.attachmentId) return
                    await deleteAttachment(lightbox.attachmentId)
                    setLightbox(null)
                  }}
                  className="text-huginn-danger hover:text-white transition-colors"
                >
                  Delete
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="text-white/60 hover:text-white transition-colors"
            >
              Close (Esc)
            </button>
          </div>
        </div>
      )}

      {showMoveDialog && !isInboxCard && (
        <MoveCardDialog
          currentProjectId={projectId}
          currentListId={task.list_id}
          onMove={(targetProjectId, targetListId) => handleMoveToBoard(targetProjectId, targetListId)}
          onDone={() => setShowMoveDialog(false)}
        />
      )}
    </div>
  )
}

function QuickButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-semibold bg-huginn-surface hover:bg-huginn-hover text-huginn-text-primary rounded-md px-3 py-1.5 transition-colors"
    >
      {icon}
      {children}
    </button>
  )
}
