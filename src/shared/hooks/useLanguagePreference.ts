import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile } from './useProfile'
import type { Language } from '../i18n'
import { SUPPORTED_LANGUAGES } from '../i18n'

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export function useLanguagePreference() {
  const { i18n } = useTranslation()
  const { profile, updateProfile } = useProfile()

  useEffect(() => {
    if (!profile?.locale) return
    if (!isLanguage(profile.locale)) return
    if (profile.locale === i18n.language) return
    i18n.changeLanguage(profile.locale)
  }, [profile?.locale, i18n])

  async function setLanguage(lang: Language) {
    await i18n.changeLanguage(lang)
    localStorage.setItem('huginn.lang', lang)
    if (profile) {
      await updateProfile({ locale: lang })
    }
  }

  return {
    language: (i18n.language as Language) ?? 'is',
    setLanguage,
  }
}
