# Huginn: leit og tögg (hönnunarskjal)

Dagsetning: 2026-11-04
Staða: drög Claude (Fable) úr minnispunktunum í `2026-11-03-naestu-verk-hugmyndavinna.md` (verk 3). Heimir bað um að skjalið yrði skrifað beint úr punktunum, svo opnu atriðin þar eru ákveðin hér og merkt í kafla 7.
Grunnur: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (gagnalíkan), plan 4 (`hg-analyse`), plan 7 (sýnir, `hg_views.filter` geymir tögg), plan 12 (tögg fóru af kortum), plan 13 (skjöl með lýsingu). Þetta skjal bætir við einni töflu (`hg_tags`), einum dálki (`hg_items.keywords`), þremur RPC föllum og einum kveikjara, og breytir leitinni, síuvalmyndinni, nýja verkinu, stillingasíðunni, CLI, speglinum, skillinu og `hg-analyse`.

Þetta er þriðja af fjórum verkum úr samtalinu 3. nóv. Verk 1 (spjöld og spjall) er plan 12, verk 2 (skjöl) er plan 13. Kassar og tiltekt fá sitt eigið skjal.

## 1. Tilgangur

Leitin á borðinu finnur í dag aðeins titil, samantekt, meginmál og tögg (`matches` í `lib/filters.ts`). Það sem Heimir man eftir er oft annars staðar: í svari við spurningu, í handtaki, í spjallinu eða í nafni skjals. Og hann man það á öðru orði en stendur á kortinu: "social media" þegar kortið segir "efni", "sýning" þegar taggið var skrifað "syning". Hann þarf líka að ýta á leitarhnappinn með músinni, Ctrl+F opnar vafraleitina sem finnur ekkert á canvas.

Töggin eru 67 ólík á um 75 verkum, 41 þeirra notað einu sinni, sum tvisvar með og án broddstafa. `hg-analyse` býr til 2 til 6 ný tögg á hvert verk og listinn vex með hverju verki. Tögg sem enginn tveir nota eins eru ekki sía.

Lagfæringin: leitin nær yfir allt sem fylgir verki, hvert verk fær falin leitarorð á íslensku og ensku sem Claude skrifar, Ctrl+F fer í leitarreitinn, töggin verða fastur listi verkefnisins sem er stýrt í stillingum, og núverandi tögg eru hreinsuð einu sinni.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Ctrl+F (og Cmd+F) á borðsíðunni fer í leitarreitinn þegar enginn reitur hefur fókus og lesarinn er ekki opinn. Esc í reitnum hreinsar leitina og fer úr reitnum.
- Leitin finnur orð í titli, samantekt, meginmáli, töggum, leitarorðum, skjalanöfnum og lýsingum skjala, spurningum og svörum, handtökum og skilaboðum í spjalli. Broddstafir skipta ekki máli ("syning" finnur "sýning").
- `hg_items.keywords`: 10 til 15 leitarorð á verk, íslensk og ensk, samheiti og orðin sem fólk mundi slá inn. Skrifuð af `hg-analyse` á ný verk og af Claude í lotum (`huginn item set --keywords`). Hvergi sýnd á vefnum. Lesin af leitinni einni.
- Fastur taggalisti verkefnisins (`hg_tags`). Tagg á verki verður að vera á listanum, gagnagrunnurinn hafnar öðru. Stillingasíðan sýnir listann með fjölda verka á hverju taggi og leyfir að bæta við, endurnefna, sameina tvö í eitt og eyða. Endurnefning, sameining og eyðing skrifa á öll verk án þess að stimpla þau eða merkja ólesin.
- `hg-analyse` velur tögg úr listanum. Frjáls tögg sem módelið stingur upp á verða leitarorð.
- Nýtt verk á vefnum velur tögg af listanum með hnöppum, enginn frjáls textareitur.
- Ein hreinsun á töggunum sem eru til: lágstafir, tvítök með og án broddstafa sameinuð, töggin sem eru notuð tvisvar eða oftar eða standa á opnu verki fara á listann, hin falla af lokuðu verkunum sem bera þau. SQL í skrá sem Heimir les og keyrir sjálfur.
- Leitarorð á öll verk sem eru á borðinu núna, skrifuð í byggingarlotunni úr `item.md` hvers verks.

**Ekki-markmið**

- Að sýna hvar leitin fann orðið (bútur eða undirstrikun). Kortið dofnar eða ekki, eins og í dag.
- Leit í texta skjalanna sjálfra. Nöfn og lýsingar skjala duga, innihaldið er í skjalinu og lesaranum.
- Leit í CLI (`pull` fær enga `--search`).
- Að sýna leitarorð á vefnum, á kortinu, í spjaldinu eða í síuvalmyndinni. Þau eru til fyrir leitina eina. Í `item.md` standa þau, því Claude þarf að sjá þau til að bæta við þau.
- Að breyta hvaða tögg síuvalmyndin og sýnaritillinn bjóða: áfram töggin sem eru í notkun á borðinu, með fjölda.
- Litur, röð eða lýsing á taggi. Taggið er nafn.
- Taggalisti í CLI umfram `tag list` og `tag add`. Endurnefning, sameining og eyðing eru á stillingasíðunni.

**And-markmið**

- Leit sem þarf netkall á hverjum staf. Allt sem leitin les er þegar á borðinu í `BoardData`, vísitalan er reiknuð í minni.
- Endurnefning taggs sem gerir öll verk ólesin fyrir Árna og setur "uppfært" stimpil á þau. RPC föllin þagga kveikjarana sem stimpla og skrá atburði.
- Tagg sem er til í tveimur stafsetningum. Listinn er einstakur óháð há- og lágstöfum, og gagnagrunnurinn skrifar stafsetningu listans á verkið hvernig sem það var slegið inn.
- Töggum bætt á kort aftur. Plan 12 tók þau af kortunum, þau sjást í haus spjaldsins og í síuvalmyndinni.
- Lituð rönd eða bar á nokkurri röð í taggalistanum eða síuvalmyndinni.

## 3. Skorður

- Supabase verkefnið er deilt, aðeins `hg_` hlutir. Migration beitt með MCP `apply_migration`, aldrei `db push`. Allt DROP og DELETE keyrir Heimir sjálfur, þess vegna er hreinsunin skrá sem hann keyrir og kveikjarinn sem hafnar töggum utan lista sér migration (0016b) sem er beitt eftir hreinsunina, eins og 0010b og 0011b.
- Engin breyting á `hg_log_event` og `hg_touch_updated_at` að öðru leyti en að `keywords` bætist við dálkana sem `hg_touch_updated_at` hunsar. Þöggunin er í `when` skilyrði kveikjaranna, með `create or replace trigger`, ekkert DROP.
- `hg-analyse` er áfram tvær skrár, `lib.ts` án innflutnings og án Deno, prófað með vitest. Útgáfa 12.
- CLI er Node ESM og afritar reglur sem það þarf (`normalizeTag`) með parity prófi.
- Engin ný bókasöfn. Leitarjöfnunin er `normalize('NFD')` og hreinsun á samsetningarmerkjum, engin fuzzy leit.
- Engin þankastrik. Íslenskt viðmót. Nýir i18n lyklar undir `vinnubord.*`, Icelandic copy sem Heimir sér er skrifuð orðrétt í planinu.
- Reglur í `vinnubord.css` lesa aðeins tokens.

## 4. Hegðun

### 4.1 Ctrl+F og Esc

Á `BoardPage` hlustar gluggi á `keydown`. Ctrl+F eða Cmd+F (án Alt og Shift) fer í leitarreitinn þegar virki þátturinn er ekki `input`, `textarea`, `select` eða `[contenteditable]` og lesarinn (`readerFileId`) er ekki opinn. Þá `preventDefault`, svo vafraleitin opnast ekki, og `TopBar` opnar reitinn (á mjóu borði er hann á bak við stækkunarglerið, `openSearch` sýnir hann) og setur fókus í hann með textanum völdum. Meðan lesarinn er opinn á Ctrl+F vafrann: Heimir leitar þá í skjalinu.

Esc í reitnum: ef reiturinn hefur texta er leitin hreinsuð (`setQuery('')`) og fókus fer úr reitnum; ef hann er tómur fer fókus úr reitnum. Esc í reitnum lokar engu öðru, eins og í dag (`stopPropagation`).

### 4.2 Leitin nær víðar

`lib/search.ts` (nýtt, hreint):

- `foldSearch(s)`: lágstafir (`toLocaleLowerCase('is')`), `normalize('NFD')`, samsetningarmerki (`̀` til `ͯ`) fjarlægð, hvítbil þjappað. "Sýning" og "syning" verða "syning". ð, þ og æ halda sér, þau eru ekki broddstafir.
- `searchIndex(data)`: `Map<itemId, string>` yfir öll verk í `data.items`. Textinn er `foldSearch` af línum: titill, samantekt, meginmál, tögg, leitarorð, nafn og lýsing hverrar skráar verksins, spurning og svar hverrar spurningar, texti hvers handtaks, texti hverrar athugasemdar á verkinu. Línur með `\n` á milli.
- `matches(item, ctx, f)` fær `ctx.text` (þegar jafnaður texti verksins) og leitar `foldSearch(f.q)` í honum í stað þess að byggja textann úr verkinu. `views.ts` sendir `text: ''`, því sýn ber aldrei leitarstreng.

`BoardPage` reiknar vísitöluna einu sinni á `data` (`useMemo`) og sendir hana í `cardModels` gegnum `CardContext.search`. Ekkert annað breytist: kort sem passar ekki dofnar, listinn fylgir `visible` eins og í dag.

### 4.3 Leitarorð

Migration 0016: `hg_items.keywords text[] not null default '{}'`. `hg_touch_updated_at` hunsar dálkinn (eins og `pos_x`, `pos_y` og `analyse_lock_until`), `hg_log_event` nefnir hann ekki: leitarorðaskrif stimpla ekkert og skrá engan atburð, svo Claude getur skrifað þau á 55 verk án þess að neitt verði ólesið.

Skrifarar:

- `hg-analyse` (4.6): nýr reitur `keywords` í tólinu, 10 til 15 orð.
- `huginn item create --keywords a,b` og `huginn item set <id> --keywords a,b`: skipt á kommu eins og tögg (`parseTags`), lágstafir, tvítök felld. `--keywords ""` tæmir. `set` skiptir listanum út, svo lota sem bætir við byrjar á línunni `Leitarorð:` í `item.md`.
- Vefurinn skrifar þau aldrei.

Lesarar: leitin (4.2), `item.md` (`- Leitarorð: a, b` í metalínunum á eftir `Merki:`), `pull --json` (dálkurinn fylgir `select *`). Hvergi á vefnum.

### 4.4 Fastur taggalisti

Migration 0016: tafla `hg_tags` (`id`, `created_at`, `project_id`, `name`, `created_by`), participant RLS eins og `hg_views`, einstakt `(project_id, lower(name))`, check: nafn jafnt `btrim(name)`, ekki tómt, mest 40 stafir, engin komma (CLI skiptir á kommu). Realtime. `created_by` stimplað úr `auth.uid()`. Sama migration setur byrjunarlistann (4.5) inn fyrir verkefnið metta, svo listinn er aldrei tómur: nýja verkið, stillingarnar og greiningin hafa tögg frá fyrstu mínútu.

Reglan í kóða, `normalizeTag(text)` í `lib/tags.ts` og `cli/lib/write.mjs` (parity): lágstafir (`is`), hvítbil þjappað í eitt bil, trim; tómt, lengra en 40 eða með kommu er villa með íslenskri ástæðu. Þetta er það sem stillingasíðan, `tag add` og `hg-analyse` skrifa á listann.

Þrjú RPC föll, security invoker (RLS gildir), `set search_path = public`, execute aðeins fyrir `authenticated`:

- `hg_tag_rename(p_tag uuid, p_name text)`: nafn raðarinnar, nafnið á `tags` hvers verks í verkefninu sem ber það, og í `filter->'tags'` hverrar sýnar sem ber það.
- `hg_tag_merge(p_from uuid, p_into uuid)`: `from` verður `into` á verkum og sýnum (tvítök felld), `from` röðin eytt. Bæði í sama verkefni, annars villa.
- `hg_tag_delete(p_tag uuid)`: taggið tekið af verkum og sýnum, röðin eytt. Hafnar með `22023` og textanum `Taggið er eina taggið í sýninni "X". Breyttu sýninni fyrst.` ef einhver sýn verkefnisins hefur þetta tagg eitt í `filter->'tags'`, því tómur listi þýðir öll tögg og sýnin opnaðist þá upp á gátt án þess að neinn sæi. Sameining tæmir aldrei sýn, `into` kemur í staðinn.

Öll þrjú kalla `set_config('hg.silent', 'on', true)` fyrst. Kveikjararnir `hg_items_stamp_trg`, `hg_items_touch_trg` og `hg_items_log_event_trg` eru endurskilgreindir með `create or replace trigger` og `when (current_setting('hg.silent', true) is distinct from 'on')`, svo skrif RPC fallanna hreyfa hvorki `updated_at`, `updated_by` né skrá `item.updated`. Utan RPC fallanna er stillingin aldrei sett, svo venjuleg skrif hegða sér eins og í dag. Verkin sem RPC skrifar fá nýjan `hg_items` realtime atburð, svo opin borð sækja þau.

Migration 0016b (eftir hreinsunina): kveikjari `hg_items_tags_trg` (`before insert or update of tags`) sem skiptir hverju taggi út fyrir stafsetningu listans (samanburður óháður há- og lágstöfum, `btrim`), fellir tvítök og heldur röð, og hafnar með `22023` og textanum `Taggið "x" er ekki á taggalista verkefnisins.` ef eitthvert tagg er ekki á listanum. `óflokkað`, taggið sem `hg-analyse` setur á verk án módúls, er á listanum frá hreinsuninni.

**Stillingasíðan**, nýr kafli "Tögg" á milli Módúlar og Þátttakendur (`TagsEditor`): listi raðað eftir fjölda verka, svo nafni; hver röð er nafnreitur, fjöldi ("N verk", talið yfir verkin sem borðið hleður, opin og lokuð síðustu 90 daga), fellilisti "Sameina við" með hinum töggunum og Sameina hnappur, Eyða (staðfesting: `Eyða tagginu {{name}}? Það fer af {{count}} verkum.`) og Vista (virkur þegar nafnið breyttist og stenst `normalizeTag`, tvítak við annað tagg á listanum er villa). Neðst "Nýtt tagg": nafnreitur og Bæta við. Villur frá gagnagrunninum (einstakt nafn) fá íslenskan texta eins og `participantErrorMessage`. Engin pöntuð röð, engir upp og niður hnappar.

**Síuvalmyndin og sýnir** breytast ekki: `tagCounts` telur áfram töggin sem eru í notkun á sýnilegum verkum, sýnaritillinn býður töggin sem eru á borðinu. Endurnefning uppfærir `hg_views.filter`, svo sýn missir ekki taggið sitt.

**Nýtt verk**: tagghnapparnir (`.hg-tag-pick`) sýna allan listann raðaðan eftir fjölda, valin tögg eru `Set` í state, textareiturinn og "Komma á milli" hverfa. `parseTags` og `toggleTagText` í `lib/newItem.ts` fara með prófunum sínum.

**CLI**: `huginn tag list` (ein lína á tagg, `nafn (N)`, `--json` gefur `[{ id, name, count }]`), `huginn tag add <nafn>` (`normalizeTag`, tvítak er villan `Taggið er þegar á listanum.`). `--tags` á `item create` og `item set` er óbreytt, villan frá kveikjaranum kemur í gegn með hjálparlínu: `Taggið "x" er ekki á taggalista verkefnisins. huginn tag list sýnir hann, huginn tag add bætir við.` `cli/lib/client.mjs loadBoard` hleður `hg_tags`.

### 4.5 Byrjunarlistinn og hreinsunin

**Byrjunarlistinn** fer inn í migration 0016 (insert á verkefnið metta): töggin sem eru notuð tvisvar eða oftar eftir sameiningu stafsetninga, þau sem standa á opnu verki, `hönnun` og `óflokkað`. Úr gögnunum 4. nóv: smokes, tækniskuld, efni, fyrir sýningu, prófun, ákvörðun, pakki árna, kennsla, villa, eftir sýningu, árni leiðarvísir, hitamælingar, hugmynd, plan, vélbúnaður, afköst, askur, redeploy, hugmyndavinna, efnaskrá, lítið, öryggi, skynjarar, stóreldhúsið, sýning, áhættumat, dvali, edge function, eftirlit, gámes, gervigreind, sala, skjár, uppgjör, hönnun, óflokkað. 36 tögg. Heimir lagar listann eftir á í stillingum ef hann vill (endurnefna, sameina, eyða).

**Hreinsunin** er skrá `supabase/manual/2026-11-04-hg-tag-cleanup.sql`, ný mappa fyrir skriftur sem Heimir keyrir sjálfur (skráð í `supabase/migrations/README.md`). Hún er reiknuð, ekki harðkóðuð, svo hún er rétt hvenær sem hún er keyrð, líka eftir að ný verk hafa bæst við. Hún keyrir í einni færslu með `hg.silent` á, eftir að 0016 er beitt og hg-analyse útgáfa 12 er í loftinu, og áður en 0016b er beitt:

1. Öll tögg á verkum metta í lágstafi og trim, tvítök felld.
2. Stafsetningar sameinaðar með föstu korti: `syning` í `sýning`, `hitamaelingar` í `hitamælingar`, `efnaskra` í `efnaskrá`, `honnun` í `hönnun`, `postur` í `póstur`, `brainstorm` í `hugmyndavinna`.
3. Sama lágstöfun og sama kort á `filter->'tags'` hverrar sýnar.
4. Tagg sem stendur á opnu verki og er ekki á listanum bætist við `hg_tags` (`on conflict do nothing`). Opið verk missir aldrei tagg.
5. Tögg utan listans tekin af lokuðum verkum og af sýnum. Úr gögnunum 4. nóv eru það: áminning, auglýsingalúppa, auglýsingaskjár, básinn, eftirfylgni, fable, frágangur, greinar, handmælingar, hjálpartexti, huginn, hýsing, ipad, kælirennur, landing, lúppa, matseðill, mögulegt tvítak, myndband, ofnæmisvaldar, pg_cron, samningur, sýningarskjár, tilkynningar, tölvupóstur, uppskriftir, verklag.
6. Talningar í lokin sem Heimir les: töggin sem bættust við listann í lið 4, fjöldi taggs á listanum, fjöldi verka með tagg utan listans (á að vera 0), og sýnir sem urðu tagglausar í lið 5 (listi, hann lagar þær í Sýn valmyndinni).

Skráin er handtak á Heimi (`action add --owner H --payload-file`), og byggingarlotan segir honum frá henni um leið og hún er til. 0016b er beitt þegar hann hefur keyrt hana; ef það gerist ekki í byggingarlotunni stendur 0016b í repoinu og framvinduskjalið segir að hún sé óbeitt og að smoke atriði 13 bíði hennar. 0016b fer aldrei á undan útgáfu 12, því útgáfa 11 skrifar frjáls tögg og hver greining félli þá með `22023`.

### 4.6 hg-analyse (útgáfa 12)

- `readProject` les líka `hg_tags.name` verkefnisins. Skilaboðin fá kafla `# Tögg verkefnisins` með einu taggi á línu á eftir módúlunum (`(engin tögg skráð)` ef listinn er tómur).
- Regla 6 í `SYSTEM_PROMPT`: `tags: 1 til 4 tögg, aðeins af listanum Tögg verkefnisins, stafrétt. Búðu aldrei til nýtt tagg.` Ný regla: `keywords: 10 til 15 leitarorð, á íslensku og ensku, í lágstöfum: samheiti, orðin sem fólk mundi slá inn til að finna atriðið, nöfn á hlutum og þjónustum sem koma við sögu. Aldrei orð sem eru þegar tagg.`
- Tólið fær `keywords: string[]` sem skylduðan reit.
- `applyAnalysis(result, modules, tagNames)`: tagg sem er á listanum (óháð há- og lágstöfum) fær stafsetningu listans, tagg utan listans fer í `keywords` í stað þess að falla; `óflokkað` bætist aðeins við ef það er á listanum. `keywords`: `cleanTag` á hvert, lágstafir, tvítök felld, orð sem eru tagg verksins felld, mest `MAX_KEYWORDS` (20).
- `mergeIntoItem` skilar líka `keywords` (leitarorð verksins fyrst, svo greiningarinnar, tvítök felld), svo `writeAnalysis` skrifar þau í sömu skrifum og hitt. `Item` í `index.ts` fær `keywords`.

### 4.7 Skill og `item.md`

`/huginn` skillið í metta2_new fær þrjár reglur: `--tags` tekur aðeins tögg af `huginn tag list`; `huginn tag add` aðeins þegar ekkert tagg nær yfir verkið, og lotan segir Heimi frá nýja tagginu; hvert `item create` og greiningin (`item set` með `--body-file` og `--summary`) ber `--keywords` með 10 til 15 orðum eftir sömu reglu og `hg-analyse`, og `--keywords` skiptir út, svo lota sem bætir við byrjar á línunni `Leitarorð:` í `item.md`.

Leitarorð á verkin sem eru til: byggingarlotan keyrir `huginn sync` og sendir Sonnet undirlotur sem lesa `item.md` hvers verks á borðinu (opin og lokuð síðustu 90 daga, um 55) og skrifa `huginn item set <id> --keywords "..."`. Engin önnur skrif.

### 4.8 Smoke

`npm run smoke:hg` atriði 13 (eftir 0016b): `hg_tags` röð sett inn, verk fær `['Smoke Tag']` og les til baka `['smoke tag']`; tagg utan lista hafnað með `22023`; `hg_tag_rename` breytir tagginu á verkinu án þess að `updated_at` færist og án nýs atburðar; `hg_tag_merge` sameinar í annað smoke tagg; `hg_tag_delete` hafnar meðan smoke sýnin (atriði 9) hefur taggið eitt, tekur það svo af verkinu þegar sýnin hefur fleiri; leitarorðaskrif á verkið færa ekki `updated_at` og skrá engan atburð. Raðirnar í `hg_tags` eytt í `finally`.

## 5. Útlit

- Leitarreiturinn og síuvalmyndin breytast ekki í útliti.
- Stillingasíðan: kaflinn Tögg notar `.hg-set-sec`, `.hg-set-list`, `.hg-set-row`, `.hg-set-field`, `.hg-set-actions`, `.hg-btn`, `.hg-btn-ghost`, `.hg-btn-danger` eins og módúlarnir. Fjöldinn er `.hg-set-meta` við hlið nafnsins. Fellilistinn "Sameina við" er `select` í `.hg-set-field`. Nýtt token aðeins ef eitthvað þarf breidd sem er ekki til: `--hg-set-tag-count-w` fyrir fjöldann, annað ekki.
- Nýtt verk: `.hg-new-tags` og `.hg-tag-pick` óbreytt, aðeins fleiri hnappar og enginn reitur fyrir ofan.

## 6. Prófanir

Hrein rök með vitest:

- `lib/search.ts`: `foldSearch` (broddstafir, há- og lágstafir, ð þ æ halda sér, hvítbil), `searchIndex` (hver tegund línu kemur með, verk án fylgihluta, skrá og athugasemd annars verks kemur ekki með).
- `lib/filters.ts`: `matches` með `ctx.text`, leitarstrengur með broddstöfum finnur texta án þeirra og öfugt, tómur strengur passar við allt.
- `lib/tags.ts`: `normalizeTag` (lágstafir, hvítbil, tómt, 41 stafir, komma), `tagRows` (fjöldi og röð), villutexti fyrir tvítak.
- `cli/lib/write.mjs`: `normalizeTag` parity, `parseTags` fyrir `--keywords`.
- `cli/lib/mirror.mjs`: `Leitarorð:` línan, engin lína þegar listinn er tómur.
- `hg-analyse/lib.ts`: taggakaflinn í skilaboðunum, reglurnar í promptinu, `keywords` skyldað í tólinu, `applyAnalysis` með taggalista (stafrétt, utan lista í keywords, óflokkað aðeins af lista, þak, tagg verksins fellt úr keywords), `mergeIntoItem` með keywords.
- `lib/newItem.ts`: prófin fyrir `parseTags` og `toggleTagText` fara.

Smoke atriði 13 (4.8). Handvirkt: Ctrl+F á borði, í spjaldi, í lesara (vafrinn), á mjóu borði; Esc hreinsar; leit að "syning" finnur verk með "sýning" í svari við spurningu; endurnefning á taggi í stillingum breytir haus spjalds, síuvalmynd og sýn, og engin kort fá bjarma; nýtt verk með tögg af listanum.

## 7. Ákvarðanir Claude í skjalinu (Heimir sá þær ekki, má snúa)

- **Tafla, ekki jsonb.** `hg_tags` er tafla því endurnefning og sameining eru færslur á þremur töflum í einu og RPC fall með `set_config` er hreinasta leiðin til að þagga kveikjarana. Jsonb á `hg_projects` hefði sparað töflu en ekki RPC föllin.
- **Gagnagrunnurinn hafnar töggum utan lista** (0016b), ekki bara vefurinn og CLI. Annars er listinn fastur aðeins þar sem einhver man eftir því. Stafsetning listans er skrifuð á verkið, svo `Smokes` verður `smokes`.
- **Þöggun með `when` á kveikjurum**, ekki endurskrift á `hg_log_event`. Minnsta breyting sem nær tilganginum, og `create or replace trigger` kemst hjá DROP.
- **Jöfnun broddstafa er leitarregla, ekki tagaregla.** Töggin eru hreinsuð einu sinni og listinn heldur þeim einstökum, leitin jafnar broddstafi í hvert sinn. `normalizeTag` jafnar ekki broddstafi, "sýning" og "syning" væru tvö tögg ef einhver bætti báðum við, og þá er það sameining í stillingum.
- **Listinn í upphafi** er töggin sem eru notuð tvisvar eða oftar eða standa á opnu verki, auk `hönnun` og `óflokkað`, og hann fer í migration 0016 svo listinn sé aldrei tómur meðan beðið er eftir hreinsuninni. Heimir lagar hann í stillingum.
- **Hreinsunin er reiknuð**, svo opið verk missir aldrei tagg hvenær sem hún er keyrð, og sýnir fá sömu meðferð og verk. Sýn sem verður tagglaus er nefnd í úttakinu, ekki löguð í skránni, því tómur listi þýðir öll og það á Heimir að ákveða.
- **Eyðing hafnar meðan tagg er eina tagg sýnar.** Hinn kosturinn, að sýnin opnist þegjandi upp á gátt, er verri en ein villulína.
- **Leitarorð í `item.md`** þótt þau séu hvergi á vefnum: Claude þarf að sjá þau til að bæta við, því `--keywords` skiptir út.
- **Keywords á gömlu verkin** eru skrifuð af undirlotum í byggingarlotunni, ekki með skriftu sem kallar á Claude API, því engin lykill er á vél Heimis fyrir það og lotan hefur `item.md` hvort eð er.
- **Síuvalmyndin og sýnaritillinn bjóða áfram tögg í notkun**, ekki allan listann. Tagg sem ekkert verk ber síar ekkert.
- **Ctrl+F í lesaranum fer til vafrans.** Þar er leit í skjalinu það sem maður vill.
- **Esc hreinsar og fer úr reitnum í einu.** Minnispunktarnir sögðu "hreinsar og skilar fókus", og tvö Esc fyrir það væri óþarfi.
- **Mest 40 stafir og engin komma í taggi**, 20 leitarorð að hámarki frá greiningunni. Tölur, ekki reglur Heimis.
- **Í settings telur fjöldinn verkin sem borðið hleður** (opin og lokuð síðustu 90 daga), ekki öll verk sögunnar, því það er það sem `BoardData` hefur.

## 8. Eftir hjá byggjanda

- Nákvæm SQL í 0016, 0016b og hreinsuninni (planið ber hana orðrétt).
- Orðalag villna og hjálpartexta sem planið gefur ekki.
- Hvort `TopBar` fær `ref` með `useImperativeHandle` eða teljara í props fyrir "opna leit": planið velur.
