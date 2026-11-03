import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../../shared/lib/dateUtils'
import { downloadFile, fileUrl } from '../../lib/api'
import { fileStamp, sortFiles } from '../../lib/files'
import { readerKind } from '../../lib/reader'
import { fileKindLabel } from '../../lib/upload'
import type { FileRow, Participant, Plan } from '../../lib/types'
import { CopyButton } from '../CopyButton'

type Props = {
  files: FileRow[]
  plans: Plan[]
  participants: Participant[]
  fresh: (at: string | null, author: string | null) => boolean
  // Opens an md or txt file in the reader, which takes the panel's place.
  onRead: (file: FileRow) => void
}

// "Skjöl": plans with a repo path come first (path only, no open), then who
// added what and when (a replaced file shows its last replace), the repo path
// to copy, and the file's note. A tap opens the file: md and txt in the reader (onRead),
// anything else in a new tab through a signed url; the arrow saves it. A file someone else
// added since the viewer last opened the item is marked new; plan rows
// never are.
export function FilesTab({ files, plans, participants, fresh, onRead }: Props) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  // Signed urls of files whose new tab was blocked, shown as a link to tap.
  const [links, setLinks] = useState<Record<string, string>>({})
  // Files being opened right now: a double tap opens one tab, not two.
  const opening = useRef(new Set<string>())

  const open = async (file: FileRow) => {
    setError(null)
    if (readerKind(file.name)) {
      onRead(file)
      return
    }
    if (opening.current.has(file.id)) return
    opening.current.add(file.id)
    // Open the tab inside the tap so it is not blocked as a popup, then point
    // it at the signed url once it arrives. If the browser blocked it anyway,
    // the board stays and the file gets a link to tap.
    const tab = window.open('', '_blank')
    try {
      const url = await fileUrl(file.storage_path)
      if (tab) {
        tab.opener = null
        tab.location.href = url
      } else {
        setLinks((l) => ({ ...l, [file.id]: url }))
      }
    } catch (e) {
      console.error(e)
      tab?.close()
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      opening.current.delete(file.id)
    }
  }

  // Saves the file under its own name. A double click saves once.
  const download = async (file: FileRow) => {
    setError(null)
    if (opening.current.has(file.id)) return
    opening.current.add(file.id)
    try {
      await downloadFile(file)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      opening.current.delete(file.id)
    }
  }

  const withPath = [...plans].filter((p) => p.path).sort((a, b) => a.position - b.position)

  if (files.length === 0 && withPath.length === 0) {
    return <p className="hg-pn-muted">{t('vinnubord.panel.files.empty')}</p>
  }

  return (
    <>
      {error && (
        <p className="hg-pn-error" role="alert">
          {error}
        </p>
      )}
      <ul className="hg-pn-list">
        {withPath.map((p) => (
          <li key={p.id} className="hg-file hg-file-plan">
            <div className="hg-file-head">
              <span className="hg-pill">{t('vinnubord.panel.files.planKind')}</span>
              <span className="hg-file-name">{p.name}</span>
            </div>
            <div className="hg-path">
              <code>{p.path}</code>
              <CopyButton text={p.path as string} what={t('vinnubord.panel.copyOf.planPath')} />
            </div>
          </li>
        ))}
        {sortFiles(files).map((f) => {
          const stamp = fileStamp(f)
          const by = participants.find((p) => p.user_id === stamp.by)
          const isNew = fresh(stamp.at, stamp.by)
          return (
            <li key={f.id} className={`hg-file${isNew ? ' hg-fresh' : ''}`}>
              <div className="hg-file-head">
                <button
                  type="button"
                  className="hg-file-open"
                  onClick={() => void open(f)}
                  aria-label={t('vinnubord.panel.files.open', { name: f.name })}
                >
                  <span className="hg-pill">{fileKindLabel(f.name)}</span>
                  <span className="hg-file-name">{f.name}</span>
                </button>
                <button
                  type="button"
                  className="hg-file-dl"
                  aria-label={t('vinnubord.panel.files.download', { name: f.name })}
                  title={t('vinnubord.panel.files.download', { name: f.name })}
                  onClick={() => void download(f)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13h10" />
                  </svg>
                </button>
              </div>
              {f.note && <p className="hg-file-note">{f.note}</p>}
              <p className="hg-pn-meta">
                <span className="hg-av" aria-hidden="true">
                  {by?.short ?? '?'}
                </span>
                {isNew && <span className="hg-fresh-mark">{t('vinnubord.panel.fresh')}</span>}
                {t(stamp.updated ? 'vinnubord.panel.files.updatedBy' : 'vinnubord.panel.files.by', {
                  name: by?.display_name ?? '?',
                  when: stamp.at ? formatStamp(stamp.at) : '',
                })}
              </p>
              {links[f.id] && (
                <a className="hg-file-link" href={links[f.id]} target="_blank" rel="noopener noreferrer">
                  {t('vinnubord.panel.files.openLink', { name: f.name })}
                </a>
              )}
              {f.repo_path && (
                <div className="hg-path">
                  <code>{f.repo_path}</code>
                  <CopyButton text={f.repo_path} what={t('vinnubord.panel.copyOf.repoPath')} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
