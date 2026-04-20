import { Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Mark, Wordmark } from '../shared/components/Logo'

export function LandingPage() {
  return (
    <div className="lp-motion min-h-screen bg-huginn-surface text-white flex flex-col overflow-x-hidden">
      <TopBar />
      <HeroSection />
      <CaptureScene />
      <FeaturesSection />
      <VoiceSection />
      <FinalCTASection />
      <Footer />
    </div>
  )
}

/* ============================================================
   Top bar
   ============================================================ */

function TopBar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-40 flex items-center justify-between px-5 md:px-10 py-4 transition-all duration-300 ${
        scrolled
          ? 'backdrop-blur-xl bg-huginn-base/70 border-b border-huginn-border/60'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <Link to="/" className="flex items-center gap-2.5 select-none group">
        <span className="transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:rotate-[-6deg]">
          <Mark size={28} />
        </span>
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
  )
}

/* ============================================================
   Hero
   ============================================================ */

const AMBIENT_THOUGHTS = [
  'Call the plumber about the kitchen sink',
  'Rework Monday\u2019s pricing deck',
  'Draft the blog post on micro-apps',
  'Book the team offsite for May',
  'Prep the investor update',
  'Add testimonial section to the site',
]

function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = heroRef.current
    const orb = orbRef.current
    if (!el || !orb) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
      orb.style.transform = `translate3d(${x * 40}px, ${y * 40}px, 0)`
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <section
      ref={heroRef}
      className="relative flex items-center justify-center px-5 py-20 md:py-28 overflow-hidden min-h-[88vh]"
    >
      {/* Ambient glows — parallax on mouse */}
      <div ref={orbRef} className="absolute inset-0 pointer-events-none will-change-transform transition-transform duration-[1200ms] ease-out">
        <div className="absolute top-[10%] left-[8%] w-[520px] h-[520px] rounded-full bg-huginn-accent/14 blur-[130px]" />
        <div className="absolute bottom-[5%] right-[5%] w-[560px] h-[560px] rounded-full bg-[#8b7dff]/10 blur-[150px]" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-[#3a2f8f]/20 blur-[160px]" />
      </div>

      {/* Particle field */}
      <ParticleField />

      {/* Grid overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      <div className="relative max-w-4xl text-center flex flex-col items-center">
        {/* Lockup entrance */}
        <div className="mb-10 flex flex-col items-center" style={{ gap: 4 }}>
          <div style={{ animation: 'lp-mark-in 900ms cubic-bezier(0.2,0.9,0.2,1) both' }}>
            <Mark size={112} />
          </div>
          <div style={{ animation: 'lp-wordmark-in 800ms cubic-bezier(0.2,0.7,0.2,1) 250ms both' }}>
            <Wordmark height={44} />
          </div>
        </div>

        {/* Split headline */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] text-white">
          <SplitText text="Your second brain," delay={700} />
          <br className="hidden md:block" />
          <span
            className="inline-block bg-gradient-to-r from-huginn-accent via-[#a78bff] to-huginn-accent bg-clip-text text-transparent leading-[1.2] pb-1"
            style={{
              backgroundSize: '200% 100%',
              animation:
                'lp-rise 700ms cubic-bezier(0.2,0.7,0.2,1) 1200ms both, lp-shimmer 6s linear 1200ms infinite',
            }}
          >
            organised.
          </span>
        </h1>

        {/* Subtitle + typewriter */}
        <div style={{ animation: 'lp-rise 700ms cubic-bezier(0.2,0.7,0.2,1) 1400ms both' }}>
          <p className="mt-6 text-base md:text-lg text-huginn-text-secondary max-w-xl mx-auto">
            Capture every thought the moment it strikes — by text or voice — then triage it into Trello-style
            projects so nothing slips and everything ships.
          </p>
          <div className="mt-5 text-sm md:text-base text-huginn-text-secondary/80 h-6 flex items-center justify-center">
            <span className="opacity-60 mr-2">Right now, Huginn is capturing:</span>
            <Typewriter words={AMBIENT_THOUGHTS} />
          </div>
        </div>

        {/* CTA row */}
        <div
          className="mt-10 flex items-center gap-3 flex-wrap justify-center"
          style={{ animation: 'lp-rise 700ms cubic-bezier(0.2,0.7,0.2,1) 1600ms both' }}
        >
          <MagneticCTA to="/login?mode=signup">Get started free</MagneticCTA>
          <Link
            to="/login"
            className="text-sm md:text-base text-huginn-text-secondary hover:text-white px-4 py-3 transition-colors"
          >
            I already have an account →
          </Link>
        </div>
      </div>

      {/* Scroll cue — positioned relative to the section */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-6 flex flex-col items-center gap-2 text-huginn-text-muted pointer-events-none"
        style={{ animation: 'lp-rise 700ms cubic-bezier(0.2,0.7,0.2,1) 1900ms both' }}
      >
        <span className="text-[10px] tracking-[0.25em] uppercase">Scroll</span>
        <span className="w-px h-10 bg-gradient-to-b from-huginn-text-muted/60 to-transparent" />
      </div>
    </section>
  )
}

/* ---------- Particle field ---------- */

function ParticleField() {
  const particles = useMemo(() => {
    const out = []
    for (let i = 0; i < 34; i++) {
      out.push({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 2.5,
        dx: (Math.random() - 0.5) * 80,
        dy: (Math.random() - 0.5) * 80,
        duration: 8 + Math.random() * 10,
        delay: Math.random() * -12,
        opacity: 0.2 + Math.random() * 0.5,
      })
    }
    return out
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map(p => (
        <span
          key={p.id}
          className="absolute rounded-full bg-huginn-accent"
          style={
            {
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              boxShadow: `0 0 ${p.size * 4}px rgba(108, 92, 231, 0.8)`,
              '--lp-dx': `${p.dx}px`,
              '--lp-dy': `${p.dy}px`,
              '--lp-op': p.opacity,
              animation: `lp-drift ${p.duration}s ease-in-out ${p.delay}s infinite`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

/* ---------- Split text ---------- */

function SplitText({ text, delay = 0, gradient = false }: { text: string; delay?: number; gradient?: boolean }) {
  const chars = Array.from(text)
  return (
    <span className={`inline-block ${gradient ? 'bg-gradient-to-r from-huginn-accent via-[#a78bff] to-[#6c5ce7] bg-clip-text text-transparent' : ''}`}>
      {chars.map((ch, i) => (
        <span
          key={i}
          className="inline-block"
          style={{
            animation: `lp-letter-in 700ms cubic-bezier(0.2,0.7,0.2,1) ${delay + i * 28}ms both`,
            transformOrigin: '50% 100%',
          }}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </span>
  )
}

/* ---------- Typewriter ---------- */

function Typewriter({ words }: { words: string[] }) {
  const [idx, setIdx] = useState(0)
  const [sub, setSub] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const full = words[idx % words.length]
    if (!deleting && sub === full) {
      const t = setTimeout(() => setDeleting(true), 1400)
      return () => clearTimeout(t)
    }
    if (deleting && sub === '') {
      setDeleting(false)
      setIdx(i => (i + 1) % words.length)
      return
    }
    const t = setTimeout(
      () => setSub(deleting ? full.slice(0, sub.length - 1) : full.slice(0, sub.length + 1)),
      deleting ? 28 : 45,
    )
    return () => clearTimeout(t)
  }, [sub, deleting, idx, words])

  return (
    <span className="text-huginn-accent font-medium">
      {sub}
      <span
        className="inline-block w-[2px] h-4 bg-huginn-accent ml-0.5 align-middle"
        style={{ animation: 'lp-caret 1s steps(2) infinite' }}
      />
    </span>
  )
}

/* ---------- Magnetic CTA ---------- */

function MagneticCTA({ to, children }: { to: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const glowRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    const glow = glowRef.current
    if (!el || !glow) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy)
      const max = 140
      if (dist > max) {
        el.style.transform = 'translate3d(0, 0, 0)'
        glow.style.opacity = '0'
        return
      }
      const strength = 1 - dist / max
      el.style.transform = `translate3d(${dx * strength * 0.25}px, ${dy * strength * 0.25}px, 0)`
      glow.style.opacity = String(0.4 + strength * 0.6)
    }
    const onLeave = () => {
      el.style.transform = 'translate3d(0, 0, 0)'
      glow.style.opacity = '0'
    }
    window.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <Link
      ref={ref}
      to={to}
      className="relative inline-flex items-center gap-2 text-white text-sm md:text-base font-semibold rounded-xl px-7 py-3.5 transition-transform duration-300 ease-out will-change-transform group"
      style={{
        background: 'linear-gradient(110deg, #6c5ce7 0%, #8b7dff 25%, #6c5ce7 50%, #5b4bd5 75%, #6c5ce7 100%)',
        backgroundSize: '200% 100%',
        animation: 'lp-shimmer 6s linear infinite',
        boxShadow: '0 10px 30px -8px rgba(108, 92, 231, 0.6), inset 0 1px 0 rgba(255,255,255,0.15)',
      }}
    >
      <span
        ref={glowRef}
        className="absolute inset-0 rounded-xl pointer-events-none opacity-0 transition-opacity duration-200"
        style={{
          background: 'radial-gradient(circle at center, rgba(167,139,255,0.6), transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      <span className="relative">{children}</span>
      <span className="relative transition-transform duration-300 group-hover:translate-x-1">→</span>
    </Link>
  )
}

/* ============================================================
   Capture Scene — the product's story, animated
   ============================================================ */

type CaptureDemo = {
  text: string
  list: 'To do' | 'In progress' | 'Done'
  label?: { text: string; color: string }
}

const CAPTURE_DEMOS: CaptureDemo[] = [
  { text: 'Rework Monday\u2019s pricing deck', list: 'To do', label: { text: 'Deck', color: '#6c5ce7' } },
  { text: 'Call the plumber about the sink', list: 'To do', label: { text: 'Home', color: '#00b894' } },
  { text: 'Draft blog post on micro-apps', list: 'In progress', label: { text: 'Writing', color: '#fdcb6e' } },
]

function CaptureScene() {
  const [reveal, setReveal] = useState<'out' | 'in'>('out')
  const sectionRef = useRef<HTMLDivElement>(null)
  const [demoIdx, setDemoIdx] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'typing' | 'dropped' | 'flying' | 'landed'>('idle')
  const [typed, setTyped] = useState('')
  const [landedInbox, setLandedInbox] = useState<CaptureDemo[]>([])
  const [landedBoard, setLandedBoard] = useState<CaptureDemo[]>([])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setReveal('in')),
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Orchestrate the demo loop — tracks index via a local counter so closure is clean
  useEffect(() => {
    if (reveal !== 'in') return
    let cancelled = false
    let localIdx = 0
    const run = async () => {
      await wait(500)
      while (!cancelled) {
        const demo = CAPTURE_DEMOS[localIdx % CAPTURE_DEMOS.length]
        setDemoIdx(localIdx % CAPTURE_DEMOS.length)

        setPhase('typing')
        setTyped('')
        for (let i = 1; i <= demo.text.length; i++) {
          if (cancelled) return
          setTyped(demo.text.slice(0, i))
          await wait(28 + Math.random() * 18)
        }
        await wait(450)
        if (cancelled) return

        setPhase('dropped')
        setTyped('')
        setLandedInbox(l => [demo, ...l].slice(0, 3))
        await wait(800)
        if (cancelled) return

        setPhase('flying')
        setLandedInbox(l => l.filter(d => d !== demo))
        await wait(1100)
        if (cancelled) return

        setPhase('landed')
        setLandedBoard(l => {
          const next = l.filter(d => d.text !== demo.text)
          next.push(demo)
          return next.slice(-3)
        })
        await wait(900)

        setPhase('idle')
        localIdx += 1
        await wait(300)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [reveal])

  const activeDemo = CAPTURE_DEMOS[demoIdx]

  return (
    <section
      ref={sectionRef}
      data-reveal={reveal}
      className="relative px-5 md:px-10 py-24 md:py-32 max-w-6xl mx-auto w-full"
    >
      <div className="text-center mb-14">
        <div className="inline-block text-[11px] tracking-[0.25em] uppercase text-huginn-accent/80 mb-4">
          How it works
        </div>
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
          From a fleeting thought<br />
          <span className="inline-block leading-[1.2] pb-1 bg-gradient-to-r from-huginn-accent to-[#a78bff] bg-clip-text text-transparent">
            to the right column.
          </span>
        </h2>
        <p className="mt-4 text-base md:text-lg text-huginn-text-secondary max-w-2xl mx-auto">
          Watch a thought get caught in the inbox and ride into the list where it belongs — the exact flow
          Huginn runs on every day.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-10 items-start relative">
        {/* Inbox pane */}
        <div className="bg-huginn-card/90 backdrop-blur-sm border border-huginn-border rounded-2xl p-4 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-huginn-danger" />
            <div className="w-2 h-2 rounded-full bg-huginn-warning" />
            <div className="w-2 h-2 rounded-full bg-huginn-success" />
            <div className="ml-3 text-[11px] tracking-[0.2em] uppercase text-huginn-text-muted">Inbox</div>
          </div>
          <div className="rounded-xl bg-huginn-base border border-huginn-border px-3 py-2.5 flex items-center gap-2 min-h-[44px]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-huginn-text-muted">
              <path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4Z" />
              <path d="M19 10v2a7 7 0 1 1-14 0v-2M12 19v3" />
            </svg>
            <span className="text-sm text-white">
              {phase === 'typing' ? typed : ''}
              {phase === 'typing' && (
                <span
                  className="inline-block w-[2px] h-4 bg-huginn-accent ml-0.5 align-middle"
                  style={{ animation: 'lp-caret 1s steps(2) infinite' }}
                />
              )}
              {phase !== 'typing' && <span className="text-huginn-text-muted">Capture a thought…</span>}
            </span>
          </div>

          <div className="mt-3 space-y-2 min-h-[120px]">
            {landedInbox.map((d, i) => (
              <div
                key={`${d.text}-${i}`}
                className="bg-huginn-base border border-huginn-border rounded-lg px-3 py-2 text-sm text-huginn-text-primary"
                style={{ animation: 'lp-card-drop-in 500ms cubic-bezier(0.2,0.7,0.2,1) both' }}
              >
                {d.text}
              </div>
            ))}
            {landedInbox.length === 0 && (
              <div className="text-xs text-huginn-text-muted italic pt-2">Empty for now…</div>
            )}
          </div>
        </div>

        {/* Flying card in the gap */}
        <div className="relative hidden md:flex items-center justify-center w-24 h-full min-h-[240px]">
          {/* arrow hint */}
          <svg viewBox="0 0 120 40" className="absolute inset-0 w-full h-full opacity-25">
            <defs>
              <linearGradient id="lp-arrow" x1="0" x2="1">
                <stop offset="0" stopColor="#6c5ce7" stopOpacity="0" />
                <stop offset="1" stopColor="#6c5ce7" stopOpacity="1" />
              </linearGradient>
            </defs>
            <path d="M5 20 Q 60 0, 115 20" stroke="url(#lp-arrow)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
          </svg>

          {phase === 'flying' && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-huginn-card border border-huginn-accent/60 rounded-lg px-3 py-2 text-xs text-white shadow-xl shadow-huginn-accent/40 whitespace-nowrap"
              style={{
                animation: 'lp-fly-card 1100ms cubic-bezier(0.5,0,0.3,1) both',
                maxWidth: 180,
              }}
            >
              <span className="truncate block">{activeDemo.text}</span>
            </div>
          )}
        </div>

        {/* Board pane */}
        <div className="bg-huginn-card/90 backdrop-blur-sm border border-huginn-border rounded-2xl p-4 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-4 h-4 rounded-sm"
              style={{ background: 'linear-gradient(135deg, #6c5ce7, #a78bff)' }}
            />
            <div className="text-[11px] tracking-[0.2em] uppercase text-huginn-text-muted">Project · Huginn.pro</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['To do', 'In progress', 'Done'] as const).map(col => (
              <div key={col} className="bg-huginn-base/60 rounded-lg p-2">
                <div className="text-[10px] tracking-[0.15em] uppercase text-huginn-text-muted mb-2 px-1">
                  {col}
                </div>
                <div className="space-y-1.5 min-h-[80px]">
                  {col === 'To do' && <SeedCard text="Review mobile layout" />}
                  {col === 'In progress' && <SeedCard text="Onboarding flow" label={{ text: 'UX', color: '#00b894' }} />}
                  {col === 'Done' && <SeedCard text="Set up Supabase" muted />}

                  {landedBoard
                    .filter(d => d.list === col)
                    .map((d, i) => (
                      <div
                        key={`${d.text}-${i}`}
                        className="bg-huginn-card border border-huginn-accent/40 rounded-md p-2 text-[11px] text-white shadow-md shadow-huginn-accent/20"
                        style={{ animation: 'lp-card-drop-in 500ms cubic-bezier(0.2,0.7,0.2,1) both' }}
                      >
                        {d.label && (
                          <span
                            className="inline-block text-[9px] font-semibold px-1.5 py-[1px] rounded-sm mb-1"
                            style={{ backgroundColor: d.label.color + '33', color: d.label.color }}
                          >
                            {d.label.text}
                          </span>
                        )}
                        <div className="leading-snug">{d.text}</div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Phase dots */}
      <div className="mt-10 flex items-center justify-center gap-2">
        {CAPTURE_DEMOS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === demoIdx % CAPTURE_DEMOS.length ? 'w-8 bg-huginn-accent' : 'w-1.5 bg-huginn-border'
            }`}
          />
        ))}
      </div>
    </section>
  )
}

function SeedCard({ text, label, muted }: { text: string; label?: { text: string; color: string }; muted?: boolean }) {
  return (
    <div
      className={`rounded-md p-2 text-[11px] leading-snug border ${
        muted
          ? 'bg-huginn-card/40 border-huginn-border/50 text-huginn-text-muted line-through'
          : 'bg-huginn-card border-huginn-border text-huginn-text-primary'
      }`}
    >
      {label && !muted && (
        <span
          className="inline-block text-[9px] font-semibold px-1.5 py-[1px] rounded-sm mb-1"
          style={{ backgroundColor: label.color + '33', color: label.color }}
        >
          {label.text}
        </span>
      )}
      {text}
    </div>
  )
}

function wait(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

/* ============================================================
   Features
   ============================================================ */

function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [reveal, setReveal] = useState<'out' | 'in'>('out')
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setReveal('in')),
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const features = [
    {
      title: 'Capture anywhere',
      body: 'An always-open inbox for every passing thought. Type fast or hit voice for hands-free dictation.',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4Zm7 8v2a7 7 0 0 1-6 6.93V22h-2v-3.07A7 7 0 0 1 5 12v-2h2v2a5 5 0 0 0 10 0v-2h2Z" />
        </svg>
      ),
    },
    {
      title: 'Trello-style projects',
      body: 'Custom lists, drag-and-drop cards, labels, checklists, comments, attachments — the full kit, nothing missing.',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M4 4h5v16H4zm7 0h5v10h-5zm7 0h3v6h-3z" />
        </svg>
      ),
    },
    {
      title: 'Team-ready',
      body: 'Invite collaborators with role-based access. They accept, jump in, and you\u2019re working on the same project in real time.',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6Zm6-7a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z" />
        </svg>
      ),
    },
  ]

  return (
    <section ref={sectionRef} data-reveal={reveal} className="px-5 md:px-10 py-20 md:py-28 max-w-6xl mx-auto w-full">
      <div className="text-center mb-14">
        <div className="inline-block text-[11px] tracking-[0.25em] uppercase text-huginn-accent/80 mb-4">
          What you get
        </div>
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
          A small kit, used daily.
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {features.map((f, i) => (
          <TiltTile key={i} delay={i * 120} {...f} />
        ))}
      </div>
    </section>
  )
}

function TiltTile({
  title,
  body,
  icon,
  delay,
}: {
  title: string
  body: string
  icon: React.ReactNode
  delay: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `perspective(900px) rotateX(${-y * 8}deg) rotateY(${x * 10}deg) translateZ(0)`
      el.style.setProperty('--lp-gx', `${x * 100 + 50}%`)
      el.style.setProperty('--lp-gy', `${y * 100 + 50}%`)
    }
    const onLeave = () => {
      el.style.transform = 'perspective(900px) rotateX(0) rotateY(0)'
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div
      ref={ref}
      className="relative group rounded-2xl p-6 bg-huginn-card border border-huginn-border overflow-hidden transition-transform duration-200 ease-out will-change-transform"
      style={{
        transformStyle: 'preserve-3d',
        animation: `lp-rise 700ms cubic-bezier(0.2,0.7,0.2,1) ${delay}ms both`,
      }}
    >
      {/* Hover spotlight */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(circle at var(--lp-gx, 50%) var(--lp-gy, 50%), rgba(108, 92, 231, 0.18), transparent 60%)',
        }}
      />
      {/* Gradient border on hover */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(135deg, rgba(108,92,231,0.6), rgba(167,139,255,0.2), rgba(108,92,231,0.6))',
          padding: 1,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      <div
        className="relative w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-huginn-accent"
        style={{
          background: 'linear-gradient(135deg, rgba(108,92,231,0.22), rgba(108,92,231,0.06))',
          boxShadow: 'inset 0 0 0 1px rgba(108,92,231,0.3)',
        }}
      >
        {icon}
      </div>
      <h3 className="relative text-lg font-bold text-white mb-2">{title}</h3>
      <p className="relative text-sm text-huginn-text-secondary leading-relaxed">{body}</p>
    </div>
  )
}

/* ============================================================
   Voice section
   ============================================================ */

function VoiceSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [reveal, setReveal] = useState<'out' | 'in'>('out')
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setReveal('in')),
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      data-reveal={reveal}
      className="relative px-5 md:px-10 py-24 md:py-32 overflow-hidden"
    >
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Orb */}
        <div className="relative flex items-center justify-center h-[300px] md:h-[360px]">
          {/* rings */}
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="absolute w-40 h-40 rounded-full border border-huginn-accent/40"
              style={{ animation: `lp-ring-expand 3s ease-out ${i * 1}s infinite` }}
            />
          ))}
          {/* orb */}
          <div
            className="relative w-40 h-40 rounded-full flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, #a78bff, #6c5ce7 45%, #3a2f8f 100%)',
              boxShadow:
                '0 20px 60px -10px rgba(108, 92, 231, 0.7), inset 0 -20px 40px rgba(0,0,0,0.35), inset 0 10px 30px rgba(255,255,255,0.15)',
              animation: 'lp-orb-breathe 3.2s ease-in-out infinite',
            }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-14 h-14 drop-shadow-lg">
              <path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4Zm7 8v2a7 7 0 0 1-6 6.93V22h-2v-3.07A7 7 0 0 1 5 12v-2h2v2a5 5 0 0 0 10 0v-2h2Z" />
            </svg>
          </div>
        </div>

        {/* Copy */}
        <div>
          <div className="text-[11px] tracking-[0.25em] uppercase text-huginn-accent/80 mb-4">
            Hands-free capture
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-[1.1]">
            Tap it. Talk.<br />
            <span className="inline-block leading-[1.2] pb-1 bg-gradient-to-r from-huginn-accent to-[#a78bff] bg-clip-text text-transparent">
              It lands in your inbox.
            </span>
          </h2>
          <p className="mt-5 text-base md:text-lg text-huginn-text-secondary max-w-lg">
            Built on the browser&rsquo;s native Web Speech API — no apps, no logins on other devices, no lag. Great
            for driving, walking the dog, or that two-second idea before it evaporates.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <MagneticCTA to="/login?mode=signup">Try it now</MagneticCTA>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   Final CTA with parallax raven silhouette
   ============================================================ */

function FinalCTASection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [reveal, setReveal] = useState<'out' | 'in'>('out')
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setReveal('in')),
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      data-reveal={reveal}
      className="relative px-5 md:px-10 py-28 md:py-36 overflow-hidden"
    >
      {/* Raven silhouette flight */}
      <div
        className="absolute pointer-events-none"
        style={{ top: '10%', left: 0, animation: 'lp-raven-glide 14s ease-in-out infinite' }}
      >
        <Mark size={72} className="opacity-30" />
      </div>
      <div
        className="absolute pointer-events-none"
        style={{ top: '55%', left: 0, animation: 'lp-raven-glide 18s ease-in-out 4s infinite' }}
      >
        <Mark size={48} className="opacity-20" />
      </div>

      {/* glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-huginn-accent/12 blur-[140px]" />
      </div>

      <div className="relative max-w-3xl mx-auto text-center">
        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.05]">
          Your thoughts,<br />
          <span className="inline-block leading-[1.2] pb-1 bg-gradient-to-r from-huginn-accent via-[#a78bff] to-huginn-accent bg-clip-text text-transparent">
            finally kept.
          </span>
        </h2>
        <p className="mt-6 text-base md:text-lg text-huginn-text-secondary max-w-xl mx-auto">
          Free while in beta. Takes 30 seconds to sign up. You&apos;ll be in your inbox a minute from now.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
          <MagneticCTA to="/login?mode=signup">Create your inbox</MagneticCTA>
          <Link
            to="/login"
            className="text-sm md:text-base text-huginn-text-secondary hover:text-white px-4 py-3 transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   Footer
   ============================================================ */

function Footer() {
  return (
    <footer className="border-t border-huginn-border/60 px-5 md:px-10 py-6 flex items-center justify-between">
      <div className="flex items-center gap-2 select-none">
        <Mark size={20} />
        <span className="text-xs text-huginn-text-muted">© {new Date().getFullYear()} Huginn</span>
      </div>
      <Link to="/login" className="text-xs text-huginn-text-muted hover:text-white transition-colors">
        Sign in
      </Link>
    </footer>
  )
}
