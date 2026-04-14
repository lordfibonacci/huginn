import { Link, useLocation } from 'react-router-dom'

export function BottomNav() {
  const { pathname } = useLocation()
  const isProjects = pathname.startsWith('/projects')

  return (
    <nav className="flex border-t border-huginn-border bg-huginn-base pb-[env(safe-area-inset-bottom,0px)]">
      <Link
        to="/projects"
        className={`flex-1 flex flex-col items-center py-3 gap-1 relative ${
          isProjects ? 'text-huginn-accent' : 'text-gray-500'
        }`}
      >
        {isProjects && <span className="w-1 h-1 rounded-full bg-huginn-accent absolute top-1.5" />}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M4 4a2 2 0 0 0-2 2v1h20V6a2 2 0 0 0-2-2h-6.18a2 2 0 0 1-1.41-.59l-.83-.82A2 2 0 0 0 10.18 2H4Zm-2 5v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9H2Z" />
        </svg>
        <span className="text-[11px] font-bold">Projects</span>
      </Link>
    </nav>
  )
}
