interface LogoProps {
  size?: number
  className?: string
  pulse?: boolean
}

export function Mark({ size = 32, className = '', pulse = false }: LogoProps) {
  return (
    <img
      src="/brand/mark.png"
      alt="Huginn"
      width={size}
      height={size}
      draggable={false}
      className={`select-none ${pulse ? 'animate-pulse' : ''} ${className}`}
      style={{ width: size, height: size, filter: 'brightness(1.25) saturate(1.1)' }}
    />
  )
}

interface WordmarkProps {
  height?: number
  className?: string
}

export function Wordmark({ height = 28, className = '' }: WordmarkProps) {
  return (
    <img
      src="/brand/wordmark.png"
      alt="huginn"
      draggable={false}
      className={`select-none ${className}`}
      style={{ height }}
    />
  )
}

interface LoadingScreenProps {
  message?: string
  className?: string
}

export function LoadingScreen({ message, className = '' }: LoadingScreenProps) {
  return (
    <div className={`flex-1 flex flex-col items-center justify-center gap-3 ${className}`}>
      <Mark size={48} pulse className="opacity-70" />
      {message && (
        <p className="text-huginn-text-muted text-xs tracking-wide uppercase">{message}</p>
      )}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  hint?: string
  className?: string
}

export function EmptyState({ title, hint, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 px-4 text-center ${className}`}>
      <Mark size={40} className="opacity-25" />
      <p className="text-sm text-huginn-text-secondary mt-2">{title}</p>
      {hint && <p className="text-xs text-huginn-text-muted">{hint}</p>}
    </div>
  )
}

interface LockupProps {
  markSize?: number
  wordmarkHeight?: number
  layout?: 'stacked' | 'horizontal'
  gap?: number
  className?: string
}

export function Lockup({
  markSize = 96,
  wordmarkHeight = 36,
  layout = 'stacked',
  gap,
  className = '',
}: LockupProps) {
  const stacked = layout === 'stacked'
  const computedGap = gap ?? (stacked ? 8 : 12)
  return (
    <div
      className={`flex items-center ${stacked ? 'flex-col' : 'flex-row'} ${className}`}
      style={{ gap: computedGap }}
    >
      <Mark size={markSize} />
      <Wordmark height={wordmarkHeight} />
    </div>
  )
}
