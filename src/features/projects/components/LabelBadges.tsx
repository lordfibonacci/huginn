import type { Label } from '../../../shared/lib/types'

interface LabelBadgesProps {
  labels: Label[]
  size?: 'sm' | 'md'
}

export function LabelBadges({ labels, size = 'md' }: LabelBadgesProps) {
  if (labels.length === 0) return null

  if (size === 'sm') {
    // Compact mode for card display — just colored strips
    return (
      <div className="flex gap-1 flex-wrap">
        {labels.map((label) => (
          <div
            key={label.id}
            className="h-2 w-8 rounded-full"
            style={{ backgroundColor: label.color }}
            title={label.name}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {labels.map((label) => (
        <span
          key={label.id}
          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md text-white"
          style={{ backgroundColor: label.color }}
        >
          {label.name}
        </span>
      ))}
    </div>
  )
}
