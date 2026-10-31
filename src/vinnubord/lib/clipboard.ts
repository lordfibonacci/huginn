// Copying text from the panel. Every prompt, SQL block, path and next step has
// a copy button that must work on a phone, including older Safari.

// Line endings to LF and trailing whitespace off each line. Nothing else
// changes: indentation, inner blank lines and leading or trailing newlines stay.
export function normalizeForCopy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
}

// Clipboard API first, a hidden textarea with execCommand for browsers that
// lack it or refuse it (older Safari, insecure origins). Never throws.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the textarea.
  }
  return copyWithTextarea(text)
}

function copyWithTextarea(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  // Off screen, and 16 px so iOS does not zoom when it takes focus.
  area.style.position = 'fixed'
  area.style.top = '0'
  area.style.left = '-9999px'
  area.style.fontSize = '16px'
  document.body.appendChild(area)
  try {
    area.select()
    area.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(area)
  }
}
