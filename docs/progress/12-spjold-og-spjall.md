# 12 Vinnuborð: spjöld og spjall (plan 12)

Dagsetning: 2026-11-03
Grein: `vinnubord-12` (commits 630ab28 til b1450d2 ofan á main 8f65933, auk þessa skjals, símaskotsins og CLAUDE.md)
Plan: `docs/superpowers/plans/2026-11-03-spjold-og-spjall.md`
Spekk: `docs/superpowers/specs/2026-11-03-spjold-og-spjall-design.md`

Staða: smíði lokið, bíður lokayfirferðar allrar greinarinnar (Fable) og prófunar Heimis. Engin migration og engin breyting á gagnagrunni. Tvö commit í metta2_new (d4fb68b9 og 08b63afc, `/huginn` skillið) eru **ekki ýtt**: þau fara með næsta ýti þeirrar geymslu.

## Hvað var gert

**Task 1, spjaldalíkan** (630ab28). `lib/cards.ts` fær `CARD_STAMP_DAYS` (7), `showStamp` (stimpill aðeins innan 7 daga, `<=`), `firstLine` (fyrsta lína sem er ekki tóm), `freshComment` (nýjustu ólesnu skilaboð annarra á verkinu, með stuttnafni og fyrstu línu) og `freshLine` (nýtt verk fyrst, svo skilaboð, annars tegundirnar). `CardModel` fær `moduleName`, `showStamp` og `freshComment`; `BoardPage` sendir athugasemdir, lesmerki og `now`.

**Task 2, spjaldið teiknað** (3b14f54). Spjaldið sýnir stöðu, titil, módúl (`.hg-card-module`), stimpilinn aðeins innan 7 daga, flís fyrir skjöl og handtök (engin tögg lengur) og eina línu `.hg-card-fresh` (einnar línu, "Á: fyrsta lína" fyrir skilaboð, "Nýtt verk" eða tegundirnar). Hringurinn er farinn (`.hg-card-ring` og `--hg-ring-*` tokens), í staðinn fær spjald með eitthvað nýtt daufan gullbjarma `.hg-card-new` (tokens `--hg-card-new-*`, `--hg-card-module-gap`). Lyklarnir `card.fresh.since` og `card.unread` fjarlægðir.

**Task 3, hæð spjalds í CLI** (cb2c0f3, lagfæring 712c386). `estimateCardHeight(item, board, now)` í `cli/lib/write.mjs`: engin tögg, módúllína, stimpilröð aðeins innan 7 daga. `base.cardBySize`, `base.cardModuleGap` og `CARD_STAMP_DAYS` í `parity.test.mjs`. Í lagfæringunni metur `placeItem` nýtt spjald eins og nýbreytt og í sínum módúl, svo pláss sé fyrir stimpil og módúllínu.

**Task 4, spjallraðir** (369b0f1). `lib/chat.ts` með `chatRows` (dagaraðir, ein "nýtt" röð fyrir fyrstu ólesnu skilaboðin, `me`, `them` eða `claude`) og `latestForeignCommentAt`. `formatDay` í `dateUtils` ("í dag", "í gær", annars dagsetning), lykill `dates.yesterday`.

**Task 5, Spjall flipinn** (df9eaac). `components/panel/ChatTab.tsx`: kúlur, þínar hægra megin í bláu, hinna vinstra megin, Claude í fjólubláu með bjarma (`--hg-msg-claude-glow`, `none` í `pointer: coarse`), tenglar virkir (greinarmerki og lokasvigi aftast eru texti, `linkParts` í `lib/chat.ts`), nafn og klukka undir hverri kúlu ("Árni, 11:20", `formatTime`), opnast á "nýtt" röðinni eða neðst. Spjall er annar flipi í `ItemPanel`, punktur `.hg-pn-tab-dot` þegar ólesin skilaboð bíða og flipinn er ekki opinn. `CommentBox`: með mús sendir Enter og Shift og Enter gefur nýja línu, á snertiskjá gefur Enter nýja línu, Ctrl eða Cmd og Enter sendir alls staðar; eftir sendingu, úr hvaða flipa sem er, skiptir spjaldið yfir á Spjall og skrunar neðst. Sagan segir "skrifaði í spjallið".

**Task 6, litaskýring** (70a0b09). `.hg-legend` og `.hg-legend-dot` í notandavalmyndinni: litirnir fimm með skýringu.

**Task 7, spjallið í `item.md`** (b1450d2). `renderItemMd` í `cli/lib/mirror.mjs` skrifar `## Spjall` (á eftir Spurningar, á undan Skrár) með ISO stimpli og nafni, `cli/README.md` uppfært. metta2_new commits d4fb68b9 og 08b63afc (ekki ýtt): `/huginn` skillið les `## Spjall` við lotubyrjun og þegar nýtt verk er sótt, og svarar þar með `huginn comment add` í lotulokum.

**Task 8, símaskot og skjöl** (afa0f32). `scripts/hg-shots.mjs` tekur `phone-10-chat` (Spjall flipinn á spjaldinu sem listinn valdi). Þetta skjal og CLAUDE.md.

**Lagfæringar lokayfirferðar** (559ea2a). Klukka undir hverri kúlu í stað `formatStamp` og komma aðeins þegar klukka er til; send úr öðrum flipa fer alltaf neðst (`sentAt` í `ItemPanel`, `toBottomRef` í `ChatTab`, svo opnun flipans fer ekki á "nýtt" röðina); greinarmerki aftast utan tengils; px gildi spjallsins orðin tokens (`--hg-msg-line-gap`, `--hg-msg-who-pad`, `--hg-pn-tab-dot-gap`, `--hg-pn-tab-dot-glow`); `.hg-legend` með `--hg-menu-item-pad`; auð lína inni í speglaðri spjalllínu er tóm, ekki tvö bil.

## Staðfesting

- `npm run build`: grænt.
- `npm run test`: 34 skrár, 551 próf græn (521 fyrir plan 12, 544 fyrir lagfæringar lokayfirferðar).
- `npm run smoke:hg` ekki keyrt: planið snertir engan gagnagrunnskóða.
- `SITE=http://localhost:4173 npm run shots:hg phone` á móti `npm run preview`: öll skot tekin, `phone-10-chat.png` sýnir Spjall flipann opinn ("Engin skilaboð enn" á valda spjaldinu, "Skrifa skilaboð" og Senda neðst). Engar villur í console.
- Task 2 skoðaði borðið í vafra (1280 px): einn gullbjarmi, 66 módúllínur, engin tögg á spjöldum, enginn hringur. Task 5 skoðaði Spjall flipann við 1280 px og 390 px með falsaðri sendingu (ekkert sent á metta).

## Það sem Heimir athugar

- Bjarmi á spjaldi sem Árni snerti, og línan neðst með fyrstu línu skilaboða hans ("Á: ...").
- Punkturinn á Spjall flipanum kviknar meðan spjaldið er opið á Staða og Árni skrifar (realtime, þarf tvo notendur).
- Claude kúlan er fjólublá með daufum bjarma (ekki hægt að sjá í smíðinni, þar var Claude notandinn sjálfur áhorfandinn). Á síma og iPad er bjarminn enginn.
- Langt spjall opnast á "nýtt" röðinni, ekki efst og ekki neðst.
- Enter á símanum gefur nýja línu og sendir ekki; Senda hnappurinn sendir.
- Að senda meðan Staða flipinn er opinn á löngu spjalli með ólesnu skiptir yfir á Spjall og endar neðst, ekki á "nýtt" röðinni.
- Spjald eldra en 7 daga sýnir ekki stimpilröðina (stuttnafn og dagsetning, til dæmis "C 31. október"). Öll metta verk voru yngri en 7 daga í smíðinni, svo þetta sést fyrst eftir 7. nóvember.
- Litaskýringin í notandavalmyndinni (smella á hringinn með upphafsstafnum): fimm litir með skýringu. Var ekki skoðuð í vafra.
- `huginn sync` í metta2_new skrifar `## Spjall` í `item.md` verks sem á skilaboð.

## Opið

- metta2_new commits d4fb68b9 og 08b63afc eru ekki ýtt.
- Smávægilegt sem var frestað í yfirferð (allt í `.superpowers/sdd/2026-11-03-spjold-og-spjall/progress.md`): ólesið á spjaldi hefur ekki lengur texta fyrir skjálesara; stytt módúllína og skilaboðalína hafa engan `title`; eytt nýrra skilaboð getur kveikt punktinn aftur; `hg_comments` er sótt án marka í CLI.
