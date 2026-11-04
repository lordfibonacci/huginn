# 16 Vinnuborð: tiltekt (plan 16)

Dagsetning: 2026-11-04
Grein: `vinnubord-16` (commits fd6e2fd til 1451f72 ofan á main 6ee5103), lokayfirferð Fable bíður, ekki sameinað og ekki pushað.
Plan: `docs/superpowers/plans/2026-11-04-tiltekt.md`
Spekk: `docs/superpowers/specs/2026-11-04-kassar-og-tiltekt-design.md`

Staða: **smíðað á grein, lokayfirferð Fable eftir**. Engin migration. `node cli/huginn.mjs pull --brief --project metta` er óbreytt eftir CLI verkefnið.

## Hvað var gert

**Task 1, stöðureglur** (fd6e2fd). `CLOSED_LINGER_DAYS` (3), `isOpen` og `isOnBoard(item, now)` í `status.ts`: lokið verk (done, dropped) með `closed_at` innan þriggja daga er áfram á borðinu. `countBucket` skilar `null` fyrir lokið verk og `wireMode` gefur `parked`. `panel.ts` notar `isOpen` (sjá R3).

**Task 2, síur og sýnir** (c8a7016). Lokið kort passar enga tónasíu en fylgir öðrum síum (tögg, pakki, ólesið, leit). `itemsInView` og `viewCounts` taka klukku.

**Task 3, spjaldalíkan og síður** (f9c7731, 92f5fb5). `CardModel.closed`, talning opinna verka (`moduleOpenCount`, `moduleTone` nota `isOpen`) og ein klukka á hverja hleðslu borðsins í `BoardPage` (`now` fer í `itemsInView`, `viewCounts`, `cardModels` og `boardCount`).

**Task 4, dofin spjöld** (fe993d2). Lokið spjald er dofið (`.hg-card-closed`, `--hg-card-closed-opacity` 0.45, enginn punktaljómi) og raðast síðast í listanum: í einingu, og í stöðuröðun sem eigin hópur "Lokið".

**Task 5, CLI** (d42d19b). `isOpen`, `isOnBoard` og `CLOSED_LINGER_DAYS` afrituð í `cli/lib/write.mjs` með samsvörunarprófi í `parity.test.mjs`. Lokið spjald telst hindrun við staðsetningu nýs spjalds.

**Task 6, geymsla samanfelldra pakka** (f3c9a74). `lib/packs.ts` (`packsKey`, `parseCollapsed`, `serializeCollapsed`, `foldLine`) og `hooks/useCollapsedPacks.ts`.

**Task 7, pakki felldur saman á borðinu** (1e9dbfc, 83b399e). Hnappur í haus pakkans (`.hg-pack-fold`) felur einingar og spjöld, ein lína (`.hg-pack-fold-line`) segir hve margar einingar og spjöld. Falin spjöld fylgja pakkanum þegar hann er dreginn (`lib/carry.ts`, 10 próf). Val á spjaldi úr lista og nýtt verk opna pakkann.

**Task 8, arrangeGrid** (b75f2a2). `lib/arrange.ts`: spjöld í röðum og dálkum, raðir greindar með vikmörkum.

**Task 9, valstika** (7d8c918, 5066311, 1451f72). `SelectionBar.tsx`: "N kort valin" með Raða og Hætta við, eftir Raða kemur Afturkalla í 8 sekúndur. Afturköllun fer í gegnum `onDrop`. Reglan um bið eftir vistun korts (`Pending.via`) er í `lib/pending.ts` (16 próf), svo hröð önnur sleppa hunsar seinan vistunarómun þeirrar fyrri.

## Ákvarðanir í byggingu

- R1: handprófanir loka aldrei raunverulegu verki á metta. Lokuð spjöld voru prófuð á verkum sem voru þegar lokuð innan þriggja daga. Prufuverk `25e9e6ce` "Prufa: tiltekt felling" var búið til í handprófun og lokað sem dropped, svo það liggur dofið á borðinu í þrjá daga. Kostnaður ef rangt: eitt dofið prófspjald.
- R2: handprófanir sem færðu raunveruleg spjöld eða pakka skráðu upphafsstöðu (pos_x, pos_y og sýnastöður) og skiluðu henni í lokin. Stóreldhús pakkinn (12 verk, 6 sýnaraðir, 1 pakkastaða) var færður til baka.
- R3: engin `filter(isOnBoard)` án örvarfalls má vera til, hvorki í `src` né `cli`, því vísitalan yrði klukkan og héldi hverju lokuðu verki á borðinu. Hvert verkefni grepar fyrir því. Kostnaður ef rangt: lokuð verk færu aldrei af borðinu.
- R4: Task 6 og Task 8 (lítil, óháð, eigin próf) voru ein Opus lota með tveimur commits og einni yfirferð.
- R5: Task 7 lagað gegn plantexta: færð staða falinna spjalda er geymd á hvert verk og sýn þar til endurhleðsla notar hana (`lib/carry.ts`), annars vistuðust rangar stöður við tvær snöggar sleppur samanfellds pakka. Kostnaður ef rangt: aðeins meira ástand í `Board`.
- R6: `placeNew` notar aftur aðalstöðu korta sem sýnin felur (galli sem Task 7 kom með) og fór í sömu lagfæringarlotu.
- R7: Task 9 lagað: afturköllun Raða hreinsast þegar sýn breytist (annars skrifast stöður sýnar A í sýn B eða á aðalborðið). Líka lagaður galli í aukacommitti Task 9 (`Pending.via`): bið gat setið föst ef via punktur sást aldrei, base inni í via kom blikinu aftur, og reglan fór í hreina, prófaða hjálp (`lib/pending.ts`).
- Lagfæringalota Task 7 drap ferli sem hlustaði á port 5173 (líklega þróunarþjónn Heimis eða annarrar lotu) þegar hún stöðvaði eigin þjón á 5174. Task 9 drap aðeins eigið ferli.

## Staðfesting

- `npm run test`: 641 próf græn (600 áður plús 41). `npm run build`: grænt.
- `node cli/huginn.mjs pull --brief --project metta` er óbreytt eftir Task 5.
- Engin migration og enginn smoke atriði bætt við: þetta er allt vefreglur og CLI afrit.
- Handprófanir hvers verkefnis (Chromium 1440 með mús) stóðust, sjá skýrslur í `.superpowers/sdd/2026-11-04-tiltekt/`. Við fyrstu athugun voru 28 metta verk þegar lokin innan þriggja daga, talning pilla 75.

## Það sem Heimir athugar

- Loka verki og sjá spjaldið dofna en haldast á staðnum, og raðast síðast í listanum (í einingu og í stöðuröðun).
- Fella pakka saman og opna hann aftur. Línan segir einingar og spjöld.
- Velja falið spjald úr listanum: pakkinn opnast og spjaldið birtist.
- Draga samanfelldan pakka og opna hann: kortin eru komin með.
- Ctrl marquee yfir nokkur kort, Raða, svo Afturkalla. Afturkalla hverfur eftir 8 sekúndur.

## Opið

1. Þriggja daga reglan fer af borðinu við næstu gagnabreytingu, ekki á klukkunni: klukkan (`now` í `BoardPage`) færist aðeins með gögnum, svo á rólegu borði helst lokið spjald lengur en þrjá daga.
2. Nýtt verk í einingu í samanfelldum pakka lendir langt fyrir neðan haus dálksins (`placeNew` stígur yfir falin spjöld).
3. Við fyrstu uppsetningu birtast öll verk sem lokuðust síðustu þrjá daga aftur, dofin á gamla staðnum, og geta skarast við spjald sem var sett þar síðan (sjá mynd `.playwright-mcp/shots/16-4-closed-card.png`). Lagast sjálft innan þriggja daga.
4. Prufuverkið `25e9e6ce` liggur dofið í þrjá daga (sjá R1).
5. Efsta línan á 1440 px: pillan "2 í byggingu" fer undir Leita reitinn. Óvíst hvort Kassi hnappur (plan 15) olli, bera saman við 02e4fd5. Kannað í lokayfirferð.
6. Lokaðar lausar endar hjá lokayfirferð Fable, ásamt smávægilegu hér að neðan.

Smávægilegt sem yfirferðir létu standa (fer í lokayfirferð greinarinnar): ekkert próf festir `filter(isOnBoard)` gildruna, `tagCounts` prófið notar fast `closed_at` og hættir að verja eftir 2026-11-07, 'off' dæmið í `list.test` hefur bucket null en closed false, `write.test` heitið "closed cards are not obstacles" stangast á við nýju regluna og enginn `placeItem` próf fyrir lokið hindrun, haus athugasemd í `placeItem` segir "open cards", `parity` vantar nákvæm mörk og ólesanlegt `closed_at`, `Point` gerðin er til í þriðja sinn í `arrange.ts`, ekkert próf á vikmörk raða gagnvart fyrsta kassa raðar, `useCollapsedPacks` án skýrrar skilagerðar, `collapsedRef` og `hiddenRef` óþarfa tvö með villandi athugasemd, athugasemd á `cardCount` í `PackColumn` ónákvæm, `.hg-pack-fold:focus-visible` með aðeins 6% lit en engan hring, þrjú eða fleiri samanfelld slepp með hlutaendurhleðslu á milli geta skilið spjald einu skrefi frá, `carry` yfirfærsla missir `via` og seinn ómur getur eytt `carry`, pakka og kassa bið heldur gömlu reglunni, Afturkalla sleppir spjaldi sem pakkinn var felldur á eftir Raða án viðvörunar, `pendingFailed` ber saman á hnitum, og afturköllun til base hunsar utanaðkomandi færslu á via punkt þar til næsta gögn koma. Class `.hg-sel-bar-text` er í markupinu án eigin reglu.
