import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { CommandPalette } from './CommandPalette'
import { GlobalTopBar } from './GlobalTopBar'
import { CommandPaletteProvider } from '../hooks/useCommandPalette'

export function Layout() {
  return (
    <CommandPaletteProvider>
      <div className="h-[100dvh] bg-huginn-surface text-white flex flex-col">
        {/* Desktop top bar (hides itself on mobile) */}
        <GlobalTopBar />
        <div className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </div>
        {/* Mobile bottom nav */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
      <CommandPalette />
    </CommandPaletteProvider>
  )
}
