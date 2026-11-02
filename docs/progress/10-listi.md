# 10 Vinnuborð: listi (plan 10)

Dagsetning: 2026-11-02
Grein: `vinnubord-10` (commits 2cf5c79 til 7192859 ofan á main 2d8d01f, auk þessa skjals, skjámynda í skriftunni og CLAUDE.md)
Plan: `docs/superpowers/plans/2026-11-02-listi.md`
Spekk: `docs/superpowers/specs/2026-11-02-listi-design.md`

Staða: lokið, bíður lokayfirferðar allrar greinarinnar og prófunar Heimis á síma og iPad. Engin migration og enginn gagnagrunnskóði. Enginn commit er ýttur.

## Hvað var gert

**Task 1, bil og laus flötur** (2cf5c79). `Padding` í `lib/geometry.ts` fær `left` og `right`, `fitAll` og `fitWidth` virða þau. Nýtt: `DEFAULT_PADDING`, `parsePx`, `REVEAL_MIN_ZOOM`, `freeRect` (lausi flöturinn á milli lista til vinstri, spjalds til hægri og hálfs botnspjalds á síma) og `revealView` (sjónarhorn sem setur kort í miðju lausa flatarins, zoom aldrei undir 0,8). `useViewport` flytur `Padding` út áfram.

**Task 2, eitt kortalíkan** (90011ca). `lib/cards.ts` með `cardModels`: borðið og listinn lesa sama líkan (flokkur, bíður hjá, ólesið, texti, tónn), reiknað einu sinni í `BoardPage`. Reiknilagið sem var í `Board` er farið þaðan. Þátttakandi sem er ekki lengur til gefur stöðutexta án avatars.

**Task 3, raðir og stillingar listans** (47295c2). `lib/list.ts`: `listRows` (raðir eftir pakka, stöðu eða síðast breytt), `Sort`, `SORTS`, `parseListPrefs` og `listOpen`. Rusl eða gamalt gildi í `localStorage` gefur lokaðan lista og "eftir pakka". Spil með módúl sem er horfinn lenda undir "Án módúls".

**Task 4, ListDrawer, tákn og texti** (256b6d1). `components/ListDrawer.tsx`, `--hg-list-*` tákn og reglur í `vinnubord.css` (yfirskrifuð í `pointer: coarse` blokkinni), lyklar `vinnubord.list.*` í `en.json` og `is.json` (íslenskan lagfærð í höndum eftir `npm run translate`). Ekki tengt enn.

**Task 5, borðið ber lausa flötinn** (6b135bc). `Board` fær `listOpen` og `panelOpen`, reiknar bil úr `--hg-list-w`, `--hg-panel-w` og `--hg-panel-inset`, og öll `fit` (Sýna allt, pakkatitill) bæta því við. `BoardHandle` fær `reveal` (líður kortinu í miðju lausa flatarins) og `peek` (kveikir á korti úr röð án render, klasi `hg-card-peek`). Seinkun á hover stækkun fellur niður fyrir `peek`.

**Task 6, breiður skjár** (4ce0c60). `hooks/useListPrefs.ts` (opið og röðun í `localStorage` `hg.list.<projectId>`), listahnappur fremst í `TopBar`, `ListDrawer` sem barn `Board` utan `.hg-board`, röð kallar `pick` (velur kortið og `reveal`). Esc lokar listanum aðeins þegar ekkert ofan á tekur Esc fyrst (reitur, hliðarspjald, nýtt verk, síuspjald, opin valmynd). Hver lokunarleið slekkur líka á `peek`.

**Task 7, þröngur skjár** (7192859). Undir 1024 px tekur listinn allan skjáinn, byrjar lokaður og er aðeins til í minni (`narrowOpen`), aldrei geymdur. Röð lokar listanum áður en hún velur. Hann notar `--hg-safe-left` og `--hg-safe-right`. `freeRect` á síma tekur frá `h * (1 - SHEET_HALF)` neðst, svo valið kort miðjast í efri 45% borðsins fyrir ofan hálft botnspjald. Skrif í `localStorage` færð út úr `setState` falli.

**Úrskurðir sem breyta hegðun.** Heiti `listOpen` og `peek(itemId | null)` eru úr planinu, ekki spekki (`listState` og `peek(itemId, on)`). `Board` tekur `listOpen` sem boolean og les breiddina úr `--hg-list-w`. Þröngi listinn notar `left` og `right` með öruggu svæði í stað `--hg-list-w: 100%`. Tvær skjámyndir (`8-list` og `9-list-pick`) í stað einnar.

## Staðfesting

- `npm run build`: grænt.
- `npm run test`: 32 skrár, 508 próf græn (474 fyrir planið, 34 ný).
- `cli/lib/parity.test.mjs`: grænt, engin stærðartákn (`--hg-pack-*`, `--hg-module-*`, `--hg-card-*`) breytt.
- `npm run smoke:hg` var ekki keyrt: engin migration og enginn gagnagrunnskóði.
- Skjámyndir: `vite preview` á port 4173 af production build, `SITE=http://localhost:4173 npm run shots:hg phone`, 69 spil, preview stöðvað á eftir. `.playwright-mcp/shots/phone-8-list.png` sýnir listann í fullum skjá (haus "Listi 69 verk", röðun "Eftir pakka", pakkar, módúlar og raðir með punkti, bíður hjá og dagsetningu). `phone-9-list-pick.png` sýnir spjaldið opið eftir ýtingu á fyrstu röð (listinn lokaður). Skriftan ýtir nú tvisvar á Esc eftir `7-new`, því fyrra Esc yfirgefur aðeins reitinn í nýtt verk blaðinu.

## Það sem Heimir prófar

Á iPhone og iPad (uppsett PWA, því aðeins þar sjást örugg svæði):

- Listahnappurinn er fremst hægra megin við nafn verkefnisins og kveikir og slekkur á listanum.
- Listinn skrunar mjúklega með fingri, líka þegar hann er langur (69 verk).
- Ýting á röð lokar listanum á síma, líður borðinu að réttu korti og opnar spjaldið. Kortið er í efri hluta borðsins, ekki undir hálfu botnspjaldi.
- Á síma byrjar listinn alltaf lokaður, líka þótt hann hafi verið opinn á skjáborði.
- Á iPad í landslagi situr listinn við hlið borðsins og "Sýna allt" passar í lausa flötinn.
- Í landslagi á iPhone fara raðir ekki undir hakið.
- Röðunin (eftir pakka, stöðu, síðast breytt) og "Hreinsa" þegar sía eða leit felur öll verk.

## Opið

Smáatriði úr yfirferðum sem notandi gæti tekið eftir, ekkert þeirra hindrar:

- Klasinn `hg-card-peek` hverfur ef React endurskrifar `className` kortsins (val, púls, dimming) meðan bendillinn er yfir röð. Næsta `peek` á sama kort setur hann aftur.
- Fókus fer á `body` þegar listinn lokast með fókus inni í honum.
- Eftir að valið verk er eytt (gamalt `selectedId`) getur listinn bætt bili fyrir spjald sem er ekki sýnilegt og Esc lokar þá ekki listanum.
- Í röðun eftir pakka lenda spil án flokks (`bucket` null) á undan "nýtt". Óskilgreint í spekki og ekki prófað.
- Engin yfirferð allrar greinarinnar er gerð enn, lokayfirferð Fable á allri greininni er eftir.
