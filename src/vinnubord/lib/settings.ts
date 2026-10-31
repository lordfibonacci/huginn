import { TONES, type Tone } from './status'

// Pure parts of the project settings page: slugs, shorts, coordinates, order
// within a list, the delete guards (ruling R24) and the project field diff.

// The five board tones a module can be given.
export const MODULE_COLORS: readonly Tone[] = TONES

const ICELANDIC: Record<string, string> = { þ: 'th', ð: 'd', æ: 'ae', ö: 'o', ø: 'o' }
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SHORT_MAX = 3

// Lowercase ascii, words joined with a hyphen, as the command line tool uses them.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[þðæöø]/g, (c) => ICELANDIC[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function validateSlug(slug: string, modules: { id: string; slug: string }[], selfId?: string): string | null {
  if (slug === '') return 'Slóðarheiti vantar.'
  if (!SLUG_RE.test(slug)) return 'Slóðarheiti má bara hafa litla stafi a til z, tölustafi og stök bandstrik á milli orða.'
  if (modules.some((m) => m.slug === slug && m.id !== selfId)) return 'Annar módull hefur þegar þetta slóðarheiti.'
  return null
}

export function validateModuleName(name: string): string | null {
  return name.trim() === '' ? 'Módullinn þarf nafn.' : null
}

export function validateShort(short: string, participants: { id: string; short: string }[], selfId?: string): string | null {
  const s = short.trim()
  if (s === '') return 'Stutt nafn vantar.'
  if ([...s].length > SHORT_MAX) return 'Stutt nafn má vera mest þrír stafir.'
  const lower = s.toLocaleLowerCase('is')
  if (participants.some((p) => p.id !== selfId && p.short.trim().toLocaleLowerCase('is') === lower)) {
    return 'Annar þátttakandi hefur þegar þetta stutta nafn.'
  }
  return null
}

// A board coordinate typed in a field, rounded to a whole number.
export function parseCoord(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n) : null
}

export function nextPosition(rows: { position: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.position + 1), 0)
}

export type PositionChange = { id: string; position: number }

// Moves one row a step up (-1) or down (1) in position order and renumbers the
// list 0..n. Returns only the rows whose position changed, nothing when the
// move is impossible.
export function reorder(rows: { id: string; position: number }[], id: string, delta: -1 | 1): PositionChange[] {
  const sorted = [...rows].sort((a, b) => a.position - b.position)
  const from = sorted.findIndex((r) => r.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= sorted.length) return []
  const [moved] = sorted.splice(from, 1)
  sorted.splice(to, 0, moved)
  return sorted.flatMap((r, i) => (r.position === i ? [] : [{ id: r.id, position: i }]))
}

// items is every item in the module, closed ones too. comments are the
// module's own comments, which a delete would remove with it (on delete cascade).
export function moduleDeleteBlock(items: number, comments = 0): string | null {
  if (items > 0) {
    return items === 1
      ? 'Ekki hægt að eyða módul sem á verk: 1 verk tengist honum. Færðu það fyrst.'
      : `Ekki hægt að eyða módul sem á verk: ${items} verk tengjast honum. Færðu þau fyrst.`
  }
  if (comments > 0) {
    return comments === 1
      ? 'Ekki hægt að eyða módul sem á athugasemd: 1 athugasemd fylgir honum og myndi hverfa með.'
      : `Ekki hægt að eyða módul sem á athugasemdir: ${comments} athugasemdir fylgja honum og myndu hverfa með.`
  }
  return null
}

// Messages from hg_add_participant for the codes it raises. A unique violation
// is always the fixed Icelandic text: two people adding the same user at once
// hit the table constraint, whose own message is English. null for other errors.
const ALREADY_PARTICIPANT = 'Notandinn er þegar þátttakandi í verkefninu.'
const PARTICIPANT_CODES = new Set(['42501', 'P0002', '22023'])

export function participantErrorMessage(code: string | undefined, message: string): string | null {
  if (code === '23505') return ALREADY_PARTICIPANT
  if (code && PARTICIPANT_CODES.has(code)) return message
  return null
}

export function validateProjectName(name: string): string | null {
  return name.trim() === '' ? 'Verkefnið þarf nafn.' : null
}

export function participantRemoveBlock(p: { user_id: string; is_service: boolean }, viewerId: string): string | null {
  if (p.user_id === viewerId) return 'Þú getur ekki fjarlægt sjálfa(n) þig.'
  if (p.is_service) return 'Ekki er hægt að fjarlægja þjónustunotandann.'
  return null
}

export type ProjectFields = { name: string; repo_path: string | null; context_bundle: string | null }
export type ProjectFieldsForm = { name: string; repo_path: string; context_bundle: string }
export type ProjectPatch = Partial<ProjectFields & { context_bundle_at: string }>

// The changed project fields. Names and paths are trimmed, an emptied path or
// bundle becomes null, an empty name is never sent, and a changed bundle is
// stamped with now (no trigger keeps context_bundle_at).
export function projectPatch(project: ProjectFields, form: ProjectFieldsForm, now: string): ProjectPatch {
  const patch: ProjectPatch = {}
  const name = form.name.trim()
  if (name !== '' && name !== project.name) patch.name = name

  const repo = form.repo_path.trim() === '' ? null : form.repo_path.trim()
  if (repo !== project.repo_path) patch.repo_path = repo

  const bundle = form.context_bundle.trim() === '' ? null : form.context_bundle
  if (bundle !== project.context_bundle) {
    patch.context_bundle = bundle
    patch.context_bundle_at = now
  }
  return patch
}
