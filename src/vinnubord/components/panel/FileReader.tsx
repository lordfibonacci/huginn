import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { downloadFile, fileText } from '../../lib/api'
import { normalizeForCopy } from '../../lib/clipboard'
import { outline } from '../../lib/markdown'
import { activeHeading, readerKind, showToc, type ReaderMode } from '../../lib/reader'
import type { FileRow } from '../../lib/types'
import { useCopy } from '../CopyButton'
import { Markdown } from '../Markdown'

type Props = {
  file: FileRow
  mode: ReaderMode
  onMode: (m: ReaderMode) => void
  onBack: () => void
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// The file reader: replaces the item panel content while an md or txt file is
// open. A bar with Til baka, the name, the Lesa / Md switch (md only), Sækja
// and Afrita allt, then the contents (md in Lesa with two or more headings) and
// the body at a readable measure. Lazy loaded, so marked stays out of the board
// bundle. The parent keys it by storage path, so a replaced file reloads.
export default function FileReader({ file, mode, onMode, onBack }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // A failed Sækja shows under the bar; the text being read stays.
  const [saveError, setSaveError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const frame = useRef<number | null>(null)
  const saving = useRef(false)
  const { state, copy } = useCopy()
  const kind = readerKind(file.name)

  useEffect(() => {
    let live = true
    setText(null)
    setError(null)
    fileText(file.storage_path).then(
      (body) => {
        if (live) setText(body)
      },
      (e: unknown) => {
        console.error(e)
        if (live) setError(errorText(e))
      },
    )
    return () => {
      live = false
    }
  }, [file.storage_path])

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    [],
  )

  const headings = useMemo(() => (text && kind === 'md' ? outline(text) : []), [text, kind])
  const toc = kind === 'md' && mode === 'read' && showToc(headings)

  const pick = (next: number) => {
    activeRef.current = next
    setActive(next)
  }

  // The active contents line follows the scroll, measured once per frame.
  // Tops are read fresh every time, so nothing goes stale when the body changes.
  const onScroll = () => {
    if (!toc || frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const body = bodyRef.current
      if (!body) return
      const base = body.getBoundingClientRect().top - body.scrollTop
      // A heading not rendered yet counts as below everything, so indexes stay in step.
      const tops = headings.map((h) => {
        const el = body.querySelector<HTMLElement>('#' + h.id)
        return el ? el.getBoundingClientRect().top - base : Infinity
      })
      const next = activeHeading(tops, body.scrollTop)
      if (next !== activeRef.current) pick(next)
    })
  }

  const go = (i: number, e: MouseEvent<HTMLButtonElement>) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    bodyRef.current
      ?.querySelector<HTMLElement>('#' + headings[i].id)
      ?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
    pick(i)
    // On the phone the contents sit in a details under the bar: close it.
    e.currentTarget.closest('details')?.removeAttribute('open')
  }

  // Saves the file under its own name. A double click saves once.
  const download = async () => {
    if (saving.current) return
    saving.current = true
    setSaveError(null)
    try {
      await downloadFile(file)
    } catch (e) {
      console.error(e)
      setSaveError(errorText(e))
    } finally {
      saving.current = false
    }
  }

  const tocList = (
    <>
      <b>{t('vinnubord.panel.reader.contents')}</b>
      {headings.map((h, i) => (
        <button
          key={h.id}
          type="button"
          className={i === active ? 'hg-on' : undefined}
          style={{ '--hg-toc-depth': h.level - 1 } as CSSProperties}
          aria-current={i === active ? 'location' : undefined}
          onClick={(e) => go(i, e)}
        >
          {h.text}
        </button>
      ))}
    </>
  )

  return (
    <div className="hg-reader">
      <div className="hg-reader-bar">
        <button type="button" className="hg-btn hg-btn-ghost" onClick={onBack}>
          {t('vinnubord.panel.reader.back')}
        </button>
        <h3 className="hg-reader-name" title={file.name}>
          {file.name}
        </h3>
        <div className="hg-reader-tools">
          {kind === 'md' && (
            <div className="hg-reader-mode" role="group" aria-label={t('vinnubord.panel.reader.modeLabel')}>
              <button type="button" aria-pressed={mode === 'read'} onClick={() => onMode('read')}>
                {t('vinnubord.panel.reader.read')}
              </button>
              <button type="button" aria-pressed={mode === 'md'} onClick={() => onMode('md')}>
                {t('vinnubord.panel.reader.md')}
              </button>
            </div>
          )}
          <button type="button" className="hg-btn" onClick={() => void download()}>
            {t('vinnubord.panel.reader.download')}
          </button>
          <button
            type="button"
            className="hg-btn"
            disabled={text === null}
            onClick={() => void copy(normalizeForCopy(text ?? ''))}
          >
            {state === 'ok' ? t('vinnubord.panel.reader.copied') : t('vinnubord.panel.reader.copyAll')}
          </button>
        </div>
      </div>
      {saveError && (
        <p className="hg-pn-error hg-reader-save-error" role="alert">
          {saveError}
        </p>
      )}
      {toc && (
        <details className="hg-reader-toc-dd">
          <summary>{t('vinnubord.panel.reader.contentsAt', { heading: headings[active]?.text ?? '' })}</summary>
          <div className="hg-reader-toc">{tocList}</div>
        </details>
      )}
      <div className="hg-reader-main">
        {toc && (
          <nav className="hg-reader-toc" aria-label={t('vinnubord.panel.reader.contents')}>
            {tocList}
          </nav>
        )}
        <div ref={bodyRef} className="hg-reader-body hg-pn-body" onScroll={onScroll}>
          {error ? (
            <p className="hg-pn-error" role="alert">
              {error}
            </p>
          ) : text === null ? (
            <p className="hg-pn-muted">{t('vinnubord.panel.files.loading')}</p>
          ) : kind === 'md' && mode === 'read' ? (
            <Markdown source={text} headingIds />
          ) : (
            <pre className="hg-reader-text">{text}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
