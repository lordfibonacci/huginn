import { useId } from 'react'

interface ProjectGlyphProps {
  color: string
  size?: number
  glow?: boolean
  className?: string
}

export function parseColor(color: string): { type: 'solid'; value: string } | { type: 'gradient'; from: string; to: string } {
  if (color.startsWith('gradient:')) {
    const [from, to] = color.slice('gradient:'.length).split(',').map(s => s.trim())
    return { type: 'gradient', from: from || '#6c5ce7', to: to || '#a78bfa' }
  }
  return { type: 'solid', value: color }
}

export function colorToCss(color: string): string {
  const parsed = parseColor(color)
  return parsed.type === 'gradient'
    ? `linear-gradient(135deg, ${parsed.from} 0%, ${parsed.to} 100%)`
    : parsed.value
}

export function colorPrimary(color: string): string {
  const parsed = parseColor(color)
  return parsed.type === 'gradient' ? parsed.from : parsed.value
}

export function ProjectGlyph({ color, size = 14, glow = true, className = '' }: ProjectGlyphProps) {
  const parsed = parseColor(color)
  const rawId = useId()
  const gradId = `pg-${rawId.replace(/:/g, '')}`
  const fill = parsed.type === 'gradient' ? `url(#${gradId})` : parsed.value
  const haloColor = colorPrimary(color)

  return (
    <span
      className={`inline-flex shrink-0 ${className}`}
      style={glow ? { filter: `drop-shadow(0 0 6px ${haloColor}80)` } : undefined}
    >
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        {parsed.type === 'gradient' && (
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={parsed.from} />
              <stop offset="100%" stopColor={parsed.to} />
            </linearGradient>
          </defs>
        )}
        <polygon points="8,1 15,8 8,15 1,8" fill={fill} />
        <polygon points="8,1 15,8 8,8" fill="#000" fillOpacity="0.22" />
        <polygon points="8,8 1,8 8,15" fill="#fff" fillOpacity="0.08" />
      </svg>
    </span>
  )
}
