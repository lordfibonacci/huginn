import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatStamp } from '../../../shared/lib/dateUtils'
import { fileText, fileUrl } from '../../lib/api'
import { fileStamp, sortFiles } from '../../lib/files'
import { fileKindLabel } from '../../lib/upload'
import type { FileRow, Participant, Plan } from '../../lib/types'
import { CopyButton } from '../CopyButton'
import { Markdown } from '../Markdown'

type Props = {
  files: FileRow[]
  plans: Plan[]
  participants: Participant[]
  fresh: (createdAt: string | null, author: string | null) => boolean
}

type Reader = { file: FileRow; text: string | null; error: string | null }

// "Skjöl": plans with a repo path come first (path only, no open), then who
// added what and when (a replaced file shows its last replace), the repo path to copy. A tap opens the file: md and txt
// in the reader inside the panel, anything else in a new tab through a signed
// url. A file someone else added since the viewer last opened the item is
// marked new; plan rows never are.
export function FilesTab({ files, plans, participants, fresh }: Props) {
  const { t } = useTranslation()
  const [reader, setReader] = useState<Reader | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Signed urls of files whose new tab was blocked, shown as a link to tap.
  const [links, setLinks] = useState<Record<string, string>>({})
  // Files being opened right now: a double tap opens one tab, not two.
  const opening = useRef(new Set<string>())

  const open = async (file: FileRow) => {
    setError(null)
    const kind = fileKindLabel(file.name)
    if (kind === 'MD' || kind === 'TXT') {
      setReader({ file, text: null, error: null })
      try {
        const text = await fileText(file.storage_path)
        setReader((r) => (r?.file.id === file.id ? { ...r, text } : r))
      } catch (e) {
        console.error(e)
        const message = e instanceof Error ? e.message : String(e)
        setReader((r) => (r?.file.id === file.id ? { ...r, error: message } : r))
      }
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

  if (reader) {
    const kind = fileKindLabel(reader.file.name)
    return (
      <div className="hg-reader">
        <button type="button" className="hg-btn hg-btn-ghost" onClick={() => setReader(null)}>
          {t('vinnubord.panel.files.back')}
        </button>
        <h3 className="hg-reader-name">{reader.file.name}</h3>
        {reader.error ? (
          <p className="hg-pn-error" role="alert">
            {reader.error}
          </p>
        ) : reader.text === null ? (
          <p className="hg-pn-muted">{t('vinnubord.panel.files.loading')}</p>
        ) : kind === 'MD' ? (
          <Markdown source={reader.text} />
        ) : (
          <pre className="hg-reader-text">{reader.text}</pre>
        )}
      </div>
    )
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
              <button
                type="button"
                className="hg-file-open"
                onClick={() => void open(f)}
                aria-label={t('vinnubord.panel.files.open', { name: f.name })}
              >
                <span className="hg-pill">{fileKindLabel(f.name)}</span>
                <span className="hg-file-name">{f.name}</span>
              </button>
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
