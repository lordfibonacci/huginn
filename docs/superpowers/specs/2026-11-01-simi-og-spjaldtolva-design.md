# Huginn: sími og spjaldtölva (hönnunarskjal)

Dagsetning: 2026-11-01
Staða: samþykkt af Heimi í samtali 1. nóv eftir úttekt Claude (Fable).
Grunnur: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (borðið, bendingar, spjaldið). Þetta skjal breytir hegðun og útliti borðsins á snertitækjum og þröngum skjám. Engin ný tafla, engin migration, CLI óbreytt.

## 1. Tilgangur

Heimir notar huginn.pro í símanum og á iPad og það er glitch og hökt: allt illa skalað við opnun, pinch virkar illa þegar mörg kort eru, síurnar kramdar í efri stikunni, spjaldið opnast í hálfum skjá, og flökt þegar zoomað er alveg út. Hann vill sama tafl (zoom, pan, kort á striga), ekki annað snið fyrir síma, en það á að vera „mun meira native".

Úttekt 1. nóv (innskráð skjáskot og mæling í símahermi, 390 px, 4x hægari örgjörvi, 70 kort og 28 módúlar) fann orsakirnar:

1. **Opnun.** `fitAll` fittar allt borðið (um 3800 x 2300 heimseiningar) í 390 px: zoom 8%. Á iPad 19 til 24%. Ekkert læsilegt.
2. **Efri stikan.** Undir 768 px fá teljarapillurnar 142 px við hliðina á Pakki, Tögg og Sýn hnöppunum. Á iPad í portrait (810 px) er stikan ein röð og pillurnar fá 86 px.
3. **Pinch.** 46 ms á ramma að meðaltali (um 20 fps), p90 83 ms. Þrennt: hver fingurhreyfing fer gegnum React state og endurteiknar allt borðið (`setView` á hverjum pointermove); canvasinn teiknar alla 70 vírana með `shadowBlur` í hverjum ramma; hvert kort og hver módúll er með `backdrop-filter` sem er eigið samsetningarlag og er endurrastað við hvert zoom skref. Kyrrt borð keyrir á 30 ms römmum af því neistar halda canvasnum vakandi.
4. **Flökt alveg útzoomað.** Þar eru allir 70 vírarnir og öll 98 blur lögin á skjánum í einu, svo hvert skref endurrastar allt.
5. **Spjaldið** opnast í 45% hæð, aðeins handfangið dregur það, og hæðin er `transition: height` sem endurreiknar allt innihaldið í hverjum ramma.
6. **Pan dautt svæði.** `useViewport` hunsar bendingar sem byrja á `button`, og módúlkort eru `<button>`. Fingur sem lendir á módúl panar ekki, og pinch með öðrum fingri á módúl verður pan með einum fingri.

Mælingarnar í 4x hermi: pinch alveg útzoomað 46 ms meðal, pan 19 ms, kyrrt 30 ms. Án shadowBlur: 37, 18, 22. Án backdrop-filter líka: 37, 19, 22. Afgangurinn er React endurteiknun og canvasinn sjálfur.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Pinch og pan á símanum á fullum hraða: viewið skrifast beint á DOM meðan bending stendur, React fær lokastöðuna.
- Kyrrt borð kostar ekkert: canvasinn hvílir þegar ekkert hreyfist.
- Opnun í síma og á iPad sýnir læsilegt borð: fyrsta pakkann efst til vinstri í zoom 0,8.
- Efri stikan undir 1024 px: pillurnar í fullri breidd, síurnar á einum hnappi sem opnar neðra spjald.
- Spjaldið opnast í fullri hæð, er dregið frá handfangi, haus eða efninu þegar það er skrunað efst, og hreyfist með transform.
- Fingur sem lendir á módúl, pakkatitli eða korti panar og pinchar eins og á auðu borði.
- Skrið (inertia) þegar pan er sleppt, tvísmellur zoomar inn, smellur á pakkatitil fittar dálkinn.
- Native hluti: safe area, theme-color sem passar borðinu, ekkert pull to refresh eða gúmmíband, standalone PWA á iOS.
- Skjáborð með mús lítur eins út og hegðar sér eins og áður, nema zoom, fit og pakkatitill líða nú (stutt hreyfing) í stað þess að hoppa.

**Ekki-markmið**

- Annað snið fyrir síma (listi, dálkar). Heimir valdi sama tafl (1. nóv).
- Breytingar á gögnum, triggerum eða CLI. Stærðartáknin sem CLI afritar (`--hg-pack-*`, `--hg-module-*`, `--hg-card-*` stærðir) breytast ekki, svo `parity.test.mjs` stendur óbreytt.
- Að endurhanna útlit spjaldsins eða kortanna. Sama útlit, aðeins ódýrara að teikna á snertitækjum.
- Snúningur (rotate) í pinch.

**And-markmið**

- Að skjáborðið versni. Allar sparnaðarreglur á útliti eru undir `@media (pointer: coarse)` og skjáborð með mús sér engan mun.
- Að bending endi í röngu ástandi: fastur pinch, kort sem hangir lyft, spjald sem festist milli stoppa. Hver bending á skýran endi.
- Að rjúfa samninginn milli `useViewport` og `useCardDrag` (hausarnir í báðum skrám). Hann helst, reglan um snertingu á hnöppum bætist við hann.

## 3. Skorður

- Ekkert nýtt UI safn. Hreyfingar eru rAF og CSS transitions eins og í dag.
- Tákn: öll ný gildi eru `--hg-*` tákn á `:root` í `src/vinnubord/vinnubord.css`, sparnaðargildin í `@media (pointer: coarse)` blokk beint á eftir `prefers-reduced-motion` blokkinni efst. Brotpunktar eru bókstaflegir í media queries (767 px fyrir spjaldið, 1023 px fyrir stikuna) eins og þeir sem eru fyrir.
- Hrein rökfræði í `src/vinnubord/lib/` með vitest skrá: skrið, breiddarfit, tvísmellsregla, hvenær snerting panar.
- Engin þankastrik og engin bandstrik sem greinarmerki, ekki í UI texta, athugasemdum eða þessu skjali.
- Nýir UI strengir fara í `en.json` undir `vinnubord.*`, `npm run translate`, og `is.json` diff skoðað (sjá CLAUDE.md um cache).
- Byggingarlotan getur ekki alltaf skráð sig inn í vafra sem þjónustunotandinn (heimildaflokkarinn stoppar það). Þess vegna fær repoið skriftu sem skráir sig inn sjálf úr `.env` og tekur skjáskot og mælingar (4.9), og lotan sannreynir með henni.

## 4. Hönnun

### 4.1 Viewið lifir í ref, React fær lokastöðuna

`useViewport` breytist svona:

- `viewRef: RefObject<View>` er sannleikurinn meðan bending stendur. `worldRef: RefObject<HTMLElement | null>` er heimslagið; `apply()` skrifar `transform: translate(x px, y px) scale(z)` og `--hg-z` beint á það. Board setur `ref={vp.worldRef}` á `.hg-world` og hættir að skrifa transform í `style` props.
- React state `view` (áfram í skilunum) er samstillt við `viewRef` með `sync()` aðeins í lok hverrar bendingar: síðasti fingur upp, skrið búið, hjólzoom þagnað í 120 ms, zoom hnappur, fit, hreyfing búin. Meðan bending stendur endurteiknar React ekkert. Prósentan í zoom hnöppunum er skrifuð beint í `textContent` á `.hg-zoom-val` úr `apply()` (Board gefur `useViewport` `zoomLabelRef`), svo hún fylgist með án endurteiknunar. Allt sem þarf viewið í hverjum ramma les `viewRef`:
  - `useCardDrag` fær `viewRef` í stað `view` (les `viewRef.current.z`).
  - `Wires` fær `viewRef` og ber saman `x`, `y`, `z` tölurnar við síðast teiknuðu til að ákveða `changed`, ekki hlutvísun.
  - `placeNew` í Board les `viewRef.current`.
- `setView` úr skilunum skrifar bæði ref og state (það er leiðin fyrir fit og hnappa).

Hreyfing milli viewa: `animateTo(target: View, ms)` í `useViewport` keyrir eigin rAF, ease-out cubic (sama fall og `drawUpProgress`), skrifar gegnum `apply()` og kallar `sync()` í lokin. Zoom hnappar, fit, pakkatitill og tvísmellur nota hana með `--hg-dur-view` (220 ms, 0 undir reduced motion, lesið með `parseDuration` eins og `popMs`). Pointerdown stöðvar hreyfingu sem er í gangi (viewið stendur þar sem það var komið).

### 4.2 Snerting á hnöppum inni í heiminum panar

Í `useViewport.onPointerDown`: fyrir `pointerType === 'touch'` gildir `NO_PAN` aðeins um `[data-no-pan], input, textarea, select`. Hnappar, tenglar og `label` inni í borðinu (módúlkort, pakkatitill) eru raktir eins og kort: `canPan` satt, þeir pana þegar fingurinn fer yfir `CARD_PAN_SLOP` (10 px, sama slop og kort, svo tap sem hreyfist 3 til 8 px opnar módúlinn samt) og mynda pinch með öðrum fingri. Smellurinn sem fylgir pani sem hreyfðist er þegar gleyptur af `onNativeClick` (capture), svo módúll opnast ekki eftir pan. Mús og penni: óbreytt (hnappar hunsaðir, kort í `useCardDrag`).

Hrein regla í `lib/gesture.ts`: `type TouchKind = 'field' | 'noPan' | 'button' | 'card' | 'board'`, `touchTracks(kind: TouchKind): boolean` (`field` og `noPan` ósatt, hitt satt) og `touchSlop(kind: TouchKind): number` (`card` og `button` gefa `CARD_PAN_SLOP`, `board` gefur `PAN_THRESHOLD`), prófuð. `onPointerDown` kortleggur `target.closest(...)` yfir á `kind` (reitur, `[data-no-pan]`, `[data-card]`, `button, a, label`, annars `board`), og `panStep` fær `slop` í stað `fromCard`.

Hausinn í `useViewport` fær nýja línu undir Rules: touch á `button`, `a`, `label` inni í borðinu panar og pinchar, aðeins reitir og `[data-no-pan]` eru hunsaðir.

### 4.3 Skrið, tvísmellur, pakkatitill

**Skrið.** `lib/fling.ts`, hreint:

- `releaseVelocity(samples: { t: number; x: number; y: number }[]): { vx: number; vy: number }` í px/ms úr síðustu sýnum innan `FLING_WINDOW_MS` (80) fyrir sleppingu; færri en tvö sýni eða sleppt meira en 80 ms eftir síðustu hreyfingu gefur 0.
- `flingStep(v: { vx: number; vy: number }, dt: number): { dx: number; dy: number; vx: number; vy: number }` með `FLING_DECAY` 0,95 á 16 ms (`decay ** (dt / 16)`), `dt` klemmt við 32.
- `flingDone(v)` þegar hraðinn er undir `FLING_STOP` 0,02 px/ms. Skrið byrjar aðeins ef sleppihraðinn er yfir `FLING_START` 0,2 px/ms.

`useViewport` safnar sýnum í pani eins fingurs (aðeins touch), og við sleppingu með hraða yfir `FLING_START` keyrir það skrið í rAF sem skrifar gegnum `apply()` og kallar `sync()` þegar það stöðvast. Pointerdown stöðvar skriðið. Pinch og mús fá ekki skrið. `isPanning` helst satt meðan skrið stendur (kortin peek-a ekki, bendillinn skiptir ekki máli á snertitæki).

**Tvísmellur.** `lib/gesture.ts`: `isDoubleTap(prev: { t: number; x: number; y: number } | null, next: { t: number; x: number; y: number }): boolean` satt innan `DOUBLE_TAP_MS` 300 og `DOUBLE_TAP_SLOP` 24 px. `useViewport` man síðasta touch tap (fingur upp án þess að bendingin hreyfðist, án pinch) af kind `board` (autt borð eða bakgrunnur pakkadálks); tvísmellur kallar `animateTo(zoomAt(view, DOUBLE_TAP_FACTOR 2, x, y))`. Tap sem byrjar á korti, módúl eða pakkatitli telur ekki (kortið og módúllinn opnast á fyrsta tapinu, titillinn fittar), og tap sem stöðvar skrið eða hreyfingu telur ekki heldur. Mús: ekkert (hjólið er fyrir mús).

**Pakkatitill.** `.hg-pack-title` verður `<button type="button">` með sama útliti (font, lit, línan á eftir), `min-height: var(--hg-touch)`. Smellur kallar `onFitPack(pkgId)` sem Board tengir við `fitWidth` á `[data-pack]` rect dálksins (`offsetLeft`, `offsetTop`, `offsetWidth`, `offsetHeight` í heimseiningum) með `DEFAULT_PADDING` og `FIT_MAX_ZOOM`. Í `lib/geometry.ts`: `fitWidth(rect, viewport, padding, maxZoom): View` með `z = min(maxZoom, W / rect.w)`, `x` miðjað eins og í `fitAll`, `y = padding.top - rect.y * z` (efst, ekki miðjað). Prófað. Smellur sem fylgir pani er gleyptur eins og aðrir.

### 4.4 Opnunarsýn

Board fittar einu sinni eftir hleðslu. Nýja reglan:

- Borðelement mjórra en `START_PACK_MAX_W` 1024 px, eða bendillinn grófur (`pointer: coarse`, nær iPad í landscape þar sem fit er 24%): viewið er `startAtPack(pack, z = START_ZOOM 0.8, pad = START_PAD 16)` með fyrsta pakkann (fyrsta röðin úr `packLayout`) efst til vinstri: `x = pad - pack.pos_x * z`, `y = pad - pack.pos_y * z`. Hreint fall í `lib/geometry.ts`, prófað.
- Annars `fitAll` eins og nú.

Fit hnappurinn er áfram yfirlitið (`fitAll`), núna með hreyfingu. Ekkert endurfit við brotpunkt: `PHONE_QUERY` hlustarinn í Board fer, viewið helst þar sem það var þegar síma eða spjaldtölvu er snúið eða gluggi breytir um breidd.

### 4.5 Canvasinn á snertitækjum

`Wires` les `coarse = matchMedia('(pointer: coarse)').matches` í effectinum (og hlustar á `change`). Þegar `coarse`:

- `shadowBlur` er aldrei settur (vírar og neistar). Glóðin er áfram breiða hálfgegnsæja strokan.
- `MAX_DPR` er `MAX_DPR_COARSE` 1,5 í stað 2.
- Sjálfkrafa neistar (`chanceCalm`, `chanceActive`) fæðast aðeins á heitum vírum (`hotIds`: valið eða dregið kort). Skot (`burst`: innkoma, slepping) keyra áfram. Þá er `sparks === 0` á kyrru borði og `canvasIdle` lætur canvasinn hvíla.
- Meðan bending stendur á borðinu (nýtt `gestureRef.current.active`, satt frá fyrsta fingri sem hreyfir viewið þar til skrið er búið) er glóðarstrokunni sleppt og aðeins kjarnalínan teiknuð; þegar bendingin endar teiknast einn rammi með glóð. Mús: ekkert af þessu.

Fasti í `WIRE`: `coarse: { dpr: 1.5 }`. `canvasIdle` óbreytt.

### 4.6 Kort, módúlar og spjald á snertitækjum: tákn

Í `vinnubord.css`, ný blokk beint á eftir `prefers-reduced-motion` blokkinni:

```css
/* Touch devices: no backdrop blur (every blurred element is its own
   compositing layer and is re-rastered at each zoom step) and lighter
   shadows. Surfaces go nearly opaque so the wires do not show through
   unblurred. Mouse desktops keep the look above. */
@media (pointer: coarse) {
  :root {
    --hg-blur-card: none;
    --hg-module-blur: none;
    --hg-blur-control: none;
    --hg-panel-blur: none;
    --hg-card-bg: linear-gradient(180deg, #1d2838, #161e2b);
    --hg-module-bg: rgba(22, 30, 43, 0.96);
    --hg-module-bg-hover: rgba(29, 40, 56, 0.98);
    --hg-panel-bg: rgba(22, 30, 43, 0.98);
    --hg-menu-bg: rgba(22, 30, 43, 0.99);
    --hg-control-bg: rgba(22, 30, 43, 0.96);
    --hg-card-shadow: 0 12px 24px -16px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.04);
    --hg-card-lift-shadow: 0 16px 32px -16px;
    --hg-module-hot-lift: 0 10px 24px -16px;
    --hg-panel-shadow: 0 16px 40px -24px rgba(0, 0, 0, 0.9);
  }
}
```

`.hg-mod`, `.hg-card`, `.hg-panel`, `.hg-menu`, `.hg-zoom` og `.hg-toast` lesa þessi tákn nú þegar, svo reglurnar sjálfar breytast ekki. Aurora óbreytt (hún er þrjú lög sem hreyfast á compositor).

### 4.7 Efri stikan undir 1024 px

Brotpunktur tveggja raða stikunnar færist úr 767 í 1023 px (nær þá iPad í portrait). Reglurnar í `@media (max-width: 767px)` blokk stikunnar flytjast í `@media (max-width: 1023px)`; 1279 og 1099 reglurnar standa.

Röð 1 óbreytt: merki, verkefni | live punktur, leitarhnappur, **síuhnappur**, þátttakandi, nýtt verk. Röð 2: `.hg-counts` ein í fullri breidd (`grid-area: f` yfir báða dálka, `grid-template-areas: "a b" "f f" "s s"`), skrunar til hliðar, pillurnar með `--hg-count-pad-phone`. Leitin opnast áfram sem röð 3.

**Síuhnappur** `.hg-icon-btn.hg-filter-btn` (sliders tákn, inline SVG: þrjár láréttar línur með hnappi hver, 16 x 16), `aria-label` `vinnubord.top.filters` („Síur"), `em` merki með tölu þegar eitthvað er valið: fjöldi valinna pakka + taga + 1 ef sýn er virk (ekki tónar, ekki ólesið, ekki leit, þau sjást á pillunum og í leitinni). Lýsir (`hg-on`) þegar talan er yfir 0. Sýnilegur aðeins undir 1024 px; `.hg-top-g` (Pakki, Tögg, Sýn, Hreinsa) er `display: none` þar.

**Síuspjaldið** `FilterSheet.tsx`: neðra spjald í sama ramma og nýtt verk (`.hg-sheet-wrap` + `.hg-sheet-backdrop` + nýtt `.hg-filter-sheet` sem fær sömu reglur og `.hg-new-sheet` gegnum sameiginlegan klasa `.hg-modal-sheet`; `.hg-new-sheet` heldur nafninu og fær `.hg-modal-sheet` við hlið sér). Haus „Síur" með „Hreinsa" hnappi (`hg-btn hg-btn-ghost`, aðeins þegar talan á síuhnappnum er yfir 0; hann hreinsar það sem talan telur: valda pakka og tögg með nýju `filterApi.clearPicks()` (`withoutPicks(f)` í `lib/filters.ts`, tæmir `packages` og `tags`, heldur `tones`, `unread` og `q`, prófað) og velur Aðalborð með `onChoose(null)`), efni sem skrunar með þremur hlutum í þessari röð, hver með `.hg-view-group` fyrirsögn og `.hg-view-chips` flögum:

1. **Sýn**: `ViewMenu` í `inline` ham (sjá neðan): Aðalborð og sýnirnar, Ný sýn, Breyta sýn, Eyða sýn, villa og ábending, eða ritillinn.
2. **Pakki**: `FilterMenu` í `inline` ham.
3. **Tögg**: `FilterMenu` í `inline` ham.

Fótur með „Loka" (`hg-btn hg-btn-primary`, fullri breidd eins og nýtt verk á síma). Bakgrunnssmellur og Esc loka. Spjaldið notar `z-index: var(--hg-new-z)` eins og nýtt verk og lokast ekki við val, svo hægt er að velja fleiri.

`FilterMenu` og `ViewMenu` fá prop `inline?: boolean`. Inline: enginn hnappur, engin `hg-dd`/`hg-menu` umgjörð, aðeins innihaldið (flögurnar, fyrir ViewMenu listinn eða ritillinn) í `div.hg-view-chips` með `role="group"` og `aria-label`. Rökfræðin (toggle, choose, remove, editor) er sú sama og ritillinn er sami íhlutur; ekkert afritað. Inline `ViewMenu` kallar ekki `useDismiss`.

TopBar ákveður með `useMediaQuery('(max-width: 1023px)')`. Nýr hook `src/shared/hooks/useMediaQuery.ts` (matchMedia + change listener, SSR öruggur), og `useIsMobile` verður `useMediaQuery('(max-width: 767px)')` svo PanelShell og Board eru sammála um sama brotpunkt.

### 4.8 Spjaldið (bottom sheet) undir 768 px

- Opnast í `full`. Stoppin eru áfram `full`, `half`, `closed` (`lib/sheet.ts` óbreytt nema `OPEN_STOP = 'full'` flutt þangað og prófað).
- Hæð spjaldsins er föst, `calc(100dvh - var(--hg-sheet-top))`, og staðan er `transform: translateY(calc(var(--hg-sheet-offset) * 1px))` þar sem `--hg-sheet-offset` er `sheetFraction(stop) * max` í px (skrifað í `style` af PanelShell, `max` úr `sheetMax()`). Lokað: offset = max og `visibility: hidden` eftir `--hg-dur-panel` eins og nú. Transition er á `transform`, ekki `height`; `.hg-panel-dragging` slekkur hana. `--hg-sheet-open` fer.
- Dregið frá þremur flötum, allt í PanelShell:
  1. Handfangið: pointer handlers eins og nú (mús og snerting, `touch-action: none`).
  2. Hausinn `.hg-pn-head`: sömu pointer handlers, `touch-action: none` á `.hg-panel-sheet .hg-pn-head`. Tap á haus (undir `TAP_SLOP_PX`) gerir ekkert (handfangið heldur full/half skiptingunni).
  3. Efnið `.hg-pn-body`: native `touchstart`, `touchmove` (non passive) og `touchend`/`touchcancel` hlustarar á `aside` elementinu, skráðir í effect þegar `narrow && open`. `touchstart` man `startY` og hvort `body.scrollTop <= 0`. Fyrsta `touchmove` sem fer yfir 6 px ákveður: byrjaði efst og `dy > 0` og `|dy| > |dx|` þýðir spjaldsdrag (frá og með því `preventDefault` á hverju `touchmove`, offset fylgir fingrinum, hraði mældur eins og í handfangsdraginu); annars skrun og hlustarinn gerir ekkert meira í þessari snertingu. `touchend` sleppir með `snapSheet` eins og handfangið. Snertingar sem byrja í handfangi, haus eða reit (`input, textarea, select`) eru hunsaðar af þessum hlustara.
- `snapSheet` reglur óbreyttar: næsta stopp við hæga sleppingu, flikk færir eitt stopp. Lokað er `onClose` eins og nú.
- `half` er gluggi: spjaldið er í fullri hæð og neðri 45% þess eru undir skjábrún, svo haus, flipar og byrjun efnisins sjást en athugasemdareiturinn ekki. Hann næst í fullri hæð. Engin hæðarbreyting á innihaldinu við stopp.
- Ekkert bakgrunnslag. Röndin efst sýnir borðið, og tap þar fer í borðið og afvelur (lokar) eins og nú.
- Spjaldið er fast í hæð, svo skrun innihaldsins (`.hg-pn-body`, `overscroll-behavior: contain`) og athugasemdareiturinn virka eins og nú. Lyklaborð: `interactive-widget=resizes-content` í viewport meta (4.10) lætur `100dvh` minnka með lyklaborðinu á Android Chrome; iOS Safari skrunar sjálft að reitnum.

Sama transform aðferð gildir ekki um nýtt verk spjaldið (það hefur eina stöðu og `hg-rise` hreyfingu), aðeins um `PanelShell`.

### 4.9 Skjáskot og mæling: `scripts/hg-shots.mjs`

Ný skrifta, `npm run shots:hg [phone|tablet|tabletLand|perf]`, með `playwright` sem devDependency (`npx playwright install chromium-headless-shell` einu sinni, skjalað í CLAUDE.md Commands). Hún:

- les `.env` sjálf (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `HG_SMOKE_EMAIL`, `HG_SMOKE_PASSWORD`), skráir sig inn með supabase-js og setur sessjónina í `localStorage` undir `sb-<ref>-auth-token` með `addInitScript`. Lykilorðið fer aldrei á stdout.
- `SITE` umhverfisbreyta velur slóð (`https://huginn.pro` sjálfgefið, `http://localhost:5173` fyrir dev).
- `phone` (iPhone 13 hermir, 390 x 844), `tablet` (iPad portrait 810 x 1080), `tabletLand` (1080 x 810): skjáskot í `.playwright-mcp/shots/<ham>-<n>.png` af opnun, útzoomað, innzoomað, síuspjald/menu, opið spjald (tap á kort á skjánum með CDP touch), leit og nýtt verk. Prentar zoom við opnun, breidd `.hg-counts` og console villur.
- `perf`: iPhone hermir, CDP `Emulation.setCPUThrottlingRate` 4, mælir tvennt meðan CDP touch pinch (tveir fingrar, 60 skref á 1 s) keyrir alveg útzoomað, pan, pinch inn, og 1 s kyrrt: **bil** milli rAF ramma (ms, mælt með eigin rAF lykkju, kemst aldrei undir 16,7) og **vinnu** innan rAF (ms á ramma: `requestAnimationFrame` er vafið í init skriftu og tími hvers callbacks lagður saman per ramma; þar keyra canvasinn og fjaðrirnar). Prentar fyrir hvort tveggja meðal, p50, p90, max og fjölda ramma yfir 33 ms.

Mælt gegn production build á `vite preview` (`npm run build && npm run preview`, `SITE=http://localhost:4173`), aldrei gegn dev server (dev React er margfalt hægara). Fyrsta verk plansins keyrir skriftuna á `main` fyrir breytingu og skrifar grunnlínuna í handover skjalið; tölurnar úr úttektinni (bil: pinch-out@min 46 ms meðal / p90 83, pan 19, pinch-in 39, idle 30, mælt gegn huginn.pro) eru til viðmiðunar en ekki grunnlínan.

Viðmið eftir breytingu, sama skrifta, sama hermir, sama preview: bil í pinch-out@min meðal undir 20 ms og p90 undir 33; bil í pan meðal undir 20; vinna í rAF kyrrt undir 1 ms meðal (canvasinn hvílir). Náist viðmiðið ekki segir lotan það í handover í stað þess að skrúfa frá reglum.

### 4.10 Meta, PWA, safe area

- `index.html`: viewport meta verður `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`; `theme-color` `#0f141c` (`--hg-board`); nýtt `<meta name="apple-mobile-web-app-capable" content="yes">` og `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`; `lang="is"`.
- `vite.config.ts` manifest: `background_color` og `theme_color` `#0f141c`.
- `src/index.css`: `html, body { overscroll-behavior: none; }` (ekkert pull to refresh á Android, ekkert gúmmíband á iOS 16+).
- Tákn: `--hg-safe-top: env(safe-area-inset-top, 0px)`, `--hg-safe-bottom: env(safe-area-inset-bottom, 0px)`, `--hg-safe-left: env(safe-area-inset-left, 0px)`, `--hg-safe-right: env(safe-area-inset-right, 0px)`. Stikan bætir `--hg-safe-top` við efri padding í öllum breiddum (standalone iPad í landscape þarf það líka, `env()` er 0 á skjáborði) og `--hg-safe-left`/`--hg-safe-right` við hliðarpadding; `.hg-zoom`, `.hg-notice` og `.hg-toast-wrap` bæta `--hg-safe-bottom` við `bottom`; `--hg-control-stack` tekur það með. Spjaldið notar `--hg-safe-bottom` í stað `env()` beint og `--hg-safe-left`/`--hg-safe-right` í hliðarpadding.

### 4.11 Spjaldtölva

- 768 til 1023 px: efri stikan eins og í síma (4.7), hliðarspjaldið frá hægri eins og nú, síuspjaldið í stað menu. Nýtt verk er miðjað dialog eins og nú.
- Snertireglurnar (4.2, 4.3, 4.5, 4.6) gilda þar sem bendillinn er grófur, óháð breidd.
- 1024 px og upp: ein röð, óbreytt.

### 4.12 Hvað breytist ekki

- Dragsamningurinn (350 ms langpressa, pinch hættir við drag, 10 px slop) og `useCardDrag` að öðru leyti en `viewRef`.
- `lib/sheet.ts` stoppin og `snapSheet`.
- Kortaútlit, tónar, hover peek með mús, aurora.
- Gögn, triggerar, CLI, `parity.test.mjs`.

## 5. Prófanir

**vitest** (nýtt eða breytt):

- `lib/fling.test.ts`: `releaseVelocity` úr 80 ms glugga, 0 ef gamalt eða eitt sýni; `flingStep` deyr út með `FLING_DECAY`, `dt` klemmt; `flingDone` við `FLING_STOP`.
- `lib/gesture.test.ts`: `touchTracks` fyrir hvert kind; `isDoubleTap` innan og utan 300 ms og 24 px, `prev` null.
- `lib/geometry.test.ts`: `fitWidth` zoomar í breiddina, efst, klemmt við `maxZoom`; `startAtPack` setur titilinn á `(pad, pad)` í zoom 0,8.
- `lib/sheet.test.ts`: `OPEN_STOP` er `full`.
- `lib/filters.test.ts`: `withoutPicks` tæmir pakka og tögg og heldur hinu.

**Skriftan** (4.9) á `vite preview` af production build: `phone`, `tablet`, `tabletLand`, `perf`. Skjáskotin eru skoðuð: opnun læsileg (zoom 0,8, fyrsti pakkinn efst til vinstri), pillurnar í fullri breidd, síuhnappur með tölu, síuspjaldið opið, spjaldið í fullri hæð, leitin í röð 3, nýtt verk. `perf` undir viðmiðum.

**Skjáborð** (Playwright MCP, 1440 x 900 með mús): útlit óbreytt, hjólzoom, fit líður, pakkatitill fittar dálk, hover peek virkar, drag virkar. Mús fær ekki skrið eða tvísmell.

**Heimir** eftir deploy, í sínum síma og iPad: pinch með öllum kortum sýnileg, pan með fingri sem byrjar á módúl, skrið, tvísmellur, pakkatitill, spjaldið í fullri hæð og dregið lokað úr efninu, síuspjaldið, ekkert pull to refresh, standalone PWA.

## 6. Ákvarðanir Claude í þessu skjali

- Opnun í síma: fyrsti pakkinn í zoom 0,8 (ekki yfirlit, það er ólæsilegt).
- Síurnar á einum hnappi og neðra spjaldi undir 1024 px, í stað þriggja menu hnappa.
- Spjaldið opnast í fullri hæð; hálft er millistopp.
- Snertireglur og sparnaðarútlit miðast við `pointer: coarse`, ekki breidd.
- Zoom, fit og pakkatitill líða í 220 ms líka með mús. Það er eina sýnilega breytingin á skjáborði.
- Skriftan í repoinu með `playwright` devDependency, af því lotur geta ekki treyst á innskráningu í vafra.
- Eftir builder check 1. nóv: opnunarsýn ræðst af breidd eða grófum bendli (iPad landscape fær pakkann), ekkert endurfit við snúning; hálft spjald er gluggi; tvísmellur aðeins á autt borð; snerting á hnappi panar við 10 px; „Hreinsa" í síuspjaldinu hreinsar aðeins pakka, tögg og sýn; mælikvarðinn er bil og rAF vinna gegn `vite preview`; zoom prósentan er skrifuð beint og React fær viewið aðeins í lok bendingar.
