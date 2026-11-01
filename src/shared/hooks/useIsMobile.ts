import { useMediaQuery } from './useMediaQuery'

// Matches the Tailwind `md` breakpoint (<768px = mobile). We don't use a media
// query hook library, one source of truth for "is this a phone-sized viewport".
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
