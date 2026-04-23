import { useEffect, useState } from 'react'

// Matches the Tailwind `md` breakpoint (<768px = mobile). We don't use a media
// query hook library — one source of truth for "is this a phone-sized viewport".
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 768
  )

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isMobile
}
