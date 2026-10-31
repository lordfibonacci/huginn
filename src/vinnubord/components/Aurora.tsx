import { memo } from 'react'

// The slow northern lights veil behind the board grid: three soft blobs that
// drift on 38 to 52 s loops (colors, sizes and times are tokens in
// vinnubord.css). Pure decoration, it never takes pointer events. Under
// prefers-reduced-motion the blobs stand still.
export const Aurora = memo(function Aurora() {
  return (
    <div className="hg-aurora" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  )
})
