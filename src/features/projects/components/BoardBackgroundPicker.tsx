import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BOARD_BACKGROUNDS,
  isCustomBackground,
  buildCustomGradient,
  parseCustomGradient,
  type GradientStops,
} from '../../../shared/lib/boardBackgrounds'
import { HexInput } from '../../../shared/components/HexInput'

interface BoardBackgroundPickerProps {
  value: string
  onChange: (value: string) => void
}

export function BoardBackgroundPicker({ value, onChange }: BoardBackgroundPickerProps) {
  const { t } = useTranslation()
  const customMode: 'solid' | 'gradient' | null = isCustomBackground(value)
    ? value.startsWith('linear-gradient') || value.startsWith('radial-gradient') ? 'gradient' : 'solid'
    : null

  const parsedGrad = customMode === 'gradient' ? parseCustomGradient(value) : null
  const [mode, setMode] = useState<'solid' | 'gradient'>(customMode ?? 'gradient')
  const [stops, setStops] = useState<GradientStops>(parsedGrad?.stops ?? 3)

  const customFrom = parsedGrad?.from ?? '#1d2125'
  const customTo = parsedGrad?.to ?? '#6c5ce7'
  const customSolid = customMode === 'solid' ? value : '#1d2125'

  const previewCss = mode === 'gradient'
    ? buildCustomGradient(customFrom, customTo, stops)
    : customSolid

  function applyPreview() {
    onChange(previewCss)
  }

  return (
    <div className="space-y-3">
      {/* Preset grid */}
      <div className="grid grid-cols-3 gap-2">
        {BOARD_BACKGROUNDS.map((bg) => {
          const selected = value === bg.id
          const label = t(`settings.background.presets.${bg.id}`, { defaultValue: bg.name })
          return (
            <button
              key={bg.id}
              type="button"
              onClick={() => onChange(bg.id)}
              className={`h-12 rounded-lg transition-all ${
                selected ? 'ring-2 ring-huginn-accent ring-offset-1 ring-offset-huginn-card' : ''
              }`}
              style={{ background: bg.style }}
              title={label}
            >
              <span className="text-[10px] font-medium text-white/70">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Custom builder */}
      <div className="bg-huginn-surface/60 rounded-lg p-3 border border-huginn-border/60">
        <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-huginn-text-muted font-semibold uppercase tracking-wider">{t('settings.background.custom')}</span>
            {customMode && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-huginn-accent/15 text-huginn-accent">
                {t('settings.background.active')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === 'gradient' && (
              <div className="flex gap-1 bg-huginn-base rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setStops(2)
                    if (customMode === 'gradient') onChange(buildCustomGradient(customFrom, customTo, 2))
                  }}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                    stops === 2 ? 'bg-huginn-accent text-white' : 'text-huginn-text-secondary hover:text-white'
                  }`}
                  title={t('settings.background.twoStopsTitle')}
                >
                  {t('settings.background.twoStops')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStops(3)
                    if (customMode === 'gradient') onChange(buildCustomGradient(customFrom, customTo, 3))
                  }}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                    stops === 3 ? 'bg-huginn-accent text-white' : 'text-huginn-text-secondary hover:text-white'
                  }`}
                  title={t('settings.background.threeStopsTitle')}
                >
                  {t('settings.background.threeStops')}
                </button>
              </div>
            )}
            <div className="flex gap-1 bg-huginn-base rounded-md p-0.5">
              <button
                type="button"
                onClick={() => {
                  setMode('solid')
                  onChange(customSolid)
                }}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                  mode === 'solid' ? 'bg-huginn-accent text-white' : 'text-huginn-text-secondary hover:text-white'
                }`}
              >
                {t('settings.background.solid')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('gradient')
                  onChange(buildCustomGradient(customFrom, customTo, stops))
                }}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                  mode === 'gradient' ? 'bg-huginn-accent text-white' : 'text-huginn-text-secondary hover:text-white'
                }`}
              >
                {t('settings.background.gradient')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live preview — click to apply */}
          <button
            type="button"
            onClick={applyPreview}
            title={customMode ? t('settings.background.activeTitle') : t('settings.background.applyTitle')}
            className={`relative w-14 h-12 rounded-md border shrink-0 transition-all ${
              customMode
                ? 'border-huginn-accent ring-2 ring-huginn-accent/40'
                : 'border-huginn-border hover:border-huginn-accent hover:scale-105 active:scale-95'
            }`}
            style={{ background: previewCss }}
          >
            {!customMode && (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-wider font-bold text-white/90 bg-black/30 rounded-md opacity-0 hover:opacity-100 transition-opacity">
                {t('settings.background.apply')}
              </span>
            )}
          </button>

          <div className="flex-1 flex items-center gap-2 flex-wrap">
            {mode === 'solid' ? (
              <HexInput
                value={customSolid}
                onChange={(hex) => onChange(hex)}
              />
            ) : (
              <>
                <HexInput
                  value={customFrom}
                  onChange={(hex) => onChange(buildCustomGradient(hex, customTo, stops))}
                  copyFromOther={() => onChange(buildCustomGradient(customTo, customTo, stops))}
                  copyDirection="left"
                />
                <button
                  type="button"
                  onClick={() => onChange(buildCustomGradient(customTo, customFrom, stops))}
                  title={t('settings.background.swap')}
                  className="text-huginn-text-muted hover:text-huginn-accent text-base p-1 rounded hover:bg-huginn-hover transition-colors"
                  aria-label={t('settings.background.swap')}
                >
                  ⇆
                </button>
                <HexInput
                  value={customTo}
                  onChange={(hex) => onChange(buildCustomGradient(customFrom, hex, stops))}
                  copyFromOther={() => onChange(buildCustomGradient(customFrom, customFrom, stops))}
                  copyDirection="right"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
