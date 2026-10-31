import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react'
import type { FilterOption } from '../lib/filters'

// Closes a dropdown on a pointer down outside root and on Esc. Esc is caught
// in the capture phase and stopped there, so it closes only the menu and not
// the side panel behind it.
export function useDismiss(root: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
      root.current?.querySelector<HTMLElement>('[aria-expanded]')?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [root, open, close])
}

type Props = {
  label: string
  options: FilterOption[]
  selected: Set<string>
  onToggle: (key: string) => void
  empty: string
}

// A top bar filter dropdown ("Pakki", "Tögg"): the button shows how many are
// chosen, the menu lists every option with its open item count and toggles
// it. The menu stays open while toggling so several can be chosen.
export function FilterMenu({ label, options, selected, onToggle, empty }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)
  const menuId = useId()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(root, open, close)
  const chosen = options.filter((o) => selected.has(o.key)).length

  return (
    <div ref={root} className="hg-dd">
      <button
        type="button"
        className={`hg-ddb${chosen > 0 ? ' hg-on' : ''}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        {chosen > 0 && <em>{chosen}</em>}
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div id={menuId} className="hg-menu" role="group" aria-label={label}>
          {options.length === 0 ? (
            <p className="hg-menu-empty">{empty}</p>
          ) : (
            options.map((o) => (
              <button
                key={o.key}
                type="button"
                className={`hg-chip${selected.has(o.key) ? ' hg-on' : ''}`}
                aria-pressed={selected.has(o.key)}
                onClick={() => onToggle(o.key)}
              >
                <span className="hg-chip-label">{o.label}</span>
                <span className="hg-chip-count">{o.count}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
