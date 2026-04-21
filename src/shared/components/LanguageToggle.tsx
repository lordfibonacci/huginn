import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../i18n'
import type { Language } from '../i18n'
import { useProfile } from '../hooks/useProfile'

interface LanguageToggleProps {
  className?: string
}

export function LanguageToggle({ className = '' }: LanguageToggleProps) {
  const { i18n } = useTranslation()
  const { profile, updateProfile } = useProfile()
  const current = (i18n.language as Language) ?? 'is'

  async function pick(lang: Language) {
    if (lang === current) return
    await i18n.changeLanguage(lang)
    localStorage.setItem('huginn.lang', lang)
    if (profile) await updateProfile({ locale: lang })
  }

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-huginn-border/60 bg-huginn-base/40 p-0.5 ${className}`}
    >
      {SUPPORTED_LANGUAGES.map((lang) => {
        const active = current === lang
        return (
          <button
            key={lang}
            type="button"
            onClick={() => pick(lang)}
            role="radio"
            aria-checked={active}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              active
                ? 'bg-huginn-accent text-white font-semibold'
                : 'text-huginn-text-secondary hover:text-white hover:bg-huginn-hover'
            }`}
          >
            {lang === 'is' ? 'IS' : 'EN'}
            <span className="sr-only"> — {LANGUAGE_LABELS[lang]}</span>
          </button>
        )
      })}
    </div>
  )
}
