import { createContext, useContext, useEffect, useState, type ReactNode, createElement } from 'react'

interface CommandPaletteValue {
  isOpen: boolean
  open: () => void
  close: () => void
}

const CommandPaletteContext = createContext<CommandPaletteValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
})

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ⌘K on mac, Ctrl+K elsewhere. Ignore when user is composing IME text.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return createElement(
    CommandPaletteContext.Provider,
    { value: { isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) } },
    children,
  )
}

export function useCommandPalette() {
  return useContext(CommandPaletteContext)
}
