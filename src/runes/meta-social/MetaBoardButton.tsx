import { useTranslation } from 'react-i18next'

interface Props {
  active: boolean
  onClick: () => void
}

// Sits next to the existing Cards / Calendar toggle in the board header.
// Tertiary-style (separate pill) so it visually reads as a rune extension
// rather than another core view toggle.
export function MetaBoardButton({ active, onClick }: Props) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'text-xs font-semibold px-2.5 py-1 rounded-md transition-colors',
        active
          ? 'bg-huginn-accent text-white'
          : 'bg-huginn-card text-huginn-text-secondary hover:text-white hover:bg-huginn-hover',
      ].join(' ')}
      title={t('runes.meta-social.calendar')}
    >
      {t('runes.meta-social.calendar')}
    </button>
  )
}
