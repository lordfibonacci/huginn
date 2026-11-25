# Fastaust í Huginn (Huginn side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `huginn` CLI can put a card in a named box and set a title, summary and source on it, the home page reopens the project the browser was last in, and the project `fastaust` exists with its boxes and tags.

**Architecture:** Boxes (`hg_zones`) join the CLI's board data. Two pure functions in `cli/lib/write.mjs` find a box by name and the first free slot in it; `item create` and `item set` call them. The home page reads one `localStorage` key through a pure rule. The project itself is data, inserted once through the Supabase MCP. Nothing on the board, the card or the panel changes.

**Tech Stack:** Node ESM (`cli/`), vitest, React 19 and TypeScript for the one web change, Supabase MCP for the data.

**Spec:** `docs/superpowers/specs/2026-11-25-fastaust-i-huginn-design.md` (Icelandic, approved by Heimir 2026-11-25), sections 5, 6 and 7. Read it before starting. The fastaust half of the spec (section 8 onward) is a second plan in the fastaust repo, `d:\Claude Code\fastaust\docs\superpowers\plans\2026-11-25-huginn-spegill.md`, built after this one is merged and pushed.

## Global Constraints

- Full profile, not the small task profile: 9 code files and two verification sets. Every task gets its review, the whole branch gets the Fable final review, fix rounds are reviewed.
- Build in a worktree, never switch the branch of the main checkout: `.superpowers/wt/feat-fastaust-cli`, branch `feat/fastaust-cli`, `node_modules` as a junction (`cmd //c "mklink /J node_modules ..\\..\\..\\node_modules"`), `.env` hard linked (`ln ../../../.env .env`).
- No migration and no file under `supabase/`. No change to `vinnubord.css`, to any component under `src/vinnubord/components/`, or to `src/vinnubord/lib/api.ts`.
- Supabase project `czdjxtsjgughimlazdmu`. Confirm that ref before every MCP call. Touch only `hg_` tables. No DELETE and no DROP through the MCP, ever.
- Nothing in this plan writes to the project `metta`. Every live CLI command in the plan carries `--project fastaust`, except the two read only `pull` commands that name `metta`.
- `--zone` reads and writes the main board only: `hg_zones.pos_x|pos_y|w|h` and `hg_items.pos_x|pos_y`. Never `hg_view_positions` or `hg_view_zone_positions`.
- Icelandic error and README copy is given verbatim in the tasks. Do not reword it.
- No em dashes and no hyphen dashes as punctuation, in code comments, copy and docs.
- Commit prefixes `feat:`, `test:`, `docs:` with scope `(vinnubord)`, trailer `Co-Authored-By: Claude <noreply@anthropic.com>` naming the model that wrote the commit.
- Implementer budget: at about 60 tool calls or 150k context, commit what is green, report DONE_WITH_CONCERNS with what is left. Read code in large ranges with Read.
- Suggested implementer models: tasks 1, 3 and 4 Sonnet (the code is in the plan), task 2 the controller itself (MCP calls are declined in subagents) with the browser check on Opus, task 5 Sonnet. Reviewers never below Sonnet.
- Each task names its verification set. The implementer checks nothing else. Reviewers judge the whole diff.

## Size table

| Task | Files | Size |
|---|---|---|
| 1. Boxes in the board data and the placement rules | `cli/lib/client.mjs`, `cli/lib/write.mjs`, `cli/lib/write.test.mjs` | M |
| 2. The project `fastaust` (data) and a board without packs in the browser | none | S |
| 3. `item create` and `item set` take the new flags | `cli/lib/commands.mjs`, `cli/lib/ops.mjs`, `cli/README.md` | M |
| 4. The home page reopens the last project | `src/vinnubord/lib/lastProject.ts` (new), `src/vinnubord/lib/lastProject.test.ts` (new), `src/vinnubord/pages/HomePage.tsx`, `src/vinnubord/pages/BoardPage.tsx` | S |
| 5. Docs | `CLAUDE.md`, `docs/progress/19-fastaust-i-huginn.md` (new) | S |

No task is L.

## Review Focus

1. A box narrower than a card (the minimum is 160 px, a card is 250 px): one column, the card sticks out, no endless loop and no crash. Test in task 1.
2. A card moved into a box must not count itself as an obstacle, or it never gets the slot it already holds. Test in task 1.
3. `item set --zone` on a card that already lies in that box must move nothing, so a first fill that is run twice does not shuffle the board. Test in task 1 (`itemInZone`), live check in task 3.
4. In metta, a card created for a module that sits inside a box must still land beside its module, not below the box. Test in task 1.
5. `hg.lastProject` naming a project the viewer has left, or `localStorage` throwing: the home page falls back to the first project. Test in task 4.

---

### Task 1: Boxes in the board data and the placement rules

**Files:**
- Modify: `cli/lib/client.mjs` (`loadBoard`, lines 112 to 156)
- Modify: `cli/lib/write.mjs` (`placeItem`, and a new section after it)
- Test: `cli/lib/write.test.mjs`

**Interfaces:**
- Produces, all exported from `cli/lib/write.mjs`:
  - `ZONE_PAD = 24`, `ZONE_TOP = 40`
  - `resolveZone(zones: Zone[], name: string): Zone` (throws an Icelandic `Error`)
  - `placeInZone(zone: Zone, size: {w, h}, cards: Rect[]): { pos: {x, y}, h: number }` where `h` is the height the box needs, never less than `zone.h`
  - `placeItemInZone(board, zone, card, now = Date.now()): { pos, h }`
  - `itemInZone(board, zone, item): boolean`
- `loadBoard` returns `zones: Zone[]` (rows of `hg_zones`: `id`, `title`, `color`, `note`, `pos_x`, `pos_y`, `w`, `h`), so `pull --json` prints them.

**Verification set:** `npx vitest run cli/lib/write.test.mjs cli/lib/parity.test.mjs` and `node cli/huginn.mjs pull --json --project metta`. Nothing else.

- [ ] **Step 1: Write the failing tests.** Add `itemInZone, placeInZone, placeItemInZone, resolveZone` to the import list at the top of `cli/lib/write.test.mjs` and append these blocks at the end of the file. They use the file's own `card`, `board`, `boardRects` and `S` helpers.

```js
describe('resolveZone', () => {
  const zones = [
    { id: 'z1', title: 'Óraðað' },
    { id: 'z2', title: 'Tilboð' },
  ]

  it('finds a box by name in any case and with stray spaces', () => {
    expect(resolveZone(zones, ' óraðað ').id).toBe('z1')
    expect(resolveZone(zones, 'TILBOÐ').id).toBe('z2')
  })

  it('names the known boxes when none matches', () => {
    expect(() => resolveZone(zones, 'Afsal')).toThrow('Kassinn Afsal fannst ekki. Kassar: Óraðað, Tilboð.')
    expect(() => resolveZone([], 'Afsal')).toThrow('Kassinn Afsal fannst ekki. Engir kassar eru á borðinu.')
  })

  it('refuses a name two boxes share and a blank name', () => {
    expect(() => resolveZone([...zones, { id: 'z3', title: 'tilboð' }], 'Tilboð')).toThrow(
      'Fleiri en einn kassi heitir Tilboð. Endurnefndu annan þeirra.',
    )
    expect(() => resolveZone(zones, '  ')).toThrow('--zone vantar gildi.')
  })
})

describe('placeInZone', () => {
  const zone = { id: 'z', pos_x: 1000, pos_y: 500, w: 600, h: 1300 }
  const size = { w: 250, h: 120 }
  const at = (x, y) => ({ x, y, w: 250, h: 120 })

  it('starts under the box name, inside the left edge', () => {
    expect(placeInZone(zone, size, [])).toEqual({ pos: { x: 1024, y: 540 }, h: 1300 })
  })

  it('takes the second column when the first slot holds a card', () => {
    expect(placeInZone(zone, size, [at(1024, 540)]).pos).toEqual({ x: 1314, y: 540 })
  })

  it('goes below a full row and keeps the 40 px gap', () => {
    expect(placeInZone(zone, size, [at(1024, 540), at(1314, 540)]).pos).toEqual({ x: 1024, y: 700 })
  })

  it('steps around a card dropped anywhere in the box', () => {
    // The card straddles both columns, so the first free slot is below it.
    expect(placeInZone(zone, size, [at(1100, 560)]).pos).toEqual({ x: 1024, y: 720 })
  })

  it('grows the box when no slot is left inside it', () => {
    const r = placeInZone({ ...zone, h: 200 }, size, [at(1024, 540), at(1314, 540)])
    expect(r.pos).toEqual({ x: 1024, y: 700 })
    expect(r.h).toBe(344)
  })

  it('uses one column in a box narrower than a card and never shrinks the box', () => {
    const r = placeInZone({ ...zone, w: 160 }, size, [at(1024, 540)])
    expect(r.pos).toEqual({ x: 1024, y: 700 })
    expect(r.h).toBe(1300)
  })
})

describe('placeItemInZone and itemInZone', () => {
  const zone = { id: 'z', pos_x: 0, pos_y: 0, w: 600, h: 1300 }
  const old = '2026-01-01T00:00:00Z'
  const now = Date.parse('2026-11-25T12:00:00Z')

  it('a moved card is not its own obstacle', () => {
    const a = card('a', 24, 40, { updated_at: old })
    expect(placeItemInZone({ items: [a] }, zone, a, now).pos).toEqual({ x: 24, y: 40 })
  })

  it('other cards are obstacles, a card closed long ago is not', () => {
    const a = card('a', 24, 40, { updated_at: old })
    const gone = card('g', 314, 40, { status: 'done', closed_at: old, updated_at: old })
    expect(placeItemInZone({ items: [a, gone] }, zone, { title: 'Ný', tags: [] }, now).pos).toEqual({ x: 314, y: 40 })
  })

  it('a card lies in a box when its centre does', () => {
    expect(itemInZone({}, zone, card('a', 24, 40, { updated_at: old }))).toBe(true)
    expect(itemInZone({}, zone, card('b', 590, 40, { updated_at: old }))).toBe(false)
    expect(itemInZone({}, zone, card('c', 24, 1290, { updated_at: old }))).toBe(false)
  })
})

describe('placeItem and boxes', () => {
  it('without a module, a new card never lands inside a box', () => {
    const zone = { id: 'z', pos_x: 0, pos_y: 0, w: 600, h: 1300 }
    const b = { packages: [], modules: [], items: [], zones: [zone] }
    const pos = placeItem(b, null, { title: 'Nýtt', tags: [] })
    const rect = { ...pos, w: S.cardW, h: estimateCardHeight({ title: 'Nýtt', tags: [], updated_at: new Date().toISOString() }) }
    expect(overlaps(rect, { x: 0, y: 0, w: 600, h: 1300 })).toBe(false)
  })

  it('a card for a module inside a box still lands beside its module', () => {
    const plain = board()
    const m2 = boardRects(plain).modules.get('m2')
    const around = { id: 'z', pos_x: m2.x - 2000, pos_y: m2.y - 2000, w: 6000, h: 6000 }
    expect(placeItem({ ...plain, zones: [around] }, 'm2')).toEqual(placeItem(plain, 'm2'))
  })
})
```

- [ ] **Step 2: Run the tests and see them fail.**

Run: `npx vitest run cli/lib/write.test.mjs`
Expected: FAIL, `resolveZone is not a function` (the import is undefined).

- [ ] **Step 3: `loadBoard` reads the boxes.** In `cli/lib/client.mjs`, add one query after `byProject('hg_tags').order('name'),`:

```js
    byProject('hg_zones').order('created_at'),
```

add `zones` as the last name in the destructuring of `results`, and add `zones: zones.data ?? [],` as the last key of the returned object.

- [ ] **Step 4: The box rules.** In `cli/lib/write.mjs`, add this section directly after `placeItem`:

```js
// ---------- boxes (kassar) ----------

// Room between a box's edge and the cards the CLI places in it. The top is
// larger: the box name sits on the top border.
export const ZONE_PAD = 24
export const ZONE_TOP = 40
// Rows are tried every ZONE_SCAN px, far enough down that a slot always turns up.
const ZONE_SCAN = 20
const ZONE_SCAN_MAX = 2000

const foldZoneName = (s) => String(s).trim().toLocaleLowerCase('is')

// The one box with this name, in any case.
export function resolveZone(zones, name) {
  const want = foldZoneName(name)
  if (!want) throw new Error('--zone vantar gildi.')
  const hits = (zones ?? []).filter((z) => foldZoneName(z.title) === want)
  if (hits.length === 1) return hits[0]
  const shown = String(name).trim()
  if (hits.length > 1) throw new Error(`Fleiri en einn kassi heitir ${shown}. Endurnefndu annan þeirra.`)
  const known = (zones ?? []).map((z) => z.title).join(', ')
  throw new Error(`Kassinn ${shown} fannst ekki. ${known ? `Kassar: ${known}.` : 'Engir kassar eru á borðinu.'}`)
}

// The first free slot for a card in a box: columns left to right, rows top
// to bottom, NEW_CARD_GAP clear of every card. h is the height the box needs
// to hold the card, never less than it has.
export function placeInZone(zone, size, cards) {
  const stepX = S.cardW + NEW_CARD_GAP
  const cols = Math.max(1, Math.floor((zone.w - 2 * ZONE_PAD + NEW_CARD_GAP) / stepX))
  const grown = cards.map((c) => ({
    x: c.x - NEW_CARD_GAP,
    y: c.y - NEW_CARD_GAP,
    w: c.w + 2 * NEW_CARD_GAP,
    h: c.h + 2 * NEW_CARD_GAP,
  }))
  const x0 = zone.pos_x + ZONE_PAD
  const y0 = zone.pos_y + ZONE_TOP
  let pos = { x: x0, y: y0 }
  scan: for (let row = 0; row < ZONE_SCAN_MAX; row++) {
    for (let col = 0; col < cols; col++) {
      const p = { x: x0 + col * stepX, y: y0 + row * ZONE_SCAN }
      if (!grown.some((o) => overlaps({ ...p, ...size }, o))) {
        pos = p
        break scan
      }
    }
  }
  return { pos, h: Math.max(zone.h, pos.y + size.h + ZONE_PAD - zone.pos_y) }
}

function cardRect(item, board) {
  return { x: item.pos_x, y: item.pos_y, w: S.cardW, h: estimateCardHeight(item, board) }
}

// Where a card lands in a box. A card that has an id is being moved and is
// not its own obstacle; a new one gets the stamp row, as in placeItem.
export function placeItemInZone(board, zone, card, now = Date.now()) {
  const cards = (board.items ?? []).filter((i) => i.id !== card.id && isOnBoard(i, now)).map((i) => cardRect(i, board))
  const sized = card.id ? card : { ...card, updated_at: card.updated_at ?? new Date().toISOString() }
  return placeInZone(zone, { w: S.cardW, h: estimateCardHeight(sized, board) }, cards)
}

// The web's rule for what lies in a box: the centre of the card, border included.
export function itemInZone(board, zone, item) {
  const r = cardRect(item, board)
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  return zone.pos_x <= cx && cx <= zone.pos_x + zone.w && zone.pos_y <= cy && cy <= zone.pos_y + zone.h
}
```

- [ ] **Step 5: Boxes are obstacles for a card without a module.** In `placeItem` in `cli/lib/write.mjs`, move the `anchor` line above the obstacles and build the obstacles like this (the rest of the function stays as it is):

```js
  const anchor = (moduleId && modules.get(moduleId)) || null
  // A card with no module to sit beside keeps out of the boxes. One with a
  // module does not: a box may be drawn around its pack.
  const zones = anchor ? [] : (board.zones ?? []).map((z) => ({ x: z.pos_x, y: z.pos_y, w: z.w, h: z.h }))
  const obstacles = [...packs, ...cards, ...zones]
```

Update the comment above `placeItem`: "Obstacles are pack columns, open cards and, for a card with no module to sit beside, boxes."

- [ ] **Step 6: Run the tests.**

Run: `npx vitest run cli/lib/write.test.mjs cli/lib/parity.test.mjs`
Expected: PASS, every test in both files.

- [ ] **Step 7: Read only live check.**

Run: `node cli/huginn.mjs pull --json --project metta | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s);console.log(Array.isArray(b.zones), b.items.length>0)})"`
Expected: `true true`

- [ ] **Step 8: Commit.**

```bash
git add cli/lib/client.mjs cli/lib/write.mjs cli/lib/write.test.mjs
git commit -m "feat(vinnubord): the cli knows boxes and finds a free slot in one"
```

---

### Task 2: The project `fastaust` and a board without packs

**Files:** none. Data only, through the Supabase MCP (`mcp__claude_ai_Supabase__execute_sql`, project `czdjxtsjgughimlazdmu`). The controller runs this task itself; if the MCP declines, stop and hand Heimir the statements to run in the SQL editor.

**Interfaces:**
- Produces: the project with slug `fastaust`, participants `H` (Heimir) and `C` (the Claude service user), six tags, seven boxes named exactly `Óraðað`, `Leiðsla`, `Í undirbúningi`, `Í sölu`, `Tilboð`, `Kaupsamningur`, `Afsal`. Task 3 and the fastaust plan rely on those names.

**Verification set:** the three `select` statements below, and the browser checks in step 4 at 1440 by 900. Nothing else.

- [ ] **Step 1: Check it is not there already.**

```sql
select id from hg_projects where slug = 'fastaust';
```

Expected: no rows. If a row exists, skip to step 3 and report what is already there.

- [ ] **Step 2: Insert the project, participants, tags and boxes.** One statement at a time, in this order:

```sql
insert into hg_projects (slug, name, repo_path)
values ('fastaust', 'Fasteignasala Austurlands', 'd:\Claude Code\fastaust');

insert into hg_participants (project_id, user_id, display_name, short, is_service)
select (select id from hg_projects where slug = 'fastaust'), p.user_id, p.display_name, p.short, p.is_service
from hg_participants p
join hg_projects m on m.id = p.project_id
where m.slug = 'metta' and p.short in ('H', 'C');

insert into hg_tags (project_id, name)
select (select id from hg_projects where slug = 'fastaust'), n
from unnest(array['eign', 'leiðsla', 'hjá seljanda', 'hjá kaupanda', 'hjá júlíusi', 'hjá öðrum']) as n;

insert into hg_zones (project_id, title, color, pos_x, pos_y, w, h)
select (select id from hg_projects where slug = 'fastaust'), z.title, z.color, z.pos_x, 0, 600, 1300
from (values
  ('Óraðað', 'stone', 0),
  ('Leiðsla', 'lilac', 660),
  ('Í undirbúningi', 'gold', 1320),
  ('Í sölu', 'teal', 1980),
  ('Tilboð', 'coral', 2640),
  ('Kaupsamningur', 'gold', 3300),
  ('Afsal', 'teal', 3960)
) as z(title, color, pos_x);
```

A box 600 wide holds two columns of cards (`placeInZone`), and 1300 tall holds twelve. The town tags of spec section 5 are not inserted here: the mirror in the fastaust repo adds each town with `tag add` the first time it meets it.

- [ ] **Step 3: Check the result.**

```sql
select p.short, p.is_service from hg_participants p join hg_projects j on j.id = p.project_id where j.slug = 'fastaust' order by p.short;
select count(*) from hg_tags t join hg_projects j on j.id = t.project_id where j.slug = 'fastaust';
select title, color, pos_x, w, h from hg_zones z join hg_projects j on j.id = z.project_id where j.slug = 'fastaust' order by pos_x;
```

Expected: `C true` and `H false`; `6`; seven rows in the order of step 2.

- [ ] **Step 4: A board without packs opens (Opus, Playwright MCP).** In the worktree run `npm run dev`. Sign in as `claude@huginn.pro` with `HG_SMOKE_PASSWORD` from `.env`, at 1440 by 900.
  - Open `/p/fastaust`. Expected: the board shows the seven boxes fitted in the view, no error panel, no console error.
  - Press the new item button. Expected: the sheet opens with no module picker and no error. Close it without saving.
  - Open the project switcher in the top bar. Expected: both `Fasteignasala Austurlands` and `Metta`. Pick Metta. Expected: the metta board loads.
  - If any of these fail, stop: it is a bug this plan did not foresee. Report it to Heimir with the console output before going on.

No commit: nothing in the repo changed.

---

### Task 3: `item create` and `item set` take the new flags

**Files:**
- Modify: `cli/lib/ops.mjs` (new function after `updateItem`)
- Modify: `cli/lib/commands.mjs` (`item.create`, `item.set`, the two import lists)
- Modify: `cli/README.md`

**Interfaces:**
- Consumes from task 1: `resolveZone`, `placeItemInZone`, `itemInZone`, and `zones` on the board from `loadBoard`.
- Produces, used by the fastaust plan through the command line:
  - `item create --title T [--summary ".."] [--source-ref ".."] [--zone "Kassi"] ...` prints `{ "ok": true, "id": "<uuid>" }` with `--json`
  - `item set <id> [--title ".."] [--zone "Kassi"] ...` prints `{ "ok": true, "id": "<uuid>" }` with `--json`, also when the card already lies in the box

**Verification set:** `npx vitest run cli/` and the live commands in step 5, all with `--project fastaust`. Nothing else.

- [ ] **Step 1: `resizeZone` in `cli/lib/ops.mjs`,** directly after `updateItem`:

```js
// A box grown to hold a card the CLI placed in it. The size is shared by
// every view; the position is never written from here.
export async function resizeZone(client, id, h) {
  const { data, error } = await client.from('hg_zones').update({ h: Math.round(h) }).eq('id', id).select('id')
  if (error) fail('Gat ekki stækkað kassann', error)
  if (!data?.length) fail('Kassinn fannst ekki eða þú hefur ekki aðgang að honum.')
}
```

- [ ] **Step 2: `item create`.** In `cli/lib/commands.mjs` add `resizeZone` to the `./ops.mjs` import and `itemInZone, placeItemInZone, resolveZone` to the `./write.mjs` import. In `WRITE.item.create`:
  - `usage` becomes `'item create --title T [--summary ".."] [--body-file f.md] [--module slug] [--zone "Kassi"] [--tags a,b] [--keywords a,b] [--source-ref ".."] [--file path ...] [--status new|waiting|ready|building|parked] [--waiting-on short]'`
  - `spec` gains `summary: 'value'`, `'source-ref': 'value'`, `zone: 'value'`
  - replace the `const pos = placeItem(...)` line with:

```js
        const card = { title, tags, fileCount: files.length }
        const zone = flags.zone !== undefined ? resolveZone(board.zones, flags.zone) : null
        const placed = zone ? placeItemInZone(board, zone, card) : null
        const pos = placed ? placed.pos : placeItem(board, moduleId, card)
        if (zone && placed.h > zone.h) await resizeZone(client, zone.id, placed.h)
```

  - the `createItem` call gains two keys: `summary: flags.summary !== undefined ? textOrNull(flags.summary) : null,` and `sourceRef: flags['source-ref'] !== undefined ? textOrNull(flags['source-ref']) : null,`

A box wins over a module for the place of the card; the module is still set.

- [ ] **Step 3: `item set`.** In `WRITE.item.set`:
  - `usage` becomes `'item set <id> [--title ".."] [--status ..] [--waiting-on short|none] [--summary ".."] [--body-file f.md] [--module slug|none] [--zone "Kassi"] [--tags a,b] [--keywords a,b] [--next-step ".."] [--next-prompt-file f.txt] [--source-ref ".."] [--force]'`
  - `spec` gains `title: 'value'`, `zone: 'value'`
  - directly after the `const patch = { ...statusPatch(flags.status, waitingOn) }` line add:

```js
        if (flags.title !== undefined) {
          const title = String(flags.title).trim()
          if (!title) throw new Error('--title má ekki vera tómt.')
          patch.title = title
        }
```

  - directly before the `if (Object.keys(patch).length === 0)` line add:

```js
        let already = null
        if (flags.zone !== undefined) {
          const board = await loadBoard(client, project.id)
          const zone = resolveZone(board.zones, flags.zone)
          const current = { ...(board.items.find((i) => i.id === item.id) ?? item), ...(patch.title ? { title: patch.title } : {}) }
          if (itemInZone(board, zone, current)) {
            already = zone.title
          } else {
            const placed = placeItemInZone(board, zone, current)
            if (placed.h > zone.h) await resizeZone(client, zone.id, placed.h)
            patch.pos_x = placed.pos.x
            patch.pos_y = placed.pos.y
          }
        }
        if (already !== null && Object.keys(patch).length === 0) {
          return {
            json: { ok: true, id: item.id },
            text: `Verk #${shortId(item.id)} er þegar í kassanum ${oneLine(already)}.`,
          }
        }
```

A write of `pos_x` and `pos_y` alone moves no stamp and logs no event (migration 0004), so a move is never unread.

- [ ] **Step 4: `cli/README.md`.**
  - In the `item create` row, the example becomes: `huginn item create --title "Nýtt verk" --summary "Ein lína um stöðuna" --body-file lysing.md --module efnaskra --tags a,b --keywords "social media,efni,instagram" --source-ref docs/skjal.md --zone "Óraðað" --file mynd.png --file skjal.pdf`
  - In the `item set` row, the example becomes: `huginn item set 1a2b3c4d --status waiting --waiting-on H --summary "Bíður svars" --title "Nýr titill" --zone "Tilboð"`
  - In the `huginn pull --json` row, the text becomes: `Allt borðið sem JSON (sama lögun og BoardData í vefnum, kassar borðsins eru í zones)`
  - The `**Staðsetning.**` bullet gains a last sentence: `Módúllaust spjald án --zone lendir heldur aldrei inni í kassa.`
  - Add this bullet directly after the `**Staðsetning.**` bullet:

```markdown
- **Kassar.** `--zone <nafn>` setur spjaldið á lausan stað í kassanum með því nafni (há- og lágstafir skipta ekki máli). Á `item create` ræður kassinn staðnum í stað módúlsins. Á `item set` færir það spjaldið, nema það liggi þegar í kassanum. Fullur kassi stækkar niður á við. Aðeins aðalborðið: staðsetning í vistaðri sýn er hvorki lesin né skrifuð. Tilfærsla hreyfir engan stimpil og ekkert verður ólesið. Nafn sem enginn kassi ber, eða fleiri en einn, er villa og ekkert er skrifað.
```

- [ ] **Step 5: Live check on the project `fastaust`.** Run each command and compare. `<id>` is the id the first command prints.

```bash
node cli/huginn.mjs item create --project fastaust --json --title "Prufa úr plani, má hunsa" --summary "Prufulína" --source-ref "prufa/plan" --zone "óraðað" --status parked
node cli/huginn.mjs pull --project fastaust --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s);const i=b.items.find(x=>x.source_ref==='prufa/plan');console.log(i.pos_x,i.pos_y,i.summary,i.status,b.zones.length)})"
node cli/huginn.mjs item set <id> --project fastaust --zone "Tilboð"
node cli/huginn.mjs item set <id> --project fastaust --zone "Tilboð"
node cli/huginn.mjs item set <id> --project fastaust --title "Prufa, nýr titill, má hunsa"
node cli/huginn.mjs item set <id> --project fastaust --zone "Ekki til"
node cli/huginn.mjs item close <id> --project fastaust --dropped
```

Expected, in order:
  1. `{ "ok": true, "id": "..." }`
  2. `24 40 Prufulína parked 7`
  3. a line starting `Verk uppfært #`
  4. a line ending `er þegar í kassanum Tilboð.`
  5. a line containing `Prufa, nýr titill, má hunsa`
  6. `Villa: Kassinn Ekki til fannst ekki. Kassar: Óraðað, Leiðsla, Í undirbúningi, Í sölu, Tilboð, Kaupsamningur, Afsal.` and exit code 1
  7. a line starting `Verki lokað #`

After command 3 run the `pull` line again with `console.log(i.pos_x, i.pos_y)`: expected `2664 40`. The dropped test card fades from the board after three days; do not delete it.

- [ ] **Step 6: Run the CLI tests and commit.**

Run: `npx vitest run cli/`
Expected: PASS.

```bash
git add cli/lib/ops.mjs cli/lib/commands.mjs cli/README.md
git commit -m "feat(vinnubord): item create and item set take a box, a title, a summary and a source"
```

---

### Task 4: The home page reopens the last project

**Files:**
- Create: `src/vinnubord/lib/lastProject.ts`
- Create: `src/vinnubord/lib/lastProject.test.ts`
- Modify: `src/vinnubord/pages/HomePage.tsx`
- Modify: `src/vinnubord/pages/BoardPage.tsx`

**Interfaces:**
- Produces: `LAST_PROJECT_KEY = 'hg.lastProject'`, `startSlug(projects: { slug: string }[], stored: string | null): string | null`, `readLastProject(): string | null`, `writeLastProject(slug: string): void`.

**Verification set:** `npx vitest run src/vinnubord/lib/lastProject.test.ts`, `npm run build`, and the browser check in step 5 at 1440 by 900 as `claude@huginn.pro`. Nothing else.

- [ ] **Step 1: Write the failing test,** `src/vinnubord/lib/lastProject.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LAST_PROJECT_KEY, startSlug } from './lastProject'

const projects = [{ slug: 'fastaust' }, { slug: 'metta' }]

describe('startSlug', () => {
  it('opens the project this browser was last in', () => {
    expect(startSlug(projects, 'metta')).toBe('metta')
  })

  it('falls back to the first project with nothing stored', () => {
    expect(startSlug(projects, null)).toBe('fastaust')
    expect(startSlug(projects, '')).toBe('fastaust')
  })

  it('falls back to the first project when the stored one is no longer the viewer\'s', () => {
    expect(startSlug(projects, 'gamalt')).toBe('fastaust')
  })

  it('gives null to a viewer with no project', () => {
    expect(startSlug([], 'metta')).toBeNull()
  })

  it('uses the documented key', () => {
    expect(LAST_PROJECT_KEY).toBe('hg.lastProject')
  })
})
```

- [ ] **Step 2: Run it and see it fail.**

Run: `npx vitest run src/vinnubord/lib/lastProject.test.ts`
Expected: FAIL, cannot resolve `./lastProject`.

- [ ] **Step 3: `src/vinnubord/lib/lastProject.ts`:**

```ts
// The project this browser opened last, so "/" returns to it instead of to
// the first project by name. One key for the whole browser, not per user:
// a slug the viewer is not a participant of is ignored.

export const LAST_PROJECT_KEY = 'hg.lastProject'

export function startSlug(projects: { slug: string }[], stored: string | null): string | null {
  if (projects.length === 0) return null
  const last = stored ? projects.find((p) => p.slug === stored) : undefined
  return (last ?? projects[0]).slug
}

export function readLastProject(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY)
  } catch {
    return null
  }
}

export function writeLastProject(slug: string): void {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, slug)
  } catch {
    // Storage is off (private mode): "/" opens the first project, as before.
  }
}
```

- [ ] **Step 4: Use it.**
  - `src/vinnubord/pages/HomePage.tsx`: import `readLastProject, startSlug` from `'../lib/lastProject'`. Replace the line `if (projects.length > 0) return <Navigate to={`/p/${projects[0].slug}`} replace />` with:

```tsx
  const slug = startSlug(projects, readLastProject())
  if (slug) return <Navigate to={`/p/${slug}`} replace />
```

    and change the comment above the component to start: `"/" sends a participant to the project this browser opened last (the first by name when there is none), ...`
  - `src/vinnubord/pages/BoardPage.tsx`: import `writeLastProject` from `'../lib/lastProject'`. Directly after the `const project = projects.find(...)` line add:

```tsx
  // "/" comes back to the board that was open last (lib/lastProject).
  const projectSlug = project?.slug ?? null
  useEffect(() => {
    if (projectSlug) writeLastProject(projectSlug)
  }, [projectSlug])
```

- [ ] **Step 5: Run the test, the build and the browser check.**

Run: `npx vitest run src/vinnubord/lib/lastProject.test.ts` then `npm run build`
Expected: PASS, and a green build.

Browser (`npm run dev`, signed in as `claude@huginn.pro`): open `/p/metta`, then `/`. Expected: lands on `/p/metta`. Open `/p/fastaust`, then `/`. Expected: lands on `/p/fastaust`. Run `localStorage.setItem('hg.lastProject', 'ekki-til')` in the console, open `/`. Expected: lands on `/p/fastaust` (first by name).

- [ ] **Step 6: Commit.**

```bash
git add src/vinnubord/lib/lastProject.ts src/vinnubord/lib/lastProject.test.ts src/vinnubord/pages/HomePage.tsx src/vinnubord/pages/BoardPage.tsx
git commit -m "feat(vinnubord): the home page reopens the project the browser was last in"
```

---

### Task 5: Docs

**Files:**
- Modify: `CLAUDE.md`
- Create: `docs/progress/19-fastaust-i-huginn.md`

**Verification set:** `npm run test` and `npm run build` on the branch (the whole suite once, before the final review). No docs review of its own; the Fable final review reads them.

- [ ] **Step 1: `CLAUDE.md`.** Touch only these places, in the file's own tone:
  - **First paragraph:** after the sentence that names the three participants, add that Huginn holds more than one project since 2026-11-25: `metta` and `fastaust` (Fasteignasala Austurlands, only Heimir and the Claude service user), and that the two share nothing but the login and the project switcher.
  - **Current state:** one new bullet, "Fastaust í Huginn (2026-11-25)": the project `fastaust` with seven boxes as stages of a sale and no packs or modules; its cards are written by `scripts/sync-huginn.mjs` in the fastaust repo from the eignalog headers, never by hand rules in this repo; the CLI gained boxes in `loadBoard` and `pull --json`, `--zone`, `--summary` and `--source-ref` on `item create`, `--title` and `--zone` on `item set`; the home page reopens the last project. Give the new test count from `npm run test`. Point at `docs/progress/19-fastaust-i-huginn.md`, and add that file to the list of progress docs at the end of the section.
  - **Routes:** the `/` line becomes: signed in goes to the project this browser opened last (`hg.lastProject`, `lib/lastProject.ts`), else the viewer's first project by name.
  - **Folder structure:** add `lastProject (the project "/" reopens)` to the `lib/` line.
  - **Key Patterns:** one new bullet, "Boxes from the CLI are main board only": `resolveZone`, `placeInZone`, `placeItemInZone` and `itemInZone` in `cli/lib/write.mjs`; `--zone` reads `hg_zones` and writes `hg_items.pos_x|pos_y` and, when the box is full, `hg_zones.h`; never a view position; a box is an obstacle for a new card only when the card has no module to sit beside; `itemInZone` copies the centre rule of `zoneMembers` in `lib/zones.ts` and has no parity test.
  - **Key Patterns, "Analysis rules":** add one sentence: an item a participant creates by hand in `fastaust` is analysed with the software prompt, a known gap (spec 2026-11-25, section 13).

- [ ] **Step 2: `docs/progress/19-fastaust-i-huginn.md`.** A per plan handover with these sections: what was built (tasks 1 to 4, one short paragraph each), the data that was inserted (project, participants, six tags, seven boxes with their sizes), what was checked and how (the test count, the live commands of task 3 and their output, the browser checks of tasks 2 and 4), what is left (the fastaust plan, the dropped test card that fades by itself, anything a reviewer deferred), and what Heimir checks: `huginn.pro` opens the project he was last in, the switcher shows both projects, and the fastaust board shows seven empty boxes.

- [ ] **Step 3: Whole suite and commit.**

Run: `npm run test` then `npm run build`
Expected: every test passes, the build is green.

```bash
git add CLAUDE.md docs/progress/19-fastaust-i-huginn.md
git commit -m "docs(vinnubord): fastaust as a Huginn project"
```

---

## After the last task

Final whole branch review on Fable, fix rounds reviewed until one comes back clean. Then merge to main from the main checkout (check `git log` for foreign commits first), `npm run build` and `npm run test` on main, push, remove the worktree. Vercel deploys main. The fastaust plan starts only after the push: it calls `cli/huginn.mjs` from the main checkout of this repo.
