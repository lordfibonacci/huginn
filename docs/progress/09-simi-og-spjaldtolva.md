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

## Hvað bíður

Tasks 2 og áfram í planinu. Þessi skrá fær sína kafla eftir því sem þeir klárast.
