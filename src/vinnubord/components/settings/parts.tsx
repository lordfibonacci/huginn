import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MODULE_COLORS } from '../../lib/settings'

// Small pieces shared by the settings editors.

export function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`hg-set-field ${className}`.trim()}>
      <span>
        {label}
        {hint && <small> {hint}</small>}
      </span>
      {children}
    </label>
  )
}

// Up and down buttons for a row in an ordered list.
export function OrderButtons({
  name,
  first,
  last,
  disabled,
  onMove,
}: {
  name: string
  first: boolean
  last: boolean
  disabled: boolean
  onMove: (delta: -1 | 1) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="hg-set-order">
      <button
        type="button"
        className="hg-set-icon"
        aria-label={t('vinnubord.settings.moveUp', { name })}
        disabled={disabled || first}
        onClick={() => onMove(-1)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 10l4-4 4 4" />
        </svg>
      </button>
      <button
        type="button"
        className="hg-set-icon"
        aria-label={t('vinnubord.settings.moveDown', { name })}
        disabled={disabled || last}
        onClick={() => onMove(1)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
    </div>
  )
}

// The five board tones as a radio group of swatches.
export function ColorPicker({ value, onChange, disabled }: { value: string; onChange: (c: string) => void; disabled: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="hg-set-field">
      <span>{t('vinnubord.settings.modules.color')}</span>
      <div className="hg-set-colors" role="radiogroup" aria-label={t('vinnubord.settings.modules.color')}>
        {MODULE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={t(`vinnubord.settings.colors.${c}`)}
            title={t(`vinnubord.settings.colors.${c}`)}
            className={`hg-swatch hg-tone-${c}${value === c ? ' hg-on' : ''}`}
            disabled={disabled}
            onClick={() => onChange(c)}
          >
            <i aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}

// The end of a row: the error or a saved note, and the buttons.
export function Actions({ error, saved, children }: { error: string | null; saved?: boolean; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="hg-set-actions">
      {error ? (
        <p className="hg-pn-error" role="alert">
          {error}
        </p>
      ) : saved ? (
        <p className="hg-set-note" role="status">
          {t('vinnubord.settings.saved')}
        </p>
      ) : null}
      {children}
    </div>
  )
}
