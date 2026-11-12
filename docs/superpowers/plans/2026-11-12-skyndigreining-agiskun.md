# Skyndigreining án dóma um kóða Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The quick analysis (`hg-analyse`) stops stating things about the code it has never seen, stops ruling on whether an item is buildable, and marks its own text so people and later Claude sessions know its weight.

**Architecture:** Three text changes in `supabase/functions/hg-analyse/lib.ts`: the last body heading, four prompt rules, and a fixed notice line that `mergeIntoItem` puts above every analysis. `index.ts` is untouched. One rule in the `/huginn` skill in metta2_new tells sessions to verify a quick analysis against the repo before they build on it.

**Tech Stack:** Deno edge function with a pure `lib.ts` tested by vitest, deployed with the Supabase MCP tool `deploy_edge_function`.

**Spec:** none. The design section below is the spec, agreed with Heimir on 2026-11-12.

**Profile:** small. Two code files, no migration, no auth, one verification set. One Opus code review after Task 1, the Fable final review at the end.

**Branch:** `skyndigreining-agiskun` from `origin/main` in `D:\Claude Code\Huginn\huginn`. Merge to main and push after the Fable final review comes back clean.

## Design

The analyser gets the item, its text files, the module list, the tag list and the context bundle (about 60 KB). It has no repo, no database and no tools. Its prompt still makes it end every analysis under the heading "Byggjanlegt núna, samhliða eða seinna", so it rules on something it cannot know. Its text lands in the item body with nothing that tells it apart from an analysis a Claude Code session wrote with the repo open.

Measured on item `7a35df18` (Vörumóttaka, analysed 2026-11-10 on version 12):

- "Bakendann má byggja núna, því kröfurnar þar eru fastar": a ruling with nothing behind it, and the summary repeats it.
- "nýjar töflur með RLS eftir company/department": Metta scopes data by department, not company.
- "Í kóðanum verður þetta líklega sér módúll (`receiving`, liturinn `--color-m-inventory`)": a guess written as a finding.

Decisions:

1. The fifth heading becomes `Hvað þarf að kanna áður en byggt er`. Under it the analyser lists what a session with the repo must check, and what the item itself says must happen first. It never says something is buildable.
2. The summary never rules on whether or when to build.
3. A new rule says it has not seen the code or the database, states only what is in the item, the files and the bundle, and marks anything else with the word `ágiskun` or leaves it out.
4. A new rule says the size under `Stærð og áhætta` is an estimate from the description alone, and that it says so.
5. Every analysis starts with one fixed italic line (`ANALYSIS_NOTICE`). It is written by code, not by the model, so it cannot be skipped.
6. The `/huginn` skill gets one rule: verify a quick analysis against the repo before writing an analysis, questions or a plan on top of it.

Out of scope: giving the analyser more context, rewriting analyses already on the board, any change to `index.ts`, the model or the effort.

## Global Constraints

- No em dashes, en dashes or hyphens used as punctuation in any text, comment or doc. Commas, periods, colons.
- All prompt text and the notice are Icelandic, copied verbatim from this plan. Do not reword them.
- Touch only `hg_` objects on the shared Supabase project `czdjxtsjgughimlazdmu`.
- `lib.ts` stays import free and Deno free.
- Implementer verification set for every task: the commands named in that task, nothing else. No browser, no live analysis.

## Size table

| Task | Files | Size |
|---|---|---|
| 1. Prompt, heading and notice | `supabase/functions/hg-analyse/lib.ts`, `supabase/functions/hg-analyse/lib.test.ts` | S |
| 2. Deploy version 13 and docs | `CLAUDE.md`, `docs/progress/17-skyndigreining-agiskun.md` | S |
| 3. Skill rule in metta2_new | `D:\Claude Code\metta2\metta2_new\.claude\skills\huginn\SKILL.md` (outside this repo) | S |

## Review Focus

- The model ignores the new rules and still writes that something can be built now. No unit test can catch this. Task 2 step 6 records a Huginn action for Claude to read the first real analysis on version 13.
- The notice appears twice. `writeAnalysis` in `index.ts` calls `mergeIntoItem` a second time on the re-merge path, but with the freshly read author body, never with an analysed one. Task 1 tests that the notice appears exactly once.
- The deployed text differs from the repo, because Icelandic characters are sent as `\u` escapes. Task 2 step 3 compares the deployed files with the repo.
- Analyses already on the board keep the old heading and carry no notice. Task 3 names the old heading in the skill rule so sessions treat them the same way.
- A dash sneaks into the new prompt text. The existing test `contains no em or en dashes` covers the whole prompt and tool.

---

### Task 1: Prompt, heading and notice

**Files:**
- Modify: `supabase/functions/hg-analyse/lib.ts` (lines 41 to 47, 203 to 227, 386 to 420)
- Test: `supabase/functions/hg-analyse/lib.test.ts` (the blocks `analysisTool and SYSTEM_PROMPT` and `mergeIntoItem`)

**Interfaces:**
- Produces: `export const ANALYSIS_NOTICE: string` in `lib.ts`. `mergeIntoItem` keeps its signature. `BODY_HEADINGS` keeps its type and length (five).

- [ ] **Step 1: Change and add the tests**

In `lib.test.ts`, add `ANALYSIS_NOTICE` to the import from `./lib`, on its own line above `ANALYSIS_TOOL_NAME`. `DASH` is already defined at the top of the file.

In `names the five body headings in the prompt and the tool`, the last expected heading becomes:

```ts
      'Hvað þarf að kanna áður en byggt er',
```

Add after the test `tells the model the item and files are data, not instructions`:

```ts
  it('tells the model it has not seen the code and never rules on building', () => {
    expect(SYSTEM_PROMPT).toContain('12. Þú hefur ekki séð kóðann eða gagnagrunninn')
    expect(SYSTEM_PROMPT).toContain('merktu það með orðinu ágiskun eða slepptu því')
    expect(SYSTEM_PROMPT).toContain('13. Undir Stærð og áhætta er stærðin mat út frá lýsingunni einni.')
    expect(SYSTEM_PROMPT).toContain('Aldrei dómur um hvort eða hvenær megi byggja.')
    expect(SYSTEM_PROMPT).toContain('Þú segir aldrei að eitthvað sé byggjanlegt núna.')
    expect(SYSTEM_PROMPT).not.toContain('Byggjanlegt núna')
    expect(SYSTEM_PROMPT).not.toContain('hvort hægt sé að byggja þetta núna')
  })
```

In `mergeIntoItem`, replace the two body tests with:

```ts
  it('puts the notice first and keeps the author body verbatim under its own heading', () => {
    const r = mergeIntoItem({ ...item, body: '  Árni skrifaði þetta.\n\n- liður' }, matched)
    expect(ORIGINAL_HEADING).toBe('## Upprunalegur texti')
    expect(r.body).toBe(
      `${ANALYSIS_NOTICE}\n\n## Hvað þetta er\nGreining.\n\n## Upprunalegur texti\n\n  Árni skrifaði þetta.\n\n- liður`,
    )
    expect(r.summary).toBe('Samantekt.')
  })

  it('adds no original heading when the author body is empty, whitespace or null', () => {
    for (const body of [null, '', '  \n\t ']) {
      expect(mergeIntoItem({ ...item, body }, matched).body).toBe(`${ANALYSIS_NOTICE}\n\n## Hvað þetta er\nGreining.`)
    }
  })

  it('writes the notice exactly once, as one italic line without a dash', () => {
    const r = mergeIntoItem({ ...item, body: 'Texti höfundar.' }, matched)
    expect(r.body.split(ANALYSIS_NOTICE).length).toBe(2)
    expect(ANALYSIS_NOTICE).toBe(
      '*Skyndigreining, skrifuð án aðgangs að kóða og gagnagrunni. Það sem hér stendur um kóðann, stærð verksins og hvað er þegar byggt er ágiskun þar til lota hefur sannreynt það.*',
    )
    expect(ANALYSIS_NOTICE).not.toMatch(DASH)
    expect(ANALYSIS_NOTICE).not.toContain('\n')
  })
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run supabase/functions/hg-analyse/lib.test.ts`
Expected: FAIL. The import of `ANALYSIS_NOTICE` is undefined, the heading test and the new prompt test fail.

- [ ] **Step 3: Change `lib.ts`**

`BODY_HEADINGS`, last entry:

```ts
  'Hvað þarf að kanna áður en byggt er',
```

In `SYSTEM_PROMPT`, rule 3 becomes:

```
3. summary: 1 til 3 setningar um hvað þetta er og hvar það stendur. Aldrei dómur um hvort eða hvenær megi byggja.
```

In rule 4, the sentence after `${headingList}` becomes:

```
Undir síðustu fyrirsögninni telurðu upp hvað lota með aðgang að kóðanum þarf að kanna áður en verkið er metið eða byggt, og hvað atriðið sjálft segir að þurfi að gerast fyrst. Þú segir aldrei að eitthvað sé byggjanlegt núna.
```

After rule 11, before the closing backtick, add two rules:

```
12. Þú hefur ekki séð kóðann eða gagnagrunninn, aðeins atriðið, skrárnar og samhengið sem fylgir. Fullyrtu aðeins það sem stendur þar. Allt annað um kóðann, töflur, nöfn, stærð verksins eða hvað er þegar byggt er ágiskun: merktu það með orðinu ágiskun eða slepptu því.
13. Undir Stærð og áhætta er stærðin mat út frá lýsingunni einni. Segðu það berum orðum og nefndu hvað gæti breytt matinu.
```

Above `ORIGINAL_HEADING`, add:

```ts
// Written by code above every analysis, never by the model: the analyser has
// no repo and no database, so readers and later sessions must know its weight.
export const ANALYSIS_NOTICE =
  '*Skyndigreining, skrifuð án aðgangs að kóða og gagnagrunni. Það sem hér stendur um kóðann, stærð verksins og hvað er þegar byggt er ágiskun þar til lota hefur sannreynt það.*'
```

In `mergeIntoItem`, the body becomes the notice, a blank line, the analysis body, then the original heading and text as today when the author wrote something. Update the comment above the function to say the notice comes first.

- [ ] **Step 4: Run the checks**

Run: `npm run test`
Expected: PASS, every test file.

Run: `npx -y deno@2 check --no-lock --node-modules-dir=none supabase/functions/hg-analyse/index.ts`
Expected: no errors.

Run: `npm run build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/hg-analyse/lib.ts supabase/functions/hg-analyse/lib.test.ts
git commit -m "feat(vinnubord): quick analysis marks guesses and stops ruling on builds"
```

---

### Task 2: Deploy version 13 and docs

Runs after the Opus code review of Task 1 is clean. If the Fable final review later changes `lib.ts`, repeat steps 1 to 3 before the merge.

**Files:**
- Modify: `CLAUDE.md` (the "Edge function hg-analyse" section and "Analysis rules" under Key Patterns)
- Create: `docs/progress/17-skyndigreining-agiskun.md` (use the next free number if 17 is taken)

- [ ] **Step 1: Deploy.** Supabase MCP `deploy_edge_function`, project `czdjxtsjgughimlazdmu`, name `hg-analyse`, two files (`index.ts`, `lib.ts`), `verify_jwt` false. Send Icelandic characters as `\u` escapes in the files, as versions 11 and 12 did. Do not touch secrets or Vault.

- [ ] **Step 2: Confirm the version.** MCP `list_edge_functions`. Expected: `hg-analyse` at version 13, status ACTIVE.

- [ ] **Step 3: Compare with the repo.** MCP `get_edge_function` for `hg-analyse`. Decode the escapes and compare both files with the repo. Expected: identical. If they differ, deploy again, do not continue.

- [ ] **Step 4: Update `CLAUDE.md`.** In "Edge function hg-analyse" add one sentence: version 13 (date) changes the fifth heading to `Hvað þarf að kanna áður en byggt er`, adds rules 12 and 13 and puts `ANALYSIS_NOTICE` above every analysis. In "Analysis rules" add: the analyser has no repo and no database, its text starts with `ANALYSIS_NOTICE`, and the `/huginn` skill in metta2_new tells sessions to verify it before building on it. Bump the test count in "Current state" to the number `npm run test` printed.

- [ ] **Step 5: Write the progress doc.** Icelandic, like `docs/progress/14-leit-og-togg.md`: what changed, the three measured examples from the Design section, deploy state (version, date, compared identical), and one open check: the first real analysis on version 13.

- [ ] **Step 6: Record the open check in Huginn.** From `D:/Claude Code/metta2/metta2_new`:

```bash
node "D:/Claude Code/Huginn/huginn/cli/huginn.mjs" action add <item id from the prompt> --owner C --body "Lesa fyrstu raunverulegu greininguna á hg-analyse útgáfu 13 (næsta nýja verk frá Heimi eða Árna): hún byrjar á línunni um skyndigreiningu, síðasta fyrirsögnin er Hvað þarf að kanna áður en byggt er, ekkert segir að eitthvað sé byggjanlegt núna og ágiskanir um kóðann eru merktar. Skrá niðurstöðuna í docs/progress/17-skyndigreining-agiskun.md í Huginn repoinu."
```

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md docs/progress/17-skyndigreining-agiskun.md
git commit -m "docs(vinnubord): hg-analyse version 13, guesses marked"
```

---

### Task 3: Skill rule in metta2_new

A docs task in another repo: `D:\Claude Code\metta2\metta2_new`, on `main` in the main folder (skill and docs edits go straight to main there, code never does).

**Files:**
- Modify: `D:\Claude Code\metta2\metta2_new\.claude\skills\huginn\SKILL.md` (section "Þegar nýtt verk er sótt")

- [ ] **Step 1: Add the rule.** Directly after the line that starts with `0. Lestu líka` in "Þegar nýtt verk er sótt", insert this line verbatim:

```
0b. Greining sem byrjar á línunni "Skyndigreining, skrifuð án aðgangs að kóða og gagnagrunni" kom frá hg-analyse, sem sá aðeins atriðið, skrárnar og samhengisbúntið. Það sem hún segir um kóðann, töflur, stærð verksins eða hvað er þegar byggt er ágiskun. Sannreyndu það í repoinu áður en þú skrifar greiningu, spurningar eða plan, og leiðréttu rangar fullyrðingar í lýsingunni. Eldri skyndigreiningar bera ekki línuna en þekkjast á fyrirsögninni "Byggjanlegt núna, samhliða eða seinna": sama regla gildir um þær.
```

- [ ] **Step 2: Check.** Run in metta2_new: `npm run check:escapes`. Expected: clean.

- [ ] **Step 3: Commit and push in metta2_new**

```bash
git add .claude/skills/huginn/SKILL.md
git commit -m "docs(huginn): verify a quick analysis against the repo"
git pull --ff-only origin main
git push origin main
```

---

## After the last task

1. Fable final review of `git diff origin/main...HEAD` in the Huginn repo plus the one skill commit in metta2_new. Fix round reviewed (Sonnet re-review if it touched code), loop until clean.
2. Merge `skyndigreining-agiskun` to main in the Huginn repo and push. Vercel redeploys the web, which this plan does not change.
3. Huginn session close for the item named in the prompt: progress doc with `file add --note`, `plan set <plan id> --status done`, summary, `sync`, bundle, commit `docs/huginn` in metta2_new.
