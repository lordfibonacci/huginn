import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function Layout() {
  return (
    <div className="h-[100dvh] bg-[#1a1a2e] text-white flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
