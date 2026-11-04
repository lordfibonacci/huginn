# 14 Vinnuborð: leit og tögg (plan 14)

Dagsetning: 2026-11-04
Grein: `vinnubord-14` (commits f995598 til 54368d2 ofan á main d272412, auk þessa skjals og CLAUDE.md). Greinin býr í worktree `D:/Claude Code/Huginn/huginn-vb14`, aðalmappan er áfram á main.
Plan: `docs/superpowers/plans/2026-11-04-leit-og-togg.md`
Spekk: `docs/superpowers/specs/2026-11-04-leit-og-togg-design.md`

Staða: kóðinn er smíðaður og yfirfarinn, en **ekkert af þessu er í loftinu**. Migration 0016 var hafnað af MCP tenginu ("Migration was declined"), svo Heimir þarf að keyra `supabase/migrations/0016_hg_tags_keywords.sql` í SQL editor. Þangað til má greinin hvorki fara á main né vera ýtt: main birtist sjálfkrafa á huginn.pro og bæði vefur og CLI lesa `hg_tags` þegar borðið hleðst, svo borðið og hver `pull` í metta2 lotum brotnuðu. hg-analyse útgáfa 12 er í greininni en ekki sett í loftið, útgáfa 11 er í loftinu. Lokayfirferð allrar greinarinnar (Fable) er gerð og lagfæringar hennar eru komnar í greinina (sjá kaflann Lokalagfæring).

## Hvað var gert

**Task 1, gagnagrunnur** (f995598, lagfæring 408f955). Migration `0016_hg_tags_keywords`: taflan `hg_tags` (`project_id`, `name`, einkvæmur lykill á `(project_id, lower(name))`, RLS fyrir þátttakendur, `created_by` stimplað), `hg_items.keywords text[]`, og þrjú RPC: `hg_tag_rename`, `hg_tag_merge`, `hg_tag_delete`. RPC setja `hg.silent` fyrir færsluna og stimpil, snertingu og atburðatriggerar á `hg_items` eru endurskilgreindir með `when` skilyrði sem sleppir þeim meðan það er kveikt, svo endurnefning, sameining og eyðing skrifa engan stimpil og engan `item.updated`. Snertitriggerinn horfir líka framhjá `keywords`. 36 upphafstögg metta eru sett inn svo listinn sé aldrei tómur. Lagfæringin tekur `execute` af `public` og `anon` og núllstillir `hg.silent` áður en hvert RPC skilar sér. README migrations fékk líka 0015 línuna sem vantaði.

**Task 2, nafnareglan** (e271536). `normalizeTag` í `lib/tags.ts` og `cli/lib/write.mjs` (lágstafir, hámark 40, ekkert komma), `tagRows`, `tagNameTaken`, `parseKeywords`, parity próf.

**Task 3, leitarvísir** (91a7e7d). `lib/search.ts`: `foldSearch` brýtur niður hástafi og broddstafi (ð helst ð) og `searchIndex` leitar í skrám, spurningum, verkum, spjalli og leitarorðum auk titils og texta. `filters.ts` notar vísinn. `Item.keywords`, `Tag` og `BoardData.tags` í `types.ts`.

**Task 4, Ctrl+F** (e87dc77). Ctrl+F (Cmd+F) á borðinu og í spjaldi opnar leitina í stað leitar vafrans, Esc tæmir hana. Í lesaranum fer Ctrl+F í leit vafrans sjálfs, því þar er leitað í skjalinu (spekk 4.1). Frávik frá plani: opið er rakið með mount ref en ekki `searchRequest > 0` (leitin þarf að þola að verkefni sé skipt).

**Task 5, taggalisti í stillingum** (035bcaf). `settings/TagsEditor.tsx` með fjórum föllum í `api.ts` (bæta við, endurnefna, sameina, eyða), `tagErrorMessage` sem þýðir 23505 og 22023, fjöldi verka á hverju taggi, markmið sameiningar núllast ef það hverfur. Notar `.hg-set-*` klasana, engir nýir klasar.

**Task 6, tögg í nýju verki** (76aa104). `NewItemSheet` velur tögg af listanum í stað þess að skrifa frjálsan texta. `parseTags` og `toggleTagText` í vefnum eru farin (4 próf fjarlægð).

**Task 7, CLI** (a5d6dfa). `huginn tag list`, `huginn tag add <nafn>`, `--keywords` á `item create` og `item set`, `Leitarorð` lína í `item.md`, og `withTagHint` sem bætir við tagalista þegar tagg er hafnað.

**Task 8, hg-analyse útgáfa 12** (9c960be). Greiningin fær taggalista verkefnisins í skilaboðin, velur tögg aðeins af listanum (hámark 6, `óflokkað` þegar ekkert passar) og skrifar leitarorð. Orð höfundar vinna. deno check hreint. **Ekki sett í loftið.**

**Task 9, hreinsun og 0016b** (1af46e4). `supabase/manual/2026-11-04-hg-tag-cleanup.sql` (Heimir keyrir, ein færsla, `hg.silent` kveikt, reiknað en ekki harðkóðað, skýrsla í lokin: stafsetningarsameining, tögg á opnum verkum sem færast á listann, einnotatögg á lokuðum verkum eytt, sýnir lagaðar) og `0016b_hg_tags_check` (trigger sem neitar taggi utan listans með 22023 og skiptir hverju taggi út fyrir stafsetningu listans).

**Task 10, skillið og leitarorð**: ekki gert, sjá ákvarðanir.

**Task 11, smoke atriði 13** (54368d2). Atriði 13 í `scripts/hg-smoke.mjs`: endurnefning, sameining, eyðing án atburða, leitarorð án atburðar, hástafatagg hafnað eftir 0016b. Skrifað, **ekki keyrt**.

## Ákvarðanir í byggingu

- 0016 var lagað áður en það var beitt: `execute` er aðeins fyrir `authenticated` (spekk 4.4), og `hg.silent` er núllstillt áður en hvert RPC skilar sér, svo stillingin lekur ekki yfir í aðra setningu í sömu færslu. Skráin er fryst þegar hún er beitt, því var yfirferð og lagfæring gerð fyrst.
- Sama regla fyrir migration og útsetningu: yfirferð fyrst, beiting eða útsetning á eftir.
- MCP hafnaði 0016. Ekki var reynt að fara framhjá því með `execute_sql` eða endurtekningu: höfnun er ákvörðun notandans eða tengisins. Heimir beitir skránni í SQL editor, eins og 0002 og 0006.
- Greinin var flutt í worktree `huginn-vb14` (node_modules tengill, `.env` afritað) og aðalmappan sett aftur á main. SessionStart hookið og `/huginn` skillið í metta2_new keyra CLI úr aðalmöppunni og CLI greinarinnar les `hg_tags`, sem er ekki til enn.
- Engin sameining á main og ekkert ýtt fyrr en 0016 er í loftinu.
- Task 10 frestað: skillreglurnar vísa á `tag list` og `--keywords`, sem aðal CLI hefur ekki fyrr en eftir sameiningu, og leitarorðaskrifin þurfa `keywords` dálkinn.
- Smoke atriði 13 er skrifað en ekki keyrt, því það þarf 0016, hreinsun og 0016b.
- Fjöldi verka á taggi telur aðeins borðgluggann (lokuð verk að 90 dögum). Spekk 7, síðasti punktur, velur þetta.
- Smíðalotan bætti engu við í Huginn (ekkert opið verk um plan 14 meðal 138) og sagði Heimi frá í spjalli. Lokalagfæringin bjó til eitt verk um plan 14 með tveimur aðgerðum á Heimi: að beita 0016 og að keyra hreinsunina.

## Staðfesting

- `npm run test`: 588 próf græn eftir lokalagfæringu (586 fyrir hana).
- `npm run build`: grænt.
- deno check á `supabase/functions/hg-analyse/index.ts`: hreint.
- `npm run smoke:hg`: **ekki keyrt**. Vænt `ok 13/13` eftir 0016, hreinsun og 0016b.
- hg-analyse útgáfa 12: **ekki sett í loftið**, útgáfa 11 er í loftinu.
- Handvirkar vafraathuganir Task 3 til 6: **ekki gerðar**, borðið hleðst ekki án `hg_tags`.
- Lifandi athugun yfirfarans á hreinsuninni: eftir sameiningar er ekkert opið verk með tagg utan listans, skref 5 eyðir 28 einnotataggum af lokuðum verkum, engin sýn verður taglaus.

## Það sem Heimir athugar

Aðeins hægt eftir að 0016 er beitt og greinin sameinuð.

- Ctrl+F á borðinu og í opnu spjaldi fer í leitarreitinn okkar (ekki leit vafrans). Í lesaranum opnast leit vafrans sjálfs. Esc tæmir leitina.
- Leit að `syning` finnur verk með taggið `sýning`.
- Leit finnur orð í skrám, spurningum, verkum og spjalli.
- Endurnefning á tagg í stillingum sést strax á kortshaus, í Tögg síunni og í sýn, án bjarma á neinu korti (ekkert ólesið).
- Sameining og eyðing á taggi: sama, og engin ný röð í sögunni.
- Nýtt verk: tögg valin af listanum, enginn frjáls texti.
- `huginn tag list` og `huginn tag add` í skel.
- Nýtt verk frá Árna fær tögg af listanum og leitarorð, og leitarorðin sjást hvergi á kortinu.

## Opið

Í þessari röð:

1. Heimir beitir `supabase/migrations/0016_hg_tags_keywords.sql` í SQL editor (Supabase, project `czdjxtsjgughimlazdmu`). Þegar því er beitt í höndunum verður það ekki skráð í `supabase_migrations.schema_migrations`, eins og 0002 og 0006.
2. Claude sameinar `vinnubord-14` á main (fast forward) og ýtir strax: `git checkout main && git pull --ff-only origin main && git merge --ff-only vinnubord-14 && npm run build && git push origin main`. Kóði greinarinnar þarf aðeins 0016.
3. Setja hg-analyse útgáfu 12 í loftið (`deploy_edge_function`, tvær skrár, `verify_jwt` false, íslenskir stafir sem `\u` í sendingunni, bera saman við repo).
4. Heimir keyrir `supabase/manual/2026-11-04-hg-tag-cleanup.sql` í SQL editor, les skýrsluna sem hún prentar í lokin og sendir Claude hana.
5. Beita `0016b_hg_tags_check`. Það má ekki koma á undan sameiningunni, því gamli vefurinn og gamla CLI sem eru í loftinu skrifa frjáls tögg og fengju hrátt 22023. Ef verk ber enn tagg utan listans neitar 0016b sjálft við beitingu og nefnir verkið.
6. `npm run smoke:hg`, vænt `ok 13/13`. Án hreinsunar og 0016b fellur atriði 13 skref a (hástafatagg vistast eins og skrifað).
7. Task 10: skillreglur í metta2_new (`tag list`, `--keywords`) og leitarorð á verkin sem eru til. Lesa push regluna í CLAUDE.md metta2_new fyrst, því ýtið fer með fyrri óýtt commit (6dd545c7 o.fl.).
8. Handvirkar vafraathuganir Task 3 til 6 (listinn hér að ofan), sérstaklega Ctrl+F á þröngu borði.

Frestað smávægilegt úr yfirferð (allt í `.superpowers/sdd/2026-11-04-leit-og-togg/progress.md`; það sem lokalagfæringin lagaði er talið upp í kaflanum Lokalagfæring):

- 0016b: bæði atriðin eru löguð (sjá Lokalagfæring).
- Kapphlaup: þögul endurnefning eða sameining hreyfir ekki `updated_at`, svo samtímis skrif hg-analyse (gluggi um 110 s á nýju verki) gæti sett gamla nafnið aftur. Eftir 0016b mistekst greining sem keppir við þögla endurnefningu með 22023 (sést sem `analysis.failed`). Bein PostgREST uppfærsla eða eyðing á `hg_tags` getur skilið verk eftir með tagg utan listans.
- hg-analyse: `MAX_TAGS` sker áður en skipt er í á lista og utan lista. Leitarorð eru ekki síuð gegn töggum höfundar eftir `mergeIntoItem` (spekk 4.6). Ekkert `MAX_KEYWORDS` loft eftir sameiningu. `óflokkað` getur lent í leitarorðum. Engin NFC jöfnun í taggasamanburði.
- Vefur: `viewFilterOf` heldur `q` og `unread` (setja `q` '' og `unread` false). Veikt próf fyrir `foldSearch('Þór')`. Ein lína sem fold sameinar getur spannað reitamörk (plan krafðist, skaðlaust).
- Ctrl+F: opið Pakki eða Tögg fellilisti verður áfram opinn og étur fyrsta Esc. Með nýtt verk eða síublað opið fer fókus á leitina bak við. Ctrl+F meðan Loader sést er gleypt. Á þröngu borði gæti `setSearchOpen` úr passive effect lent á eftir rAF fókus.
- TagsEditor: breyting á hástöfum eingöngu skilur Vista eftir virkt og drögin í hástöfum (`TagsEditor.tsx:143`). Öll 22023 skilaboð fara í gegn óbreytt. Athugasemd á `ProjectSettingsPage.tsx:388` ætti að nefna rauntíma.
- NewItemSheet: `chosen` heldur nöfnum, endurnefning eða eyðing meðan blaðið er opið sendir nafn utan lista (byggja af `tagList` síuðum með `chosen`). Tagghnappar án hópmerkis (`role=group aria-labelledby`). Tvöfalt bil á undan `noTags` vísbendingu.
- CLI: `tag list` og `tag add` prenta nöfn óhreinsuð (`commands.mjs:301`, `:314`, nota `oneLine`, escape raðir í terminal). README línan fyrir `item.md` ætti að nefna leitarorð (`cli/README.md:100`). `withTagHint` hefur ekkert eigið próf (einkafall, smoke 13 nær því).
- Smoke: sameining og eyðing hafa ekki eigin atburðaathugun. Endurnefning les aðeins `tags[0]`. Leitarorðagildi ekki borin saman. `void td` lína (plan). Orðalag við hluta eyðingu.
- Lítið: bókstafstab í stað `\t` í `tags.test.ts:9` og `parity.test.mjs:64`. Sýnaröð í hreinsun skref 3 er raðað (plan).
- Ef prófverk eða prófsýn verður eftir við smoke keyrslu er þess getið hér af lotunni sem keyrir hana.

## Lokalagfæring

Lokayfirferð Fable á allri greininni fann 16 atriði, öll löguð í einni umferð:

- Hreinsunin: skýrslutaflan lifir commit og síðasta setningin, á eftir `commit`, prentar hana, svo SQL editor sýnir skýrsluna. Skref 4 bætir aðeins á listann töggum sem standast regluna (hámark 40 stafir, engin komma) og skýrslan telur upp þau sem slepptust.
- 0016b: `u.t is not null` í athuguninni, svo `{NULL,'bogus'}` er hafnað á `bogus`, og `do` blokk efst sem neitar beitingu með 22023 og nefnir verk og tagg ef eitthvert verk ber tagg utan listans.
- hg-analyse: `mergeIntoItem` fellir leitarorð sem eru jöfn taggi (óháð hástöfum) og sker við `MAX_KEYWORDS`, með tveimur nýjum prófum.
- Vefur: nýtt verk sendir aðeins tögg sem eru enn á listanum, Ctrl+F á þröngu borði setur fókus í layout effect eftir að reiturinn sést, og Vista í taggalistanum setur reitinn aftur á vistaða stafsetningu.
- CLI: `tag list` og `tag add` prenta nöfn gegnum `oneLine`, README nefnir leitarorð í `item.md`.
- Próf og smoke: tvö ný `foldSearch` próf; atriði 13 athugar atburði eftir sameiningu og eyðingu, ber saman allt `tags` fylkið eftir endurnefningu og gildi leitarorðanna, og hluta eyðing nefnir hvaða auðkenni urðu eftir.
- Skjölin: röð þess sem er opið, Ctrl+F í lesaranum og handbeiting 0016.
