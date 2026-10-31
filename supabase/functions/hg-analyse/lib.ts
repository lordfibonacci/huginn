// Pure helpers for the hg-analyse edge function. No imports and no Deno
// globals, so vitest (Node) and the Deno function both load this file.

export type FileRow = { name: string; size: number; mime: string | null }

export type MessageFile = { name: string; size: number; text?: string }

export type MessageInput = {
  item: { title: string; body: string | null }
  files: MessageFile[]
  bundle: string | null
  modules: Array<{ slug: string; name: string; status_line: string | null }>
  participants: Array<{ short: string; name: string }>
}

export type QuestionTo = 'Á' | 'H'

export type Analysis = {
  summary: string
  body: string
  module_id: string | null
  tags: string[]
  questions: Array<{ to: QuestionTo; body: string }>
  unmatchedModule: boolean
}

export const ANALYSIS_TOOL_NAME = 'skrifa_greiningu'
export const CLIP_MARKER = '\n\n[klippt, skráin er lengri]'
export const UNMATCHED_TAG = 'óflokkað'
export const MAX_TAGS = 6
export const MAX_FILE_BYTES = 2_000_000
export const MAX_TEXT_BYTES = 400_000

export const BODY_HEADINGS = [
  'Hvað þetta er',
  'Hvaða módul og af hverju',
  'Stærð og áhætta',
  'Hvað þarf að spyrja um',
  'Byggjanlegt núna, samhliða eða seinna',
] as const

const TEXT_EXTENSIONS = new Set(['html', 'htm', 'md', 'markdown', 'txt'])
const TEXT_MIMES = new Set(['text/html', 'text/markdown', 'text/x-markdown', 'text/plain'])
// Never sent to Claude, whatever the mime says.
const BINARY_EXTENSIONS = new Set([
  'mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv',
  'zip',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic',
  'pdf',
])

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return name.slice(dot + 1).toLowerCase()
}

function isTextFile(file: FileRow): boolean {
  const ext = extensionOf(file.name)
  if (BINARY_EXTENSIONS.has(ext)) return false
  if (TEXT_EXTENSIONS.has(ext)) return true
  const mime = (file.mime ?? '').split(';')[0].trim().toLowerCase()
  return TEXT_MIMES.has(mime)
}

// Html, md and txt up to maxPerFile bytes are read and sent. Everything else
// (video, zip, images, text that is too big) goes in the file list by name
// and size only. Extra fields on the rows, such as storage paths, pass through.
export function selectTextFiles<T extends FileRow>(
  files: T[],
  maxPerFile: number = MAX_FILE_BYTES,
): { send: T[]; listOnly: T[] } {
  const send: T[] = []
  const listOnly: T[] = []
  for (const f of files) {
    if (isTextFile(f) && f.size <= maxPerFile) send.push(f)
    else listOnly.push(f)
  }
  return { send, listOnly }
}

// maxBytes counts UTF-8 bytes. The cut steps back over continuation bytes so
// it never lands inside a multi byte character. The marker comes on top.
export function clipText(text: string, maxBytes: number = MAX_TEXT_BYTES): string {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length <= maxBytes) return text
  let cut = Math.max(0, maxBytes)
  while (cut > 0 && (bytes[cut] & 0xc0) === 0x80) cut--
  return new TextDecoder().decode(bytes.subarray(0, cut)) + CLIP_MARKER
}

function fenceFor(text: string): string {
  const runs = text.match(/`+/g) ?? []
  const longest = runs.reduce((n, r) => Math.max(n, r.length), 0)
  return '`'.repeat(Math.max(3, longest + 1))
}

function sizeKb(size: number): string {
  return `${Math.ceil(size / 1024)} KB`
}

export function buildUserMessage(input: MessageInput): string {
  const { item, files, bundle, modules, participants } = input
  const body = item.body && item.body.trim() !== '' ? item.body : '(enginn texti)'

  const itemPart = ['# Nýtt atriði', `Titill: ${item.title}`, '', body].join('\n')

  const fileLines = files.map((f) =>
    f.text === undefined
      ? `- ${f.name}, ${sizeKb(f.size)}, aðeins nafn og stærð, efnið er ekki sent`
      : `- ${f.name}, ${sizeKb(f.size)}`,
  )
  const fileTexts = files
    .filter((f): f is MessageFile & { text: string } => f.text !== undefined)
    .map((f) => {
      const fence = fenceFor(f.text)
      return `## ${f.name}\n${fence}\n${f.text}\n${fence}`
    })
  const filePart = [
    '# Skrár',
    ...(files.length > 0 ? fileLines : ['Engar skrár fylgja.']),
    ...fileTexts.map((t) => `\n${t}`),
  ].join('\n')

  const moduleLines = modules.map(
    (m) => `- ${m.slug}: ${m.name}${m.status_line ? `. ${m.status_line}` : ''}`,
  )
  const modulePart = ['# Módúlar', ...(moduleLines.length > 0 ? moduleLines : ['(engir módúlar skráðir)'])].join(
    '\n',
  )

  const peopleLines = participants.map((p) => `- ${p.short}: ${p.name}`)
  const peoplePart = ['# Þátttakendur', ...(peopleLines.length > 0 ? peopleLines : ['(engir)'])].join('\n')

  const bundlePart = [
    '# Samhengi verkefnisins',
    bundle && bundle.trim() !== '' ? bundle : 'Ekkert samhengi er skráð fyrir verkefnið.',
  ].join('\n')

  return [itemPart, filePart, modulePart, peoplePart, bundlePart].join('\n\n')
}

const headingList = BODY_HEADINGS.map((h) => `## ${h}`).join('\n')

export const SYSTEM_PROMPT = `Þú ert Claude og skrifar fyrstu skyndigreiningu á nýju atriði sem var að lenda á vinnuborði Mettu (Huginn).

Þátttakendur á borðinu:
Heimir, stutt H: tekur ákvarðanir og rekur hlutina.
Árni, stutt Á: hönnun, módúlar og spekkar í Markdown og HTML frumgerðum. Árni skrifar aldrei kóða.
Claude, það ert þú: greining, áætlanir og smíði.

Lestu atriðið, skrárnar sem fylgja, módúlalistann og samhengi verkefnisins. Skrifaðu svo stutta fyrstu greiningu sem sýnir Heimi og Árna strax hvað þetta er, hvert það á heima og hvað þarf til.

Svaraðu eingöngu með því að kalla á tólið ${ANALYSIS_TOOL_NAME} nákvæmlega einu sinni. Skrifaðu engan annan texta, hvorki á undan kallinu né eftir það.

Reglur:
1. Skrifaðu á íslensku, á einföldu og stuttu máli.
2. Notaðu aldrei löng eða stutt þankastrik sem greinarmerki. Notaðu kommur, punkta eða tvípunkta í staðinn.
3. summary: 1 til 3 setningar um hvar við erum með þetta atriði.
4. body: Markdown með nákvæmlega þessum fimm fyrirsögnum, í þessari röð:
${headingList}
Undir síðustu fyrirsögninni segirðu hvort hægt sé að byggja þetta núna, samhliða öðru verki eða hvort það þurfi að bíða, og af hverju.
5. module_slug: veldu aðeins slug úr módúlalistanum sem fylgir. Ef ekkert módul passar, skilaðu null. Búðu aldrei til nýtt slug.
6. tags: 2 til 6 stutt tögg á íslensku, í lágstöfum.
7. questions: spyrðu aðeins þegar svar er raunverulega nauðsynlegt til að halda áfram. Hönnunarspurningar fara til Á, ákvörðunarspurningar til H. Ef ekkert þarf að spyrja, skilaðu tómu fylki.
8. Skrár sem eru aðeins nefndar með nafni og stærð hefurðu ekki séð. Ekki giska á innihald þeirra.
9. Skrá sem endar á [klippt, skráin er lengri] var stytt. Hafðu það í huga.`

export const analysisTool = {
  name: ANALYSIS_TOOL_NAME,
  description: 'Skráir fyrstu skyndigreiningu á nýju atriði á vinnuborði Mettu. Kallað er á tólið nákvæmlega einu sinni.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: {
        type: 'string',
        description: '1 til 3 setningar á íslensku: hvar erum við með þetta atriði.',
      },
      body: {
        type: 'string',
        description: `Markdown á íslensku með nákvæmlega þessum fimm fyrirsögnum, í þessari röð: ${BODY_HEADINGS.map(
          (h) => `"## ${h}"`,
        ).join(', ')}.`,
      },
      module_slug: {
        type: ['string', 'null'],
        description: 'Slug úr módúlalistanum sem atriðið á heima í, eða null ef ekkert módul passar.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '2 til 6 stutt tögg á íslensku, í lágstöfum.',
      },
      questions: {
        type: 'array',
        description: 'Spurningar sem þarf svar við. Hönnun fer til Á, ákvarðanir til H. Tómt fylki ef engin.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            to: { type: 'string', enum: ['Á', 'H'], description: 'Stutt nafn þess sem á að svara.' },
            body: { type: 'string', description: 'Spurningin sjálf, á íslensku.' },
          },
          required: ['to', 'body'],
        },
      },
    },
    required: ['summary', 'body', 'module_slug', 'tags', 'questions'],
  },
}

function clean(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[–—]/g, ',').trim()
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of value) {
    const tag = clean(raw)
    const key = tag.toLowerCase()
    if (tag === '' || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags.slice(0, MAX_TAGS)
}

function cleanQuestions(value: unknown): Array<{ to: QuestionTo; body: string }> {
  if (!Array.isArray(value)) return []
  const out: Array<{ to: QuestionTo; body: string }> = []
  for (const q of value) {
    if (q === null || typeof q !== 'object') continue
    const rec = q as Record<string, unknown>
    const to = typeof rec.to === 'string' ? rec.to.normalize('NFC').trim() : ''
    const body = clean(rec.body)
    if ((to === 'Á' || to === 'H') && body !== '') out.push({ to, body })
  }
  return out
}

// The tool input is model output, so every field is checked rather than
// trusted. A null slug or one that matches no module leaves module_id null,
// sets unmatchedModule and tags the item óflokkað.
export function applyAnalysis(result: unknown, modules: Array<{ id: string; slug: string }>): Analysis {
  const r = result !== null && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const slug = typeof r.module_slug === 'string' ? r.module_slug.trim().toLowerCase() : ''
  const match = slug === '' ? undefined : modules.find((m) => m.slug.toLowerCase() === slug)
  const unmatchedModule = match === undefined

  const tags = cleanTags(r.tags)
  if (unmatchedModule && !tags.some((t) => t.toLowerCase() === UNMATCHED_TAG)) tags.push(UNMATCHED_TAG)

  return {
    summary: clean(r.summary),
    body: clean(r.body),
    module_id: match ? match.id : null,
    tags,
    questions: cleanQuestions(r.questions),
    unmatchedModule,
  }
}
