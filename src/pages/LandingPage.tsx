import { Link } from 'react-router-dom'
import { Lockup, Mark, Wordmark } from '../shared/components/Logo'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-huginn-surface text-white flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 md:px-10 py-4 border-b border-huginn-border/60">
        <Link to="/" className="flex items-center gap-2.5 select-none">
          <Mark size={28} />
          <Wordmark height={20} />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="text-xs md:text-sm text-huginn-text-secondary hover:text-white px-3 py-2 rounded-lg hover:bg-huginn-hover transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/login?mode=signup"
            className="text-xs md:text-sm font-semibold bg-huginn-accent hover:bg-huginn-accent-hover text-white px-4 py-2 rounded-lg shadow-md shadow-huginn-accent/30 transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex-1 flex items-center justify-center px-5 py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-huginn-accent/10 blur-[120px]" />
          <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-huginn-accent/8 blur-[140px]" />
        </div>

        <div className="relative max-w-3xl text-center flex flex-col items-center">
          <Lockup markSize={120} wordmarkHeight={48} gap={4} className="mb-8" />

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.1] text-white">
            Your second brain,<br className="hidden md:block" /> organised.
          </h1>
          <p className="mt-5 text-base md:text-lg text-huginn-text-secondary max-w-xl">
            Capture every thought the moment it strikes — by text or voice — then triage them into
            Trello-style boards so nothing slips and everything ships.
          </p>

          <div className="mt-9 flex items-center gap-3">
            <Link
              to="/login?mode=signup"
              className="bg-huginn-accent hover:bg-huginn-accent-hover text-white text-sm md:text-base font-semibold rounded-xl px-6 md:px-7 py-3 shadow-lg shadow-huginn-accent/30 transition-colors"
            >
              Get started
            </Link>
            <Link
              to="/login"
              className="text-sm md:text-base text-huginn-text-secondary hover:text-white px-3 py-3 transition-colors"
            >
              I already have an account →
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-5 md:px-10 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureTile
            title="Capture anywhere"
            body="An always-open inbox for every passing thought — type fast or hit voice for hands-free dictation."
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.5 9.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v6a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-6Zm1 2v4a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-4h-3.09a3 3 0 0 1-5.82 0H4.5Z" />
              </svg>
            }
          />
          <FeatureTile
            title="Trello-style boards"
            body="One board per project. Custom lists, drag-and-drop cards, labels, checklists, comments, attachments — the full kit."
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h11A2.5 2.5 0 0 1 18 4.5v2a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5v-2ZM2.5 8h15a.5.5 0 0 1 .5.5v7A2.5 2.5 0 0 1 15.5 18h-11A2.5 2.5 0 0 1 2 15.5v-7a.5.5 0 0 1 .5-.5Z" />
              </svg>
            }
          />
          <FeatureTile
            title="Team-ready"
            body="Invite collaborators with role-based access. They accept the invite, jump in, and you're working on the same board in real time."
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-huginn-border/60 px-5 md:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2 select-none">
          <Mark size={20} />
          <span className="text-xs text-huginn-text-muted">© {new Date().getFullYear()} Huginn</span>
        </div>
        <Link to="/login" className="text-xs text-huginn-text-muted hover:text-white transition-colors">
          Sign in
        </Link>
      </footer>
    </div>
  )
}

function FeatureTile({ title, body, icon }: { title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="bg-huginn-card border border-huginn-border/60 rounded-2xl p-5 hover:border-huginn-accent/40 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-huginn-accent/15 text-huginn-accent flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-huginn-text-secondary leading-relaxed">{body}</p>
    </div>
  )
}
