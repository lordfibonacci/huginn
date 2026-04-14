import { useEffect, useRef, useState } from 'react'
import type { Task, TaskStatus, ThoughtPriority, List } from '../../../shared/lib/types'
import { timeAgo } from '../../../shared/lib/dateUtils'
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
import { useAuth } from '../../../shared/hooks/useAuth'
import { useBoardMembers } from '../hooks/useBoardMembers'
import { useTaskMembers } from '../hooks/useTaskMembers'

interface CardPopupProps {
  task: Task
  projectId: string
  lists: List[]
  onUpdate: (id: string, updates: { title?: string; notes?: string | null; status?: TaskStatus; priority?: ThoughtPriority | null; due_date?: string | null; list_id?: string }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onClose: () => void
}

const PRIORITY_OPTIONS: { value: ThoughtPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-huginn-warning' },
  { value: 'high', label: 'High', color: 'bg-huginn-danger' },
]

export function CardPopup({ task, projectId, lists, onUpdate, onDelete, onClose }: CardPopupProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.notes ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [priority, setPriority] = useState<ThoughtPriority | null>(task.priority)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [visible, setVisible] = useState(false)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { user } = useAuth()
  const { checklists, addChecklist, deleteChecklist, renameChecklist, addItem, toggleItem, updateItemText, deleteItem } = useChecklists(task.id)
  const { labels: projectLabels, createLabel } = useLabels(projectId)
  const { labelIds, addLabel, removeLabel, hasLabel } = useTaskLabels(task.id)
  const { comments, addComment, deleteComment } = useComments(task.id)
  const { activities } = useActivity(task.id)
  const { attachments, uploadFile, deleteAttachment } = useAttachments(task.id)
  const { members: boardMembers } = useBoardMembers(projectId)
  const { memberIds: assignedIds, profiles: assignedProfiles, assignMember, unassignMember, isAssigned } = useTaskMembers(task.id)
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const taskLabels = projectLabels.filter(l => labelIds.includes(l.id))

  const currentList = lists.find(l => l.id === task.list_id)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  // Reset when task changes
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.notes ?? '')
    setDueDate(task.due_date ?? '')
    setPriority(task.priority)
    setConfirmDelete(false)
  }, [task.id, task.title, task.notes, task.due_date, task.priority])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  // Auto-save title on blur
  function handleTitleBlur() {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) {
      onUpdate(task.id, { title: trimmed })
    }
  }

  // Auto-save description on blur
  function handleDescriptionChange(html: string) {
    setDescription(html)
    // Debounce save (save after user stops typing for 1s)
    const clean = html === '<p></p>' ? null : html
    if (clean !== task.notes) {
      onUpdate(task.id, { notes: clean })
    }
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    onDelete(task.id)
    handleClose()
  }

  function handleMoveToList(listId: string) {
    if (listId !== task.list_id) {
      onUpdate(task.id, { list_id: listId })
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center pt-12 md:pt-16 px-4 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div
        className={`relative bg-huginn-card rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto transition-transform duration-200 ${
          visible ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 text-huginn-text-muted hover:text-white bg-huginn-surface/80 rounded-full p-2 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>

        <div className="flex flex-col md:flex-row">
          {/* Left column — main content */}
          <div className="flex-1 p-8 md:pr-6 space-y-6">
            {/* List indicator */}
            {currentList && (
              <p className="text-sm text-huginn-text-muted">
                in list <span className="font-semibold text-huginn-text-primary">{currentList.name}</span>
              </p>
            )}

            {/* Title */}
            <textarea
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                // Auto-grow
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
              rows={1}
              className="w-full bg-transparent text-2xl font-bold text-huginn-text-primary outline-none placeholder-huginn-text-muted leading-snug resize-none overflow-hidden"
              placeholder="Card title"
            />

            {/* Labels + Members */}
            {(taskLabels.length > 0 || assignedProfiles.length > 0) && (
              <div className="flex items-center gap-4 flex-wrap">
                {taskLabels.length > 0 && (
                  <div>
                    <p className="text-xs text-huginn-text-muted font-semibold mb-1.5">Labels</p>
                    <LabelBadges labels={taskLabels} />
                  </div>
                )}
                {assignedProfiles.length > 0 && (
                  <div>
                    <p className="text-xs text-huginn-text-muted font-semibold mb-1.5">Members</p>
                    <MemberAvatars profiles={assignedProfiles} />
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <p className="text-sm text-huginn-text-muted font-semibold mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h7A2.5 2.5 0 0 1 14 4.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 11.5v-7ZM4 5.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4ZM4 8a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4Zm0 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H4Z" />
                </svg>
                Description
              </p>
              <RichTextEditor
                content={description}
                onChange={handleDescriptionChange}
                placeholder="Add a more detailed description..."
              />
            </div>

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
            {attachments.length > 0 && (
              <div>
                <p className="text-sm text-huginn-text-muted font-semibold mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path d="M11.5 2a3.5 3.5 0 0 0-2.475 1.025L3.22 8.83a2.2 2.2 0 0 0 3.111 3.111l4.87-4.87a.75.75 0 1 1 1.06 1.06l-4.87 4.87a3.7 3.7 0 0 1-5.232-5.232l5.805-5.805A5 5 0 0 1 15.025 9.05l-5.805 5.805a3.2 3.2 0 0 1-4.525-4.525l4.87-4.87a.75.75 0 1 1 1.06 1.06l-4.87 4.87a1.7 1.7 0 0 0 2.404 2.404l5.805-5.805A3.5 3.5 0 0 0 11.5 2Z" />
                  </svg>
                  Attachments
                </p>
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-3 bg-huginn-card rounded-lg p-2.5 group">
                      {att.type === 'image' ? (
                        <img src={att.url} alt={att.name} className="w-16 h-12 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-16 h-12 rounded bg-huginn-surface flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-huginn-text-muted">
                            <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V6.621a1.5 1.5 0 0 0-.44-1.06L9.94 2.44A1.5 1.5 0 0 0 8.878 2H3.5Z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-huginn-text-primary hover:text-huginn-accent truncate block">
                          {att.name}
                        </a>
                        <p className="text-[10px] text-huginn-text-muted mt-0.5">
                          {att.size ? `${(att.size / 1024).toFixed(0)} KB` : att.type === 'link' ? 'Link' : 'File'}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteAttachment(att.id)}
                        className="text-huginn-text-muted hover:text-huginn-danger opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments & Activity */}
            <CommentSection
              comments={comments}
              activities={activities}
              currentUserId={user?.id ?? ''}
              onAddComment={addComment}
              onDeleteComment={deleteComment}
            />
          </div>

          {/* Right column — sidebar actions */}
          <div className="w-full md:w-52 p-8 md:pl-3 md:pt-14 space-y-1.5">
            <p className="text-xs uppercase tracking-wider font-bold text-huginn-text-muted mb-2">Add to card</p>

            {/* Members */}
            <div className="relative">
              <SidebarButton onClick={() => setShowMemberPicker(!showMemberPicker)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.7 14a6.98 6.98 0 0 0-9.4 0 .5.5 0 0 0 .35.85h8.7a.5.5 0 0 0 .35-.85Z" />
                </svg>
                Members
              </SidebarButton>
              {showMemberPicker && (
                <MemberPicker
                  boardMembers={boardMembers}
                  assignedIds={assignedIds}
                  onToggle={(userId) => isAssigned(userId) ? unassignMember(userId) : assignMember(userId)}
                  onClose={() => setShowMemberPicker(false)}
                />
              )}
            </div>

            {/* Labels */}
            <div className="relative">
              <SidebarButton onClick={() => setShowLabelPicker(!showLabelPicker)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M3.5 1A1.5 1.5 0 0 0 2 2.5v9.793a.5.5 0 0 0 .854.354l2.646-2.647 2.646 2.647a.5.5 0 0 0 .854-.354V2.5A1.5 1.5 0 0 0 7.5 1h-4Z" />
                </svg>
                Labels
              </SidebarButton>
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

            {/* Checklist */}
            <SidebarButton onClick={() => addChecklist('Checklist')}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M12.4 4.7a.75.75 0 0 1 .1 1.06l-5.25 6a.75.75 0 0 1-1.1.02L3.6 9.1a.75.75 0 1 1 1.1-1.02l2.05 2.22 4.7-5.37a.75.75 0 0 1 1.06-.1l-.1-.13Z" clipRule="evenodd" />
              </svg>
              Checklist
            </SidebarButton>

            {/* Attachment */}
            <label className="flex items-center gap-2 w-full text-xs text-huginn-text-secondary bg-huginn-card hover:bg-huginn-hover rounded-md px-2.5 py-1.5 transition-colors cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M11.5 2a3.5 3.5 0 0 0-2.475 1.025L3.22 8.83a2.2 2.2 0 0 0 3.111 3.111l4.87-4.87a.75.75 0 1 1 1.06 1.06l-4.87 4.87a3.7 3.7 0 0 1-5.232-5.232l5.805-5.805A5 5 0 0 1 15.025 9.05l-5.805 5.805a3.2 3.2 0 0 1-4.525-4.525l4.87-4.87a.75.75 0 1 1 1.06 1.06l-4.87 4.87a1.7 1.7 0 0 0 2.404 2.404l5.805-5.805A3.5 3.5 0 0 0 11.5 2Z" />
              </svg>
              Attachment
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadFile(file)
                  e.target.value = ''
                }}
              />
            </label>

            {/* Due date */}
            <div>
              <SidebarButton onClick={() => {}}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M5 4a.75.75 0 0 0-1.5 0v1H2.75A.75.75 0 0 0 2 5.75v.5c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75v-.5a.75.75 0 0 0-.75-.75H12.5V4a.75.75 0 0 0-1.5 0v1h-5V4Z" />
                  <path d="M2 9.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 .75.75v4a1.75 1.75 0 0 1-1.75 1.75H3.75A1.75 1.75 0 0 1 2 13.25v-4Z" />
                </svg>
                Dates
              </SidebarButton>
              {/* Inline date input */}
              <div className="mt-1">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value)
                    onUpdate(task.id, { due_date: e.target.value || null })
                  }}
                  className="w-full bg-huginn-surface text-huginn-text-primary rounded-md px-2 py-1 text-xs outline-none border border-huginn-border focus:border-huginn-accent [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Priority */}
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-huginn-text-muted mb-2 mt-5">Priority</p>
              <div className="flex flex-col gap-1.5">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const newP = priority === opt.value ? null : opt.value
                      setPriority(newP)
                      onUpdate(task.id, { priority: newP })
                    }}
                    className={`text-sm py-1.5 px-3 rounded-lg text-left font-medium transition-colors ${
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

            {/* Move to list */}
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-huginn-text-muted mb-2 mt-5">Actions</p>
              <select
                value={task.list_id ?? ''}
                onChange={(e) => handleMoveToList(e.target.value)}
                className="w-full bg-huginn-surface text-huginn-text-secondary rounded-lg px-3 py-2 text-sm outline-none border border-huginn-border focus:border-huginn-accent appearance-none mb-1.5"
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>

              <button
                onClick={handleDelete}
                className={`w-full text-left text-sm py-2 px-3 rounded-lg transition-colors ${
                  confirmDelete ? 'text-red-400 bg-huginn-danger/10 font-semibold' : 'bg-huginn-surface text-huginn-text-secondary hover:text-huginn-danger hover:bg-huginn-danger/10'
                }`}
              >
                {confirmDelete ? 'Click again to delete' : 'Delete card'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full text-sm text-huginn-text-secondary bg-huginn-surface hover:bg-huginn-hover rounded-lg px-3 py-2 transition-colors"
    >
      {children}
    </button>
  )
}
