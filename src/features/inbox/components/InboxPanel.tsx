import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Task } from '../../../shared/lib/types'
import { EmptyState } from '../../../shared/components/Logo'

interface InboxPanelProps {
  cards: Task[]
  loading: boolean
  onAddCard: (title: string) => Promise<unknown>
  onDeleteCard: (cardId: string) => void
  onCardTap: (card: Task) => void
  onClose: () => void
}

export function InboxPanel({ cards, loading, onAddCard, onDeleteCard, onCardTap, onClose }: InboxPanelProps) {
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    await onAddCard(trimmed)
    setNewTitle('')
  }

  return (
    <div className="w-72 min-w-[288px] bg-huginn-base border-r border-huginn-border flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-huginn-border">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-text-secondary">
            <path d="M3.5 9.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v6a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-6Zm1 2v4a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-4h-3.09a3 3 0 0 1-5.82 0H4.5Z" />
          </svg>
          <h2 className="text-sm font-bold text-huginn-text-primary">Inbox</h2>
        </div>
        <button onClick={onClose} className="text-huginn-text-muted hover:text-white transition-colors p-1 rounded hover:bg-huginn-hover">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Add card */}
      <div className="px-3 py-2">
        {adding ? (
          <div>
            <textarea
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter a title..."
              autoFocus
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() }
                if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
              }}
              className="w-full bg-huginn-card text-sm text-huginn-text-primary rounded-lg px-3 py-2 outline-none border border-huginn-border focus:border-huginn-accent resize-none placeholder-huginn-text-muted"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleAdd}
                disabled={!newTitle.trim()}
                className="bg-huginn-accent text-white text-xs font-semibold rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                Add card
              </button>
              <button onClick={() => { setAdding(false); setNewTitle('') }} className="text-huginn-text-muted hover:text-white text-xs">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-sm text-huginn-text-muted hover:text-huginn-text-secondary w-full px-2 py-1.5 rounded-md hover:bg-huginn-card/50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
            </svg>
            Add a card
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        {loading ? (
          <p className="text-xs text-huginn-text-muted py-4 text-center">Loading...</p>
        ) : cards.length === 0 ? (
          <EmptyState
            title="Your inbox is empty"
            hint="Capture quick ideas here."
          />
        ) : (
          cards.map((card) => (
            <DraggableInboxCard
              key={card.id}
              card={card}
              onTap={() => onCardTap(card)}
              onDelete={() => onDeleteCard(card.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function DraggableInboxCard({ card, onTap, onDelete }: { card: Task; onTap: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onTap}
      className={`bg-huginn-card rounded-lg p-3 mb-2 cursor-pointer hover:bg-huginn-hover transition-colors group select-none ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <p className="text-sm text-huginn-text-primary flex-1 break-words">{card.title}</p>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-huginn-text-muted hover:text-huginn-danger opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
      {card.due_date && (
        <p className="text-[10px] text-huginn-text-muted mt-1">{card.due_date}</p>
      )}
    </div>
  )
}
