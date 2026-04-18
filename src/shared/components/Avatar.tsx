interface AvatarProps {
  url?: string | null
  name?: string | null
  email?: string | null
  size?: number
  className?: string
}

export function Avatar({ url, name, email, size = 32, className = '' }: AvatarProps) {
  const initials = getInitials(name, email)
  const bg = colorFromString(name || email || 'huginn')

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? email ?? 'avatar'}
        width={size}
        height={size}
        draggable={false}
        className={`rounded-full object-cover select-none ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white select-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.max(10, Math.round(size * 0.42)),
      }}
      aria-label={name ?? email ?? 'avatar'}
    >
      {initials}
    </div>
  )
}

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.split('@')[0] || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function colorFromString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  const hue = Math.abs(h) % 360
  return `linear-gradient(135deg, hsl(${hue}, 55%, 45%) 0%, hsl(${(hue + 40) % 360}, 60%, 35%) 100%)`
}
