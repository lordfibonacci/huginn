// Returns the ideal foreground text color (light or dark) for a given background
// color, based on relative luminance — matches the approach Trello uses so that
// yellow / mint / amber labels get dark text, while red / blue / purple labels
// stay white.
//
// Luminance threshold of 0.55 was chosen empirically against our 30-color
// palette so the mid-tone yellows (#e2b203) flip to dark while the darker
// ambers (#946f00) stay white.

const LIGHT = '#ffffff'
const DARK = '#091e42' // Trello's dark label text color

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace('#', '')
  if (m.length !== 3 && m.length !== 6) return null
  const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(n => Number.isNaN(n))) return null
  return [r, g, b]
}

function channelToLinear(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

export function getContrastTextColor(backgroundHex: string): string {
  const rgb = hexToRgb(backgroundHex)
  if (!rgb) return LIGHT
  const L = relativeLuminance(rgb[0], rgb[1], rgb[2])
  return L > 0.55 ? DARK : LIGHT
}
