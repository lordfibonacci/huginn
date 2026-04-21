import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectGlyph, parseColor } from './ProjectGlyph'
import { HexInput } from '../../../shared/components/HexInput'

const SOLID_PRESETS = [
  '#6c5ce7', '#00b894', '#fdcb6e', '#e17055',
  '#0984e3', '#e84393', '#a78bfa', '#636e72',
]

const EXTRA_SOLID = [
  '#fd79a8', '#55efc4', '#ff7675', '#74b9ff',
  '#ffeaa7', '#81ecec', '#dfe6e9', '#2d3436',
]

const GRADIENT_PRESETS = [
  'gradient:#6c5ce7,#a78bfa',
  'gradient:#00b894,#55efc4',
  'gradient:#fdcb6e,#fab1a0',
  'gradient:#e17055,#fd79a8',
  'gradient:#0984e3,#74b9ff',
  'gradient:#6c5ce7,#e84393',
  'gradient:#00b894,#0984e3',
  'gradient:#e84393,#fdcb6e',
]

interface ProjectColorPickerProps {
  value: string
  onChange: (value: string) => void
}

export function ProjectColorPicker({ value, onChange }: ProjectColorPickerProps) {
  const { t } = useTranslation()
  const parsed = parseColor(value)
  const isPreset = SOLID_PRESETS.includes(value)
  const [expanded, setExpanded] = useState(!isPreset)
  const [customMode, setCustomMode] = useState<'solid' | 'gradient'>(parsed.type)

  const customSolid = parsed.type === 'solid' && !SOLID_PRESETS.includes(parsed.value) ? parsed.value : '#a29bfe'
  const customFrom = parsed.type === 'gradient' ? parsed.from : '#6c5ce7'
  const customTo = parsed.type === 'gradient' ? parsed.to : '#e84393'

  function handlePresetTap(c: string) {
    onChange(c)
    setExpanded(false)
  }

  return (
    <div className="space-y-3">
      {/* Standard preset row */}
      <div className="flex flex-wrap gap-1.5">
        {SOLID_PRESETS.map((c) => (
          <Swatch key={c} color={c} selected={value === c} onClick={() => handlePresetTap(c)} />
        ))}
        <CustomTile
          active={!isPreset}
          expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          label={t('settings.color.moreColors')}
        />
      </div>

      {/* Expanded custom panel */}
      {expanded && (
        <div className="bg-huginn-surface/60 rounded-lg p-3 border border-huginn-border/60 space-y-3">
          {/* Solid / Gradient toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-huginn-text-muted font-semibold uppercase tracking-wider">{t('settings.color.moreColors')}</span>
            <div className="flex gap-1 bg-huginn-base rounded-md p-0.5">
              <button
                type="button"
                onClick={() => {
                  setCustomMode('solid')
                  if (parsed.type === 'gradient') onChange(customSolid)
                }}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                  customMode === 'solid' ? 'bg-huginn-accent text-white' : 'text-huginn-text-secondary hover:text-white'
                }`}
              >
                {t('settings.color.solid')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomMode('gradient')
                  if (parsed.type === 'solid') onChange(`gradient:${customFrom},${customTo}`)
                }}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                  customMode === 'gradient' ? 'bg-huginn-accent text-white' : 'text-huginn-text-secondary hover:text-white'
                }`}
              >
                {t('settings.color.gradient')}
              </button>
            </div>
          </div>

          {/* Extra preset row (solid extras OR gradient presets) */}
          <div className="flex flex-wrap gap-1.5">
            {(customMode === 'solid' ? EXTRA_SOLID : GRADIENT_PRESETS).map((c) => (
              <Swatch
                key={c}
                color={c}
                selected={value === c}
                onClick={() => onChange(c)}
              />
            ))}
          </div>

          {/* Hex builder */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                if (customMode === 'solid') onChange(customSolid)
                else onChange(`gradient:${customFrom},${customTo}`)
              }}
              title={isPreset ? t('settings.color.applyTitle') : t('settings.color.activeTitle')}
              className="rounded-md p-0.5 hover:bg-huginn-hover transition-colors"
            >
              <ProjectGlyph
                color={customMode === 'solid' ? customSolid : `gradient:${customFrom},${customTo}`}
                size={26}
                glow={false}
              />
            </button>
            {customMode === 'solid' ? (
              <HexInput
                value={parsed.type === 'solid' ? parsed.value : customSolid}
                onChange={(hex) => onChange(hex)}
              />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <HexInput
                  value={customFrom}
                  onChange={(hex) => onChange(`gradient:${hex},${customTo}`)}
                  copyFromOther={() => onChange(`gradient:${customTo},${customTo}`)}
                  copyDirection="left"
                />
                <button
                  type="button"
                  onClick={() => onChange(`gradient:${customTo},${customFrom}`)}
                  title={t('settings.color.swap')}
                  className="text-huginn-text-muted hover:text-huginn-accent text-base p-1 rounded hover:bg-huginn-hover transition-colors"
                  aria-label={t('settings.color.swap')}
                >
                  ⇆
                </button>
                <HexInput
                  value={customTo}
                  onChange={(hex) => onChange(`gradient:${customFrom},${hex}`)}
                  copyFromOther={() => onChange(`gradient:${customFrom},${customFrom}`)}
                  copyDirection="right"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Swatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-center w-9 h-9 rounded-md transition-all ${
        selected ? 'bg-huginn-hover ring-2 ring-huginn-accent' : 'hover:bg-huginn-hover/50'
      }`}
      aria-label={color}
    >
      <ProjectGlyph color={color} size={22} glow={false} />
    </button>
  )
}

function CustomTile({ active, expanded, onClick, label }: { active: boolean; expanded: boolean; onClick: () => void; label: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-center w-9 h-9 rounded-md transition-all ${
        active ? 'bg-huginn-hover ring-2 ring-huginn-accent' : expanded ? 'bg-huginn-hover/70' : 'hover:bg-huginn-hover/50'
      }`}
      aria-label={label}
      title={label}
    >
      <svg width={22} height={22} viewBox="0 0 16 16" aria-hidden>
        <defs>
          <linearGradient id={`ct-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6c5ce7" />
            <stop offset="33%" stopColor="#00b894" />
            <stop offset="66%" stopColor="#fdcb6e" />
            <stop offset="100%" stopColor="#e84393" />
          </linearGradient>
        </defs>
        <polygon points="8,1 15,8 8,15 1,8" fill={`url(#ct-${id})`} />
        <polygon points="8,1 15,8 8,8" fill="#000" fillOpacity="0.22" />
        <polygon points="8,8 1,8 8,15" fill="#fff" fillOpacity="0.08" />
      </svg>
    </button>
  )
}
