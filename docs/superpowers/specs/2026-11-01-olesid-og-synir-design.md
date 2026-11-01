# Huginn: ólesið og sýnir (hönnunarskjal)

Dagsetning: 2026-11-01
Staða: drög eftir hugmyndavinnu Heimis og Claude (Fable) 1. nóv, mockup A valið í vafra.
Grunnur: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (gagnalíkan, borð, síur) og `2026-11-01-stada-ur-gognum-design.md` (handtök eru eina heimildin um hvað er eftir). Þetta skjal bætir við þremur hlutum sem verða þrjú plön: **A. Ólesið** (hvað er nýtt og hvað breyttist síðan ég leit síðast), **B. Sýnir** (vistuð borðsýn með eigin síu og eigin uppröðun) og **C. Handtak breytt og fellt niður** (CLI getur lagað handtak sem varð rangt). A og C deila handtakalistanum, svo C er byggt á eftir A.

## 1. Tilgangur

Heimir opnar Huginn að morgni eftir að Árni, skyndigreiningin og byggingarlotur hafa sett inn og breytt hlutum. Hann vill sjá á tíu sekúndum, áður en hann opnar nokkurt spjald: hvað er nýtt, hvað breyttist og hvað breyttist (handtak, skjal, spurning).

Tvennt kemur í veg fyrir það í dag:

1. Skyndigreiningin færir nýtt verk úr `new` í `waiting` á Heimi um leið og hún er búin. Verkið dettur úr „Nýtt" pillunni og blandast 24 öðrum sem bíða hans. Nýtt og gamalt verður eitt.
2. Ólesið-hringurinn á spjaldinu (`isUnread` í `lib/reads.ts`) horfir aðeins á `updated_at` verksins. Nýtt handtak, skjal, spurning eða athugasemd breytir `updated_at` ekki (triggerinn `hg_touch_updated_at` keyrir aðeins á `hg_items`), svo spjald með nýju handtaki frá Claude sýnir engan hring. Inni í spjaldinu sést ekki hvenær handtak kom inn né hvort Heimir hefur séð það.

Atburðaskráin `hg_events` (0003, 0004, 0007) skráir hins vegar hvert handtak, skjal, spurningu, svar, athugasemd, plan, stöðubreytingu og greiningu með tíma og geranda. Lesmerkin `hg_reads` segja hvenær hver notandi opnaði spjaldið síðast. Þar með er „hvað breyttist síðan ég leit síðast" reiknanlegt án nýrra gagna.

Hinn hlutinn: borðið er troðið (73 innflutt verk, 40 í bið). Heimir vill geta falið í bið verkin og þjappað því sem eftir er, farið svo aftur í aðalborðið og til baka og fundið sýnina eins og hann skildi við hana. Það er vistuð sýn með eigin uppröðun.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Pilla uppi, „N ólesin", sem telur spjöld sem einhver annar bjó til eða breytti síðan viðmælandi opnaði þau síðast, og síar borðið niður í þau.
- Spjaldið segir hvað breyttist án þess að vera opnað: „Nýtt spjald" eða „Síðan síðast: +2 handtök, +1 skjal, spurning".
- Inni í spjaldinu bera handtök, skjöl, spurningar og athugasemdir tímastimpil, og þau sem komu inn eftir síðustu opnun eru merkt „nýtt" þar til spjaldinu er lokað.
- Sýnir: vistuð sía plús uppröðun, sameiginlegar fyrir borðið, hver notandi velur sína virku sýn. Spjöld utan sýnar eru alveg falin, ekki dauf.
- Spjald sem er fært í sýn heldur þeirri stöðu í sýninni; spjald sem ekki hefur verið snert í sýninni fylgir aðalborðinu.

**Ekki-markmið**

- Dagsetningasíur („ný í dag", „uppfært síðustu 3 daga"). Heimir nefndi þær sem hugmynd; lesmerkin svara spurningunni sem hann var að spyrja (hvað hef ég ekki séð) betur en klukkan, því greiningin og Árni breyta hlutum sem hann hefur ekki séð í viku. Má bæta við seinna ef vantar.
- Yfirferð og lokun innfluttu verkanna. Sérverkefni, kemur á eftir þessu.
- Sýn sem felur einstök spjöld eða pakka handvirkt. Sýn er sía plús uppröðun, ekkert annað (Heimir, 1. nóv: „byrjum bara á því").
- Pan og zoom í sýn. Útsýnið er áfram per tæki eins og nú.
- Sýnir í CLI. `pull`, `sync` og `item.md` lesa aðalborðið; sýnir eru vefhlutur.
- Ólesið fyrir Claude þjónustunotandann. `pull` merkir ekkert lesið.

**And-markmið**

- Að spjald segi „ólesið" eftir að viðmælandi opnaði það. Opnun hreinsar, alltaf.
- Að eigin breytingar glói. Það sem viðmælandi gerði sjálfur er aldrei ólesið hjá honum.
- Að sýn breyti gögnum verks. Staða, módúll, handtök og aðalstaðsetning eru þau sömu í öllum sýnum. Sýnin á aðeins sína eigin hnit.
- Að sía sem einhver smellir á í sýn breyti sýninni sjálfri hjá hinum. Sýn breytist aðeins með „Vista".

## 3. Skorður

- Sama Supabase verkefni, aðeins `hg_` hlutir. Migration gegnum MCP `apply_migration`, engin DROP.
- RLS á nýjum töflum gegnum `hg_is_participant(project_id)` eins og á öllum hinum, allir þátttakendur lesa og skrifa allt. Nýjar töflur í `supabase_realtime` publication.
- Realtime DELETE berst ekki öðrum opnum borðum (sjá Key Patterns í CLAUDE.md). Eydd sýn hverfur hjá hinum við næstu breytingu eða endurhleðslu; sá sem eyðir endurhleður sjálfur.
- `EVENTS_LIMIT` 500 í `loadBoard` er fyrir Saga flipann. Ólesið má ekki byggja á þeim afmarkaða lista (eftir viku í burtu væru elstu ólesnu atburðirnir dottnir út), heldur á sérfyrirspurn (4.1).
- CLI afritar reglur vefsins í `cli/lib/*.mjs` með `parity.test.mjs`. Þessi hönnun breytir engri reglu sem CLI afritar (staðsetningartóka, `placeNewCard`, stöðunöfn), svo CLI er óbreytt.
- Engin þankastrik, engin bandstrik sem greinarmerki, íslenskt viðmót, nýir lyklar undir `vinnubord.*` í `en.json`, `is.json` gegnum `npm run translate`.

## 4. Hönnun A: ólesið

### 4.1 Gagnagrunnur: ólesnir atburðir per verk

Migration `0010_hg_unread`. Ein lesfyrirspurn, engin ný tafla, einn nýr dálkur:

`hg_actions` fær `created_by uuid` (nullable). Handtak hefur `owner` (sá sem á að gera það) en engan höfund, og ferskleikinn í 4.6 þarf höfundinn: handtak sem Claude setur á Heimi er nýtt hjá Heimi, handtak sem Heimir setur sjálfur á sig ekki. `hg_stamp_author` fær grein fyrir `hg_actions` á insert: `new.created_by := coalesce(auth.uid(), new.created_by)`, á update heldur það gamla gildinu. Eldri raðir standa með null og null telst „annar" (eins og `actor` null í `hg_unread`), svo gömul handtök sýnast ekki fersk nema lesmerkið sé eldra en þau. `Action` tegundin í `types.ts` og CLI mirror (`item.md` prentar handtök, ekki höfund) breytast ekki nema tegundin fái dálkinn.

```sql
create or replace function hg_unread(p_project uuid)
returns table (item_id uuid, kind text, n bigint, latest timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select e.item_id, e.kind, count(*)::bigint, max(e.created_at)
  from hg_events e
  left join hg_reads r on r.item_id = e.item_id and r.user_id = auth.uid()
  where e.project_id = p_project
    and e.item_id is not null
    and e.actor is distinct from auth.uid()
    and (r.read_at is null or e.created_at > r.read_at)
  group by e.item_id, e.kind
$$;
grant execute on function hg_unread(uuid) to authenticated;
```

Security invoker, svo select reglan á `hg_events` (þátttakendur) gildir og enginn sér annað verkefni. `actor is distinct from auth.uid()` telur líka atburði með `actor` null (skrifaðir af service role) sem annarra. Atburðir á verkum sem eru `done` eða `dropped` koma með en vefurinn telur aðeins spjöld á borðinu. Vísitala `hg_events_item_idx` er til; migrationin bætir við `hg_events_project_created_idx on hg_events (project_id, created_at)` fyrir fyrirspurnina.

Sama migration bætir við `hg_mark_all_read(p_project uuid)`, security invoker, sem gerir `insert ... on conflict (item_id, user_id) do update set read_at = now()` í `hg_reads` fyrir öll verk verkefnisins sem ekki eru `done` eða `dropped`, fyrir `auth.uid()`. Stimpiltriggerinn 0006 setur `read_at` hvort eð er. Insert og update reglurnar á `hg_reads` (0002) gilda óbreyttar.

`isUnread` í `lib/reads.ts` (updated_at reglan) fellur út og `Read` tegundin heldur sér.

### 4.2 Gögn á vefnum

`BoardData` fær `unread: UnreadRow[]` (`item_id`, `kind`, `n`, `latest`) úr `supabase.rpc('hg_unread', { p_project })` í `loadBoard`, í sömu `Promise.all`. Realtime á `hg_events` og `hg_reads` er þegar í áskriftinni, svo endurhleðslan sækir nýja summu þegar atburður eða lesmerki bætist við.

Hreint fall `summarizeUnread(rows, viewerId?)` í `lib/reads.ts` með prófi skilar `Map<itemId, UnreadSummary>`:

```ts
type UnreadKind = 'created' | 'action' | 'actionDone' | 'question' | 'answer' | 'file' | 'comment' | 'status' | 'plan' | 'ruling' | 'analysis' | 'analysisFailed' | 'text'
type UnreadSummary = { created: boolean; kinds: { kind: UnreadKind; n: number }[]; latest: string }
```

Vörpun atburðartegunda: `item.created` → created; `action.added` → action; `action.done` → actionDone; `question.asked` → question; `question.answered` → answer; `file.added` → file; `comment.added` → comment; `item.status` → status; `plan.added` og `plan.status` → plan; `ruling.added` → ruling; `analysis.done` → analysis; `analysis.failed` → analysisFailed; `item.updated` → text; annað er sleppt. `kinds` er raðað í þessari forgangsröð: action, actionDone, question, answer, file, comment, status, plan, ruling, analysis, analysisFailed, text, og `created` er fáni, ekki í listanum. Verk er ólesið þegar það á færslu í vörpuninni.

### 4.3 Spjaldið (mockup A)

Hringurinn `hg-card-ring` sést eins og nú þegar verkið er ólesið, nú samkvæmt `summarizeUnread`. Neðst á spjaldinu, undir smámerkjum og plönum, kemur lína `hg-card-fresh` með þunnri brotalínu ofan við, gulum texta (`--hg-gold` tónninn, ekki `--hg-c` spjaldsins):

- `created` satt: „**Nýtt spjald**", ekkert annað, þótt handtök hafi líka bæst við.
- annars „**Síðan síðast:**" og allt að þrjár pillur í forgangsröðinni, svo „+N" fyrir afganginn af tegundunum. Pillutextar með `count` lyklum: „+2 handtök", „+1 skjal", „spurning", „svar", „athugasemd", „staða", „plan", „úrskurður", „greind", „greining mistókst", „texti"; handtak, skjal, spurning, svar og athugasemd fá plús og tölu, hin eru stök orð án tölu (status og plan geta komið oft í einni lotu, talan segir ekkert).

Línan er aðeins á ólesnum spjöldum. `estimateCardHeight` í `cli/lib/write.mjs` telur hana ekki (CLI veit ekki hver horfir); það skekkir `placeNewCard` um eina línu á ólesnu spjaldi, og það er ásættanlegt.

### 4.4 Pillan og sían

`Filter` í `lib/filters.ts` fær `unread: boolean` (sjálfgefið false, í `serializeFilter`/`parseFilter`, `isActive` telur það). `matches` fær `ctx.unread` og fellir verk sem ekki er ólesið þegar `f.unread` er satt.

Fremst í teljararöðinni kemur pillan „N ólesin" (`vinnubord.board.counts.unread`), tónn gull með hring í stað punkts (`hg-count-unread`), sýnd þegar talan er yfir 0 eða sían er á. Smellur kveikir og slekkur á `filter.unread`. Talan er fjöldi spjalda á borðinu (í virkri sýn, sjá B) sem eru ólesin. `Counts` fær `unread`; `countsFor` fær `unreadByItem` sem inntak. Hreinsa hreinsar þetta eins og annað.

### 4.5 Merkja allt lesið

Í viðmælandavalmyndinni (`ViewerMenu`) kemur hnappur „Merkja allt lesið" sem kallar `hg_mark_all_read`. Sýnist alltaf, óvirkur meðan beðið er. Realtime á `hg_reads` endurhleður borðið og hringirnir hverfa. Engin staðfestingargluggi, aðgerðin er afturkræf í þeim skilningi að næsta breyting glóir aftur.

Fyrsta daginn: 73 innfluttu verkin eru stofnuð af þjónustunotandanum og flest án lesmerkis hjá Heimi og Árna, svo nánast hvert spjald segir „Nýtt spjald" og pillan um 70. Migrationin skrifar engin lesmerki; fyrsti smellur hvors um sig er „Merkja allt lesið". Framvinduskjalið segir það.

### 4.6 Inni í spjaldinu

`ItemPanel` tekur við opnun `readAtOnOpen`: `read_at` viðmælandans á verkinu úr `data.reads` í fyrsta render (`useState` initializer, keyrir aðeins við mount því panelinn er keyed á verk), áður en `markRead` skrifar. Hreint fall `isFresh(createdAt, author, readAtOnOpen, viewerId)` í `lib/reads.ts` með prófi: satt þegar höfundur er ekki viðmælandi og (`readAtOnOpen` null eða `createdAt > readAtOnOpen`).

- **Handtök** (`ActionList`): höfundur er `created_by` (4.1). Hver lína fær tímastimpil `formatStamp(created_at)` hægra megin (eigandi, texti, stimpill). Ferskt handtak fær `hg-act-new` (dauf gul bakgrunnsslikja) og stimpillinn verður „nýtt · <stimpill>" í gulu. Afgreidd handtök í samanbrotna listanum fá stimpilinn en aldrei merkinguna.
- **Skjöl** (`FilesTab`): skrár fá sömu merkingu á sinni línu. Plön með slóð fá hana ekki (plan hefur engan höfund).
- **Spurningar** (`QuestionsTab`): spurning fersk eftir `asked_by` og `created_at`; svar ferskt eftir `answered_by` og `answered_at`, merkt á svarinu.
- **Saga og athugasemdir** (`HistoryTab`): færslur sem eru ferskar fá sömu slikju. Athugasemd eftir `user_id` og `created_at`; atburður eftir `actor` og `created_at`.
- Flipalýsingar: „Handtök" er kafli í Staða, ekki flipi, svo kaflafyrirsögnin fær „(N ný)" þegar N > 0. Flipinn „Skjöl (n)" og „Spurningar (n)" halda sínum tölum.

Merkingin lifir þar til panelinn er tekinn niður (annað verk valið eða lokað); ný handtök sem koma inn frá öðrum meðan spjaldið er opið eru líka fersk (þau eru yngri en `readAtOnOpen`).

`needsReadMark` breytist: meðan spjaldið er opið er það merkt lesið aftur þegar nýjasti atburður verksins frá öðrum (úr `data.events`, hæsta `created_at` með `actor !== viewerId`) breytist, í stað `updated_by` samanburðarins. `ItemPanel` fylgist með þeim stimpli í `useEffect`.

### 4.7 Skyndigreining og lotur

Óbreytt. Greiningin skrifar `item.updated` og `analysis.done` sem þjónustunotandinn, svo greint verk sýnir hjá Heimi „Síðan síðast: greind, texti" eða, sé það nýtt frá Árna og ólesið, „Nýtt spjald". Byggingarlota sem bætir við handtaki sýnir „+1 handtak" hjá Heimi á spjaldi sem var annars lesið. Það er nákvæmlega vandamálið úr kafla 1.

## 5. Hönnun B: sýnir

### 5.1 Gagnagrunnur

Migration `0011_hg_views`:

```sql
create table hg_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid not null references hg_projects(id) on delete cascade,
  name text not null,
  filter jsonb not null default '{}',
  position int not null default 0,
  created_by uuid
);

create table hg_view_positions (
  project_id uuid not null references hg_projects(id) on delete cascade,
  view_id uuid not null references hg_views(id) on delete cascade,
  item_id uuid not null references hg_items(id) on delete cascade,
  pos_x int not null,
  pos_y int not null,
  primary key (view_id, item_id)
);
```

Vísitölur á `project_id` beggja og `hg_view_positions (item_id)`. RLS eins og 0001: select, insert, update, delete fyrir `authenticated` með `hg_is_participant(project_id)` í `using` og `with check`. `created_by` stimplað úr `auth.uid()` á insert með sama mynstri og `hg_stamp_author` (lítill before insert trigger, `coalesce(auth.uid(), new.created_by)`). Báðar töflur í `supabase_realtime`. Engir atburðir í `hg_events` fyrir sýnir, þær eru ekki saga verks.

`filter` er `{ "tones": [...], "packages": [...], "tags": [...] }`, sama snið og `serializeFilter` án `q` og `unread`. Tóm fylki þýða allt. `parseFilter` les það (óþekkt gildi falla burt, eins og nú).

Ekkert uppfærir `updated_at` á verki við skrif í `hg_view_positions`, svo færsla í sýn merkir ekkert ólesið, eins og pos only uppfærsla á `hg_items` (0004).

### 5.2 Virk sýn

`localStorage` lykill `hg.view.<projectId>` geymir id virkrar sýnar, ekkert þýðir aðalborð. Hook `useActiveView(projectId, views)` skilar sýninni eða null; id sem ekki finnst í `data.views` (eydd sýn) fellur á aðalborð og lykillinn hreinsast. Pure logic í `lib/views.ts` með prófi.

Sían í `sessionStorage` (`useFilter`) er óbreytt og liggur ofan á sýninni.

### 5.3 Hvað sýn gerir á borðinu

Í `Board`:

1. `onBoard` verður verk á borðinu sem passa sýnarsíunni (`matches(item, ctx, view.filter)` með pakkaauðkenni sem ekki eru til á borðinu hreinsuð úr settinu fyrst, sbr. `prunePackages`). Ekkert utan sýnar er teiknað: engin spjöld, engar línur. Módúlar og pakkar sjást allir, aldrei daufir vegna sýnar.
2. Teljarapillur, Pakki og Tögg valmyndirnar og ólesið telja þessi verk. `BoardPage` reiknar `visibleItems` einu sinni (hreint fall `itemsInView(items, modules, view)` í `lib/views.ts`) og sendir þau í `countsFor`, `tagCounts`, `packageCounts` og `Board`.
3. Staða spjalds: `positionOf(item, viewPositions)` í `lib/views.ts`: hnit sýnar ef til, annars `pos_x`/`pos_y` verksins. Springs, `pending` samanburður og `placeNew` nota þau hnit alls staðar þar sem `item.pos_x`/`pos_y` eru lesin núna (`useLayoutEffect`, `savePosition` fallback, `onDrop` base).
4. Drag í sýn: `onDrop` kallar `upsertViewPosition(viewId, itemId, x, y)` (upsert á `(view_id, item_id)`) í stað `updateItemPosition`. Debounce, flush á pagehide og villumeðferð eins og nú. Aðalhnit verksins breytast ekki.
5. Drag í aðalborði: eins og nú. Sýnir sem hafa ekki eigin hnit fyrir spjaldið fylgja.
6. Nýtt verk úr Nýtt verk blaðinu: hnitin fara í `hg_items` eins og nú. Í sýn telur `placeNew` sem hindranir bæði sýnilegu spjöldin á sýnarhnitum sínum og öll falin opin verk á aðalhnitum sínum (annars lenti nýja spjaldið oft ofan á földu í bið spjaldi á aðalborðinu). Sýnin fær engin eigin hnit fyrir það; passi verkið ekki sýnarsíunni sést það ekki í sýninni en toastið og panelinn virka samt (valið verk þarf ekki spjald á borði).
7. Verk sem síast út úr sýn eftir á (t.d. fer í bið í sýn sem felur í bið) hverfur úr sýninni; hnitin þess í `hg_view_positions` standa ef það kemur til baka.

Ólesið-pillan í sýn telur ólesin spjöld í sýninni. Verk utan sýnar geta verið ólesin án þess að sjást; aðalborðið sýnir þau.

### 5.4 Valmyndin „Sýn"

Í `hg-top-g` við hlið Tögg, sama `hg-dd` útlit og `FilterMenu`. Hnappurinn sýnir „Sýn" og nafn virkrar sýnar með `em` (eins og talan í Pakki), `hg-on` þegar sýn er virk. Valmyndin:

- Listi: „Aðalborð" efst með fjölda verka á borðinu, svo sýnirnar í `position` röð með fjölda verka sem passa (`itemsInView` lengd). Virk lína merkt eins og valinn chip (`hg-on`, `aria-pressed`). Smellur velur og lokar.
- Skil, svo aðgerðir: „Ný sýn" (opnar ritilinn tóman, forfylltan með núverandi síu ef hún er virk: tónar, pakkar, tögg; ekki leit, ekki ólesið), og þegar sýn er virk „Breyta sýn" og „Eyða sýn".
- Neðst dauf lína: „Sýnir eru sameiginlegar. Valin sýn vistast í þessum vafra."

**Ritillinn** (`ViewEditor`) er `hg-menu` spjald í sömu dropdown með form: nafn (`hg-field`, krafist, klippt), „Sýna" með fimm föstum hökum í teljararöð (Nýtt, Hjá þér, Hjá öðrum, Í byggingu, Í bið, lyklar úr `vinnubord.board.counts.*`), „Pakkar" með chip per pakka í borðaröð, „Tögg" með chip per tagg úr `tagCounts` yfir öll verk borðsins ásamt töggum sýnarinnar sjálfrar. Allt hakað eða ekkert hakað í hóp þýðir allt (vistað sem tómt fylki). Hnappar „Vista" (`hg-btn hg-btn-primary`) og „Hætta við". Vista á nýrri sýn gerir hana virka strax. Allir fimm tónarnir eru alltaf í boði, óháð því hvort pillan sést í stikunni, svo „fela í bið" verður `tones = [gold, coral, lilac, teal]` og nýtt verk sem kemur síðar sést í sýninni.

**Eyða** spyr með sama staðfestingarmynstri og þátttakenda og módúlaeyðing í stillingum notar, eyðir röðinni (hnitin fylgja með cascade), fellur á aðalborð og endurhleður. Sýn má eyða af hverjum sem er.

**Færsla sýnar** í röðinni: ekki í þessari útgáfu, `position` er stofnröð (`created_at`), `position` dálkurinn er til fyrir seinna.

Á síma breidd (undir 768 px) er valmyndin í efri röð með Pakki og Tögg og ritillinn skrunar innan `hg-menu` með `max-height`.

### 5.5 API

`lib/api.ts`: `createView(projectId, name, filter)`, `updateView(id, patch: { name?, filter? })`, `deleteView(id)`, `upsertViewPosition(projectId, viewId, itemId, x, y)`. `loadBoard` sækir `hg_views` (order position, created_at) og `hg_view_positions` í sömu `Promise.all`; `BoardData` fær `views: View[]` og `viewPositions: ViewPosition[]`; `useBoardData` bætir báðum töflum í `REALTIME_TABLES`. `cli/lib/client.mjs` þarf ekki að sækja þær.

## 5b. Hönnun C: handtak breytt og fellt niður

Beiðni úr byggingarlotu metta 1. nóv (verk 800c8265, handtak 4d404216): planið breyttist, handtakið varð rangt, og CLI gat aðeins látið það standa rangt eða hakað það sem gert. Handtök eru eina heimildin um hvað er eftir, svo þau verða að vera breytanleg. Aðeins CLI skrifar í þessari umferð (Heimir, 1. nóv: „bara cli í bili svo CC geti breytt"); vefurinn sýnir.

### C.1 Gagnagrunnur

Migration `0012_hg_action_edits`:

- `hg_actions` fær `updated_at timestamptz`, `updated_by uuid` (bæði nullable, null þýðir aldrei breytt) og `cancelled boolean not null default false`.
- `hg_stamp_author` fyrir `hg_actions` á update: ef `body`, `owner` eða `payload` breytist stimplast `updated_at := now()` og `updated_by := coalesce(auth.uid(), new.updated_by)`; `done_at`/`cancelled` breyting ein og sér stimplar ekki. `created_by` (0010) heldur gamla gildinu á update.
- `hg_log_event` fyrir `hg_actions` á update: breyting á `body`, `owner` eða `payload` skráir `action.updated` með `data.fields` eins og `item.updated`; `done_at` sem fer úr null í gildi skráir `action.cancelled` þegar `new.cancelled` er satt, annars `action.done` eins og nú. Insert með `cancelled` satt er ekki stutt (CLI gerir það ekki).
- Niðurfelling er `done_at = now()`, `done_by` stimplað eins og lokið, `cancelled = true`, ástæðan í nýjum dálki `cancel_reason text` (payload heldur sér). Þannig sjá triggerinn 0009 (`done_at is null` = opið), `waitsFor`, `countBucket`, `guardClose` í CLI, `pull` og Halda áfram promptið niðurfellt handtak sem lokað án þess að nokkur þeirra breytist. Afturköllun á niðurfellingu er ekki til (CLI `action done` á handtak með `done_at` gerir ekkert, eins og nú).

### C.2 CLI

- `action set <aid> [--body ".."] [--owner H|Á|C] [--payload-file f.sql]`: a.m.k. eitt flagg, aðeins opið handtak (lokað eða niðurfellt gefur villu „Handtakið er lokað"), `created_at` óbreytt. Eigandi leystur úr stuttnafni eins og í `action add`.
- `action cancel <aid> [--reason ".."]`: opið handtak, setur `done_at`, `cancelled`, `cancel_reason`.
- `--help` listinn og `cli/README.md` fá báðar skipanir. Óþekkt flögg hafna eins og aðrar skrifskipanir.
- `pull` og `pull --brief`: opið handtak sem hefur verið breytt fær „breytt <dags> af <stutt>" aftan við línuna; niðurfellt handtak telst lokað og sést í `pull` aðeins þar sem lokuð handtök sjást nú (ekki í opna listanum). `item.md` (`renderItemMd`): fyrirsögnin „Handtak #id, fellt niður" í stað „lokið", línan „Fellt niður: <dags>, af <stutt>, ástæða: ..." í stað „Lokið: ...", og „Breytt: <dags>, af <stutt>" undir handtaki sem hefur verið breytt.
- Skillið `/huginn` í metta2_new (`.claude/skills/huginn/SKILL.md`), kaflinn „Að haka við", fær tvær línur: breytist plan svo opið handtak verði rangt á lotan að laga það með `action set`, aldrei haka það; handtak sem á ekki lengur við er fellt niður með `action cancel --reason`, aldrei hakað sem gert. Promptsniðið í 4.3 í staða úr gögnum skjalinu breytist ekki.

### C.3 Vefur

- `ActionList`: undir texta handtaks sem hefur `updated_at` kemur dauf lína „breytt <formatStamp> af <stutt>" (`vinnubord.panel.actionEdited`). Niðurfellt handtak er í samanbrotna „Afgreitt (n)" listanum með hakreitinn skipt út fyrir merkið „fellt niður" (`hg-act-cancelled`, strikað eins og lokið) og ástæðuna í daufri línu ef hún er til; hakreitur óvirkur, afturköllun ekki í boði.
- Ólesið (4.2) fær tvær tegundir: `action.updated` → `actionEdited` („handtak breytt"), `action.cancelled` → `actionCancelled` („handtak fellt niður"), í forgangsröðinni strax á eftir `actionDone`.
- Saga flipinn (`describeEvent`) fær línur fyrir báða atburði.
- Ferskleiki (4.6): breytt handtak telst ferskt þegar `updated_by` er annar og `updated_at > readAtOnOpen`, auk reglunnar um `created_by`.

### C.4 Snertir ekki

`hg_plan_moves_item` (0009), `waitsFor`, `countBucket`, `mineActionsByItem`, `guardClose`, `buildContinuationPrompt` og `estimateCardHeight`: allt les `done_at` og helst óbreytt. `parity.test.mjs` óbreytt.

## 6. Prófun

- vitest: `summarizeUnread` (vörpun, forgangsröð, created fáni, sleppt tegund), `isFresh`, `matches` með `unread`, `serializeFilter`/`parseFilter` með `unread`, `countsFor` með ólesið, `itemsInView` (tóm sía, pakki sem er ekki til, tónar), `positionOf`, `useActiveView` logic (eydd sýn fellur á aðalborð). `parity.test.mjs` grænt óbreytt.
- `npm run smoke:hg` fær þrjár sviðsmyndir: (8) `hg_unread` skilar handtaki sem annar bætti við eftir lesmerki og ekkert eftir `hg_mark_all_read`; eigin atburður telst ekki; (9) sýn stofnuð, hnit skrifuð, sýn eydd og hnitin horfin (cascade); (10) `action set` stimplar `updated_at`/`updated_by` og skráir `action.updated`, `action cancel` setur `done_at` og `cancelled` og skráir `action.cancelled`, og plan sem fer í done með aðeins niðurfellt handtak eftir lokar verkinu. Prófunargögnum eytt í `finally` eins og nú.
- CLI: vitest á `format.mjs` (breytt merki í `pull`) og `mirror.mjs` (fellt niður í `item.md`). Samþykktarpróf beiðninnar: úr metta2_new `huginn action set 4d404216 --body "..."` breytir textanum, `huginn pull` sýnir hann með breytt merkinu, staða og `waiting_on` verksins óbreytt.
- Handpróf í vafra, skjár og sími: Árni (eða CLI sem þjónustunotandi) bætir handtaki við lesið verk; spjaldið fær hring og „Síðan síðast: +1 handtak" innan sekúndu, pillan telur það, opnun sýnir „nýtt · stimpill" á handtakinu, lokun og opnun aftur sýnir það venjulegt. Nýtt verk frá Árna sýnir „Nýtt spjald" líka eftir að greiningin færir það í bið eftir Heimi. Sýn „Í bið falin" stofnuð, 40 spjöld hverfa, þrjú spjöld færð, aðalborð opnað (þau á gamla staðnum), sýnin aftur (á nýja staðnum), annar vafri sér sömu sýn með sömu uppröðun.

## 7. Ákvarðanir Heimis (eins og hann tók þær)

- Það sem hann vill sjá að morgni er hvað er nýtt, hvað breyttist og hvers konar breyting (handtak, skjal, spurning), áður en hann opnar spjald.
- Í spjaldi vill hann sjá hvenær handtak kom inn og hvort hann hafi séð það, þ.e. opnað spjaldið eftir að því var bætt við.
- Sýnir: vistaðar, með eigin uppröðun, aðallega til að þjappa og minnka hávaða. Byrja á síu plús uppröðun, ekkert handvirkt felu.
- Mockup A: lína neðst á spjaldinu með því sem breyttist, hringurinn helst.
- Troðna borðið og yfirferð innfluttra verka er sérverkefni.

## 8. Ákvarðanir Claude (má snúa við)

- Lesmerki í stað dagsetningasía. Spurningin var „hvað hef ég ekki séð", ekki „hvað gerðist í gær".
- Ólesið reiknað í gagnagrunni (`hg_unread`) en ekki úr 500 atburða listanum, svo það sé rétt eftir langa fjarveru.
- Sýnir eru sameiginlegar, virk sýn er per vafra. Ef Árni þjappar sýn vill Heimir sjá hana þjappaða, ekki eigin kópíu.
- Ósnert spjöld í sýn fylgja aðalborðinu; snert spjöld halda sinni stöðu í sýninni.
- Spjöld utan sýnar eru alveg falin; sía ofan á sýn deyfir eins og nú. Sýn er „hvað er á borðinu", sía er „hvað er upplýst".
- Teljarar, Pakki og Tögg telja innan sýnar, svo pilla og það sem sést passi saman.
- Sýn geymir inntökusett (tónar, pakkar, tögg) með öllum fimm tónum alltaf í boði í ritlinum, svo „fela í bið" sé eitt hak og nýtt verk sjáist síðar.
- Sýn geymir hvorki leit né ólesið; hvort tveggja er per manneskju og augnablik.
- Tónarnir í sýn eru teljarahóparnir og þeir eru afstæðir við þann sem horfir: sýn með „Hjá þér" sýnir Árna hans spjöld og Heimi hans, en hnitin eru sameiginleg. Það er látið standa; notkunin sem skiptir máli (fela í bið, einn pakki) er sú sama hjá báðum, og ritillinn notar sömu orð og pillurnar svo enginn er blekktur.
- `created_by` bætt á `hg_actions` í 0010 í stað þess að giska á höfund út frá `owner`. Gömul handtök með null teljast annarra.
- Engin lesmerki skrifuð í migration fyrir innfluttu verkin; „Merkja allt lesið" er fyrsti smellurinn.
- `placeNew` í sýn telur falin verk á aðalhnitum með sem hindranir.
- Niðurfellt handtak er lokað handtak með fána (`done_at` sett, `cancelled` satt), ekki þriðja staðan. Allt sem les `done_at` helst óbreytt, aðeins sýningin og sagan greina á milli.
- Handtök eru aðeins breytt úr CLI í þessari umferð (Heimir, 1. nóv).
- „Merkja allt lesið" í viðmælandavalmyndinni, án staðfestingar.
- Ferskt handtak er merkt þar til panelinn fer niður, ekki þegar það skrunar fram hjá.
- `created` yfirtekur línuna á spjaldinu („Nýtt spjald"), svo nýtt verk með þremur handtökum frá greiningunni segi ekki „+3 handtök, greind, texti".
- Engir `hg_events` atburðir fyrir sýnir.

## 9. Eftirlátið byggingaraðila (plansmiður ákveður í plani)

- Nákvæm SQL fyrir RLS, vísitölur og stimpiltrigger í 0010 og 0011, í stíl 0001 og 0003.
- CSS fyrir `hg-card-fresh`, `hg-count-unread`, `hg-act-new` og ritilinn, með tókum sem eru til; ný tóka aðeins fyrir gulu slikjuna ef `--hg-gold` með alpha er ekki til nú þegar.
- Nákvæm enska nýrra lykla og uppfærsla `is.json`.
- Hvernig `Board` þræðir `positionOf` gegnum springs og drag án þess að brjóta `pending` samanburðinn.
- Framvinduskjöl `docs/progress/06-olesid.md`, `07-synir.md` og `08-handtok-breytt.md`, CLAUDE.md kaflarnir Supabase (0010, 0011, 0012), Key Patterns (ólesið úr atburðum, sýnir, niðurfellt handtak er lokað handtak) og Design System, `cli/README.md`.
