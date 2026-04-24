import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Avatar } from '../../../shared/components/Avatar'

export interface MentionItem {
  id: string
  label: string
  avatarUrl?: string | null
  email?: string | null
}

interface MentionSuggestionListProps {
  items: MentionItem[]
  command: (item: { id: string; label: string }) => void
}

export interface MentionSuggestionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

// Renders the @-mention popup for both Tiptap (description) and the comment
// composer. Forwards a ref so the parent can route arrow / enter / escape
// keys into the list without changing focus.
export const MentionSuggestionList = forwardRef<MentionSuggestionListHandle, MentionSuggestionListProps>(
  function MentionSuggestionList({ items, command }, ref) {
    const [selected, setSelected] = useState(0)

    useEffect(() => { setSelected(0) }, [items])

    function pick(index: number) {
      const item = items[index]
      if (item) command({ id: item.id, label: item.label })
    }

    useImperativeHandle(ref, () => ({
      onKeyDown(event) {
        if (event.key === 'ArrowDown') {
          setSelected((s) => (items.length === 0 ? 0 : (s + 1) % items.length))
          return true
        }
        if (event.key === 'ArrowUp') {
          setSelected((s) => (items.length === 0 ? 0 : (s - 1 + items.length) % items.length))
          return true
        }
        if (event.key === 'Enter') {
          pick(selected)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="bg-huginn-card border border-huginn-border rounded-lg shadow-2xl px-3 py-2 text-xs text-huginn-text-muted w-56">
          No matching members
        </div>
      )
    }

    return (
      <div className="bg-huginn-card border border-huginn-border rounded-lg shadow-2xl py-1 max-h-60 overflow-y-auto w-56">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => pick(index)}
            onMouseEnter={() => setSelected(index)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors ${
              index === selected
                ? 'bg-huginn-accent-soft text-white'
                : 'text-huginn-text-secondary hover:text-white hover:bg-huginn-hover'
            }`}
          >
            <Avatar
              url={item.avatarUrl}
              name={item.label}
              email={item.email ?? undefined}
              size={20}
            />
            <span className="truncate font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    )
  },
)
