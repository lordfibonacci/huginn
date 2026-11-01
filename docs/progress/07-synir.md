# 07 Vinnuborð: sýnir (plan 7)

Dagsetning: 2026-11-01
Grein: `main` (commits 9c58d36 til c2b9025 ofan á 71d6e55, ekki ýtt þegar þessi texti var skrifaður).
Plan: `docs/superpowers/plans/2026-11-01-synir.md`
Spekk: `docs/superpowers/specs/2026-11-01-olesid-og-synir-design.md` (kaflar 5, 7 og 8)

Staða: kóðinn er búinn og yfirfarinn task fyrir task. Sýn er vistuð, sameiginleg uppröðun: sía (litir, pakkar, tögg) auk eigin staðsetninga spjalda. Allir þátttakendur sjá sömu sýnir, en virka sýnin er geymd í vafranum. Lokayfirferð allrar greinarinnar á Fable er eftir og gerist áður en ýtt er.

## Hvað var gert

**Task 1, migration 0011.** `0011_hg_views` var beitt gegnum MCP 2026-11-01: töflurnar `hg_views` (nafn, röð, sía sem json) og `hg_view_positions` (staðsetning per `(view_id, item_id)`), RLS í gegnum `hg_is_participant`, `created_by` stimplað af trigger og realtime á báðum. Smoke atriði 9 bætist við (býr til sýn, vistar staðsetningu, athugar að `hg_items.updated_at` hreyfist ekki, eyðir sýninni). Í yfirferð kom í ljós að staðsetningarraðir gátu vísað í sýn eða verk í öðru verkefni, svo `0011b_hg_views_project_keys` var beitt til viðbótar: einstakur lykill `(id, project_id)` á `hg_views` og samsettir lyklar á `hg_view_positions`, eins og 0002 gerði við aðrar töflur. Smoke eyðir líka sýninni sinni í `finally`. `npm run smoke:hg` skilaði `ok 9/9`. Commits 9c58d36 og f7ef604.

**Task 2, hrein föll.** `lib/views.ts` með `viewFilterOf`, `viewFilterJson`, `itemsInView`, `positionsOf`, `positionOf`, `activeViewKey`, `resolveActiveView` og `viewCounts`, auk tegundanna `View`, `ViewFilterJson` og `ViewPosition`. `itemsInView` tekur `(items, modules, actions, viewerId, view)`, ekki styttri undirskriftina úr spekkinu, því litur spjalds kemur úr `countBucket` sem þarf aðgerðir og áhorfanda. Tíu próf. Commit f632551.

**Task 3, gögn.** `loadBoard` sækir sýnir og staðsetningar, `createView`, `updateView`, `deleteView` og `upsertViewPosition` í `lib/api.ts`, realtime á báðum töflum og `useActiveView` (vafralykillinn `hg.view.<projectId>`). Lagfæring eftir yfirferð: gömul sýnalisti eftir verkefnaskipti hreinsar ekki nýja lykilinn og nýval beint eftir `createView` hreinsast ekki áður en listinn hleðst. Commits 9ab7187 og 95befe4.

**Task 4, borðið.** `BoardPage` sendir `visibleItems` (úr `itemsInView`) í teljara, pakka- og einingateljara, síuvalmyndir og `Board`. `Board` teiknar bara spjöld sýnarinnar og sækir staðsetningu úr `hg_view_positions` með `positionOf`. Drag í sýn skrifar sýnarstaðsetningu og aldrei `hg_items`. Vistunarmarkið er fest við sleppingu (`SaveJob.viewId`), svo sýnaskipti innan töfarinnar (debounce) vista samt í sýnina sem spjaldið var sleppt í. Vafrapróf í 1280 px: þrjú spjöld dregin í sýn, `hg_items` óbreytt. Commit 9d21828.

**Task 5, valmyndin.** `ViewMenu`: hnappurinn "Sýn" í topplínunni, listi (Aðalborð og sýnir með fjölda), ný sýn, breyta sýn og eyða sýn. Ritillinn byrjar á núverandi síu og vistar fullhakaðan hóp sem "allt" (`normalizeViewFilter`, spekk 5.4). `onReload` skilar Promise og ný sýn bíður eftir endurhleðslu áður en hún er valin, svo borðið blikkar ekki. Fimm ný próf fyrir `normalizeViewFilter`. Vafrapróf í 1280 px og 390 px. Í 390 px fannst galli (sýnaheitið í hnappinum gerði seinni dálkinn breiðari en línuna og teljararnir hrundu saman), lagaður með tveimur auka CSS reglum. Commit c2b9025.

## Staðfesting

- `npm run build`: grænt.
- `npm run test`: 28 skrár, 450 próf græn.
- `npm run smoke:hg`: `ok 9/9` (lifandi gagnagrunnur).
- Migrations: `0011_hg_views` og `0011b_hg_views_project_keys`, báðar beittar.
- Vafrapróf í tasks 4 og 5 sem Claude þjónustunotandi á `/p/metta`. Annar vafri var ekki opnaður, svo "Árni sér sýnina" var athugað með lestri á `hg_views` frekar en með öðrum notanda.
- Prófgögn úr task 5 eru hreinsuð: tvær sýnir eytt gegnum valmyndina og prófverkið 75ce5d2d sett á `dropped`.
- Yfirferð eftir hvern task. Lokayfirferð allrar greinarinnar á Fable er eftir.

## Hvað bíður

### Hjá Heimi

1. **Prófsýn í gagnagrunninum.** Sýnin "Í bið falin" (id `1c223cc2-e33a-4063-86f8-82253fd202bc`) með þremur prófstaðsetningum var skilin eftir í lifandi gagnagrunni eftir athugun í task 4, því SQL eyðingin var hafnað og eyðingar eru hjá Heimi. Annaðhvort eyðir hann henni í Sýn valmyndinni ("Eyða sýn"), eða heldur henni sem sinni eigin "Í bið falin" eftir að hafa raðað upp á nýtt, því það er sýnin sem planið bað hann um að búa til.
2. **Búa til "Í bið falin"** (ef prófsýnin er ekki notuð), þjappa henni saman með því að draga spjöldin og staðfesta að Árni sjái hana þjappaða.
3. **Hönnunarákvarðanir.** Hnappurinn "Sýn" þrengir topplínuna: teljaraströndin er um 140 px í 1280 px og 390 px og skrunast til hliðar. Undir 768 px er nafn virku sýnarinnar falið á hnappinum, svo upplýstur hnappur og listinn sýna hvaða sýn er virk. Segðu til ef þú vilt annað.

### Ákvarðanir sem gott er að vita

- Einingateljarar fylgja sýninni: í sýn sýnir hver eining bara það sem er teiknað (Kiosk fór úr 5 í 1 í prófinu).
- Hópur sem er allur hakaður (litir, pakkar, tögg) vistast sem "allt" (spekk 5.4). Það tekur líka með verk án tagga og verk í einingum án pakka.
- Slepping á spjaldi í sýn vistast í þá sýn, líka þótt áhorfandinn skipti um sýn innan töfarinnar (debounce).
- Staðsetningar sýnar eru bara í `hg_view_positions`. Spjald án sýnarstaðsetningar birtist á aðalstaðsetningu sinni.

### Smálegt sem bíður

Fannst í yfirferð og er ekki lagað. Ekkert af því brýtur neitt.

1. Smoke prófar ekki að staðsetning úr öðru verkefni sé hafnað (þarf annað verkefni).
2. `viewCounts` er O(sýnir x verk) og býr til einingakort fyrir hverja sýn.
3. Ekkert próf festir að sýn með bara óþekkta liti sýni allt.
4. Hreinsunarskilyrði `useActiveView` hefur ekki próf. `choose(X)` á þegar leystu X skilur eftir `unseen=X`, og ef X er eytt eftir það lifir dauði lykillinn til næsta vals eða endurhleðslu.
5. Í sýn horfir `placeNew` ekki á aðalstaðsetningar teiknaðra spjalda, svo nýtt spjald getur lent ofan á spjaldi á aðalborðinu (spekk 5.3.6).
6. `onDrop` endurnýtir `s.pending.baseX` án þess að athuga `pending.viewId` við sýnaskipti í miðju drag. Í versta falli einn snemmbúinn smellur.
7. Spjöld sem snúa aftur í sýn mounta með fyrstu `enterDelay` gildunum og geta raðast upp aftur í allt að 3 sekúndur við skipti til baka á aðalborðið.
8. Tögg í `NewItemSheet` koma úr `visibleItems`, svo í sýn eru bara tögg sýnarinnar boðin.
9. `.hg-view-ddb em` takmarkast við `--hg-menu-w` í stað eigin tákns.
10. Á meðan sýn er eytt er hægt að smella á flísar í listanum, og `onChoose(null)` yfirskrifar val sem var gert á meðan.
11. Villa í listanum hreinsast ekki þegar farið er í ritilinn og hætt við.
12. Á símum er sýnaheitið falið og `title` á földu `em` gagnslaust. Hnappurinn ætti að fá `aria-label` með heitinu.
