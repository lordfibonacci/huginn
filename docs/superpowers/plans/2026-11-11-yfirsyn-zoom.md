# Yfirsýn: læsileg nöfn og meira zoom út (smáverk)

Heimir, 2026-11-11, með skjámynd af metta í 20%: "það er dáldið mikið chaos í gangi hér, ég sé t.d. ekkert hvað kassarnir segja, titill og þess háttar, það má vera stærra þegar ég zooma út, væri líka gott að geta zoomað aðeins meira út til að fá betri yfirsýn yfir stór verkefni".

Orsök: allt í `.hg-world` skalast með zoominu. Í 20% er nafn kassa (13 px) um 3 px á skjá, athugasemd kassa (12 px) um 2 px og pakkatitill (30 px) 6 px. `MIN_ZOOM` í `src/vinnubord/lib/geometry.ts` er 0.2.

## Hönnun (ákvörðun Fable, Heimir sagði "byrjaðu bara")

1. Þrír merkimiðar hætta að minnka á skjánum neðan við þröskuld: nafn kassa, athugasemd kassa og nafn pakka. Gert í CSS eingöngu með `scale: max(1, far / --hg-z)`. `--hg-z` er þegar skrifað á `.hg-world` í hverjum ramma (`useViewport.apply`). `scale` breytir engu layouti, svo `offsetWidth` og `offsetLeft`, sem val (`titleBoxes`) og aðild að kassa lesa, eru óbreytt.
2. Hámarksbreidd hvers miða er deilt með sama stuðli, svo skalaður miði endar innan kassans eða dálksins með úrfellingu og leggst ekki yfir næsta.
3. Nafn pakka fær eigið `span` svo aðeins textinn skalist, frá neðra vinstra horni (vex upp, ýtir ekki módúlunum). Hnappurinn heldur kassanum sínum.
4. `MIN_ZOOM` fer úr 0.2 í 0.1.

Ekki í þessu verki: nöfn módúla og titlar spjalda. Þau þurfa aðra framsetningu í fjarlægð (nýtt scope, nýtt spjald).

## Stærðartafla

| Verk | Skrár | Stærð |
|---|---|---|
| 1. Fjarmiðar og lágmarkszoom | src/vinnubord/vinnubord.css, src/vinnubord/components/PackColumn.tsx, src/vinnubord/lib/geometry.ts, src/vinnubord/lib/geometry.test.ts | S |
| 2. CLAUDE.md | CLAUDE.md | S |

Smáverk: 4 kóðaskrár, um 40 línur, engin migration, ekkert auth, `PackColumn` er aðeins á borðinu, ein sannreyning.

## Verk 1

Allt verbatim. Engin önnur breyting.

### 1a. `src/vinnubord/vinnubord.css`, tokens

Á eftir línunni `  --hg-pack-title-size: 30px;` (Pack columns hópurinn):

```css
  /* Below this board zoom (--hg-z) the pack name stops shrinking on screen: it
     is scaled back up by this over the zoom, so 0.5 keeps a 30 px name at
     15 px. 0 turns it off. */
  --hg-pack-title-far: 0.5;
```

Á eftir línunni `  --hg-zone-note-max-w: 70%;` (Kassar hópurinn):

```css
  /* Below this board zoom (--hg-z) the box name and note stop shrinking on
     screen, scaled back up by this over the zoom. 1 keeps them at their own
     size at every zoom below 100%. 0 turns it off. */
  --hg-zone-far: 1;
```

### 1b. `src/vinnubord/vinnubord.css`, pakkatitill

Á eftir línunni sem byrjar á `.hg-pack-title::after {` (ein lína), ný regla:

```css
/* The name alone is scaled back up when the board is zoomed far out
   (--hg-pack-title-far), from its bottom left corner: it grows upwards and to
   the right over the hairline and never pushes the modules. The button keeps
   its box, so the grip, the selection ring and the boxes Board measures stay
   the same. The width cap shrinks by the same factor, so the scaled name ends
   at the column's right edge with an ellipsis. */
.hg-pack-title-text {
  --hg-far-k: max(1, calc(var(--hg-pack-title-far) / var(--hg-z, 1)));
  min-width: 0; max-width: calc((var(--hg-pack-w) - var(--hg-pack-title-indent)) / var(--hg-far-k));
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transform-origin: left bottom; scale: var(--hg-far-k);
}
```

Reglan `.hg-pack-fold { ... }` verður (bætt við `position: relative; z-index: 1;` og athugasemd á undan):

```css
/* Above the pack name, which covers it when scaled up far out. */
.hg-pack-fold {
  width: var(--hg-touch); height: var(--hg-touch); flex: none; display: grid; place-items: center; cursor: pointer;
  border: none; border-radius: var(--hg-radius-control-inner); background: none; color: var(--hg-ink-3);
  position: relative; z-index: 1;
}
```

### 1c. `src/vinnubord/vinnubord.css`, kassar

Reglan `.hg-zone { ... }` verður:

```css
.hg-zone {
  position: absolute; z-index: var(--hg-zone-z); border-radius: var(--hg-radius-zone);
  background: color-mix(in oklab, var(--hg-c) var(--hg-zone-fill), transparent);
  border: 1px solid color-mix(in oklab, var(--hg-c) var(--hg-zone-border), transparent);
  font-family: var(--hg-font);
  /* How much the name and note are scaled back up when the board is zoomed
     far out (--hg-zone-far). Their width caps shrink by the same factor, so a
     scaled label still ends inside the box. */
  --hg-far-k: max(1, calc(var(--hg-zone-far) / var(--hg-z, 1)));
}
```

Reglan `.hg-zone-title { ... }` verður (nýtt `max-width`, og `transform-origin` og `scale` aftast):

```css
.hg-zone-title {
  position: absolute; left: var(--hg-zone-title-inset); top: calc(-1 * var(--hg-zone-title-h) / 2);
  min-height: var(--hg-zone-title-h); max-width: calc((100% - 2 * var(--hg-zone-title-inset)) / var(--hg-far-k)); padding: var(--hg-zone-title-pad);
  border: none; border-radius: var(--hg-radius-chip); background: var(--hg-board); color: var(--hg-c);
  font: inherit; font-size: var(--hg-zone-title-size); font-weight: 800; letter-spacing: -0.01em; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; cursor: grab; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  transform-origin: left center; scale: var(--hg-far-k);
}
```

Reglan `.hg-zone-note { ... }` verður:

```css
.hg-zone-note {
  position: absolute; left: var(--hg-zone-title-inset); bottom: var(--hg-zone-note-inset); max-width: calc(var(--hg-zone-note-max-w) / var(--hg-far-k));
  font-size: var(--hg-zone-note-size); color: var(--hg-ink-2); line-height: 1.35; overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; pointer-events: none;
  transform-origin: left bottom; scale: var(--hg-far-k);
}
```

### 1d. `src/vinnubord/components/PackColumn.tsx`

Í titilhnappnum verður `{pkg.name}` að:

```tsx
          <span className="hg-pack-title-text">{pkg.name}</span>
```

### 1e. `src/vinnubord/lib/geometry.ts`

```ts
export const MIN_ZOOM = 0.1
```

### 1f. `src/vinnubord/lib/geometry.test.ts`

Í `describe('zoomAt')` verða þessi fjögur próf (hin óbreytt):

```ts
  it('clamps to 0.1 and 2.5 by default', () => {
    expect(zoomAt({ x: 0, y: 0, z: 1 }, 100, 0, 0).z).toBe(2.5)
    expect(zoomAt({ x: 0, y: 0, z: 1 }, 0.01, 0, 0).z).toBe(0.1)
  })

  it('never zooms in when zooming out from a view already below the floor', () => {
    const view: View = { x: 40, y: 90, z: 0.05 }
    const [wx, wy] = screenToWorld(view, 500, 400)
    const next = zoomAt(view, 0.8, 500, 400)
    expect(next.z).toBe(0.05)
    const [ax, ay] = screenToWorld(next, 500, 400)
    expect(ax).toBeCloseTo(wx)
    expect(ay).toBeCloseTo(wy)
  })

  it('zooms in gradually from below the floor instead of snapping to it', () => {
    expect(zoomAt({ x: 0, y: 0, z: 0.05 }, 1.25, 0, 0).z).toBeCloseTo(0.0625)
    expect(zoomAt({ x: 0, y: 0, z: 0.05 }, 10, 0, 0).z).toBeCloseTo(0.5)
  })
```

og í prófinu `a fitted view of a huge board stays put on zoom out` verður línan `expect(fitted.z).toBeLessThan(0.2)` að:

```ts
    expect(fitted.z).toBeLessThan(0.1)
```

Í `describe('pinchView')` verður síðasta prófið:

```ts
  it('never zooms in when pinching out from a view below the floor', () => {
    const next = pinchView({ x: 0, y: 0, z: 0.05 }, { cx: 0, cy: 0, d: 100 }, { cx: 0, cy: 0, d: 50 })
    expect(next.z).toBe(0.05)
  })
```

### Sannreyning útfæranda

`npm run test` (641 próf, öll græn) og `npm run build` grænt. Ekkert annað þarf útfærandi að athuga. Stjórnandi tekur skjámyndina (`npm run shots:hg tabletLand` á móti local preview) og les hana í lokarýni.

Commit: `feat(vinnubord): far labels stay readable, zoom out to 10%`.

## Verk 2: CLAUDE.md

Í Design System, ný málsgrein á eftir málsgreininni sem byrjar á "Plan 15 adds the `Kassar` token group":

```
Far labels (2026-11-11): three labels stop shrinking on screen below a zoom threshold, each by `scale: max(1, far / --hg-z)` in CSS only (no React, no layout change, so the offset boxes that selection and box membership read stay the same). `--hg-zone-far` (1) covers the box name (`.hg-zone-title`, scaled from its left centre) and note (`.hg-zone-note`, from its bottom left); `.hg-zone` sets the factor as `--hg-far-k` and both labels divide their `max-width` by it, so a scaled label still ends inside its box with an ellipsis. `--hg-pack-title-far` (0.5) covers the pack name, which is its own span (`.hg-pack-title-text`, scaled from its bottom left so it grows upwards and never pushes the modules, one line, capped at the column width with an ellipsis); the title button keeps its box, and `.hg-pack-fold` sits above the scaled name (`z-index: 1`). Setting a far token to 0 turns the effect off. `MIN_ZOOM` in `lib/geometry.ts` is 0.1.
```

Commit: `docs(vinnubord): far labels and the 10% zoom floor`.

## Rýni

Ein kóðarýni á Opus eftir verk 1, lokarýni á Fable (les diffið og skjámyndina). Hafnaðar athugasemdir fá eina línu hér fyrir neðan.

### Rýni 1 (Opus á 1ae58e8, og skjámynd og mæling stjórnanda)

Mæling, `npm run shots:hg perf` á móti local preview, sama build, far tokenin 0 eða eins og byggt (hermdur sími, 4x CPU):

| | pinch-out@min gap mean | pinch-in gap mean | p90 |
|---|---|---|---|
| Slökkt (2 keyrslur) | 43.2, 42.3 | 41.7, 46.6 | 100 |
| Kveikt (3 keyrslur) | 45.4, 45.4, 50.3 | 46.4, 47.1, 59.8 | 100 til 150 |

Athugið: `pinch-out@min` byrjar nú í 10% en ekki 20%, svo tölurnar eru ekki sambærilegar við plan 9.

| # | Atriði | Niðurstaða |
|---|---|---|
| 1 | `max-width` og `scale` breytast í hverjum ramma neðan við þröskuld (Important, staðfest með mælingu) | Lagað: lagfæring 1, sest zoom `--hg-zs` |
| 2 | Perf grunnlínan breytist | Skráð hér fyrir ofan |
| 3 | Vafri sem hafnar `calc` deilingu með `max()` | Hafnað: gilt samkvæmt css-values-4, staðfest í Chromium, iPhone er á athugunarlista Heimis |
| 4 | Val og aðild að kassa lesa óskalaðan titilkassa pakka | Hafnað sem kóðabreyting: Ctrl val er aðeins með mús og tekur titilinn þegar kassinn nær yfir neðri brún nafnsins. Skráð í CLAUDE.md |
| 5 | Gripsvæðið stækkar með nafninu | Engin breyting: í samræmi við það sem er teiknað. Skráð í CLAUDE.md |
| 6 | Athugasemd leggst yfir nafn á litlum kassa | Lagað: þak á stækkun athugasemdar og `--hg-zone-note-z` |
| 7 | Löng pakkanöfn fá úrfellingu í stað línuskila í 100% | Hafnað: ekkert pakkanafn nálgast breidd dálksins, fullt nafn er í `aria-label` og listanum, `title` myndi sýna tooltip á hverju hover |
| 8 | `z-index: 1` sem tala í reglu | Lagað: `--hg-pack-fold-z` |
| S1 | Skjámynd: athugasemdir kassa of stórar í fjarlægð og hálfar undir spjöldum | Lagað: `--hg-zone-note-far-max` |
| S2 | Skjámynd: pakkanöfn styttast ("Stórel…") af því þau eru köppuð við dálkbreidd | Lagað: kappið tekið af |

Lagfæringin snertir `src/vinnubord/hooks/useViewport.ts`, sem planið nefndi ekki, svo verkið fylgir fullu sniði héðan: Opus rýnir lagfæringuna og hver umferð er rýnd þar til rýni kemur hrein.

## Lagfæring 1

Allt verbatim. Engin önnur breyting.

### L1a. `src/vinnubord/hooks/useViewport.ts`

Í hausathugasemdinni verður setningin

```ts
// 120 ms after the last wheel step, at the end of a glide (animateTo), when a
// press stops a glide or fling, and on setView. Anything that needs the
// view every frame reads viewRef, not `view`.
```

að:

```ts
// 120 ms after the last wheel step, at the end of a glide (animateTo), when a
// press stops a glide or fling, and on setView. Anything that needs the
// view every frame reads viewRef, not `view`. sync() also writes the settled
// zoom --hg-zs on the world (settle), which CSS that may only follow the zoom
// at gesture end reads instead of --hg-z.
```

Fallið `sync` verður, með nýju `settle` á undan:

```ts
  // The settled zoom (--hg-zs) for CSS that follows the zoom at gesture end
  // only (the far labels in vinnubord.css). Never written per frame, so a
  // pinch, a wheel run or a glide costs no layout or paint for it.
  const settle = useCallback(() => {
    worldRef.current?.style.setProperty('--hg-zs', String(viewRef.current.z))
  }, [])

  const sync = useCallback(() => {
    settle()
    setViewState(viewRef.current)
  }, [settle])
```

Í `useLayoutEffect` sem setur sýnina á world sem mountast seinna verður línan `if (worldRef.current) apply(viewRef.current)` að:

```ts
    if (worldRef.current) {
      apply(viewRef.current)
      settle()
    }
```

`settle` er skilgreint á undan `sync`, og `sync` er þegar á undan þessu effecti, svo röðin gengur.

### L1b. `src/vinnubord/vinnubord.css`, tokens

Pack columns hópurinn, athugasemdin og tokenið frá verki 1 verða (og nýtt token á eftir):

```css
  /* Below this board zoom the pack name stops shrinking on screen: once the
     zoom settles (--hg-zs) it is scaled back up by this over the zoom, so 0.5
     keeps a 30 px name at 15 px. 0 turns it off. */
  --hg-pack-title-far: 0.5;
  /* The fold button sits above the pack name, which covers it when scaled up. */
  --hg-pack-fold-z: 1;
```

Kassar hópurinn, athugasemdin og tokenið frá verki 1 verða (og tvö ný token á eftir):

```css
  /* Below this board zoom the box name and note stop shrinking on screen: once
     the zoom settles (--hg-zs) they are scaled back up by this over the zoom.
     1 keeps the name at its own size at every zoom below 100%. 0 turns it off. */
  --hg-zone-far: 1;
  /* The note is scaled back up at most this many times (at least 1): 2.5 keeps
     it readable down to 40% and lets it shrink further out, where a full size
     note would slide under the cards. */
  --hg-zone-note-far-max: 2.5;
  /* The note sits under the name and the resize corner. */
  --hg-zone-note-z: -1;
```

### L1c. `src/vinnubord/vinnubord.css`, pakkatitill

Athugasemdin og reglan `.hg-pack-title-text` frá verki 1 verða:

```css
/* The name alone is scaled back up when the board is zoomed far out
   (--hg-pack-title-far), from its bottom left corner: it grows upwards and to
   the right over the hairline and never pushes the modules. The button keeps
   its box, so the selection ring and the boxes Board measures stay the same.
   It reads the settled zoom, so it scales with the board during a gesture and
   settles when the gesture ends. */
.hg-pack-title-text {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transform-origin: left bottom; scale: max(1, calc(var(--hg-pack-title-far) / var(--hg-zs, var(--hg-z, 1))));
  transition: scale var(--hg-dur-view) var(--hg-ease);
}
```

Í reglunni `.hg-pack-fold` verður `position: relative; z-index: 1;` að:

```css
  position: relative; z-index: var(--hg-pack-fold-z);
```

### L1d. `src/vinnubord/vinnubord.css`, kassar

Í reglunni `.hg-zone` verða athugasemdin og `--hg-far-k` línan frá verki 1 að:

```css
  /* How much the name and the note are scaled back up when the board is zoomed
     far out (--hg-zone-far), read from the settled zoom so a gesture costs
     nothing. Their width caps shrink by the same factor, so a scaled label
     still ends inside the box. */
  --hg-far-k: max(1, calc(var(--hg-zone-far) / var(--hg-zs, var(--hg-z, 1))));
  --hg-far-note-k: min(var(--hg-far-k), var(--hg-zone-note-far-max));
```

Í reglunni `.hg-zone-title` verður síðasta línan (`transform-origin: left center; scale: var(--hg-far-k);`) að:

```css
  transform-origin: left center; scale: var(--hg-far-k); transition: scale var(--hg-dur-view) var(--hg-ease);
```

Reglan `.hg-zone-note` verður:

```css
.hg-zone-note {
  position: absolute; left: var(--hg-zone-title-inset); bottom: var(--hg-zone-note-inset); max-width: calc(var(--hg-zone-note-max-w) / var(--hg-far-note-k));
  z-index: var(--hg-zone-note-z);
  font-size: var(--hg-zone-note-size); color: var(--hg-ink-2); line-height: 1.35; overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; pointer-events: none;
  transform-origin: left bottom; scale: var(--hg-far-note-k); transition: scale var(--hg-dur-view) var(--hg-ease);
}
```

### L1e. CLAUDE.md

Málsgreinin "Far labels (2026-11-11): ..." í Design System verður í heild:

```
Far labels (2026-11-11): three labels stop shrinking on screen below a zoom threshold, each by `scale: max(1, far / zoom)` in CSS only (no layout change, so the offset boxes that selection and box membership read stay the unscaled ones: a marquee or a box takes a pack by its unscaled title box, while the press area of a name is the scaled one). The zoom they read is `--hg-zs`, the settled zoom that `useViewport` writes on `.hg-world` in `sync()` and when the world mounts, never per frame: during a pinch, a wheel run or a glide the labels scale with the board and settle over `--hg-dur-view` when it ends, so a gesture costs no layout or paint for them (reading `--hg-z` per frame raised the emulated pinch gap mean from about 43 to about 50 ms). `--hg-zone-far` (1) covers the box name (`.hg-zone-title`, scaled from its left centre) and note (`.hg-zone-note`, from its bottom left, at most `--hg-zone-note-far-max` (2.5) times, so a note is readable down to 40% and shrinks further out; `--hg-zone-note-z` keeps it under the name and the corner). `.hg-zone` sets the factors as `--hg-far-k` and `--hg-far-note-k` and each label divides its `max-width` by its own, so a scaled label still ends inside its box with an ellipsis. `--hg-pack-title-far` (0.5) covers the pack name, which is its own span (`.hg-pack-title-text`, scaled from its bottom left so it grows upwards and never pushes the modules, one line with an ellipsis, no width cap of its own, so a scaled name may run past its column); the title button keeps its box and `.hg-pack-fold` sits above the scaled name (`--hg-pack-fold-z`). Setting a far token to 0 turns the effect off. `MIN_ZOOM` in `lib/geometry.ts` is 0.1.
```

Í Key Patterns, Gesture contract, á eftir setningunni sem endar á "a press that stops motion, `setView`)." kemur ný setning:

```
`sync` also writes the settled zoom `--hg-zs` on the world layer (so does a world that mounts later), which the far labels read instead of `--hg-z`.
```

### Sannreyning útfæranda

`npm run test` (641 próf, öll græn) og `npm run build` grænt. Ekkert annað þarf útfærandi að athuga. Stjórnandi tekur skjámynd og mælir pinch aftur.

Commit: `fix(vinnubord): far labels follow the settled zoom, note cap, full pack names` (kóði) og `docs(vinnubord): far labels read the settled zoom` (CLAUDE.md).

### Rýni 2 (Opus á c07c66a, og skjámynd og mæling stjórnanda)

Skjámynd (tabletLand, 10% og 14%): pakkanöfn heil, kassanöfn læsileg, athugasemdir litlar neðst í kössum. Mæling eftir lagfæringu 1 (2 keyrslur, Opus rýni í gangi á vélinni á meðan): pinch-out@min gap mean 50.1 og 45.9, pinch-in 46.4 og 46.6, p90 100 til 117. Tölurnar þrjár (slökkt, kveikt, lagað) liggja innan suðs hermisins, svo mælingin ein sker ekki úr. Rökin fyrir lagfæringu 1 eru í kóðanum: miðarnir lesa ekki lengur gildi sem breytist í hverjum ramma.

| # | Atriði | Niðurstaða |
|---|---|---|
| 1 | Miðar vaxa inn á 220 ms við fyrstu opnun: `Board` les stærðir (style flush með `--hg-zs` 1) áður en fyrsta sýnin sest (Important, staðfest í kóða) | Lagað: lagfæring 2, `--hg-zs-live` |
| 2 | Miðar blása út þegar zoomað er inn úr fjarlægð, því sest zoom helst alla hreyfinguna (Important) | Lagað: lagfæring 2, `SETTLE_DRIFT` |
| 3 | `max-width` breytist strax en `scale` á 220 ms | Hafnað: transition á `max-width` setur layout aftur í ramma hreyfingarinnar, misræmið varir eitt skref. Skráð í CLAUDE.md |
| 4 | Pakkanöfn án kapps geta náð yfir næsta dálk í fjarlægð | Hafnað: ákvörðun S2, heil nöfn ganga fyrir. Skráð í CLAUDE.md |
| 5 | Týnt pointerup skilur miða eftir í gamalli stærð | Hafnað: eldri veila í bendlameðferð, sama á við um `active`, næsta ýting endurstillir |
| 6 | Athugasemd í `.hg-zone` segir "a gesture costs nothing" | Lagað í lagfæringu 2 |

## Lagfæring 2

Allt verbatim. Engin önnur breyting.

### L2a. `src/vinnubord/hooks/useViewport.ts`

Í hausathugasemdinni verður setningin

```ts
// view every frame reads viewRef, not `view`. sync() also writes the settled
// zoom --hg-zs on the world (settle), which CSS that may only follow the zoom
// at gesture end reads instead of --hg-z.
```

að:

```ts
// view every frame reads viewRef, not `view`. sync() also writes the settled
// zoom --hg-zs on the world (settle), and apply() does once the zoom has
// drifted SETTLE_DRIFT times from it. CSS that must not follow the zoom every
// frame reads it instead of --hg-z.
```

Á eftir línunni `const BUTTON_STEP = 1.25` kemur:

```ts
// The far labels settle in the middle of a gesture once the zoom has drifted
// this many times from the settled one, so a long zoom in does not leave them
// many times too big until the gesture ends.
const SETTLE_DRIFT = 1.5
```

Blokkin frá `const apply = useCallback((v: View) => {` til og með loka `sync` (`}, [settle])`) verður í heild (`settle` fer á undan `apply`, `apply` fær eina nýja línu og `[settle]`, `sync` fær `live`):

```ts
  // The settled zoom (--hg-zs) for CSS that must not follow the zoom every
  // frame (the far labels in vinnubord.css): written at gesture end by sync()
  // and, in the middle of a gesture, each time the zoom has drifted
  // SETTLE_DRIFT times from the last settled one (apply). A pinch, a wheel run
  // or a glide then costs a handful of label updates, not one per frame.
  const settledZ = useRef(START.z)
  const settle = useCallback(() => {
    settledZ.current = viewRef.current.z
    worldRef.current?.style.setProperty('--hg-zs', String(viewRef.current.z))
  }, [])

  const apply = useCallback((v: View) => {
    viewRef.current = v
    const world = worldRef.current
    if (world) {
      world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`
      world.style.setProperty('--hg-z', String(v.z))
    }
    if (v.z > settledZ.current * SETTLE_DRIFT || v.z < settledZ.current / SETTLE_DRIFT) settle()
    // Writes React's own text node, so a later render updates the node on
    // screen. textContent would swap in a new node and leave React writing to
    // a detached one; it is only the fallback when there is no text node.
    const label = zoomLabelRef.current
    if (label) {
      const text = `${Math.round(v.z * 100)}%`
      const node = label.firstChild
      if (node && node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue !== text) node.nodeValue = text
      } else if (label.textContent !== text) label.textContent = text
    }
  }, [settle])

  // Whether the far labels may animate to a new settled zoom: --hg-zs-live
  // turns their scale transition on. It stays off until the first synced view
  // has been styled, so the labels do not grow in when the board opens.
  const live = useRef(false)
  const sync = useCallback(() => {
    settle()
    const world = worldRef.current
    if (world && !live.current) {
      live.current = true
      // Style the first settled zoom while the transition is still off.
      void world.offsetWidth
      world.style.setProperty('--hg-zs-live', '1')
    }
    setViewState(viewRef.current)
  }, [settle])
```

Í `useLayoutEffect` sem setur sýnina á world sem mountast seinna verður blokkin

```ts
    if (worldRef.current) {
      apply(viewRef.current)
      settle()
    }
```

að:

```ts
    if (worldRef.current) {
      apply(viewRef.current)
      settle()
      if (live.current) worldRef.current.style.setProperty('--hg-zs-live', '1')
    }
```

### L2b. `src/vinnubord/vinnubord.css`

Í þremur reglum (`.hg-pack-title-text`, `.hg-zone-title`, `.hg-zone-note`) verður `transition: scale var(--hg-dur-view) var(--hg-ease);` að:

```css
transition: scale calc(var(--hg-dur-view) * var(--hg-zs-live, 0)) var(--hg-ease);
```

Athugasemdin á undan `.hg-pack-title-text` verður:

```css
/* The name alone is scaled back up when the board is zoomed far out
   (--hg-pack-title-far), from its bottom left corner: it grows upwards and to
   the right over the hairline and never pushes the modules. The button keeps
   its box, so the selection ring and the boxes Board measures stay the same.
   It reads the settled zoom (--hg-zs), so during a gesture it scales with the
   board and catches up in a few steps, and it settles when the gesture ends.
   The transition is off (--hg-zs-live) until the first view is drawn. */
```

Athugasemdin í `.hg-zone` verður:

```css
  /* How much the name and the note are scaled back up when the board is zoomed
     far out (--hg-zone-far), read from the settled zoom (--hg-zs), which
     changes a few times in a gesture and not every frame. Their width caps
     shrink by the same factor, so a scaled label still ends inside the box. */
```

### L2c. CLAUDE.md

Í málsgreininni "Far labels (2026-11-11): ..." verður setningin sem byrjar á "The zoom they read is `--hg-zs`" og endar á "about 50 ms)." að:

```
The zoom they read is `--hg-zs`, the settled zoom that `useViewport` writes on `.hg-world` in `sync()`, when the world mounts, and in the middle of a gesture each time the zoom has drifted `SETTLE_DRIFT` (1.5) times from it, never per frame: during a pinch, a wheel run or a glide the labels scale with the board, catch up in a few steps and settle when it ends, each step over `--hg-dur-view` (reading `--hg-z` instead would change `max-width` and `scale` on every label in every zoom frame). The transition is gated by `--hg-zs-live`, which `sync()` sets after the first synced view has been styled, so the labels do not grow in when the board opens; `max-width` is not transitioned, so a label can sit a little wide or short for the length of one step.
```

Í Key Patterns, Gesture contract, verður setningin sem byrjar á "`sync` also writes the settled zoom" að:

```
`sync` also writes the settled zoom `--hg-zs` on the world layer (so do a world that mounts later and `apply` once the zoom has drifted `SETTLE_DRIFT` times from it), which the far labels read instead of `--hg-z`.
```

### Sannreyning útfæranda

`npm run test` (641 próf, öll græn) og `npm run build` grænt. Ekkert annað þarf útfærandi að athuga.

Commit: `fix(vinnubord): far labels catch up mid gesture, no grow in on load` (kóði) og `docs(vinnubord): settled zoom drift and the live gate` (CLAUDE.md).

### Rýni 3 (Opus á 4d00b6e og 160c4b9, lokarýni Fable á heildardiffinu)

Ekkert Critical eða Important. Báðar lækningar staðfestar í kóða: fyrsta opnun á báðum slóðum (`startAtPack` og `fitAll(false)`), endurmount, StrictMode, hook dependencies, og `offsetWidth` lifir í bundlinum. Skjámyndir (tabletLand): opnun í 80% óbreytt, 13% og 10% með heilum pakkanöfnum og læsilegum kassanöfnum.

Mæling á rólegri vél, sama build, pinch gap mean, tvær keyrslur hvor: far tokenin 0 gefa 49.1 og 49.7 (út), 47.6 og 47.0 (inn); lagfæring 2 gefur 47.8 og 45.6 (út), 51.1 og 49.4 (inn); p90 100 til 117 í báðum. Enginn mælanlegur munur.

| # | Atriði | Niðurstaða |
|---|---|---|
| 1 | `SETTLE_DRIFT` 1.5 gefur sagtannarhreyfingu í hægu pinch (Minor, ekki séð í vafra) | Óbreytt: stilling á tilfinningu, á athugunarlista Heimis. 1.25 er næsta gildi að prófa |
| 2 | `max-width` stekkur meðan `scale` líður | Þegar skráð í CLAUDE.md |
| 3 | Gamalt Safari gæti hafnað `calc()` í transition tíma (Minor, grunur) | Óbreytt: þá stökkva miðarnir í stað þess að líða, ekkert brotnar. Á athugunarlista Heimis |
| 4 | Token athugasemdir segja "once the zoom settles" | Hafnað: rétt eins og það stendur |

### Heimir athugar

1. Tölva, huginn.pro/p/metta: zooma út í 10% með hjóli og tökkum. Nöfn kassa og pakka læsileg, athugasemdir kassa læsilegar niður í um 40%.
2. Zooma hratt inn úr 10% í 100%: nöfnin fylgja í nokkrum skrefum og enda í réttri stærð. Ef skrefin trufla er `SETTLE_DRIFT` í `useViewport.ts` stillingin (1.25 gefur fleiri og minni skref).
3. iPhone og iPad: pinch út og inn. Nöfnin stækka þegar zoomað er út (staðfestir að Safari taki `calc` reglurnar) og pinch er jafn lipurt og áður.
4. Stærðirnar eru token efst í `vinnubord.css`: `--hg-zone-far`, `--hg-zone-note-far-max`, `--hg-pack-title-far`.
