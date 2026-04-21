import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Label } from '../../../shared/lib/types'
import { getContrastTextColor } from '../../../shared/lib/contrast'

const LABEL_COLORS = [
  '#4bce97', '#1f845a', '#216e4e',
  '#f5cd47', '#e2b203', '#946f00',
  '#fea362', '#e56910', '#a54800',
  '#f87168', '#c9372c', '#ae2e24',
  '#cf8de0', '#8270db', '#5e4db2',
  '#579dff', '#1d7afc', '#0c66e4',
  '#60c6d2', '#1d9aaa', '#206a83',
  '#94c748', '#5b7f24', '#37471f',
  '#e774bb', '#ae4787', '#5d1f42',
  '#8590a2', '#596773', '#454f59',
]

interface LabelPickerProps {
  labels: Label[]
  activeLabelIds: string[]
  onToggle: (labelId: string) => void
  onCreate: (name: string, color: string) => Promise<unknown>
  onUpdate?: (labelId: string, updates: { name?: string; color?: string }) => Promise<unknown>
  onDelete?: (labelId: string) => Promise<unknown>
  onClose: () => void
}

type Mode =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; labelId: string }

export function LabelPicker({ labels, activeLabelIds, onToggle, onCreate, onUpdate, onDelete, onClose }: LabelPickerProps) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [query, setQuery] = useState('')
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState(LABEL_COLORS[0])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return labels
    return labels.filter(l => l.name.toLowerCase().includes(q))
  }, [labels, query])

  function openCreate() {
    setFormName(query.trim())
    setFormColor(LABEL_COLORS[0])
    setMode({ kind: 'create' })
  }

  function openEdit(label: Label) {
    setFormName(label.name)
    setFormColor(label.color)
    setMode({ kind: 'edit', labelId: label.id })
  }

  function backToList() {
    setMode({ kind: 'list' })
    setFormName('')
  }

  async function handleSave() {
    const trimmed = formName.trim()
    if (!trimmed) return
    if (mode.kind === 'edit' && onUpdate) {
      await onUpdate(mode.labelId, { name: trimmed, color: formColor })
    } else if (mode.kind === 'create') {
      await onCreate(trimmed, formColor)
    }
    backToList()
  }

  async function handleDelete() {
    if (mode.kind !== 'edit' || !onDelete) return
    await onDelete(mode.labelId)
    backToList()
  }

  return createPortal(
    <>
      {/* Backdrop — dims content behind and closes on outside click */}
      <div className="fixed inset-0 z-[70] bg-black/40" onClick={onClose} />

      <div
        className="fixed z-[71] bg-huginn-card border border-huginn-border rounded-xl shadow-2xl w-72 overflow-hidden max-h-[min(calc(100vh-2rem),640px)] flex flex-col"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center px-3 py-2.5 border-b border-huginn-border shrink-0">
          {mode.kind !== 'list' && (
            <button
              onClick={backToList}
              className="absolute left-2 text-huginn-text-muted hover:text-huginn-text-primary p-1 rounded hover:bg-huginn-hover"
              aria-label="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M10.28 3.22a.75.75 0 0 1 0 1.06L6.56 8l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <p className="text-sm font-semibold text-huginn-text-primary">
            {mode.kind === 'edit' ? 'Edit label' : mode.kind === 'create' ? 'Create label' : 'Labels'}
          </p>
          <button
            onClick={onClose}
            className="absolute right-2 text-huginn-text-muted hover:text-huginn-text-primary p-1 rounded hover:bg-huginn-hover"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {mode.kind === 'list' ? (
          <>
            {/* Search */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search labels..."
                className="w-full bg-huginn-surface text-sm text-huginn-text-primary rounded-md px-2.5 py-1.5 outline-none border border-huginn-border focus:border-huginn-accent placeholder-huginn-text-muted"
              />
            </div>

            {/* Label rows */}
            <div className="px-3 pb-2 flex-1 min-h-0 overflow-y-auto">
              <p className="text-[11px] font-semibold text-huginn-text-secondary mb-1.5 mt-1">Labels</p>
              <div className="space-y-1.5">
                {filtered.map((label) => {
                  const isActive = activeLabelIds.includes(label.id)
                  return (
                    <div key={label.id} className="flex items-center gap-2">
                      <button
                        onClick={() => onToggle(label.id)}
                        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                          isActive
                            ? 'bg-huginn-accent border-huginn-accent text-white'
                            : 'border-huginn-text-muted hover:border-huginn-text-secondary'
                        }`}
                        aria-label={isActive ? `Unselect ${label.name}` : `Select ${label.name}`}
                      >
                        {isActive && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => onToggle(label.id)}
                        className="flex-1 text-left text-xs font-semibold rounded-md px-2.5 py-1.5 truncate transition-all hover:brightness-110 shadow-sm"
                        style={{ backgroundColor: label.color, color: getContrastTextColor(label.color) }}
                      >
                        {label.name}
                      </button>
                      {onUpdate && (
                        <button
                          onClick={() => openEdit(label)}
                          className="text-huginn-text-muted hover:text-huginn-text-primary p-1 rounded hover:bg-huginn-hover shrink-0"
                          aria-label={`Edit ${label.name}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25a1.75 1.75 0 0 1 .445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086Zm-1.177 3.3L9.811 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064l6.286-6.286Z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })}
                {filtered.length === 0 && (
                  <p className="text-xs text-huginn-text-muted py-3 text-center">
                    {query ? 'No labels match' : 'No labels yet'}
                  </p>
                )}
              </div>
            </div>

            {/* Create button */}
            <div className="px-3 pt-2 pb-3 border-t border-huginn-border shrink-0">
              <button
                onClick={openCreate}
                className="w-full bg-huginn-surface hover:bg-huginn-hover text-huginn-text-primary text-xs font-semibold rounded-md px-2.5 py-2 transition-colors"
              >
                Create a new label
              </button>
            </div>
          </>
        ) : (
          /* Create / Edit form */
          <div className="p-3 space-y-3 overflow-y-auto">
            {/* Preview */}
            <div className="flex items-center justify-center bg-huginn-surface/60 rounded-md py-4">
              <span
                className="text-xs font-semibold rounded-md px-3 py-1.5 shadow-sm max-w-[14rem] truncate"
                style={{ backgroundColor: formColor, color: getContrastTextColor(formColor) }}
              >
                {formName.trim() || 'Label preview'}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-huginn-text-secondary mb-1">Title</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Label name"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                className="w-full bg-huginn-surface text-sm text-huginn-text-primary rounded-md px-2.5 py-1.5 outline-none border border-huginn-border focus:border-huginn-accent placeholder-huginn-text-muted"
              />
            </div>

            <div>
              <p className="block text-[11px] font-semibold text-huginn-text-secondary mb-1.5">Select a color</p>
              <div className="grid grid-cols-6 gap-1.5">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={`h-7 rounded-md transition-all hover:brightness-110 ${
                      formColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-huginn-card' : ''
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {mode.kind === 'edit' && onDelete ? (
                <button
                  onClick={handleDelete}
                  className="bg-huginn-surface hover:bg-huginn-danger/20 text-huginn-danger text-xs font-semibold rounded-md px-3 py-1.5 transition-colors"
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={handleSave}
                disabled={!formName.trim()}
                className="bg-huginn-accent hover:bg-huginn-accent-hover text-white text-xs font-semibold rounded-md px-3 py-1.5 disabled:opacity-50 transition-colors"
              >
                {mode.kind === 'edit' ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
