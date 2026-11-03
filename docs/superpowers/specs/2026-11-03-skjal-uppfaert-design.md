# Skjal uppfært: sama slóð er sama skjalið

Dagsetning: 2026-11-03. Staða: samþykkt af Heimi í spjalli, skrifað af Fable.

## Tilgangur

Þegar Claude vinnur í skjali (plan, grunninnlegg, efnisáætlun) og skrifar það inn á Huginn aftur og aftur með `huginn file add <item> <path> --repo-path docs/...`, þá verður til ný röð í `hg_files` og nýtt eintak í geymslunni í hvert sinn. Skjöl flipinn sýnir sex eintök af sama skjalinu, hvert með „nýtt". Heimir vill sjá eitt skjal, nýjustu útgáfuna, með tímastimpli um hvenær það var uppfært.

Reglan: **sama `repo_path` á sama verki er sama skjalið.** Ný útgáfa tekur við af þeirri gömlu, gamla eintakið er ekki geymt.

## Markmið

- Eitt skjal á hverja slóð á hverju verki, í Skjöl flipanum, í `pull`, í `item.md`.
- Línan undir skjalinu segir hver uppfærði það og hvenær („Uppfært: Claude, í dag 07:55"), annars hver bætti því við eins og nú.
- Uppfærsla telst ný fyrir hina þátttakendurna: „nýtt" merki í Skjöl, lína í Sögu („Skjal uppfært: nafn"), ólesið á spjaldinu, eins og „Skjal bætt við".
- Gagnagrunnurinn verndar regluna svo tvítök geti ekki orðið til aftur, sama hver skrifar.

## Ekki markmið

- Útgáfusaga skjala. Gamla eintakið er fjarlægt úr geymslunni.
- Skrár án slóðar (mynd dregin inn á vefnum, `item create --file`). Þær eru áfram hvert eintak sér. Lykillinn er slóðin, ekki nafnið.
- Vefupphal með slóð. Vefurinn sendir aldrei `repo_path` í dag (`NewItemSheet` hleður upp án slóðar), svo `uploadFile` í `src/vinnubord/lib/api.ts` breytist ekki. Vörnin í grunninum gildir samt fyrir hann.
- Plön (`hg_plans.path`). `plan add` er eitt á hvert plan og Skjöl flipinn listar þau sér. Óbreytt.

## Hönnun

### Gagnagrunnur: migration `0014_hg_file_replace`

1. `hg_files` fær `updated_at timestamptz` og `updated_by uuid`, bæði null þar til skjalið er fyrst skrifað yfir.
2. Stimplunin (`hg_stamp_author`, greinin fyrir `hg_files`) stimplar á UPDATE þegar `storage_path` breytist: `updated_at = now()`, `updated_by = coalesce(auth.uid(), new.updated_by)`. `uploaded_by` helst eins og nú (fyrsti höfundur). Breyting sem snertir ekki `storage_path` stimplar ekkert.
3. Atburðaskráningin (`hg_log_event`, greinin fyrir `hg_files`): triggerinn `hg_files_log_event_trg` verður `after insert or update`. Á UPDATE þegar `storage_path` er distinct from gamla gildið er skrifað `file.updated` með `data = { name }` og actor `coalesce(v_uid, new.updated_by)`. INSERT skrifar `file.added` eins og nú.
4. Vörn: `create unique index hg_files_item_repo_path_key on hg_files (item_id, repo_path) where repo_path is not null`.
5. `hg_files_analyse_trg` er áfram `after insert` eingöngu. Uppfært skjal setur ekki greiningu af stað.
6. Eitt skjal telst einu sinni ólesið. Bæði `file.added` og `file.updated` skrifa `file_id` í `data` (`{ name, file_id }`), og `hg_unread` er skipt út (sama undirskrift og í 0010b) svo talan á hverja tegund er `count(distinct coalesce(data->>'file_id', id::text))` í stað `count(*)`. Atburðir annarra tegunda hafa ekkert `file_id` og telja áfram hver fyrir sig; eldri skjalaatburðir án `file_id` líka. Þannig segir spjaldið „+1 skjal" þótt Claude hafi skrifað sama planið sex sinnum.

Migration er sett á með MCP `apply_migration`. Hún fellur ef tvítök eru til, svo Heimir keyrir hreinsunina fyrst (sjá Handvirk skref).

### CLI: `huginn file add` með `--repo-path`

Slóðin er stöðluð áður en hún er notuð, í hreinu falli með prófi (`normalizeRepoPath` í `cli/lib/write.mjs`): `trim`, bakstrik verður skástrik, `./` fremst er fjarlægt, tvöfalt skástrik verður eitt. Tóm slóð eftir stöðlun er villa. Lifandi gögnin á metta (skoðuð 2026-11-03) eru öll þegar á þessu formi, svo engar raðir þarf að endurskrifa.

Í `cli/lib/ops.mjs` fær `uploadFile` nýja hegðun þegar `repoPath` er gefið:

1. Leita að röð í `hg_files` með sama `item_id` og `repo_path`.
2. Finnist engin: eins og nú (nýtt eintak, insert).
3. Finnist röð með sömu `size`: sækja gamla eintakið (`downloadFile`) og bera bætin saman. Séu þau eins er ekkert gert: engin upphleðsla, engin uppfærsla, enginn atburður. Úttak „Skjal óbreytt", json `unchanged: true`. `/huginn` skilið skrifar á föstum augnablikum og skjalið er oft óbreytt á milli; óbreytt skjal á ekki að verða „nýtt" hjá hinum.
4. Finnist röð og bætin eru önnur: hlaða nýja eintakinu upp undir nýjum lykli (`storagePath(projectId, itemId, randomUUID(), name)`, `upsert: false` eins og nú, engin UPDATE regla er á geymslunni), uppfæra röðina (`name`, `storage_path`, `size`, `mime`), svo fjarlægja gamla eintakið úr geymslunni. Fellur uppfærslan er nýja eintakið fjarlægt aftur og skipunin fellur með „Gat ekki uppfært <nafn>". Fellur fjarlæging gamla eintaksins er það aðeins varað (`warning`), röðin er þegar rétt.
5. Röðin heldur sama `id`. Tenglar, lesmerki og spegillinn haldast.

Úttak: textinn „Skjal uppfært" í stað „Skjal bætt við", json fær `replaced: true`. `item create --file` breytist ekki (engin slóð).

Kapphlaup (tvær skipanir með sömu slóð á sama tíma, engin röð til fyrir): sú seinni fær `unique_violation` á insert, fjarlægir eintakið sitt og fellur með skýrum texta „Skjalið er þegar til, keyrðu skipunina aftur". Ekki reynt aftur sjálfkrafa.

### Vefur

- `FileRow` í `src/vinnubord/lib/types.ts` fær `updated_at: string | null` og `updated_by: string | null`.
- Stimpillinn sem röð skjals notar, bæði til að raða og til að sýna, er `updated_at ?? created_at`, og höfundurinn `updated_by ?? uploaded_by`. Hrein fall í `src/vinnubord/lib/` (t.d. `fileStamp(file)` í `upload.ts` eða nýrri `files.ts`) með prófi, svo Skjöl flipinn, röðunin og lesmerkin lesi sömu regluna.
- `FilesTab`: línan undir skjalinu er „Uppfært: {name}, {when}" þegar `updated_at` er sett (nýr lykill `vinnubord.panel.files.updatedBy` í `en.json`, `npm run translate` fyrir `is.json`), annars `files.by` eins og nú. „nýtt" merkið: `fresh(stamp, author)` með sömu reglu.
- `history.ts`: `file.updated` → lína `fileUpdated` („Skjal uppfært: {name}"), nýr lykill undir `vinnubord.panel.history.*` við hlið `fileAdded`.
- `reads.ts`: `'file.updated': 'file'` í flokkunartöflunni, svo ólesna talan og „Síðan síðast" telja það með skjölum.
- `useBoardData`: realtime UPDATE á `hg_files` kemur með `project_id` síunni og rennur í gegnum sömu leið og aðrar uppfærslur. Smiðurinn staðfestir að `hg_files` sé ekki meðhöndlað sem insert only neins staðar.

### CLI speglun og `pull`

CLI sýnir hvorki sögu né dagsetningar skjala í dag (`item.md` hefur enga sögu og engar dagsetningar á skráalínum, `pull` listar engar skrár), og það helst. Breytingarnar eru tvær:

- Skráalína í `item.md` (`fileLine` í `mirror.mjs`) fær viðbótina ` (uppfært YYYY-MM-DD HH:MM)` aðeins þegar `updated_at` er sett. Skjal sem aldrei hefur verið skrifað yfir rennur óbreytt í gegn, svo `sync` endurskrifar ekki allan spegilinn.
- `--json` úttak sem skilar skráaröðum ber nýju dálkana með (`select('*')` gerir það þegar).

`fileTargets` raðar áfram eftir `created_at` (nöfn í speglinum eiga að haldast stöðug), slóðarskjöl eru `repo` og eru hvort eð er ekki afrituð.

### Próf

- vitest: `history.test.ts` (nýja línan), `reads.test.ts` (flokkun `file.updated`), prófið fyrir `fileStamp`, CLI próf fyrir úttak og sögulínu, parity próf ef það nær yfir atburðategundir.
- vitest: `normalizeRepoPath` og `reads.test.ts` fyrir það að `hg_unread` talan á skjölum er lesin óbreytt (summarizeUnread breytist ekki, talan kemur talin úr grunninum).
- `npm run smoke:hg` fær atriði 11: `file add` með slóð þrisvar á sama verki (önnur bæti, sömu bæti, önnur bæti), staðfest ein röð, breytt `storage_path`, gömlu eintökin horfin úr geymslunni, `updated_at` og `updated_by` sett, einn `file.added` og tveir `file.updated` atburðir með `file_id`, `hg_unread` gefur 1 fyrir tegundina `file` hjá hinum þátttakandanum, og skrá án slóðar tvisvar gefur tvær raðir.
- `npm run build` grænt.

## Handvirk skref (Heimir)

Áður en migration 0014 er sett á keyrir Heimir hreinsunina í SQL ritlinum (DELETE er alltaf hans). Hún heldur nýjustu röðinni á hverri (verk, slóð) og eyðir hinum:

```sql
delete from hg_files f
using (
  select id, row_number() over (partition by item_id, repo_path order by created_at desc, id desc) as rn
  from hg_files
  where repo_path is not null
) d
where f.id = d.id and d.rn > 1;
```

Skoðað 2026-11-03: 15 skjöl eiga tvítök og 26 raðir fara. Eintökin í geymslunni sem þessar raðir vísuðu á verða munaðarlaus (lítil Markdown og HTML skjöl). Þau má fjarlægja í Storage í stjórnborðinu þegar hentar; ekkert les þau.

## Skráning

- `docs/progress/11-skjal-uppfaert.md` með því sem var byggt og hvað er opið.
- CLAUDE.md: Supabase kaflinn (migration 0014, `hg_files` dálkar), Key Patterns (ein regla: sama slóð er sama skjalið), `cli/README.md` (`file add` lýsing).

## Það sem smiðurinn ræður

- Hvar `fileStamp` býr og nákvæm nöfn á i18n lyklum.
- Hvort `uploadFile` í ops.mjs skiptist í tvö föll (insert og replace) eða eitt með grein.
- Orðalag í `cli/README.md`.
