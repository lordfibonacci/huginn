# 14 Vinnuborð: leit og tögg (plan 14)

Dagsetning: 2026-11-04
Grein: `vinnubord-14` (commits f995598 til 1032144 ofan á main d272412), sameinuð á main með fast forward og ýtt 2026-11-04. Worktree og grein eru fjarlægð.
Plan: `docs/superpowers/plans/2026-11-04-leit-og-togg.md`
Spekk: `docs/superpowers/specs/2026-11-04-leit-og-togg-design.md`

Staða: **í loftinu** (2026-11-04). Heimir beitti `0016_hg_tags_keywords.sql` í SQL editor (MCP hafnaði henni), svo hún er ekki í `supabase_migrations.schema_migrations`, eins og 0002 og 0006. Staðfest í lifandi gagnagrunni: 36 tögg, `hg_items.keywords`, þrjú `hg.silent` when skilyrði, anon getur ekki keyrt RPC, `hg_tags` í rauntíma. Greinin er á main og ýtt (d272412..1032144). hg-analyse útgáfa 12 er í loftinu (útgáfa 11 farin). Heimir keyrði hreinsunina, `0016b_hg_tags_check` er beitt og smoke prentaði `ok 13/13`. Task 10 er gert. Heimir gerði vafraathuganirnar 2026-11-04 og verkinu í Huginn (1aeb972a) er lokað. Eftir er aðeins að sjá fyrstu raunverulegu greininguna á útgáfu 12 (sjá Opið).

## Hvað var gert

**Task 1, gagnagrunnur** (f995598, lagfæring 408f955). Migration `0016_hg_tags_keywords`: taflan `hg_tags` (`project_id`, `name`, einkvæmur lykill á `(project_id, lower(name))`, RLS fyrir þátttakendur, `created_by` stimplað), `hg_items.keywords text[]`, og þrjú RPC: `hg_tag_rename`, `hg_tag_merge`, `hg_tag_delete`. RPC setja `hg.silent` fyrir færsluna og stimpil, snertingu og atburðatriggerar á `hg_items` eru endurskilgreindir með `when` skilyrði sem sleppir þeim meðan það er kveikt, svo endurnefning, sameining og eyðing skrifa engan stimpil og engan `item.updated`. Snertitriggerinn horfir líka framhjá `keywords`. 36 upphafstögg metta eru sett inn svo listinn sé aldrei tómur. Lagfæringin tekur `execute` af `public` og `anon` og núllstillir `hg.silent` áður en hvert RPC skilar sér. README migrations fékk líka 0015 línuna sem vantaði.

**Task 2, nafnareglan** (e271536). `normalizeTag` í `lib/tags.ts` og `cli/lib/write.mjs` (lágstafir, hámark 40, ekkert komma), `tagRows`, `tagNameTaken`, `parseKeywords`, parity próf.

**Task 3, leitarvísir** (91a7e7d). `lib/search.ts`: `foldSearch` brýtur niður hástafi og broddstafi (ð helst ð) og `searchIndex` leitar í skrám, spurningum, verkum, spjalli og leitarorðum auk titils og texta. `filters.ts` notar vísinn. `Item.keywords`, `Tag` og `BoardData.tags` í `types.ts`.

**Task 4, Ctrl+F** (e87dc77). Ctrl+F (Cmd+F) á borðinu og í spjaldi opnar leitina í stað leitar vafrans, Esc tæmir hana. Í lesaranum fer Ctrl+F í leit vafrans sjálfs, því þar er leitað í skjalinu (spekk 4.1). Frávik frá plani: opið er rakið með mount ref en ekki `searchRequest > 0` (leitin þarf að þola að verkefni sé skipt).

**Task 5, taggalisti í stillingum** (035bcaf). `settings/TagsEditor.tsx` með fjórum föllum í `api.ts` (bæta við, endurnefna, sameina, eyða), `tagErrorMessage` sem þýðir 23505 og 22023, fjöldi verka á hverju taggi, markmið sameiningar núllast ef það hverfur. Notar `.hg-set-*` klasana, engir nýir klasar.

**Task 6, tögg í nýju verki** (76aa104). `NewItemSheet` velur tögg af listanum í stað þess að skrifa frjálsan texta. `parseTags` og `toggleTagText` í vefnum eru farin (4 próf fjarlægð).

**Task 7, CLI** (a5d6dfa). `huginn tag list`, `huginn tag add <nafn>`, `--keywords` á `item create` og `item set`, `Leitarorð` lína í `item.md`, og `withTagHint` sem bætir við tagalista þegar tagg er hafnað.

**Task 8, hg-analyse útgáfa 12** (9c960be). Greiningin fær taggalista verkefnisins í skilaboðin, velur tögg aðeins af listanum (hámark 6, `óflokkað` þegar ekkert passar) og skrifar leitarorð. Orð höfundar vinna. deno check hreint. Sett í loftið 2026-11-04.

**Task 9, hreinsun og 0016b** (1af46e4). `supabase/manual/2026-11-04-hg-tag-cleanup.sql` (Heimir keyrir, ein færsla, `hg.silent` kveikt, reiknað en ekki harðkóðað, skýrsla í lokin: stafsetningarsameining, tögg á opnum verkum sem færast á listann, einnotatögg á lokuðum verkum eytt, sýnir lagaðar) og `0016b_hg_tags_check` (trigger sem neitar taggi utan listans með 22023 og skiptir hverju taggi út fyrir stafsetningu listans).

**Task 10, skillið og leitarorð**: gert 2026-11-04. `/huginn` skillið í metta2_new fékk tagg- og leitarorðareglurnar (metta2_new commit 6bfd4517, ýtt). Öll 97 speglaðu metta verkin fengu 13 til 21 leitarorð hvert, skrifuð þegjandi (mesta `updated_at` og fjöldi atburða óbreytt, 0 opin verk án leitarorða).

**Task 11, smoke atriði 13** (54368d2). Atriði 13 í `scripts/hg-smoke.mjs`: endurnefning, sameining, eyðing án atburða, leitarorð án atburðar, hástafatagg hafnað eftir 0016b. Keyrt eftir hreinsun og 0016b: `ok 13/13`.

## Ákvarðanir í byggingu

- 0016 var lagað áður en það var beitt: `execute` er aðeins fyrir `authenticated` (spekk 4.4), og `hg.silent` er núllstillt áður en hvert RPC skilar sér, svo stillingin lekur ekki yfir í aðra setningu í sömu færslu. Skráin er fryst þegar hún er beitt, því var yfirferð og lagfæring gerð fyrst.
- Sama regla fyrir migration og útsetningu: yfirferð fyrst, beiting eða útsetning á eftir.
- MCP hafnaði 0016. Ekki var reynt að fara framhjá því með `execute_sql` eða endurtekningu: höfnun er ákvörðun notandans eða tengisins. Heimir beitir skránni í SQL editor, eins og 0002 og 0006.
- (Saga) Greinin var flutt í worktree `huginn-vb14` (node_modules tengill, `.env` afritað) og aðalmappan sett aftur á main. SessionStart hookið og `/huginn` skillið í metta2_new keyra CLI úr aðalmöppunni og CLI greinarinnar les `hg_tags`, sem er ekki til enn.
- Engin sameining á main og ekkert ýtt fyrr en 0016 var í loftinu. Það gekk eftir: sameinað og ýtt eftir að Heimir beitti 0016.
- Task 10 var frestað þar til eftir sameiningu og 0016, og var þá gert (sjá Task 10).
- Smoke atriði 13 var keyrt eftir 0016, hreinsun og 0016b.
- Fjöldi verka á taggi telur aðeins borðgluggann (lokuð verk að 90 dögum). Spekk 7, síðasti punktur, velur þetta.
- Smíðalotan bætti engu við í Huginn (ekkert opið verk um plan 14 meðal 138) og sagði Heimi frá í spjalli. Lokalagfæringin bjó til eitt verk um plan 14 með tveimur aðgerðum á Heimi: að beita 0016 og að keyra hreinsunina.

## Staðfesting

- `npm run test`: 588 próf græn. `npm run build`: grænt.
- deno check á `supabase/functions/hg-analyse/index.ts`: hreint.
- `npm run smoke:hg`: `ok 13/13` (2026-11-04, eftir 0016, hreinsun og 0016b).
- hg-analyse útgáfa 12: í loftinu, útgáfa 11 farin. Sett í loftið með MCP og birti textinn er eins og í repo við 1032144. Engin greining hefur enn keyrt á útgáfu 12.
- Skýrsla hreinsunarinnar (Heimir keyrði `supabase/manual/2026-11-04-hg-tag-cleanup.sql`): 36 tögg á listanum, 0 verk með tagg utan listans, engu bætt við, engin sýn varð taglaus.
- `0016b_hg_tags_check` beitt með MCP eftir hreinsunina.
- Lifandi athugun 0016: 36 tögg, `hg_items.keywords`, þrjú `hg.silent` when skilyrði, anon getur ekki keyrt RPC, `hg_tags` í rauntíma.
- Handvirkar vafraathuganir Task 3 til 6: gerðar af Heimi 2026-11-04 (handtak #93e3b40d á verkinu 1aeb972a), engar athugasemdir.

## Það sem Heimir athugar

0016 er beitt og greinin er á main, svo þetta er hægt núna.

- Ctrl+F á borðinu og í opnu spjaldi fer í leitarreitinn okkar (ekki leit vafrans). Í lesaranum opnast leit vafrans sjálfs. Esc tæmir leitina.
- Leit að `syning` finnur verk með taggið `sýning`.
- Leit finnur orð í skrám, spurningum, verkum og spjalli.
- Endurnefning á tagg í stillingum sést strax á kortshaus, í Tögg síunni og í sýn, án bjarma á neinu korti (ekkert ólesið).
- Sameining og eyðing á taggi: sama, og engin ný röð í sögunni.
- Nýtt verk: tögg valin af listanum, enginn frjáls texti.
- `huginn tag list` og `huginn tag add` í skel.
- Nýtt verk frá Árna fær tögg af listanum og leitarorð, og leitarorðin sjást hvergi á kortinu.

## Opið

Eftir:

1. Fyrsta raunverulega greiningin á útgáfu 12: hún keyrir sjálf á næsta nýja verki frá Heimi eða Árna. Athuga þá að tögg hennar séu af listanum og að hún skrifi leitarorð (engin greining hafði keyrt á útgáfu 12 þann 2026-11-04 kl. 10:30).

Verkið "Leit og tögg (plan 14): beita 0016 og ljúka" (1aeb972a) í Huginn er lokað 2026-11-04: öll þrjú handtökin (0016, hreinsun, vafraathuganir) eru lokin af Heimi.

Frestað smávægilegt úr yfirferð (allt í `.superpowers/sdd/2026-11-04-leit-og-togg/progress.md`; það sem lokalagfæringin lagaði er talið upp í kaflanum Lokalagfæring):

- Kapphlaup: þögul endurnefning eða sameining hreyfir ekki `updated_at`, svo samtímis skrif hg-analyse (gluggi um 110 s á nýju verki) gæti sett gamla nafnið aftur. Eftir 0016b mistekst greining sem keppir við þögla endurnefningu með 22023 (sést sem `analysis.failed`). Bein PostgREST uppfærsla eða eyðing á `hg_tags` getur skilið verk eftir með tagg utan listans.
- hg-analyse: `MAX_TAGS` sker áður en skipt er í á lista og utan lista. Engin NFC jöfnun í taggasamanburði.
- Vefur: `viewFilterOf` heldur `q` og `unread` (setja `q` '' og `unread` false). Ein lína sem fold sameinar getur spannað reitamörk (plan krafðist, skaðlaust).
- Ctrl+F: opið Pakki eða Tögg fellilisti verður áfram opinn og étur fyrsta Esc. Með nýtt verk eða síublað opið fer fókus á leitina bak við. Ctrl+F meðan Loader sést er gleypt.
- TagsEditor: öll 22023 skilaboð fara í gegn óbreytt. Athugasemd á `ProjectSettingsPage.tsx:388` ætti að nefna rauntíma.
- NewItemSheet: tagghnappar án hópmerkis (`role=group aria-labelledby`). Tvöfalt bil á undan `noTags` vísbendingu.
- CLI: `withTagHint` hefur ekkert eigið próf (einkafall, smoke 13 nær því).
- Smoke: `void td` lína (plan).
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
