import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'

// App frame for the vinnubord. Full dynamic viewport height, dark, no nav
// chrome. The top bar arrives in plan 2 inside BoardPage. Renders children
// when given, otherwise the matched child route.
export function Shell({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-huginn-surface text-huginn-text-primary">
      {children ?? <Outlet />}
    </div>
  )
}
