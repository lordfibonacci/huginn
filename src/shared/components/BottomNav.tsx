import { Link, useLocation } from 'react-router-dom'

export function BottomNav() {
  const { pathname } = useLocation()
  const isInbox = pathname === '/'
  const isProjects = pathname.startsWith('/projects')

  return (
    <nav className="flex border-t border-huginn-border bg-huginn-base pb-[env(safe-area-inset-bottom,0px)]">
      <Link
        to="/"
        className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${
          isInbox ? 'text-huginn-accent' : 'text-gray-500'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M3.5 9.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v8a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 3.5 17.5v-8Zm1 3V17.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V12.5h-4.09a3.5 3.5 0 0 1-6.82 0H4.5Z" />
        </svg>
        <span className="text-[10px] font-medium">Inbox</span>
      </Link>
      <Link
        to="/projects"
        className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${
          isProjects ? 'text-huginn-accent' : 'text-gray-500'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M4 4a2 2 0 0 0-2 2v1h20V6a2 2 0 0 0-2-2h-6.18a2 2 0 0 1-1.41-.59l-.83-.82A2 2 0 0 0 10.18 2H4Zm-2 5v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9H2Z" />
        </svg>
        <span className="text-[10px] font-medium">Projects</span>
      </Link>
    </nav>
  )
}
