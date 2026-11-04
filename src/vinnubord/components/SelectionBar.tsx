import { useTranslation } from 'react-i18next'

type Props = {
  // Selected cards (two or more show the bar).
  count: number
  // An arrange just ran and can still be undone.
  undoable: boolean
  onArrange: () => void
  onUndo: () => void
  onCancel: () => void
}

// The small bar above the zoom controls while two or more cards are selected
// with the Ctrl marquee: arrange them in a grid, undo the last arrange, or
// drop the selection. Mouse only, like the selection.
export function SelectionBar({ count, undoable, onArrange, onUndo, onCancel }: Props) {
  const { t } = useTranslation()
  return (
    <div className="hg-sel-bar" role="status">
      <span className="hg-sel-bar-text">{undoable ? t('vinnubord.selection.arranged') : t('vinnubord.selection.count', { count })}</span>
      {undoable ? (
        <button type="button" onClick={onUndo}>{t('vinnubord.selection.undo')}</button>
      ) : (
        <button type="button" onClick={onArrange}>{t('vinnubord.selection.arrange')}</button>
      )}
      <button type="button" onClick={onCancel}>{t('vinnubord.selection.cancel')}</button>
    </div>
  )
}
