# 06 Vinnuborð: ólesið (plan 6)

Dagsetning: 2026-11-01
Grein: `main` (commits 4c551f7 til 7a9842a í Huginn ofan á d8dc7a8, auk lagfæringarinnar 0010b í síðasta commit lokayfirferðar, ekki ýtt þegar þessi texti var skrifaður).
Plan: `docs/superpowers/plans/2026-11-01-olesid.md`
Spekk: `docs/superpowers/specs/2026-11-01-olesid-og-synir-design.md`

Staða: kóðinn er búinn og yfirfarinn task fyrir task. Ólesið kemur nú úr atburðum í stað `updated_at`: spjaldið sýnir hring og línuna "Síðan síðast", teljarinn "N ólesin" síar borðið, spjaldið merkir nýju línurnar og "Merkja allt lesið" hreinsar allt. Vafraskoðun á tasks 4, 5 og 6 var ekki gerð í byggingunni (sjá Hvað bíður).

## Hvað var gert

**Task 1, migration 0010.** `0010_hg_unread` var beitt gegnum MCP 2026-11-01. `hg_unread` flokkar ólesna atburði áhorfandans eftir verki og tegund, `hg_mark_all_read` merkir allt lesið í einu og `hg_actions` fær `created_by` (stimplað af trigger). Staðfest með `execute_sql` sem Heimir (ólesnir flokkar fundust) og sem þjónustunotandinn (athuganir a, b og c stóðust). `npm run smoke:hg` skilaði `ok 8/8`. Atriði 8 var breytt frá planinu í byggingunni: smoke verkið er `done` á þeim tímapunkti, svo atriðið athugar fyrst að `hg_mark_all_read` skilji enga merkingu eftir á lokuðu verki, opnar það síðan aftur sem `parked` og athugar nýja merkingu stimplaða af þjóninum. Commit 4c551f7.

**Task 2, hrein föll.** `summarizeUnread`, ferskleikamerki og ólesinna sían sem hrein rökfræði í `reads.ts`, `filters.ts` og `status.ts` í `src/vinnubord/lib/` með prófum, og kallarar í `Board` og `ItemPanel` löguðir að nýju föllunum. Commit 396d6c4.

**Task 3, gögn.** Ólesnu raðirnar eru sóttar í `lib/api.ts`, kallið á "merkja allt lesið" bætist við og `useFilter` fær rofa fyrir ólesinna síuna. Commit c2f8276.

**Task 4, spjaldið.** Hringur á spjaldi með ólesnu og línan "Nýtt spjald" eða "Síðan síðast: ..." (`.hg-card-fresh`). Engin vafraskoðun. Commit 41b2e1a.

**Task 5, teljari og valmynd.** Teljarinn "N ólesin" fremst í röðinni með hring, sían dimmir restina og "Hreinsa" hreinsar hana. "Merkja allt lesið" í avatar valmyndinni. Engin vafraskoðun. Commit 7899d19.

**Task 6, hliðarspjaldið.** `markRead` keyrir við opnun og þegar nýrri atburður frá öðrum kemur á opna verkið (`latestForeignAt`). Spjaldið man `readAtOnOpen` áður en það merkir, svo nýjar línur eru áfram merktar þar til það lokast. Flipinn "Handtök (N ný)", litaðar raðir með "nýtt · stimpill". Engin vafraskoðun. Commit d09c5d3.

## Staðfesting

- `npm run build`: grænt.
- `npm run test`: 27 skrár, 435 próf græn.
- `npm run smoke:hg`: `ok 8/8` (keyrt í task 1 og aftur eftir 0010b, lifandi gagnagrunnur).
- Migrations: `0010_hg_unread` og `0010b_hg_unread_open_only`, báðar beittar.
- Yfirferð eftir hvern task. Lokayfirferð allrar greinarinnar á Fable er eftir og gerist áður en ýtt er.

## Hvað bíður

### Hjá Heimi

1. **Fyrsti smellur á huginn.pro: "Merkja allt lesið"** í avatar valmyndinni. Verkin 73 sem voru flutt inn eru ólesin hjá honum, svo borðið byrjar fullt af hringjum þar til þetta er gert.
2. **Handpróf úr spekk kafla 6.** Árni eða CLI bætir handtaki við lesið verk. Spjaldið sýnir línuna innan sekúndu og hliðarspjaldið merkir hana.
3. **Spjaldlínan** "Nýtt spjald" og "Síðan síðast: ..." á spjöldum með hring, í 1280 px breidd.
4. **Teljarinn "N ólesin"** fremst í röðinni með hring. Sían dimmir restina og "Hreinsa" hreinsar hana, í 1280 px og 390 px.
5. **Hliðarspjaldið.** Flipinn "Handtök (N ný)", litaðar raðir með "nýtt · stimpill", liturinn farinn eftir að spjaldið er lokað og opnað aftur.

### Opin atriði sem fundust í byggingunni

1. Lagað í lokayfirferð: migration `0010b_hg_unread_open_only` (beitt gegnum MCP 2026-11-01) takmarkar `hg_unread` við opin verk, svo flokkar fyrir `done` og `dropped` safnast ekki upp að 1000 raða þaki PostgREST (hjá Heimi fór talan úr 175 flokkum í 72, enginn lokaður).
2. Ferska línan bætir hæð á spjaldið sem `estimateCardHeight` í CLI telur ekki með (samþykkt í spekk 4.3).
3. Í 390 px breidd helst stimpill handtaks á línu textans í stað þess að brotna undir hann. Textadálkurinn mjókkar, ekkert flæðir yfir.
4. Ferskar sögulínur fá aukalegt padding svo þær sitji innrykkaðar.
5. Misheppnað "Merkja allt lesið" skrifar bara í console.
6. Hver keyrsla á `npm run smoke:hg` kallar á `hg_mark_all_read` sem Claude þjónustunotandinn á öllu metta.
7. Aukaregla `.hg-file.hg-fresh, .hg-q.hg-fresh` þurfti í CSS, því þær raðir setja eigin bakgrunn á eftir `.hg-fresh`.
