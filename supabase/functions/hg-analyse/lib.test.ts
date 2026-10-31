import { describe, expect, it } from 'vitest'
import {
  ANALYSIS_TOOL_NAME,
  ORIGINAL_HEADING,
  BODY_HEADINGS,
  CLIP_MARKER,
  SYSTEM_PROMPT,
  analysisTool,
  applyAnalysis,
  buildUserMessage,
  clipText,
  isItemFilePath,
  mergeIntoItem,
  selectTextFiles,
} from './lib'

const KB = 1000
const DASH = /[–—]/

const bytes = (s: string): number => new TextEncoder().encode(s).length

describe('selectTextFiles', () => {
  it('sends html and md under the limit and keeps any extra fields on the rows', () => {
    const files = [
      { name: 'frumgerd.html', size: 1_900_000, mime: 'text/html', path: 'a/frumgerd.html' },
      { name: 'lysing.md', size: 30 * KB, mime: 'text/markdown', path: 'a/lysing.md' },
    ]
    const r = selectTextFiles(files)
    expect(r.send.map((f) => f.name)).toEqual(['frumgerd.html', 'lysing.md'])
    expect(r.listOnly).toEqual([])
    expect(r.send[0].path).toBe('a/frumgerd.html')
  })

  it('never sends video, zip or images, only lists them', () => {
    const files = [
      { name: 'synidaemi.mp4', size: 5000, mime: 'video/mp4' },
      { name: 'pakki.zip', size: 5000, mime: 'application/zip' },
      { name: 'mynd.PNG', size: 5000, mime: 'image/png' },
      { name: 'skyring.txt', size: 5000, mime: 'text/plain' },
    ]
    const r = selectTextFiles(files)
    expect(r.send.map((f) => f.name)).toEqual(['skyring.txt'])
    expect(r.listOnly.map((f) => f.name)).toEqual(['synidaemi.mp4', 'pakki.zip', 'mynd.PNG'])
  })

  it('a binary extension wins over a text mime', () => {
    const r = selectTextFiles([{ name: 'myndband.mov', size: 10, mime: 'text/plain' }])
    expect(r.send).toEqual([])
  })

  it('recognises md by extension when the mime is empty, null or octet stream', () => {
    const files = [
      { name: 'A.MD', size: 10, mime: '' },
      { name: 'b.md', size: 10, mime: null },
      { name: 'c.Md', size: 10, mime: 'application/octet-stream' },
      { name: 'd.HTM', size: 10, mime: null },
    ]
    expect(selectTextFiles(files).send).toHaveLength(4)
  })

  it('recognises text by mime when the name has no extension', () => {
    const files = [
      { name: 'minnispunktar', size: 10, mime: 'text/plain; charset=utf-8' },
      { name: 'eitthvad', size: 10, mime: 'application/octet-stream' },
    ]
    const r = selectTextFiles(files)
    expect(r.send.map((f) => f.name)).toEqual(['minnispunktar'])
    expect(r.listOnly.map((f) => f.name)).toEqual(['eitthvad'])
  })

  it('lists a text file over maxPerFile instead of sending it', () => {
    const r = selectTextFiles([
      { name: 'risastort.html', size: 2_000_001, mime: 'text/html' },
      { name: 'akkurat.html', size: 2_000_000, mime: 'text/html' },
    ])
    expect(r.send.map((f) => f.name)).toEqual(['akkurat.html'])
    expect(r.listOnly.map((f) => f.name)).toEqual(['risastort.html'])
  })

  it('honours a custom maxPerFile', () => {
    const r = selectTextFiles([{ name: 'a.md', size: 101, mime: null }], 100)
    expect(r.listOnly).toHaveLength(1)
  })
})

describe('clipText', () => {
  it('leaves text under the limit alone', () => {
    const t = 'a'.repeat(400_000)
    expect(clipText(t)).toBe(t)
  })

  it('clips over the limit and adds the marker', () => {
    const out = clipText('a'.repeat(400_001))
    expect(out.endsWith(CLIP_MARKER)).toBe(true)
    expect(CLIP_MARKER).toBe('\n\n[klippt, skráin er lengri]')
    expect(bytes(out.slice(0, -CLIP_MARKER.length))).toBe(400_000)
  })

  it('measures UTF-8 bytes, not characters', () => {
    // 6 characters, 12 bytes
    expect(clipText('þþþþþþ', 10)).toBe('þþþþþ' + CLIP_MARKER)
  })

  it('never cuts inside a multi byte character', () => {
    // 'ð' is 2 bytes, so a cut at 2 bytes would split it
    expect(clipText('aðb', 2)).toBe('a' + CLIP_MARKER)
    // a 4 byte character (surrogate pair in JS)
    expect(clipText('ab\u{1F600}', 4)).toBe('ab' + CLIP_MARKER)
    const out = clipText('á'.repeat(300_000), 400_001)
    const kept = out.slice(0, -CLIP_MARKER.length)
    expect(kept).toBe('á'.repeat(200_000))
    expect(kept.includes('�')).toBe(false)
  })

  it('review focus 3: a 1.9 MB html is clipped at 400 KB, a 30 KB md is not', () => {
    const html = '<p>Árni</p>'.repeat(Math.ceil(1_900_000 / bytes('<p>Árni</p>')))
    const md = '# Lýsing\n'.repeat(Math.ceil(30_000 / bytes('# Lýsing\n')))
    const { send } = selectTextFiles([
      { name: 'frumgerd.html', size: bytes(html), mime: 'text/html' },
      { name: 'lysing.md', size: bytes(md), mime: 'text/markdown' },
    ])
    expect(send).toHaveLength(2)
    const clippedHtml = clipText(html)
    const keptHtml = clippedHtml.slice(0, -CLIP_MARKER.length)
    expect(clippedHtml.endsWith(CLIP_MARKER)).toBe(true)
    expect(bytes(keptHtml)).toBeLessThanOrEqual(400_000)
    expect(bytes(keptHtml)).toBeGreaterThan(399_990)
    expect(clipText(md)).toBe(md)
  })
})

describe('buildUserMessage', () => {
  const input = {
    item: { title: 'Bókunarflæði', body: 'Árni vill einfalda bókun.' },
    files: [
      { name: 'flaedi.md', size: 3 * 1024, text: '# Flæði\nSkref eitt.' },
      { name: 'synidaemi.mp4', size: 5 * 1024 * 1024 },
    ],
    bundle: 'Metta er bókunarkerfi fyrir tjaldsvæði.',
    modules: [
      { slug: 'bokun', name: 'Bókun', status_line: 'Í smíð' },
      { slug: 'greidslur', name: 'Greiðslur', status_line: null },
    ],
    participants: [
      { short: 'H', name: 'Heimir' },
      { short: 'Á', name: 'Árni' },
    ],
  }

  it('contains the item, the module list, participants and the bundle', () => {
    const msg = buildUserMessage(input)
    for (const s of [
      'Bókunarflæði',
      'Árni vill einfalda bókun.',
      'bokun',
      'Bókun',
      'Í smíð',
      'greidslur',
      'Greiðslur',
      'Heimir',
      'Metta er bókunarkerfi fyrir tjaldsvæði.',
    ]) {
      expect(msg).toContain(s)
    }
  })

  it('puts the sections in order: item, files, modules, participants, bundle', () => {
    const msg = buildUserMessage(input)
    const order = [
      msg.indexOf('Bókunarflæði'),
      msg.indexOf('flaedi.md'),
      msg.indexOf('greidslur'),
      msg.indexOf('Heimir'),
      msg.indexOf('Metta er bókunarkerfi'),
    ]
    expect(order.every((n) => n >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('sends the text of a sent file and only the name and size of a listed file', () => {
    const msg = buildUserMessage(input)
    expect(msg).toContain('# Flæði\nSkref eitt.')
    expect(msg).toContain('synidaemi.mp4')
    expect(msg).toContain('3 KB')
    expect(msg).toContain('5120 KB')
    expect(msg.match(/synidaemi\.mp4/g)).toHaveLength(1)
  })

  it('uses a fence longer than any backtick run inside a file', () => {
    const msg = buildUserMessage({
      ...input,
      files: [{ name: 'kodi.md', size: 100, text: '```ts\nconst a = 1\n```' }],
    })
    expect(msg).toContain('````\n```ts\nconst a = 1\n```\n````')
  })

  it('says so when there is no body, no files and no bundle', () => {
    const msg = buildUserMessage({ ...input, item: { title: 'T', body: null }, files: [], bundle: null })
    expect(msg).toContain('(enginn texti)')
    expect(msg).toContain('Engar skrár fylgja.')
    expect(msg).toContain('Ekkert samhengi er skráð fyrir verkefnið.')
  })
})

describe('analysisTool and SYSTEM_PROMPT', () => {
  it('is a strict tool named skrifa_greiningu with every field required', () => {
    expect(ANALYSIS_TOOL_NAME).toBe('skrifa_greiningu')
    expect(analysisTool.name).toBe(ANALYSIS_TOOL_NAME)
    expect(analysisTool.strict).toBe(true)
    const s = analysisTool.input_schema
    expect(s.type).toBe('object')
    expect(s.additionalProperties).toBe(false)
    expect(s.required).toEqual(['summary', 'body', 'module_slug', 'tags', 'questions'])
    expect(Object.keys(s.properties).sort()).toEqual([...s.required].sort())
    expect(s.properties.module_slug.type).toEqual(['string', 'null'])
    const q = s.properties.questions.items
    expect(q.additionalProperties).toBe(false)
    expect(q.required).toEqual(['to', 'body'])
    expect(q.properties.to.enum).toEqual(['Á', 'H'])
    expect('minItems' in s.properties.tags).toBe(false)
    expect('maxItems' in s.properties.tags).toBe(false)
    expect(s.properties.tags.description).toContain('2 til 6')
  })

  it('names the five body headings in the prompt and the tool', () => {
    expect(BODY_HEADINGS).toEqual([
      'Hvað þetta er',
      'Hvaða módul og af hverju',
      'Stærð og áhætta',
      'Hvað þarf að spyrja um',
      'Byggjanlegt núna, samhliða eða seinna',
    ])
    for (const h of BODY_HEADINGS) {
      expect(SYSTEM_PROMPT).toContain(`## ${h}`)
      expect(analysisTool.input_schema.properties.body.description).toContain(h)
    }
  })

  it('tells the model to call the tool exactly once and write nothing else', () => {
    expect(SYSTEM_PROMPT).toContain('skrifa_greiningu')
    expect(SYSTEM_PROMPT).toContain('nákvæmlega einu sinni')
  })

  it('contains no em or en dashes', () => {
    expect(SYSTEM_PROMPT).not.toMatch(DASH)
    expect(JSON.stringify(analysisTool)).not.toMatch(DASH)
  })
})

describe('applyAnalysis', () => {
  const modules = [
    { id: 'm1', slug: 'bokun' },
    { id: 'm2', slug: 'greidslur' },
  ]
  const base = {
    summary: 'Stutt samantekt.',
    body: '## Hvað þetta er\nTexti.',
    module_slug: 'greidslur',
    tags: ['greiðslur', 'hönnun'],
    questions: [{ to: 'Á', body: 'Hvaða litur?' }],
  }

  it('maps a matching slug to the module id', () => {
    expect(applyAnalysis(base, modules)).toEqual({
      summary: 'Stutt samantekt.',
      body: '## Hvað þetta er\nTexti.',
      module_id: 'm2',
      tags: ['greiðslur', 'hönnun'],
      questions: [{ to: 'Á', body: 'Hvaða litur?' }],
      unmatchedModule: false,
    })
  })

  it('matches the slug after trimming and ignoring case', () => {
    expect(applyAnalysis({ ...base, module_slug: ' Bokun ' }, modules).module_id).toBe('m1')
  })

  it('review focus 4: a slug that matches no module leaves module_id null and tags óflokkað', () => {
    const r = applyAnalysis({ ...base, module_slug: 'veit-ekki' }, modules)
    expect(r.module_id).toBeNull()
    expect(r.unmatchedModule).toBe(true)
    expect(r.tags).toEqual(['greiðslur', 'hönnun', 'óflokkað'])
  })

  it('a null slug is treated the same as no match', () => {
    const r = applyAnalysis({ ...base, module_slug: null }, modules)
    expect(r.module_id).toBeNull()
    expect(r.unmatchedModule).toBe(true)
    expect(r.tags).toEqual(['greiðslur', 'hönnun', 'óflokkað'])
  })

  it('does not add óflokkað twice', () => {
    const r = applyAnalysis({ ...base, module_slug: null, tags: ['Óflokkað', 'hönnun'] }, modules)
    expect(r.tags).toEqual(['Óflokkað', 'hönnun'])
  })

  it('trims, drops empty and dedupes tags', () => {
    const r = applyAnalysis({ ...base, tags: [' hönnun ', '', '   ', 'hönnun', 'Hönnun', 'bókun'] }, modules)
    expect(r.tags).toEqual(['hönnun', 'bókun'])
  })

  it('R22: the cap of 6 counts model tags only, óflokkað may be a seventh', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    expect(applyAnalysis({ ...base, tags }, modules).tags).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    const r = applyAnalysis({ ...base, tags, module_slug: null }, modules)
    expect(r.tags).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'óflokkað'])
  })

  it('applies the cap after dedupe', () => {
    const tags = ['a', 'a', 'b', ' ', 'c', 'd', 'e', 'f', 'g']
    expect(applyAnalysis({ ...base, tags }, modules).tags).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('strips em and en dashes from summary, body, tags and questions', () => {
    const r = applyAnalysis(
      {
        summary: 'Fyrst — svo',
        body: 'A–B',
        module_slug: 'bokun',
        tags: ['x—y', 'z'],
        questions: [{ to: 'H', body: 'Já — eða nei?' }],
      },
      modules,
    )
    expect(JSON.stringify(r)).not.toMatch(DASH)
    expect(r.summary).toBe('Fyrst, svo')
    expect(r.body).toBe('A,B')
    expect(r.questions[0].body).toBe('Já, eða nei?')
  })

  it('keeps the newline in front of a dash bullet on its own line', () => {
    const r = applyAnalysis({ ...base, body: 'Fyrsta lína\n— liður', summary: 'A \t— B' }, modules)
    expect(r.body).toBe('Fyrsta lína\n, liður')
    expect(r.summary).toBe('A, B')
  })

  it('turns a dash in a tag into a space, never a comma, because the CLI splits tags on commas', () => {
    const r = applyAnalysis({ ...base, tags: ['x—y', 'a – b', 'z'] }, modules)
    expect(r.tags).toEqual(['x y', 'a b', 'z'])
    expect(r.tags.join('')).not.toContain(',')
  })

  it('drops questions to anyone but Á or H and questions with an empty body', () => {
    const r = applyAnalysis(
      {
        ...base,
        questions: [
          { to: 'C', body: 'Til Claude?' },
          { to: 'H', body: '   ' },
          { to: ' H ', body: ' Á að byggja þetta núna? ' },
          { to: 'Á', body: 'Samsett Á' },
        ],
      },
      modules,
    )
    expect(r.questions).toEqual([
      { to: 'H', body: 'Á að byggja þetta núna?' },
      { to: 'Á', body: 'Samsett Á' },
    ])
  })

  it('survives a malformed tool input', () => {
    const r = applyAnalysis({ summary: 3, tags: 'x', questions: [null, { to: 'H' }] }, modules)
    expect(r).toEqual({
      summary: '',
      body: '',
      module_id: null,
      tags: ['óflokkað'],
      questions: [],
      unmatchedModule: true,
    })
  })
})

describe('mergeIntoItem', () => {
  const modules = [
    { id: 'm1', slug: 'bokun' },
    { id: 'm2', slug: 'greidslur' },
  ]
  const raw = {
    summary: 'Samantekt.',
    body: '## Hvað þetta er\nGreining.',
    module_slug: 'greidslur',
    tags: ['greiðslur', 'hönnun'],
    questions: [],
  }
  const matched = applyAnalysis(raw, modules)
  const unmatched = applyAnalysis({ ...raw, module_slug: null }, modules)
  const item = { body: null, module_id: null, tags: [] as string[] }

  it('keeps the author body verbatim under its own heading after the analysis', () => {
    const r = mergeIntoItem({ ...item, body: '  Árni skrifaði þetta.\n\n- liður' }, matched)
    expect(ORIGINAL_HEADING).toBe('## Upprunalegur texti')
    expect(r.body).toBe(
      '## Hvað þetta er\nGreining.\n\n## Upprunalegur texti\n\n  Árni skrifaði þetta.\n\n- liður',
    )
    expect(r.summary).toBe('Samantekt.')
  })

  it('adds no heading when the author body is empty, whitespace or null', () => {
    for (const body of [null, '', '  \n\t ']) {
      expect(mergeIntoItem({ ...item, body }, matched).body).toBe('## Hvað þetta er\nGreining.')
    }
  })

  it('takes the suggested module when the author chose none', () => {
    expect(mergeIntoItem(item, matched).module_id).toBe('m2')
    expect(mergeIntoItem(item, unmatched).module_id).toBeNull()
  })

  it('the author module wins over a matched suggestion', () => {
    expect(mergeIntoItem({ ...item, module_id: 'm1' }, matched).module_id).toBe('m1')
  })

  it('an author module plus an unmatched suggestion keeps the module and drops óflokkað', () => {
    const r = mergeIntoItem({ ...item, module_id: 'm1' }, unmatched)
    expect(r.module_id).toBe('m1')
    expect(r.tags).toEqual(['greiðslur', 'hönnun'])
  })

  it('keeps óflokkað when neither the author nor the analysis has a module', () => {
    expect(mergeIntoItem(item, unmatched).tags).toEqual(['greiðslur', 'hönnun', 'óflokkað'])
  })

  it('puts author tags first and dedupes ignoring case', () => {
    const r = mergeIntoItem({ ...item, tags: ['Hönnun', 'brýnt'] }, matched)
    expect(r.tags).toEqual(['Hönnun', 'brýnt', 'greiðslur'])
  })
})

describe('isItemFilePath', () => {
  const project = '6ea33ea7-0072-4e4b-a625-156ebf487399'
  const item = '9f8e7d6c-5b4a-4321-8fed-cba987654321'
  const otherProject = '0b1c2d3e-4f50-4617-8899-aabbccddeeff'
  const otherItem = '11111111-2222-4333-8444-555555555555'
  const name = '3c9a1f2e-7b6d-4e5f-9a0b-1c2d3e4f5a6b_Lysing_v2.md'
  const path = (n: string, p = project, i = item) => `${p}/${i}/${n}`

  it('passes the shape both writers build', () => {
    expect(isItemFilePath(path(name), project, item)).toBe(true)
  })

  it('passes upper case uuids in the path', () => {
    expect(isItemFilePath(path(name, project.toUpperCase(), item.toUpperCase()), project, item)).toBe(true)
  })

  it('R26: fails another project', () => {
    expect(isItemFilePath(path(name, otherProject), project, item)).toBe(false)
  })

  it('fails another item in the same project', () => {
    expect(isItemFilePath(path(name, project, otherItem), project, item)).toBe(false)
  })

  it('R27: fails percent encoded traversal in any segment', () => {
    expect(isItemFilePath(path('%2e%2e'), project, item)).toBe(false)
    expect(isItemFilePath(path('a%2e%2e%2fb.md'), project, item)).toBe(false)
    expect(isItemFilePath(`%2e%2e/${item}/${name}`, project, item)).toBe(false)
    expect(isItemFilePath(`${project}/%2e%2e/${name}`, project, item)).toBe(false)
  })

  it('fails . and .. as the name', () => {
    expect(isItemFilePath(path('..'), project, item)).toBe(false)
    expect(isItemFilePath(path('.'), project, item)).toBe(false)
  })

  it('fails ?, #, backslash and space in the name', () => {
    expect(isItemFilePath(path('a.md?x=1'), project, item)).toBe(false)
    expect(isItemFilePath(path('a.md#x'), project, item)).toBe(false)
    expect(isItemFilePath(path('a\\..\\b.md'), project, item)).toBe(false)
    expect(isItemFilePath(path('a b.md'), project, item)).toBe(false)
  })

  it('fails 2 and 4 segments, and empty segments', () => {
    expect(isItemFilePath(`${project}/${name}`, project, item)).toBe(false)
    expect(isItemFilePath(`${project}/${item}/x/${name}`, project, item)).toBe(false)
    expect(isItemFilePath(`${project}/${item}/`, project, item)).toBe(false)
    expect(isItemFilePath(`/${project}/${item}`, project, item)).toBe(false)
  })

  it('fails when the project id is only a prefix of a longer first segment', () => {
    expect(isItemFilePath(`${project}x/${item}/${name}`, project, item)).toBe(false)
  })

  it('fails an empty project or item id', () => {
    expect(isItemFilePath(`/${item}/${name}`, '', item)).toBe(false)
    expect(isItemFilePath(`${project}//${name}`, project, '')).toBe(false)
  })
})

