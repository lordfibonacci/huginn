# Huginn: staða úr gögnum (hönnunarskjal)

Dagsetning: 2026-11-01
Staða: samþykkt af Heimi í samtali 1. nóv eftir hugmyndavinnu með Claude (Fable).
Grunnur: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (gagnalíkan, flæði, hliðar). Þetta skjal breytir hegðun innan þess líkans, engin ný tafla.

## 1. Tilgangur

Verkið "Sýningarskráning: iPad skráning, Meet bókun og póstlota" (607f7a55) sýndi vandann 1. nóv. Heimir kláraði handtak (domain-wide delegation), lotan hakaði það í Huginn, en "Hvar erum við", punkturinn "Eftir hjá Heimi" í lýsingunni og Halda áfram promptið sögðu áfram að það væri eftir. Byggingarlotan keyrði planið til enda, lokarýni hrein, fjögur ný handtök á Heimi og sautján úrskurðir í lotunni, og Huginn vissi ekkert: planið "Ekki byrjað", verkið "Tilbúið til byggingar", Skjöl (0) þótt plan og hönnunarskjal væru til.

Orsökin er sú sama í öllum þremur tilfellum: Huginn geymir réttu gögnin (handtak hakað, plan með slóð) en það sem Heimir sér fyrst er annað hvort handskrifaður texti sem úreldist eða ekki tengt við gögnin, og skrifin í Huginn eru háð því að Claude muni eftir skillinu á réttu augnabliki.

Lagfæringin: sýnin kemur úr gögnunum, gagnagrunnurinn færir stöðu verks þegar plan færist, og byggingarlotan skrifar í Huginn á föstum augnablikum sem promptið sjálft ber.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Spjald sem er "Í byggingu" meðan byggt er og "Bíður þín" þegar planið er búið, án þess að nokkur segi neitt.
- Ein heimild um hvað er eftir hjá hverjum: handtökin. Enginn texti endurtekur þau.
- Skjöl flipinn og skráateljari spjaldsins telja plön með slóð með, svo "Skjöl (0)" sést ekki á verki sem á plan.
- Byggingarlota skrifar í Huginn í upphafi, þegar handtak kemur upp og þegar lokarýni er hrein, án þess að Heimir segi lotulok. Lotulok frá Heimi stendur áfram sem fullur skyldulisti og varnagli.

**Ekki-markmið**

- Að opna plön eða hönnunarskjöl í símanum. Slóð og afritunarhnappur duga (Heimir, 1. nóv).
- Að reikna stöðu verks af öðru en plönum. Svar við síðustu spurningu færir verk nú þegar (0003), annað er handvirkt áfram.
- Að laga gögn verksins 607f7a55. Það gerist í lotulokum byggingarlotunnar með tólinu, ekki með kóða.
- Nýjar töflur eða dálkar.

**And-markmið**

- Spjald sem segir eitthvað rangt í millitíðinni. Triggerinn má vera íhaldssamur, en aldrei færa verk í stöðu sem er röng.
- Að Claude þurfi að muna fleiri reiti. Breytingin á að fækka því sem þarf að muna, ekki fjölga.

## 3. Skorður

- Sama Supabase verkefni og áður, aðeins `hg_` hlutir. Migration gegnum MCP `apply_migration`, engin DROP (Heimir keyrir þau í SQL editor ef þarf).
- CLI afritar reglur vefsins; breytist regla sem CLI afritar breytist `cli/lib/*.mjs` og `parity.test.mjs` með. Þessi hönnun snertir engar þeirra (sjá 4.4).
- Skillið `/huginn` býr í metta2_new (`.claude/skills/huginn/SKILL.md`), ekki í Huginn repoinu. Planið snertir bæði repo og segir hvar hvert verk er.
- Engin þankastrik og engin bandstrik sem greinarmerki í neinu, þar með talið í promptsniðinu.

## 4. Hönnun

### 4.1 Gagnagrunnur: plan færir verkið

Migration `0008_hg_plan_moves_item`. Trigger `hg_plans_move_item_trg`, after insert or update of `status` on `hg_plans`, fall `hg_plan_moves_item()`, security definer með `set search_path = public` eins og `hg_question_answered`. Á update keyrir það aðeins þegar `new.status is distinct from old.status`; á insert gildir `new.status` sem umskiptin (plan stofnað beint í `building` eða `done`, t.d. `plan add --status done` í lotulokum, færir verkið eins og update hefði gert; plan stofnað í `todo` gerir ekkert). Snertir aldrei verk með stöðuna `done` eða `dropped`.

Reglur, í þessari röð:

1. **Plan fer í `building`.** Verkið fer í `building`, `waiting_on` null. Gildir hvaða stöðu sem verkið hafði á borðinu (new, waiting, ready, parked, building). Ef verkið er þegar `building` gerist ekkert (engin tóm uppfærsla, engin saga).
2. **Plan fer í `done`** og annað plan verksins er `building`: ekkert.
3. **Plan fer í `done`** og annað plan verksins er `todo`: verkið fer í `ready`, `waiting_on` null. Spjaldið sýnir "Plan 2 af 3" og "Tilbúið til byggingar".
4. **Plan fer í `done`** og ekkert plan verksins er eftir. Þá skuldar annað hvort einhver eitthvað eða verkið er búið:
   - opið handtak er á verkinu (`hg_actions.done_at is null`): verkið fer í `waiting`, `waiting_on` = eigandi elsta opna handtaksins (raðað eftir `created_at`), hvaða þátttakandi sem það er;
   - annars ósvöruð spurning (`hg_questions.answer is null`): `waiting`, `waiting_on` = `asked_to` elstu ósvöruðu spurningarinnar (null ef hún hefur engan viðtakanda, sem er "Bíður ákvörðunar" í `pull`);
   - annars fer verkið í `done`. `hg_item_closed_at` (0003) stimplar `closed_at` eins og við aðra lokun. Þetta var ákvörðun Heimis 1. nóv: fullbyggt verk sem enginn skuldar neitt á bíður ekki neins. Ef Heimir á eftir að prófa eitthvað á það að vera handtak á hann, og þá bíður verkið hans. Promptsniðið í 4.3 segir byggingarlotunni það berum orðum.
5. **Plan fer úr `done` eða `building` aftur í `todo`:** ekkert. Afturköllun er handvirk.

`updated_by` á verkinu verður `coalesce(auth.uid(), <updated_by plansins ef til, annars óbreytt>)`. `hg_plans` hefur engan `updated_by` dálk, svo í reynd `auth.uid()`; triggerinn keyrir alltaf í samhengi innskráðs þátttakanda (RLS á `hg_plans` leyfir ekki annað). Uppfærslan á `hg_items` fer gegnum `hg_items_log_event_trg`, svo sagan fær `item.status` atburð með `from`, `to` og `waiting_on` eins og aðrar stöðubreytingar, og gerandi er sá sem færði planið. Engin ný tegund atburðar.

`hg_touch_updated_at` gildir óbreytt: stöðubreyting stimplar `updated_at`, svo spjaldið fær ólesið merki hjá hinum.

Þetta er eina sjálfvirka stöðureglan sem bætist við. Reglan "Status is stored, not computed" í CLAUDE.md fær viðbótina: tveir triggerar færa stöðu, svar við síðustu spurningu (0003) og plan sem færist (0008), annað er handvirkt.

### 4.2 Vefur: spjald og Staða flipi

**Spjaldið.** Smámerkið fyrir handtök sýnir eigin handtök fyrst: ef viðmælandi á opið handtak á verkinu stendur "2 hjá þér" (nýir lyklar `vinnubord.card.actionsMine_one` "{{count}} for you" og `_other`), annars "N handtök" eins og nú. Merkið "hjá þér" fær tóninn coral (`hg-tone-coral` á span, sami litur og "Bíður þín"), hin smámerkin óbreytt. Talan kemur úr sama `waitsFor` hugtaki og teljarapillan "Hjá þér", svo pilla og spjald segja það sama. Hrein fallið `openActionsFor(actions, itemId, viewerId)` í `lib/status.ts` með prófi.

Skráateljarinn á spjaldinu ("N skrár") telur skrár plús plön með slóð (sjá Skjöl hér fyrir neðan).

**Staða flipinn, ný röð:**

1. Hvar erum við (summary, stöðulína, módúll), óbreytt.
2. Handtök. Opin fyrst eins og nú. Afgreidd handtök fara í samanbrotinn `<details>` undir listanum með `<summary>` "Afgreitt (n)" (`vinnubord.panel.actionsDone` "Done ({{count}})"), lokaður sjálfgefið. Ef engin eru opin og einhver afgreidd sést aðeins samanbrotna línan. Ef verkið á engin handtök sést kaflinn ekki, eins og nú.
3. Næsta skref og prompt, svo Halda áfram, óbreytt innihald.
4. Plön með úrskurðum, óbreytt.
5. Lýsing (Markdown), óbreytt innihald, færist neðar því hún er lengst.
6. Breyta stöðu, óbreytt.
7. Heimild, óbreytt.

**Skjöl flipinn.** Efst koma plön verksins sem eiga `path`, ein lína á plan: pilla "Plan" (sami `hg-pill` stíll og MD, PDF), nafn plansins, og slóðin í `hg-path` blokk með afritunarhnappi, nákvæmlega eins og `repo_path` skrár birtist. Enginn opnunarhnappur, engin "bætt við af" lína (plan hefur engan `uploaded_by`). Svo skrárnar eins og nú. Talan á flipanum ("Skjöl (n)") og á spjaldinu telur hvort tveggja. Tómi textinn sést aðeins ef hvorki eru skrár né plön með slóð. Hreint fall `fileTabCount(files, plans, itemId)` í `lib/panel.ts` með prófi, notað á þremur stöðum (flipi, spjald, Board teljari) svo tölurnar passi.

Plan án slóðar sést áfram aðeins undir Plön.

### 4.3 Prompt og skill: byggingarlotan skrifar sjálf

Þetta er breyting á `/huginn` skillinu í metta2_new. Huginn vefurinn og CLI breytast ekki vegna þessa kafla.

**Snið promptsins fyrir byggingarlotu.** Kaflinn "Þegar plan er skrifað" fær fast snið sem Claude fyllir og vistar í skrá fyrir `--next-prompt-file`. Sniðið, orðrétt (hornklofar eru reitir sem fyllt er í):

```
Keyrðu planið [slóð plans] með superpowers:subagent-driven-development. Lestu fyrst hönnunarskjalið [slóð spec]. Vinnumappan er D:\Claude Code\metta2\metta2_new, á main, commit á hvert verk, push í lok síðasta verks.

Huginn (vinnuborðið, verk [8 stafa auðkenni], plan [8 stafa auðkenni plans]). Tólið er node "D:/Claude Code/Huginn/huginn/cli/huginn.mjs", keyrt úr D:/Claude Code/metta2/metta2_new. Þrjú föst augnablik, án þess að Heimir biðji um það:

1. Í upphafi, áður en fyrsta verk planins byrjar: huginn plan set [plan id] --status building. Verkið fer þá sjálft í "Í byggingu".
2. Um leið og eitthvað kemur upp sem Heimir eða Árni þarf að gera (SQL í editor, stilling í þjónustu, prófun í tæki): huginn action add [verk id] --owner H --body "..." strax, ekki í lokin. SQL fer í skrá og --payload-file, aldrei í body. Haltu svo áfram með næsta verk ef hægt er.
3. Þegar lokarýnin á greininni kemur hrein: keyrðu lotulokalistann í /huginn skillinu í hans röð (handtök, úrskurðir, framvinduskjal með --repo-path, svo huginn plan set [plan id] --status done, svo summary, sync, búnt og commit). Þegar planið fer í done fer verkið sjálft í bið eftir þeim sem á elsta opna handtakið, og í Lokið ef enginn á neitt opið. Ef Heimir þarf að prófa eitthvað í alvöru umhverfi áður en verkið telst búið, skráðu það sem handtak á hann áður en planið fer í done, annars lokast verkið. Segðu Heimi í fáum línum hvað var skrifað í Huginn.

Ef lotan stöðvast í miðju verki: gerðu lið 2 fyrir það sem þegar er ljóst og skrifaðu summary um hvar planið stendur. Ekki setja planið í done.

[Sértæk fyrirmæli verksins, ef einhver: hvað á að athuga áður en tiltekið verk byrjar, hvað á að spyrja um. Vísaðu í handtök með orðum þeirra, t.d. "athugaðu í Huginn hvort handtakið um DWD sé hakað", aldrei með því að endurtaka hvað er eftir.]
```

Sniðið nefnir Huginn berum orðum með fullri slóð tólsins, svo lotan þarf ekki að kveikja á skillinu til að gera þetta. Skillið kveikir samt venjulega og kaflarnir þar segja það sama.

**Textareglur** (nýr kafli "Texti sem úreldist ekki" í skillinu):

- Hvar erum við (summary) er ein til tvær línur um hvar verkið stendur og hvað gerist næst sem heild, t.d. "Byggt og í loftinu á metta.is/syning. Drip bíður myndbandshlekkja." Það telur aldrei upp hvað er eftir hjá hverjum, það gera handtökin.
- Greining Claude í lýsingunni telur ekki upp "Eftir hjá Heimi" eða "Eftir hjá Árna". Hvert slíkt atriði er handtak.
- Prompt og næsta skref vísa í handtök með orðum þeirra, ekki með því að endurtaka hvað er eftir.
- `action done` kallar ekki á neina aðra uppfærslu, því enginn texti endurtekur handtakið.
- Nýtt framhaldsatriði sem lota stofnar fer inn í bið eftir Heimi: `item create --title ... --body-file ... --module ... --waiting-on H`. Summary aðeins ef verkið er þegar komið af stað; fyrir hugmynd sem er ekki byrjuð dugar lýsingin og línan "Claude hefur ekki skrifað samantekt ennþá" er rétt (Heimir, 1. nóv). Aldrei `--status parked` nema Heimir hafi sjálfur ákveðið að það bíði. Skyndigreiningin sleppir verkum sem Claude stofnar (viljandi, lotan veit meira en greinirinn), svo staðan verður að koma frá lotunni; annars er kortið falið. Dæmið 1. nóv: "Póstsniðmát fyrir kynningar og söluferli" (800c8265) kom inn sem Í bið.

**Þegar plan er skrifað**, viðbætur: `huginn file add <id> <slóð spec> --repo-path <slóð spec>` um leið og planið er skráð, svo hönnunarskjalið sé á verkinu. Planið sjálft fer ekki í `file add`, Skjöl flipinn sýnir það af planskráningunni.

**Lotulok**, breytt röð svo triggerinn velji rétt og spegillinn sýni lokastöðuna: skjöl (liður 2), handtök (liður 3) og úrskurðir (liður 4) fyrst, svo `plan set --status done` (liður 1 færist þangað), svo verkið sjálft (liður 5), svo `sync`, búnt og commit eins og nú. Eftir `plan set done` er verkið í bið eftir þeim sem á elsta opna handtakið, eða lokið ef enginn á neitt opið. Liður 5 setur `--summary` og `--next-step`; `--waiting-on` aðeins ef annar á næsta leik en triggerinn valdi, og `--status ready` aðeins ef næst er bygging og enginn skuldar neitt. Liður 7 (`item close`) fellur út sem sérstakt skref, triggerinn lokar verki sem enginn skuldar neitt á; `item close` er áfram til fyrir verk án plans.

**Að haka við**, viðbót: `plan set <pid> --status building` í upphafi byggingarlotu færir verkið sjálft, lotan á ekki að keyra `item set --status building` líka.

### 4.4 Óbreytt

- `pull`, `pull --brief`, `sync` og `item.md`: óbreytt. item.md telur plön nú þegar upp með slóð.
- Halda áfram promptið (`buildContinuationPrompt`): óbreytt, það telur upp opin handtök og plön úr gögnunum.
- Skyndigreining: óbreytt.
- `cli/lib/write.mjs` og `parity.test.mjs`: óbreytt, engin regla sem CLI afritar breytist. `openActionsFor` og `fileTabCount` eru aðeins á vefnum.

## 5. Prófun

- Trigger: `npm run smoke:hg` fær nýja sviðsmynd á prófunarverki sem scriptið eyðir í `finally` eins og það gerir nú (sviðsmynd 6, cascade, stendur óbreytt og `TOTAL` hækkar um einn): plan todo til building færir verkið í building; plan done með opið handtak færir verkið í waiting á eiganda þess; plan done með ósvaraða spurningu og ekkert handtak færir það í waiting á `asked_to`; plan done án handtaka og spurninga færir verkið í done með `closed_at`; tvö plön, fyrra done færir verkið í ready; plan stofnað beint í building færir verkið; verk í done hreyfist ekki þótt plan þess færist. Sagan fær `item.status` atburði með gerandann sem færði planið.
- Vefur: vitest á `openActionsFor` og `fileTabCount`. Handpróf í vafra á verki með plani með slóð, handtökum hjá viðmælanda og afgreiddum handtökum, á síma breidd og skjá: spjaldið sýnir "N hjá þér" og rétta skráatölu, Staða flipinn í nýrri röð, Skjöl með planlínu efst, samanbrotin afgreidd handtök opnast.
- Skill: lesið yfir og ein byggingarlota keyrð með nýja sniðinu á næsta plani metta2_new. Staðfest að verkið fór í building í upphafi og í bið eftir Heimi í lokin án þess að Heimir segði lotulok.

## 6. Ákvarðanir Heimis (eins og hann tók þær)

- Staða verks á að koma úr gögnum, ekki úr minni Claude.
- Handtökin eru eina heimildin um hvað er eftir hjá hverjum. Hvar erum við má verða styttra og segir ekkert um hver á hvað eftir.
- Hann þarf ekki að opna plön eða hönnunarskjöl í símanum, slóð dugar.
- Hann segir oftast "end of session" í byggingarlotum, svo lotulokalistinn stendur. Upphaf og miðja lotu eru það sem vantaði.
- Fullbyggt verk sem enginn skuldar neitt á (ekkert opið handtak, engin ósvöruð spurning) fer í Lokið, það bíður ekki neins. Ef hann á eftir að prófa eitthvað á það að vera handtak á hann.

## 7. Ákvarðanir Claude (má snúa við)

- Hvern verkið bíður þegar síðasta plan klárast og einhver skuldar eitthvað: elsta opna handtakið fyrst, svo elsta ósvaraða spurningin. Einfalt og fyrirsjáanlegt, lotulok stillir nánar ef þarf.
- Triggerinn gildir líka um plan sem er stofnað beint í building eða done, svo `plan add --status done` eftir á skilji spjaldið ekki eftir rangt.
- Í lotulokum fer `plan set done` á eftir skjölum, handtökum og úrskurðum og á undan summary, sync og búnti, svo triggerinn velji rétt og spegillinn og búntið sýni lokastöðuna.
- Smoke prófið eyðir prófunarverkinu eftir sig eins og það gerir nú, í stað þess að skilja eftir dropped verk í metta.
- Plan sem fer aftur í todo hreyfir ekki verkið. Afturköllun er sjaldgæf og handvirk.
- Plan í `building` færir verk líka úr `parked`. Sá sem byrjar að byggja hefur tekið það úr bið.
- Afgreidd handtök í samanbrotnum `<details>`, ekki falin. Sagan er áfram í Saga flipanum.
- Lýsingin færist neðst af innihaldsköflunum í Staða, af því að hún er lengst og minnst notuð eftir fyrsta lestur.
- Planið er ekki tvískráð sem skrá; Skjöl flipinn les það af planskráningunni.
- Smámerkið "hjá þér" fær coral tón. Það er eina smámerkið með lit.

## 8. Eftirlátið byggingaraðila

- Nákvæm SQL triggersins innan reglnanna í 4.1, í stíl 0003 og 0004.
- CSS fyrir `<details>` afgreiddra handtaka og planlínur í Skjöl, með tókum sem eru til (`--hg-*`), engin ný tókalög.
- Nákvæm orðalag nýju i18n lykla á ensku; `is.json` gegnum `npm run translate`, íslenskan yfirfarin.
- Hvar `fileTabCount` er kallað í Board svo spjaldið og flipinn deili einni tölu.
- Framvinduskjalið `docs/progress/05-stada-ur-gognum.md` og CLAUDE.md kaflarnir Supabase (0008), Key Patterns (stöðureglan) og Design System ef nýr stíll bætist við.
