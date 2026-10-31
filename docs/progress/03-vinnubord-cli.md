# 03 Vinnuborð: skipanalínutól og /huginn (plan 3)

Dagsetning: 2026-10-31
Grein: `vinnubord-3` (ekki sameinuð, ekki ýtt)
Plan: `docs/superpowers/plans/2026-10-31-vinnubord-3-cli.md`
Spekk: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (kaflar 5, 5b, 5c, 7, 9b, 10)

## Hvað var gert

- **Verk 1:** `cli/huginn.mjs` með `login`, `whoami` og `pull`, innskráning, val verkefnis, staðan sem markdown.
- **Verk 2:** skrifskipanir (`cli/lib/write.mjs` hrein föll, `cli/lib/ops.mjs` Supabase köll, `cli/lib/commands.mjs`), staðsetning nýrra spjalda.
- **Verk 3:** `huginn sync`, spegill í `docs/huginn/` og `STATUS.md` (`cli/lib/mirror.mjs` hrein föll, `cli/lib/sync.mjs` skráavinnsla).
- **Verk 4:** `pull --brief`, `/huginn` skill, SessionStart hook og Pending kaflinn í metta2_new færður í Huginn.
- **Verk 5:** fyrsta fylling metta (73 verk) og fyrsti spegill í metta2_new.
- **Verk 6:** lagfæringar eftir fyllingu, þessi skrá og CLAUDE.md.

### Skipanir

Tólið er hreint Node ESM (Node 20 eða nýrra), eina dependency er `@supabase/supabase-js` úr Huginn repoinu. Keyrt sem `node "D:/Claude Code/Huginn/huginn/cli/huginn.mjs" <skipun>`, eða `huginn` eftir `npm link`. Fullur texti með dæmum í `cli/README.md`.

| Skipun | Hvað hún gerir |
|---|---|
| `login`, `whoami` | Prófar credentials; sýnir notanda, verkefni og þátttakanda |
| `pull` | Staðan sem markdown (sjá STATUS.md og pull) |
| `pull --json` | Allt borðið, sama lögun og `BoardData` í vefnum |
| `pull --since <ISO>` | Aðeins verk með `updated_at` frá þeim tíma og það sem þeim fylgir |
| `pull --brief` | Ein lína: `Huginn: N bíða Claude, M bíða Árna, K bíða Heimis` |
| `sync [--dry-run] [--out <mappa>]` | Spegill í `docs/huginn/` og `STATUS.md` |
| `item create`, `item set <id>`, `item close <id> [--dropped]` | Stofna, breyta og loka verki |
| `question ask <item>`, `question answer <qid>` | Spurningar |
| `action add <item>`, `action done <aid>` | Handtök, SQL í `--payload-file` |
| `plan add <item>`, `plan set <pid>`, `ruling add <plan>` | Plön og úrskurðir |
| `file add <item> <path> [--repo-path]`, `file get <fileid> --out` | Skrár í `hg-files` |
| `comment add <item>` | Athugasemd |
| `bundle push --file` | Setur `context_bundle` verkefnisins |

Reglur sem gilda alls staðar: auðkenni er heilt uuid eða að minnsta kosti 8 fyrstu stafir (`#1a2b3c4d` aftast í línum `pull`). Fólk er skammstöfun (C, H, Á, `none`). Skrifskipanir og `sync` hafna óþekktum rofa. Lokun neitar ef verkið á ósvaraða spurningu eða opið handtak, nema með `--force`. Önnur staða en `waiting` hreinsar `waiting_on`. Villa er ein lína á íslensku á stderr og exit kóði 1. `--json` á skrifskipun skilar `{ "ok": true, "id": "<uuid>" }`. Höfundar, tímar, saga og `closed_at` koma frá gagnagrunninum (triggerar úr 0003 og 0004), tólið sendir þá ekki.

Tólið afritar þær reglur vefsins sem það þarf sem `.mjs` (staðaheiti, `isOnBoard`, `waitsFor`, upload reglur, `placeNewCard`, stærðir úr `--hg-*` tókum, gluggi lokaðra verka) og `cli/lib/parity.test.mjs` ber þær saman við `src/vinnubord/lib/` og `vinnubord.css`. Ný spjöld lenda við hlið módúlsins eins og í vefnum (`placeItem`, hæð spjalda og módúla metin út frá texta), aldrei ofan á öðru spjaldi eða pakka.

### Credentials og lota

- `~/.huginn/credentials.json` (á Windows `C:\Users\<notandi>\.huginn\credentials.json`) með fjórum reitum: `url`, `anonKey`, `email`, `password`. `url` og `anonKey` eru sömu gildi og `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY`. Hjá Heimi er notandinn Claude þjónustunotandinn `claude@huginn.pro`. Tólið notar aldrei service role lykil, svo RLS ræður öllu.
- `~/.huginn/session.json` geymir access og refresh token svo flestar keyrslur sleppa lykilorðinu. Tólið endurnýjar tokenið ef það rennur út innan 60 s og hunsar skrána ef url eða netfang breytist. Óhætt að eyða henni, þá er skráð inn aftur.
- **Báðar skrár eru lifandi aðgangur** að Huginn sem þessi notandi. `mode 0600` hefur engin áhrif á Windows. Þær fara aldrei í repo, og lykilorðið birtist aldrei í úttaki eða villum (prófað).

### Spegill (`huginn sync`)

- Sjálfgefin mappa er `docs/huginn` í möppunni sem geymir `.huginn-project` (`slug=metta` í metta2_new).
- Speglað: öll opin verk á borðinu og verk sem lokuðust (`done`) síðustu 30 daga. Verk sem hætt var við (`dropped`) speglast ekki, svo prófunarverk lenda ekki í repoinu.
- Ein mappa á verk, `<slug titils>-<6 fyrstu stafir id>`, með `item.md`: staða, hver bíður, módúll, merki, dagsetningar, Hvar erum við, lýsing, næsta skref, prompt, plön með úrskurðum, handtök, spurningar og svör, skráalisti. Athugasemdir speglast ekki. Sama gögn gefa sömu skrá bæti fyrir bæti.
- Skrá undir 10 MB er afrituð, hvaða tegund sem er. 10 MB og stærri fær `<nafn>.pointer.json` (name, size, mime, storage_path, sha256). Skrá með `repo_path` er þegar í repoinu og er bara talin upp.
- Skrá er aðeins sótt ef Storage slóðin er nákvæmlega `<verkefni>/<verk>/<uuid>_<nafn>` með nafni úr A til Z, a til z, 0 til 9, punkti, undirstriki og bandstriki. Annars fer hún á villulistann.
- Gamlar möppur: ef titill breytist er mappan sem endar á sama `-<id6>` notuð áfram. Verk sem fer af speglinum (hætt við, eða lokað fyrir meira en 30 dögum) fær lokaútgáfu af `item.md` í möppuna sína ef hún er til, án niðurhals. Tólið eyðir aldrei neinu og skrifar aldrei utan möppunnar.
- Aðeins breytingar eru skrifaðar (sha256 á md, stærð á afritum, storage_path á bendiskrám), fyrst í bráðabirgðaskrá og svo endurnefnt. Ef ein skrá mistekst heldur keyrslan áfram, STATUS.md er samt skrifuð og exit kóðinn er 1.
- metta2_new fékk `.gitattributes` línuna `/docs/huginn/** -text` (enginn CRLF snúningur) og `.gitignore` línuna `*.huginn-tmp`.

### STATUS.md og pull

Hópar í fastri röð, tómir sleppa: Nýtt, Bíður ákvörðunar (bíður án manns), Bíður Claude, Bíður Árna, Bíður Heimis (þjónustunotandi fyrst, svo eftir skammstöfun), Tilbúið til byggingar, Í byggingu, Í bið. Ein lína á verk, nýjast fyrst: `[tónn] titill, staða, hver, ISO tími #id8`, og undir henni opin handtök og ósvaraðar spurningar. Stýritákn úr gagnagrunninum eru hreinsuð, svo titill getur ekki búið til fyrirsögn. Lokuð verk og hætt við eru aldrei á listanum.

`pull --brief` telur verk á borðinu sem bíða hvers þátttakanda eftir reglu vefsins (`waitsFor`): verkið bíður hans eða hann á opið handtak á því. Sama röð og STATUS.md.

### Skill og hook í metta2_new

- `.claude/skills/huginn/SKILL.md`: hvað Huginn er, keyra alltaf úr `metta2_new` (cd þangað fyrst), lotustart, nýtt verk sótt og greint, plan skrifað, að haka við handtak og svara spurningu, lotulok sem skyldulisti (plön, skrár með `--repo-path` ef þær eru ekki þegar á verkinu, handtök með SQL í payload, úrskurðir, Hvar erum við og næsta skref, `sync`, `bundle push`, `git add docs/huginn`), reglur.
- `.claude/settings.json`: SessionStart hook sem keyrir `pull --brief` með `2>/dev/null || true`, svo lotan fellur aldrei ef tólið vantar, netið er niðri eða node finnst ekki (prófað). Timeout 20 s.
- `.huginn-project` (`slug=metta`), `docs/huginn/.gitkeep`.
- `CLAUDE.md`: Pending kaflinn vísar í Huginn, lotuloka ritúölin kalla á `/huginn` lotulok í stað þess að skrifa Pending línur.

### Fyrsta fylling metta

- `cli/seed/seed.mjs`, `cli/seed/seedlib.mjs` (hrein föll, prófuð), `cli/seed/metta-2026-10-31.json`, keyrt með `npm run seed:metta`. Skrifar gegnum sömu föll og `item create`, innskráð sem Claude.
- 73 verk: mockup v7 hafði 50 (49 haldið, eitt fellt út sem þegar byggt) og 24 bættust við úr Pending í metta2_new og minnisskrám. Staða: bíður Heimis 15, bíður Árna 14, í bið 40, tilbúið 3, í byggingu 1. Með þeim 14 plön, 17 úrskurðir (R1 til R17 úr doc 141 á Plan A Efnaskrár) og 14 opin handtök. `pull --brief` eftir fyllingu: `Huginn: 0 bíða Claude, 16 bíða Árna, 18 bíða Heimis`.
- Allar 28 einingar mockupsins vörpuðust á lifandi módúla. Þrjú verk eru án módúls (Pakki 1, Vaktaplan v1.5, Samfélagsmiðlar).
- Endurtekning: verki með sama titil (trimmaðan) í verkefninu, hvaða stöðu sem það hefur, er sleppt. Önnur keyrsla: `Stofnuð: 0, sleppt: 73, mistókst: 0`. Verk sem stofnaðist en plan, úrskurður eða handtak þess mistókst er líka sleppt í endurkeyrslu, svo það er klárað með höndum með auðkenninu sem keyrslan prentaði.
- `--dry-run` sýnir hvert verk, módúl, stöðu, staðsetningu, plön og handtök án þess að skrifa.
- 17 skrár úr `D:\Claude Code\metta2\from_arni` afritaðar í `docs/huginn/<mappa>/` og hengdar á verk með `file add --repo-path` (stærst 768 KB, engar bendiskrár). Frumritin liggja enn í `from_arni`.

| Skrá | Verk | Mappa í docs/huginn |
|---|---|---|
| 2026-10-29-abendingar-minnispunktar-dev.md | ab1 f1400cd7 | abendingar-nyr-modull-f1400c |
| metta-abendingar-v5.html | ab1 | sama |
| 2026-10-29-merkimidar-umferd-2-minnispunktar-dev.md | m1 1319986d | merkimidar-umferd-2-prentari-laestur-hja-jolt-131998 |
| metta-merkimidar-v3.html | m1 | sama |
| merkimidar-prentstod-frumgerd.zip | m1 | sama |
| 2026-10-29-verkferlar-utlitsumferd-minnispunktar-dev.md | v1 8a3ab510 | verkferlar-utlitsumferd-8a3ab5 |
| metta-verkferlar-v1.html | v1 | sama |
| 2026-10-30-efnaskra-endurhonnun-minnispunktar-dev.md | e1 37b70825 | efnaskra-a-og-b-endurhonnun-37b708 |
| metta-efnaskra-v3.html | e1 | sama |
| 2026-10-30-ipad-utlitsuttekt-minnispunktar-dev.md | p1 1e724025 | ipad-og-simar-vidbragdsumferd-1e7240 |
| 2026-10-30-rv-kennslumyndbond-minnispunktar-dev.md | rv1 87401f12 | rv-kennsla-ipad-athugun-arna-a2-og-m2-m3-87401f |
| rv-kennsla-2026-10-30.zip | rv1 | sama |
| 2026-10-30-vidhald-honnunarumferd-minnispunktar-dev.md | vh1 95655098 | vidhald-honnunarumferd-taekjalisti-v2-956550 |
| metta-vidhald-taekjalisti-v2.html | vh1 | sama |
| ahaettumat-umferd-2-svor-arna-2026-10-30.md | r1 45e5863b | kennsla-ahaettumat-fragangur-umferdar-eitt-45e586 |
| kennsla-2026-10-30.zip | g1 09f33ce2 | kennsla-gatlistar-og-hitamaelingar-thrju-atridi-eftir-09f33c |
| metta-syningarskjar-portrait-v1.html | sh1 cd454cee | syningarskjar-nytt-html-fra-arna-sunnudag-cd454c |

## Staðfesting

Keyrt í verki 6, 2026-10-31:

- `npm run test`: `Test Files 26 passed (26)`, `Tests 360 passed (360)` (vefur og `cli/**/*.test.mjs`).
- `npm run build`: grænt (`built in 1.38s`).

Lifandi prófanir á metta, innskráð sem Claude:

- `login`, `whoami`, `pull`, `pull --json` (orðið password kemur aldrei fyrir), villuleiðir (ekkert verkefni, rangt lykilorð, óþekkt skipun, ógilt auðkenni).
- Allar skrifskipanir á fjórum "Prófun: " verkum (verk 2). Saga í `hg_events` öll skráð á C, lokunarvörn neitar og `--force` lokar. Prófunarverkin sett í `dropped`, engu eytt.
- `sync` í prufumöppu (verk 3), svo í metta2_new (verk 5): fyrsta keyrsla 74 færslur, sú næsta 0 skrifaðar. Í verki 6: 2 skrifaðar (item.md Smápakka og STATUS.md), næsta 0.
- Hook skipunin keyrð eins og Claude Code keyrir hana: með tólinu, án tólsins, án `.huginn-project`, án node og án nets. Exit 0 í öll skiptin.
- Skörun spjalda á lifandi borði (metnar stærðir spjalda og pakka): eitt par í verki 5 og eitt í verki 6 eftir að skráamerki stækkuðu tíu spjöld, bæði lagfærð. Nú 0 skaranir hjá 73 spjöldum og 5 pökkum. Aðeins `pos_x` og `pos_y` breytt.

Ekki skoðað í vafra. Borðið var sannreynt gegnum `pull`, `pull --json`, `pull --brief` og spegilinn.

## Hvað bíður

### Hjá Heimi

1. **Ýta báðum repoum.** Huginn: greinin `vinnubord-3` til sameiningar í main. metta2_new: main er 4 commitum á undan origin úr þessu plani: `752db5a6`, `d756a659`, `9a1ac72f`, `8d594011`.
2. **Hook og skill í `D:\Claude Code\metta2`.** Flestar metta2 lotur byrja í þeirri möppu, þar sem hook og skill metta2_new hlaðast ekki. Auto mode flokkarinn hafnaði breytingunni (sjálfsbreyting), svo þú ákveður. Bæta við undir `"hooks"` í `D:\Claude Code\metta2\.claude\settings.json`, við hlið PreToolUse og PostToolUse:

   ```json
   "SessionStart": [
     {
       "hooks": [
         {
           "type": "command",
           "command": "cd \"D:/Claude Code/metta2/metta2_new\" && node \"D:/Claude Code/Huginn/huginn/cli/huginn.mjs\" pull --brief 2>/dev/null || true",
           "timeout": 10
         }
       ]
     }
   ]
   ```

   Og `D:\Claude Code\metta2\.claude\skills\huginn\SKILL.md` sem vísar á eina eintakið:

   ```markdown
   ---
   name: huginn
   description: Vinnuborð Mettu í Huginn (huginn.pro, verkefni metta). Notaðu þegar Heimir skrifar /huginn, í upphafi lotu, í lotulokum og alltaf þegar verk, skjöl frá Árna, spurningar, handtök, plön eða úrskurðir koma upp.
   ---

   Lestu `D:/Claude Code/metta2/metta2_new/.claude/skills/huginn/SKILL.md` og fylgdu því. Það er eina útgáfan.
   ```

   Í leiðinni: lækka timeout í `metta2_new/.claude/settings.json` úr 20 í 10 s.
3. **Níu atriði úr fyllingunni til að staðfesta:**
   1. e1: deploy á parse-sds og askur-chat frá main er opið handtak "ef það er ekki þegar gert" (askur v92 er eldra en B2 commit 222b5e36).
   2. r1 og i1: askur-chat redeploy handtökin gætu þegar verið leyst með v92, haka við ef svo er.
   3. h2: titli breytt úr "sex smokes" í "Gemini-yfirferð og opin smokes" eftir doc 105.
   4. h3: ekki skráð hvort viðvaranir Jans voru settar aftur á og hvort post user smoke Askur var keyrt.
   5. vh1 heldur opið (bíður Árna) þótt umferðin sé sameinuð: 10 iPad athuganir og eftirfylgni doc 142. Loka þegar hann skilar.
   6. p1 í byggingu því phone touch er á eigin grein, kjarnaplanið er lokið.
   7. Úrskurðir R1 til R17 á Plan A eru ensk orðrétt afrit úr doc 141, ekki þýddir.
   8. Þrjár migration drift línur úr Pending sameinaðar í eitt verk.
   9. Spjöld við þétta módúla lenda langt niðri í dálki (landing y 4573, vh1 y 3494). Draga á vefnum.
4. **Plans B1 og B2** á Efnaskrá eru án úrskurða þótt doc 143 og 144 telji þá upp.
5. **metta2_new `CLAUDE.md:356` og haus doc 145** segja enn að iPad kjarnasameining bíði, en hún er komin í main.
6. **Má eyða með hendi:** fjögur "Prófun: " verk úr verki 2, öll `dropped`: `a2298eda-7176-483f-ad07-9fb4be5c08c4`, `98b44e36-40be-4b0e-bfb8-ac89d60c58b0`, `3ab242b5-4a05-4c39-ae3c-afe6117a3f72`, `4e64653d-31b6-4cba-9a20-60ddb3379fa4`. Eyðing verkanna tekur með sér spurningar, handtak, plan, úrskurð, skrárraðir og athugasemd. Tvo Storage hluti í `hg-files` þarf að fjarlægja sér, báða í `74e926d8-f53a-42fc-8a83-c93ec405a6ae/a2298eda-7176-483f-ad07-9fb4be5c08c4/`: `850fa243-98d9-4f34-984a-d2811733373e_profun.txt` og `17648ab0-5b67-46b3-8691-46c83878fdda_profun.txt`. Frumrit skránna 17 í `D:\Claude Code\metta2\from_arni` má líka fjarlægja.
7. **Minnisskrár Claude** halda stöðulínum sínum þar til þú ákveður annað. Huginn er sannleikurinn um opin verk.
8. **Claude Code hjá Árna** (seinna, sjá næsta kafla).

### Uppsetning hjá Árna (fyrir seinna)

1. Node 20 eða nýrra.
2. Afrit af Huginn repoinu og `npm install` í rót þess. `npm link` gerir skipunina `huginn` til.
3. Búa til `~/.huginn/credentials.json` með `url` og `anonKey` (Heimir sendir, sömu gildi og `VITE_SUPABASE_*`), og netfangi og lykilorði Árna í Huginn. Skráin fer aldrei í repo, hún og `session.json` eru lifandi aðgangur.
4. `huginn login`, svo `huginn whoami --project metta` sem á að sýna `Þátttakandi: Árni (Á)`.
5. Í repoi sem á að tengjast: `.huginn-project` með `slug=metta`, annars `--project metta` í hverri skipun.
6. Skill og hook í metta2_new vísa í `D:/Claude Code/Huginn/huginn/cli/huginn.mjs` og lýsa verklagi Claude þjónustunotandans. Ákveða þarf útgáfu fyrir Árna: slóð að tólinu á hans vél (eða `huginn` eftir `npm link`) og hvaða skref eiga við hann.
7. R1: skrif úr CLI eru ekki enn merkt "(Claude Code)" í tímalínunni. Hjá Heimi skiptir það engu, því tólið er alltaf Claude. Hjá Árna birtast þau sem venjuleg skrif Árna þar til migration les haus beiðninnar í `hg_log_event` og viðmótið sýnir merkið.

### Opið í kóða

Allt minniháttar, ekkert bilar. Skipt eftir svæðum:

- **Rofar og úttak:** `pull` og `whoami` hunsa óþekkta rofa (skrifskipanir og `sync` hafna þeim), svo `--projct` endar í "Ekkert verkefni fundið". `BOOLEAN_FLAGS` í `config.mjs` þarf að passa við boolean rofa skrifskipana, ekkert próf gætir þess. Samsetningar `--brief` við aðra rofa óprófaðar. Netvilla prentar fyrst margra lína TypeError frá supabase-js á undan einlínu villunni. Tvöföld greinarmerki í innskráningarvillum, "Óþekkt skipun: item ." með auka bili, "Bíður, bíður C" í línu verks. `maskString` ruglar úttaki ef lykilorð er mjög stutt.
- **pull --since:** tekur við hvaða dagsetningu sem `Date.parse` skilur og síar á `updated_at` verks, svo svöruð spurning eða klárað handtak á gömlu verki sést ekki alltaf.
- **Skrifskipanir:** ef upphleðsla mistekst eftir `item create` kemur ekkert `--json`, auðkennið aðeins á stderr. `context_bundle_at` notar klukku notandans (enginn trigger á `hg_projects`). `commands.mjs` og `ops.mjs` hafa engin einingapróf, aðeins lifandi keyrslu.
- **Staðsetning:** mat á hæð spjalda og módúla getur verið of lágt (skráamerki stækkuðu tíu spjöld eftir á og eitt par skaraðist þar til það var lagað). Spjöld við þétta módúla lenda langt niðri.
- **Spegill:** `DEVICE_NAMES` vantar `CONIN$` og `CONOUT$`. Forskeytisárekstur á `id6` gæti látið verk taka möppu annars verks. `--dry-run` með ógildri slóð hættir með exit 1. Bendiskrár eru sóttar í heild í minni fyrir sha256, ekkert þak. `item.md` segir "afrit í möppunni" þótt of stór skrá hafi fengið bendiskrá, og lokaútgáfa `item.md` heldur sama orðalagi. Röð `node:path` innflutnings í `huginn.mjs`, og `mirrorTargets` reiknað tvisvar.
- **Próf:** í `parity.test.mjs` er `\s` í template streng bara `s` (um línu 109) og `'a/b\c.txt'` prófar aldrei bakstrik (um línu 61).
- **Lagt til hliðar, kostar ef rangt:**
  - R1: `actor_via` ekki útfært (sjá uppsetningu Árna). Kostar: skrif Árna úr CLI líta út eins og vefskrif þar til migration og viðmót koma.
  - R21: symlink í spegilmöppunni getur beint skrifi út fyrir hana. Ekki lagað, því það krefst skrifaðgangs að repoinu, sem er þegar fullt vald. Kostar: smíðaður symlink á vél gæti skrifað utan möppunnar.
  - R28: hookið í metta2_new er committað og keyrir node á algildri slóð utan repoins með faldar villur. Kostar ef rangt: flytja það í `settings.local.json`, ein lína.
  - R30: `pull --brief` raðar Claude, Árna, Heimis (sama röð og STATUS.md), ekki eins og planið nefndi. Kostar: ein lína í `briefCounts`.

## Næst

Plan 4: skyndigreining (edge function sem kallar á Claude API þegar nýtt verk kemur inn, skráð inn sem Claude þjónustunotandinn).
