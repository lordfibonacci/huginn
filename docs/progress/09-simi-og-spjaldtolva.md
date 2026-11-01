# 09 Vinnuborð: sími og spjaldtölva (plan 9)

Dagsetning: 2026-11-01
Grein: `vinnubord-9` (commits 104ef30 til 5d8aad1 ofan á main e0c5e61, auk þessa skjals og CLAUDE.md, og lagfæringar lokayfirferðar 19e5837, c3b6fbe og 3531871)
Plan: `docs/superpowers/plans/2026-11-01-simi-og-spjaldtolva.md`
Spekk: `docs/superpowers/specs/2026-11-01-simi-og-spjaldtolva-design.md`

Staða: lokið, bíður yfirferðar og prófunar Heimis á tæki. Kóðinn er búinn og yfirfarinn task fyrir task, build og próf eru græn. Mælingarmarkmiðin í spekki 4.9 nást fyrir `pan` og `idle` en ekki fyrir klípu (`pinch-out@min`) í hermi, sjá Staðfesting. Lokayfirferð allrar greinarinnar á Fable er gerð og lagfæringarnar úr henni eru taldar upp í Lokayfirferð hér að neðan. Yfirferð þeirra lagfæringa er eftir og gerist áður en ýtt er. Enginn commit er ýttur.

## Hvað var gert

**Task 1, skriftan og grunnlínan** (104ef30). `scripts/hg-shots.mjs` (`npm run shots:hg phone|tablet|tabletLand|perf|all`) skráir sig inn sem smoke notandinn, tekur skjámyndir af síma og spjaldtölvum í `.playwright-mcp/shots/` og mælir klípu, drátt og hvíld með 4x hægari örgjörva. `playwright` er devDependency, aðeins fyrir skriftuna. Grunnlínan var keyrð á óbreyttum kóða.

**Task 2, hreint reiknilag** (b98588d, 2d5f453). `lib/fling.ts` (`releaseVelocity` úr 80 ms glugga, `flingStep`, `flingStarts`, `flingDone`), `lib/gesture.ts` (snertitegundir `field`, `noPan`, `card`, `button`, `board`, `touchTracks`, `touchSlop`, `isDoubleTap` með beinni fjarlægð), `lib/geometry.ts` (`fitWidth`, `startAtPack`), `lib/sheet.ts` (`OPEN_STOP` er `full`) og `lib/filters.ts` (`withoutPicks`). Öll með vitest.

**Task 3, sjónarhornið í ref** (f853367). `useViewport` geymir sjónarhornið í `viewRef` og skrifar umbreytingu heimslagsins, `--hg-z` og prósentutextann beint. React fær stöðuna í lok bendingar (`sync`). `Wires`, `useCardDrag` og `placeNew` lesa refið. Aðdráttarhnappar og fit líða nú yfir `--hg-dur-view` (220 ms, núll undir `prefers-reduced-motion`). Snerting á hnappi, tengli eða merkimiða í borðinu (módúlar, pakkatitlar) pannar og klípir eins og snerting á korti. Á skjáborði með mús er allt óbreytt nema líðandi hreyfingin.

**Task 4, skrið og tvísmellur** (c9e7179). Eins fingurs pan sem sleppt er hraðar en `FLING_START` rennur áfram og deyr út. Tvær snertingar á autt borð innan 300 ms og 24 px zooma inn um 2x. Ný snerting stöðvar skrið. Bending með klípu skríður aldrei. Mús fær hvorugt. `onLostPointerCapture` endar bendingu eins og `pointercancel`.

**Task 5, upphafsstaðan og pakkatitill** (45181d0). Á borði undir 1024 px eða með grófan bendil opnast fyrsti pakkinn í zoom 0,8 efst til vinstri (`startAtPack`) í stað yfirlits sem var ólæsilegt. Pakkatitill er nú `button` sem líður yfir dálkinn á breiddina (`fitWidth`), með `aria-label` "Sýna Grunnur".

**Task 6, ódýrari vírar** (6c9d2fa). Á `pointer: coarse` er enginn `shadowBlur`, pixlahlutfall í mesta lagi 1,5, sjálfkrafa neistar aðeins á heitum vírum og glóðarstrokunni er sleppt meðan bending hreyfir borðið. Mús sér ekkert af þessu.

**Task 7, tákn fyrir snertitæki** (c6ec0cb). Blokk undir `@media (pointer: coarse)` í `vinnubord.css`: enginn `backdrop-filter`, næstum ógegnsæir fletir og léttari skuggar.

**Task 8, meta og öruggt svæði** (16ffe0d). `viewport-fit=cover`, `interactive-widget=resizes-content`, theme color `#0f141c` (líka í manifest), apple-mobile-web-app metas, `overscroll-behavior: none`, og fjögur tákn `--hg-safe-top|bottom|left|right` sem efri stikan, stjórntök, tilkynningar og spjaldið nota.

**Task 9, `useMediaQuery` og innfelldir valmyndir** (c0933eb). `useIsMobile` byggir á nýju `useMediaQuery`. `FilterMenu` og `ViewMenu` fá `inline` til að birtast beint í síuspjaldinu.

**Task 10, efri stikan og síuspjaldið** (ba6965c, lagfæring 6c9693f). Undir 1024 px er stikan tvær raðir (þrjár með leitinni) og pillurnar fá fulla breidd. Pakki, Tögg og Sýn hverfa af stikunni í einn síuhnapp (`.hg-filter-btn`, með tölu þegar eitthvað er valið) sem opnar `FilterSheet`: botnspjald á síma, miðjaður gluggi á spjaldtölvu, með "Hreinsa" og "Loka". Hliðarspjaldið á spjaldtölvu byrjar undir tveggja raða stikunni (`--hg-panel-top` yfirskrifað undir 1024 px). Síuspjaldið lokast þegar breiddin fer yfir 1024 px og tekur fókus við opnun. `grid-template-rows: minmax(0, 1fr)` á `.hg-sheet-wrap` á síma lagaði að "Loka" og síðustu tögg voru utan skjás (líka á nýtt verk spjaldinu). Reglan sem faldi nafn sýnarinnar undir 768 px og tákn `--hg-ddb-pad-phone` voru fjarlægð, því valmyndirnar eru ekki teiknaðar undir 1024 px.

**Task 11, spjaldið á síma** (31eadf9, lagfæring 6dd4c20). Spjaldið undir 768 px opnast í fullri hæð, er fast í hæð og færist með `transform` eftir `--hg-sheet-offset` (óeiningartala í px sem `PanelShell` skrifar, kom í stað `--hg-sheet-open`). Það er dregið frá handfangi, haus og efni (efnið aðeins með snertingu sem byrjar efst og fer niður). Þrjár stöður: full, hálf (45%) og lokað, með flick. Lagfæringin kom í veg fyrir að spjald sæti fast ef dráttur var rofinn. Skriftan pannar nú borðið til að finna spil á símanum og handfangsdrátturinn er 300 px.

**Task 11b, þrjár lagfæringar fyrir skil** (31e5f8b, 157937b, 5d8aad1). Ýting sem stöðvar skrið eða líðandi hreyfingu er aldrei tap eða smellur (`gestureRef.current.stoppedMotion`, innfæddur capture `pointerdown` á borðinu, `useCardDrag` sleppir `onTap`, smellurinn á eftir er gleyptur). Það gildir líka um mús á 220 ms líðandi hreyfingu. Ekkert skrið undir `prefers-reduced-motion`. Tailwind síðurnar (Login, ResetPassword, AuthCallback, NoAccess, ErrorBoundary, LoadError) og stillingasíðan fá öruggt svæði með nýjum `safe-p-*`, `safe-top-*` og `safe-right-*` í `src/index.css`.

## Lokayfirferð

Lagfæringar eftir yfirferð allrar greinarinnar:

- **Lokunarhnappur á spjaldinu á síma** (19e5837). Í fullri hæð var ekkert til að ýta á sem lokaði spjaldinu, því röndin fyrir ofan er efri stikan og flick úr fullri stöðu fer aðeins í hálfa. Nú er 44 px hnappur (`.hg-sheet-close`, x tákn, `aria-label` "Loka") hægra megin í handfangsröðinni. Ýting á hann er aldrei dráttur, tap á handfang eða yfirtaka efnisins. `snapSheet` og stöðurnar eru óbreyttar. Hlutverkið `separator` færðist af röðinni á gripið sjálft, svo hnappurinn hverfi ekki sem skrautbarn aðskilnaðar.
- **Spjaldið undir hakinu á iPhone** (19e5837). Hæð spjaldsins og efri bil `.hg-sheet-wrap` á síma draga nú líka frá `--hg-safe-top`. Full hæð spjaldsins er mæld `offsetHeight` þess sjálfs (lesin þegar farið er undir 768 px og við `resize`, aldrei í hverri hreyfingu), því `getPropertyValue` getur ekki lesið `env()` í gegnum tákn. Fyrir fyrstu mælingu gildir gamli útreikningurinn. Þetta lagar líka að `sheetMax()` keyrði `getComputedStyle` í hverri teikningu.
- **Tákn í stað fastra gilda** (19e5837). Talan á síuhnappnum les `--hg-filter-badge-offset` og `--hg-filter-badge-size`, og fókushringur pakkatitils les `--hg-card-focus-ring` og `--hg-card-focus-offset` (hringurinn fer úr 4 px í 3 px frá titlinum).
- **Textahnútur aðdráttartölunnar** (c3b6fbe). `apply()` í `useViewport` skrifar `nodeValue` á textahnút React í stað `textContent`, sem skipti hnútnum út og lét React skrifa í aftengdan hnút.
- **Athugasemdir** (c3b6fbe). `useViewport` (stöðvunarýting gleypir aðeins smellinn sem fylgir, og ekki aðal `pointerdown` hreinsar ekki gleypinguna meðan stöðvunarýting er niðri), `lib/fling.ts` ("above"), `lib/gesture.ts` (bein fjarlægð, svo lítið skáhallt flökt telur enn) og haus `useCardDrag.ts` (línulengd).
- **Pakkahaus í CLI** (3531871). `packHead` í `cli/lib/write.mjs` reiknar titilinn sem hærra gildið af `touch` (44 px, úr `--hg-touch`) og textalínunni, því titillinn er hnappur með `min-height: var(--hg-touch)`. Pakkahausinn er því 74 px. `parity.test.mjs` krefst þess að `touch` sé jafnt tákninu og að `packHead` fylgi táknunum. Engu `--hg-pack-*`, `--hg-module-*` eða `--hg-card-*` stærðartákni var breytt.

Staðfest: `npm run build` grænt, `npm run test` 29 skrár og 474 próf græn. `vite preview` á port 4173 og `SITE=http://localhost:4173 npm run shots:hg phone`: `phone-5-panel.png` sýnir x hnappinn hægra megin í handfangsröðinni. Tímabundin skrifta (utan git, öllum skrifum í gagnagrunn hafnað nema les RPC `hg_unread`): tap á handfang fer í hálfa stöðu (offset 358,2 af 796) og annað tap aftur í fulla; efnið skrunað um 200 px og snertidráttur niður um 200 px: `scrollTop` 15, spjaldið kyrrt í fullri hæð; dráttur sem byrjar á x hnappnum hreyfir spjaldið ekki; tap á x hnappinn lokar spjaldinu. Mús á 1440 x 900: hliðarspjaldið óbreytt (efri brún 76, hæð 808, hvorki handfang né x hnappur) og Tab á pakkatitil sýnir hringinn (2 px, 3 px frá). Preview stöðvað, ekkert hlustar á 4173 til 4177.

## Staðfesting

- `npm run build`: grænt.
- `npm run test`: 29 skrár, 474 próf græn (457 fyrir planið, 17 ný).
- `cli/lib/parity.test.mjs`: grænt, engin stærðartákn (`--hg-pack-*`, `--hg-module-*`, `--hg-card-*`) breytt.
- `npm run smoke:hg` var ekki keyrt: engin migration og enginn gagnagrunnskóði í þessu plani.
- Lokamæling: `vite preview` á port 4173 af production build á `5d8aad1`, `SITE=http://localhost:4173 npm run shots:hg all`, 70 spil. Preview stöðvað á eftir, ekkert hlustar á 4173 til 4177.

Hleðslulínurnar þrjár eftir planið (zoom var 0,079, 0,185 og 0,243 í grunnlínu):

| Tæki | zoom | countsWidth | Grunnlína countsWidth |
| --- | --- | --- | --- |
| phone | 0,800 | 366 | 142 |
| tablet | 0,800 | 786 | 86 |
| tabletLand | 0,800 | 356 | 356 |

Tímamæling á síma með 4x hægari örgjörva, grunnlína og lokamæling hlið við hlið (`gap` er bilið milli ramma í ms, `work` er vinna appsins í ramma):

| Mæling | Grunnlína | Lokamæling | Markmið spekks 4.9 |
| --- | --- | --- | --- |
| `pinch-out@min` gap | mean 40,1, p90 83, 90 af 161 yfir 33 ms | mean 43,8, p90 100, 70 af 186 yfir 33 ms | mean undir 20 og p90 undir 33: **næst ekki** |
| `pinch-out@min` work | mean 16,6, p90 45 | mean 4,9, p90 5 | |
| `pan` gap | mean 18,4, p90 33 | mean 16,7, p90 17 | mean undir 20: **næst** |
| `pan` work | mean 4,7, p90 6 | mean 1,4, p90 5 | |
| `pinch-in` gap | mean 36,5, p90 67 | mean 44,5, p90 100 | ekkert sett |
| `pinch-in` work | mean 12,3, p90 47 | mean 5,1, p90 5 | |
| `idle` gap | mean 25,4, p50 33 | mean 16,7, p50 17 | |
| `idle` work | mean 4,7, p90 6 | mean 0,1, p90 0 | mean undir 1: **næst** |

Fullt úttak lokamælingarinnar:

```
pinch-out@min    gap  n=186 mean=43.8 p50=17 p90=100 max=150 >33ms=70
                 work n=186 mean=4.9 p50=0 p90=5 max=52 >33ms=16
pan              gap  n=189 mean=16.7 p50=17 p90=17 max=17 >33ms=0
                 work n=189 mean=1.4 p50=0 p90=5 max=9 >33ms=0
pinch-in         gap  n=177 mean=44.5 p50=17 p90=100 max=167 >33ms=67
                 work n=177 mean=5.1 p50=0 p90=5 max=48 >33ms=16
idle             gap  n=60 mean=16.7 p50=17 p90=17 max=17 >33ms=0
                 work n=60 mean=0.1 p50=0 p90=0 max=0 >33ms=0
```

**Hvað næst og hvað ekki.** `pan` og `idle` ná markmiðunum með góðum mun: pan er 60 Hz ramma eftir ramma og kyrrt borð kostar 0,1 ms í ramma. Klípa nær þeim ekki: `pinch-out@min` gap mean er 43,8 (markmið undir 20) og p90 er 100 (markmið undir 33). Reglurnar voru ekki losaðar.

**Grunur um orsök, ekki sannaður.** Vinna appsins í ramma er orðin 5 ms (p90 úr 45 í 5), en rammarnir eru áfram stundum 100 til 150 ms. Miðgildið er 17 ms og meðaltalið er dregið upp af þungum römmum, svo tíminn fer í eitthvað utan skriftunnar: stíll, útlit, teikning og samsetning (raster og composite). Hermirinn teiknar án GPU og með 4x hægari örgjörva, og í `pinch-out@min` er borðið í lágmarks zoom þar sem öll 70 spilin, módúlarnir og vírarnir eru á skjánum í einu, svo hvert aðdráttarskref endurteiknar mest allt efnið. Task 7 (enginn `backdrop-filter`) lækkaði klípubilið um 4 til 6 ms og tilfærslan í ref lækkaði vinnuna, en bilið hreyfðist ekki að ráði í hermi. Þetta þarf mælingu á raunverulegum síma (GPU) áður en hert er meira, til dæmis með `will-change: transform` á heimslaginu eða með því að teikna spilin sem mynd í klípu. Tvær aðrar athugasemdir um mælinguna: CDP sendir snertihreyfingar með um 47 ms millibili, svo `pan` í `perf` skríður aldrei (skrið var sannreynt sér, sjá Eftir task 4), og þetta er ein keyrsla með breytileika milli keyrslna (task 6 sá nokkra ms).

**Skjámyndir sem voru skoðaðar** (`.playwright-mcp/shots/`, ekki í git): `phone-1-load` (Grunnur læsilegur efst til vinstri í zoom 80%, pillurnar í einni röð sem skrunast til hliðar, módúlar stórir), `phone-4-filters` (síuspjaldið með Sýn, Pakki, Tögg og "Loka" í sjónmáli), `phone-5-panel` (spjaldið í fullri hæð með handfangi og 48 px rönd efst, athugasemdareitur neðst), `tablet-1-load` (tvær raðir, allar fimm pillurnar í fullri breidd, spil við hlið dálksins) og `tabletLand-5-panel` (ein stika með Leita, Pakki, Tögg og Sýn, hliðarspjald og valið spil afmarkað). `tabletLand-6-search` er ekki tekin því skriftan sleppir því skrefi á 810 px hæð.

Eldri mælingar eftir hvern task eru hér að neðan óbreyttar ásamt grunnlínunni.

## Grunnlína

Keyrt með `SITE=http://localhost:4173 npm run shots:hg all`, innskráð sem smoke notandinn, 70 spil á borðinu. Myndirnar liggja í `.playwright-mcp/shots/` (ekki í git).

Hleðslulínurnar þrjár (aðdráttur við opnun, fjöldi spila og breidd teljarapillanna í px):

| Tæki | Viewport | zoom | countsWidth |
| --- | --- | --- | --- |
| phone | 390 x 844 | 0.079 | 142 |
| tablet | 810 x 1080 | 0.185 | 86 |
| tabletLand | 1080 x 810 | 0.243 | 356 |

Tímamæling á síma með 4x hægari örgjörva. `gap` er bilið milli ramma í ms, `work` er vinnan sem appið vinnur inni í hverjum ramma:

```
pinch-out@min    gap  n=161 mean=40.1 p50=33 p90=83 max=100 >33ms=90
                 work n=161 mean=16.6 p50=5 p90=45 max=71 >33ms=48
pan              gap  n=193 mean=18.4 p50=17 p90=33 max=34 >33ms=20
                 work n=193 mean=4.7 p50=5 p90=6 max=14 >33ms=0
pinch-in         gap  n=157 mean=36.5 p50=33 p90=67 max=83 >33ms=102
                 work n=157 mean=12.3 p50=5 p90=47 max=56 >33ms=25
idle             gap  n=40 mean=25.4 p50=33 p90=33 max=33 >33ms=21
                 work n=40 mean=4.7 p50=5 p90=6 max=6 >33ms=0
```

Klípa er þungust: p90 á vinnu í ramma er 45 til 47 ms og bilið milli ramma fer í allt að 100 ms. Markmiðið er að sjá þetta lækka í lok plansins. Í hvíld (`idle`) er bilið samt 33 ms í miðgildi, svo eitthvað teiknar stöðugt (aurora og vírar), sem er líka til skoðunar.

## Eftir task 4

Skrið eftir pan eins fingurs og tvísmellur á autt borð (`useViewport`). Keyrt með `npm run build`, `vite preview` og `SITE=<preview> npm run shots:hg perf`, sími með 4x hægari örgjörva:

```
pinch-out@min    gap  n=160 mean=61.8 p50=33 p90=133 max=167 >33ms=115
                 work n=160 mean=17.3 p50=6 p90=49 max=94 >33ms=42
pan              gap  n=185 mean=20.5 p50=17 p90=33 max=50 >33ms=42
                 work n=185 mean=5.8 p50=6 p90=7 max=11 >33ms=0
pinch-in         gap  n=156 mean=49.5 p50=33 p90=117 max=183 >33ms=105
                 work n=156 mean=12.7 p50=6 p90=48 max=76 >33ms=25
idle             gap  n=36 mean=28.7 p50=33 p90=33 max=50 >33ms=25
                 work n=36 mean=5.5 p50=5 p90=6 max=15 >33ms=0
```

Til samanburðar gaf bygging task 3 (`f853367`) sama kvöld `pinch-out@min` gap mean 59.7 p90 133 og work p90 6, `pinch-in` gap mean 46.2 p90 117 og work p90 6. Bilið milli ramma er því það sama, en vinnan í klípu mælist aftur um 48 ms í p90. Það kemur frá því að zoom talan er núna aðeins skrifuð þegar textinn breytist: þá fer stíll og útreikningur útlits (sem þarf hvort sem er) inn í ramma víranna í stað þess að gerast utan rAF. Bygging með gömlu skriftinni á zoom tölunni gaf work p90 6 og gap mean 52.2 og 44.5, svo þetta er tilfærsla í mælingunni, ekki hægari rammar.

Í `perf` skriftunni fær `pan` ekki skrið: CDP sendir hreyfingarnar með um 47 ms millibili, svo innan 80 ms gluggans fyrir sleppingu er aðeins eitt sýni. Sér prófun með hraðara pani sýndi skrið sem næsta klípa stöðvar og að klípan breytir aðdrætti eðlilega, án villu í console.

## Eftir task 6

Ódýrari vírar á snertitækjum (`Wires`, `pointer: coarse`): enginn `shadowBlur`, pixlahlutfall í mesta lagi 1,5, sjálfkrafa neistar fæðast aðeins á heitum vírum (valið eða dregið kort) og glóðarstrokunni er sleppt meðan bending hreyfir borðið. Keyrt með `npm run build`, `vite preview` og `SITE=http://localhost:4173 npm run shots:hg perf`, sími með 4x hægari örgjörva:

```
pinch-out@min    gap  n=184 mean=46.8 p50=17 p90=117 max=133 >33ms=69
                 work n=184 mean=5.3 p50=0 p90=5 max=50 >33ms=16
pan              gap  n=187 mean=16.7 p50=17 p90=17 max=17 >33ms=0
                 work n=187 mean=1.6 p50=0 p90=5 max=6 >33ms=0
pinch-in         gap  n=185 mean=46.6 p50=17 p90=100 max=167 >33ms=73
                 work n=185 mean=5.5 p50=0 p90=5 max=79 >33ms=17
idle             gap  n=61 mean=16.7 p50=17 p90=17 max=17 >33ms=0
                 work n=61 mean=0.1 p50=0 p90=0 max=0 >33ms=0
```

Miðað við task 4: í hvíld fer vinna í ramma úr mean 5.5 í 0.1 ms (p90 úr 6 í 0), svo kyrrt borð kostar ekkert lengur og bilið milli ramma er 17 ms í stað 33. Í klípu fer work mean úr 17.3 í 5.3 (`pinch-out@min`) og úr 12.7 í 5.5 (`pinch-in`), p90 úr 48 til 49 í 5, og gap mean úr 61.8 í 46.8 og úr 49.5 í 46.6. Pan fer úr work mean 5.8 í 1.6. Stöku þungir rammar eru eftir í klípu (max 50 og 79).

Mús á 1440 x 900 (tímabundin skrifta utan repo, öllum skrifum í gagnagrunn hafnað): `pointer: coarse` er ósatt, vírarnir teikna um 230 ramma á 5 s með um 65 neista í hverjum ramma og `shadowBlur` 14 eins og áður. Á rólegum vír (ekki pulse, ekki parked) teiknuðust 0 neistar á 5 s áður en kortið var valið og 682 neistabogar á 5 s eftir að það var valið.

## Eftir task 7

Tákn fyrir snertitæki (`@media (pointer: coarse)` á eftir `prefers-reduced-motion`): enginn `backdrop-filter` á kortum, módúlum, stjórntökkum, valmyndum og hliðarspjaldi, næstum ógegnsæir fletir og léttari skuggar. Staðfest í símahermi: `pointer: coarse` er satt, `backdrop-filter` er `none` á korti og módúl og bakgrunnur korts er ógegnsær litstigull. Keyrt með `npm run build`, `vite preview` og `SITE=http://localhost:4173 npm run shots:hg perf`, sími með 4x hægari örgjörva:

```
pinch-out@min    gap  n=186 mean=42.1 p50=17 p90=100 max=117 >33ms=63
                 work n=186 mean=4.9 p50=0 p90=5 max=54 >33ms=16
pan              gap  n=189 mean=16.8 p50=17 p90=17 max=33 >33ms=1
                 work n=189 mean=1.6 p50=0 p90=5 max=9 >33ms=0
pinch-in         gap  n=181 mean=40.4 p50=17 p90=83 max=133 >33ms=61
                 work n=181 mean=4.7 p50=0 p90=5 max=64 >33ms=16
idle             gap  n=60 mean=16.7 p50=17 p90=17 max=17 >33ms=0
                 work n=60 mean=0.1 p50=0 p90=0 max=0 >33ms=0
```

Miðað við task 6: gap mean í klípu fer úr 46.8 í 42.1 (`pinch-out@min`) og úr 46.6 í 40.4 (`pinch-in`), work er í raun óbreytt. Pan og hvíld eru óbreytt innan skekkju. Munurinn er lítill í hermi því hermirinn teiknar ekki með GPU eins og sími. Mús á 1440 x 900: sama útlit og áður, blur sést á kortum yfir norðurljósunum.

## Eftir task 11

Spjaldið á síma (undir 768 px) opnast í fullri hæð, er fast í hæð `calc(100dvh - var(--hg-sheet-top))` og færist með `transform` eftir `--hg-sheet-offset` (px). Það er dregið frá handfangi, haus og efni (efnið aðeins með snertingu sem byrjar efst og fer niður). Keyrt gegn `vite preview` á port 4173 með `SITE=http://localhost:4173 npm run shots:hg phone`: `phone-5-panel.png` sýnir spjaldið í fullri hæð með 48 px rönd efst, og `phone-5b-panel-half.png` sýnir það í hálfri stöðu eftir drátt í handfangi. Skriftan hliðrar nú borðinu með CDP snertingu þegar ekkert kort er á skjánum, svo myndirnar af spjaldinu eru teknar aftur.

Tímabundnar athuganir (afrit af skriftunni utan git, öllum skrifum í gagnagrunn öðrum en lesmerkjum hafnað):

- (a) Efnið skrunað niður um 200 px með músarhjóli, svo snertidráttur niður um 200 px inni í efninu: `scrollTop` fór úr 200 í 15 og spjaldið hreyfðist ekki (efri brún áfram 48 px, `--hg-sheet-offset` 0). Efnið skrunar, spjaldið stendur kyrrt.
- Til samanburðar: efnið efst og hægur snertidráttur niður um 250 px inni í efninu færði spjaldið í hálfa stöðu (`--hg-sheet-offset` 358,2, sem er 0,45 af 796).
- (b) Spjaldið í fullri hæð og viewport sett á 844 x 390: breiddin er yfir 767 px, svo spjaldið verður hliðarspjald og er áfram opið. Aftur í 390 x 844: spjaldið er aftur neðst, opið, í fullri hæð með `--hg-sheet-offset` 0 og hæð 796. Í hálfri stöðu og hæð breytt í 390 x 600 fylgir offset nýju hæðinni (248,4, sem er 0,45 af 552) og spjaldið er 552 px hátt, svo staðan helst.
- Tap á handfang skiptir milli fullrar og hálfrar stöðu, tap á haus gerir ekkert, hægur dráttur í haus niður um 280 px setur spjaldið í hálfa stöðu.
- Mús á 390 x 844: dráttur í handfang niður um 300 px setur spjaldið í hálfa stöðu, dráttur í haus upp setur það aftur í fulla hæð án þess að texti veljist. Í fullri hæð er 48 px röndin efst öll undir stikunni, svo þar er enginn blettur af borðinu til að smella á. Í hálfri stöðu lokar smellur á borðið fyrir ofan spjaldið því.
- Mús á 1440 x 900: hliðarspjaldið er óbreytt (efri brún 76 px, hæð 808, engin `--hg-sheet-offset`).


## Hvað bíður

### Hjá Heimi

Skoða á alvöru síma og iPad. Planið gat aðeins prófað í hermi, þar sem örgjörvi, GPU, snertiskynjun og öruggt svæði eru ekki eins og á tæki. Listinn úr spekki kafla 5:

1. **Klípa með öll spil sýnileg.** Klípa út og inn á borðinu og finna hvort hún er mjúk eða hikstar. Þetta er eina markmiðið sem hermirinn náði ekki (sjá Staðfesting), svo dómurinn kemur af tækinu.
2. **Pan með fingri sem byrjar á módúl** og á pakkatitli. Borðið á að fara með fingrinum, ekki opna módúlinn.
3. **Skrið.** Fljótt dregið og sleppt á borðið á að renna áfram og deyja út. Ný snerting á að stöðva það án þess að opna spil eða módúl.
4. **Tvísmellur** á autt borð zoomar inn. Tvísmellur á spil gerir það ekki.
5. **Pakkatitill.** Snerting á titil pakka líður yfir dálkinn í breidd skjásins.
6. **Spjaldið á síma.** Opnast í fullri hæð. Dregið niður frá handfangi, haus og frá efninu þegar það er efst: full, hálf, lokað. Efnið skrunast sem áður þegar það er ekki efst. x hnappurinn hægra megin í handfangsröðinni lokar því, og á iPhone með haki byrjar spjaldið í fullri hæð fyrir neðan stöðustikuna.
7. **Síuspjaldið.** Sliders hnappurinn með tölu, Sýn, Pakki, Tögg, Hreinsa, Loka. Á iPad bæði upprétt og lárétt.
8. **Ekkert pull to refresh** þegar borðið eða spjaldið er dregið niður.
9. **Standalone PWA.** Bæta á heimaskjá og opna þar. Skoða stikuna efst og heimaröndina neðst.
10. **Öruggt svæði og hak á alvöru iPhone** í uppsettu PWA. Hermirinn gefur núll í `env(safe-area-inset-*)`, svo hvorki efri stikan, aðdráttarhnapparnir, spjaldið né Tailwind síðurnar (innskráning, endurstilling lykilorðs, villusíða) hafa sést með raunverulegu haki. Líka lárétt á síma, þar sem hakið er til hliðar.

Úrskurðir sem breyta hegðun og Heimir ætti að staðfesta:

- **Tvísmellur notar beina fjarlægð** (24 px hringur), ekki ferhyrning. Tvær snertingar sem eru 20 og 10 px í sundur telja sem tvísmellur.
- **Spjaldið í fullri hæð lokast með x hnappnum eða drætti, ekki með snertingu fyrir ofan það.** Í fullri stöðu er 48 px röndin fyrir ofan spjaldið fyrsta röð efri stikunnar, ekki borð, svo snerting þar hittir stikuna. Snerting á borðið fyrir ofan lokar aðeins í hálfri stöðu. x hnappurinn í handfangsröðinni lokar í hvaða stöðu sem er.
- **Smellur á 220 ms líðandi hreyfingu er gleyptur líka með mús.** Smellur á borðið, módúl eða spil innan 220 ms eftir aðdráttarhnapp, fit eða pakkatitil stöðvar hreyfinguna og fer ekki í gegn, eins og með snertingu. Aðdráttarhnapparnir sjálfir eru utan borðsins og verða ekki fyrir þessu.
- **Leitarröðin getur legið undir hliðarspjaldinu** á spjaldtölvu (768 til 1023 px) þegar leitin er opin og spjald er opið. Spjaldið er einbeittur lestrarhamur og mæld hliðrun þarf ResizeObserver fyrir eitt jaðartilvik.

### Afköst eftir prófun á tæki

Grunur sem á að skoða eftir að klípan hefur verið prófuð á síma, ekki fyrr:

1. `--hg-z` er skrifað inline á heimslagið í hverri hreyfingu, en aðeins stækkun korts undir mús (hover peek) les það.
2. `Wires` les 2 x 70 `getBoundingClientRect` í hverjum ramma. Það mætti leiða staðsetningarnar af gormunum og `viewRef`.
3. Skuggar með blur eru eftir undir `pointer: coarse`: `--hg-card-shadow` (24 px blur) og glóðin í `.hg-mod::before`.

### Smálegt sem bíður

Fannst í yfirferð og er ekki lagað. Ekkert af því brýtur neitt í dag.

1. `scripts/hg-shots.mjs`: `OUT` er hlutfallsleg við vinnumöppu en `.env` er lesið frá `import.meta.url`.
2. `package-lock.json` fékk óskyldan `bin` blokk (npm sync).
3. Skriftan sleppir skrefum þegjandi: leitin á 810 px hæð og handfangið á `tabletLand`.
4. Tvær hraðar ýtingar á + zooma frá miðri líðandi stöðu og gefa aðeins minna en 1,25 í öðru veldi.
5. Lok skriðs er skrifað tvisvar í `useViewport` og skarast að hluta við `finish()`, einn hjálparfall myndi duga.
6. Tab fókus á pakkatitil sem er utan skjás skrunar `overflow: hidden` `.hg-board` (módúlar gerðu það þegar).
7. Fókushringur pakkatitils notar `--hg-line`, lág birtuskil.
8. `MediaQueryList.addEventListener` kastar villu á Safari eldra en 14, ekkert varaúrræði. `useMediaQuery`, `Board` og `Wires` gera ráð fyrir `matchMedia`.
9. `.hg-notice` og `.hg-toast-wrap` hafa ekki öruggt svæði til hliðar fyrir hak í láréttri stöðu. `ModalShell` notar hráa `env(safe-area-inset-bottom, 16px)` og er ekki í notkun núna.
10. Hvorugt spjaldið (nýtt verk, síur) skilar fókus á hnappinn sem opnaði það þegar það lokast.
11. `resize` hlustandinn í `PanelShell` liggur áfram meðan spjaldið á síma er lokað (hann mælir aðeins hæðina aftur, skaðlaust).
12. Snerting í efni spjaldsins sem byrjar efst, fer fyrst niður og beygir svo til hliðar, getur misst lárétta skrun þeirrar bendingar á iOS. Önnur fingur í spjalddrætti lætur spjaldið stökkva til baka án mýktar.
13. `safe-p-*` bætir líka neðri innfellingunni við (umfram það sem þurfti, skaðlaust).
14. `perf` skriftan hermir ekki skrið því CDP sendir hreyfingar með um 47 ms millibili. Skrið og stöðvun þess eru sannreynd sér, ekki í mælingunni.
15. Rönd pakkans byrjar við `--hg-pack-rail-top` (71 px) en fyrsti módúllinn við 74 px síðan pakkatitillinn varð 44 px hnappur. 3 px munur sést varla og stærðartáknum pakka var ekki breytt.
