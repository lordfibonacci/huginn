import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import is from './locales/is.json'

export const SUPPORTED_LANGUAGES = ['is', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_LABELS: Record<Language, string> = {
  is: 'Íslenska',
  en: 'English',
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      is: { translation: is },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'huginn.lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    load: 'languageOnly',
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (lngs, _ns, key) => {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] missing key: ${key} (in ${lngs.join(',')})`)
      }
    },
  })

const stored = localStorage.getItem('huginn.lang')
if (!stored) {
  const nav = (navigator.language || '').toLowerCase()
  const preferred: Language = nav.startsWith('en') ? 'en' : 'is'
  i18n.changeLanguage(preferred)
}

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})
document.documentElement.lang = i18n.language

export default i18n
