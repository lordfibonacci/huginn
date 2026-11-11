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
