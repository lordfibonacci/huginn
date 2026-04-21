import { useTranslation } from 'react-i18next'

interface HexInputProps {
  value: string
  onChange: (hex: string) => void
  copyFromOther?: () => void
  copyDirection?: 'left' | 'right'
  className?: string
}

export function HexInput({ value, onChange, copyFromOther, copyDirection, className = '' }: HexInputProps) {
  const { t } = useTranslation()
  return (
    <div className={`relative flex items-center gap-1.5 group ${className}`}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded cursor-pointer bg-transparent border border-huginn-border [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value
          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
        }}
        className="w-20 bg-huginn-surface text-xs text-huginn-text-primary rounded px-2 py-1 outline-none border border-huginn-border focus:border-huginn-accent font-mono"
      />
      {copyFromOther && (
        <button
          type="button"
          onClick={copyFromOther}
          title={t('settings.hexInput.copyFrom')}
          className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 transition-opacity text-[10px] text-huginn-text-muted hover:text-huginn-accent px-1.5 py-0.5 rounded hover:bg-huginn-hover"
        >
          {copyDirection === 'left' ? t('settings.hexInput.copyLeft') : t('settings.hexInput.copyRight')}
        </button>
      )}
    </div>
  )
}
