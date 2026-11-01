# 09 Vinnuborð: sími og spjaldtölva (plan 9)

Dagsetning: 2026-11-01
Grein: `vinnubord-9`
Plan: `docs/superpowers/plans/2026-11-01-simi-og-spjaldtolva.md`
Spekk: `docs/superpowers/specs/2026-11-01-simi-og-spjaldtolva-design.md`

Staða: í byggingu. Task 1 er búinn: skriftan `scripts/hg-shots.mjs` (`npm run shots:hg`) tekur skjámyndir og mælir klípu og drátt á hermdum síma og spjaldtölvum. Grunnlínan hér að neðan er keyrð á óbreyttri `main` byggingu (`npm run build` og `npm run preview` á port 4173), áður en nokkur kóði í appinu var snertur.

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

## Hvað bíður

Tasks 2 og áfram í planinu. Þessi skrá fær sína kafla eftir því sem þeir klárast.
