# huginn skipanalínutól

Lætur Claude Code lesa og skrifa vinnuborð Huginn (huginn.pro) beint. Tólið skráir sig inn sem venjulegur Huginn notandi með anon lykli, svo RLS ræður hvað það sér. Það notar aldrei service role lykil.

Plain Node ESM, Node 20 eða nýrra. Eina dependency er `@supabase/supabase-js` úr Huginn repoinu, svo keyrðu `npm install` í rót repoins fyrst.

## Uppsetning

1. Búðu til `~/.huginn/credentials.json` (á Windows `C:\Users\<notandi>\.huginn\credentials.json`):

   ```json
   {
     "url": "https://<verkefni>.supabase.co",
     "anonKey": "<anon lykill>",
     "email": "<netfang Huginn notanda>",
     "password": "<lykilorð>"
   }
   ```

   `url` og `anonKey` eru sömu gildi og `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY` í `.env`. Hjá Heimi er notandinn Claude þjónustunotandinn (`claude@huginn.pro`). Skráin fer aldrei í repo.

2. Prófaðu: `node cli/huginn.mjs login`.

3. Í repoi sem á að tengjast verkefni: skrá `.huginn-project` í rót með línunni `slug=<verkefni>`, til dæmis `slug=metta`. Annars þarf `--project <slug>` í hverri skipun.

Tólið geymir innskráningu í `~/.huginn/session.json` svo flestar keyrslur sleppa lykilorðinu. Óhætt er að eyða þeirri skrá, þá skráir tólið sig inn aftur.

Mappan `~/.huginn/` geymir lifandi lykilorð (`credentials.json`) og innskráningartóka (`session.json`). Tólið skrifar þær með `mode 0o600`, en það gerir ekkert á Windows, svo á sameiginlegri tölvu þarf að læsa möppunni handvirkt (Eiginleikar, Öryggi: aðeins þinn notandi).

Með `npm link` í rót repoins verður til skipunin `huginn`. Annars `node "D:/Claude Code/Huginn/huginn/cli/huginn.mjs" <skipun>`.

## Skipanir

| Skipun | Hvað hún gerir |
|---|---|
| `huginn login` | Skráir sig inn með lykilorði og prófar credentials |
| `huginn whoami` | Notandi, verkefni og þátttakandi |
| `huginn pull` | Sækir borðið og prentar stöðuna sem markdown |
| `huginn pull --json` | Allt borðið sem JSON (sama lögun og `BoardData` í vefnum) |
| `huginn pull --since <ISO>` | Aðeins verk sem breyttust frá þeim tíma, með því sem þeim fylgir |
| `huginn pull --brief` | Ein lína, t.d. `Huginn: 2 bíða Claude, 1 bíða Árna, 0 bíða Heimis`. Telur opin verk sem bíða hvers þátttakanda eftir sömu reglu og vefurinn (`waitsFor`: verkið bíður hans eða hann á opið handtak á því). Með `--json` listi af `{ short, display_name, count }`. Fer ekki saman við `--since` |
| `huginn sync` | Speglar verkin í `docs/huginn/` og skrifar `docs/huginn/STATUS.md` (sjá Spegill) |
| `huginn sync --dry-run` | Sýnir hvað yrði skrifað, skrifar ekkert |
| `huginn sync --out <mappa>` | Speglar í aðra möppu |
| `huginn tag list` | Taggalisti verkefnisins með fjölda verka á hverju taggi, raðað eftir fjölda. `--json` gefur `[{ id, name, count }]` |

### Skrifskipanir

| Skipun | Dæmi |
|---|---|
| `item create` | `huginn item create --title "Nýtt verk" --body-file lysing.md --module efnaskra --tags a,b --keywords "social media,efni,instagram" --file mynd.png --file skjal.pdf` |
| `item set <id>` | `huginn item set 1a2b3c4d --status waiting --waiting-on H --summary "Bíður svars"` |
| `item close <id>` | `huginn item close 1a2b3c4d` (staðan Lokið), `--dropped` fyrir Hætt við |
| `question ask <item>` | `huginn question ask 1a2b3c4d --to Á --body "Hvaða litur?"` |
| `question answer <qid>` | `huginn question answer 9f8e7d6c --body "Blár"` |
| `action add <item>` | `huginn action add 1a2b3c4d --owner H --body "Keyra SQL" --payload-file 0007.sql` |
| `action done <aid>` | `huginn action done 5e6f7a8b` |
| `action set <aid>` | `huginn action set 5e6f7a8b --body "Nýr texti" --owner Á --payload-file 0012.sql` (aðeins opið handtak, stofndagur helst, breytingin er merkt) |
| `action cancel <aid>` | `huginn action cancel 5e6f7a8b --reason "Planið breyttist"` (lokar handtaki sem á ekki lengur við án þess að það teljist gert) |
| `plan add <item>` | `huginn plan add 1a2b3c4d --name "Plan A" --path docs/plan.md --status todo` |
| `plan set <pid>` | `huginn plan set 0c1d2e3f --status building` |
| `ruling add <plan>` | `huginn ruling add 0c1d2e3f --code R1 --body "Engin ný tafla" --cost "Lítill"` |
| `file add <item> <path>` | `huginn file add 1a2b3c4d skyrsla.pdf --repo-path docs/skyrsla.pdf --note "Skýrsla um stöðuna, fyrir Árna"` (sama --repo-path á sama verki uppfærir skjalið í stað þess að bæta við eintaki; óbreytt skjal skrifar ekkert; --note er ein setning, hvað skjalið er og fyrir hvern (mest 200 stafir), og án --note helst lýsingin sem var) |
| `file set <fileid>` | `huginn file set 7a8b9c0d --note "Hönnunarskjal lesarans, fyrir Heimi"` |
| `file get <fileid>` | `huginn file get 7a8b9c0d --out ./skyrsla.pdf` (`--force` skrifar yfir) |
| `comment add <item>` | `huginn comment add 1a2b3c4d --body "Lítur vel út"` |
| `tag add <nafn>` | `huginn tag add "edge function"` (lágstafir, mest 40 stafir, engin komma; tvítak er villa) |
| `bundle push` | `huginn bundle push --file bundle.md` (setur samhengi verkefnisins) |

Með `--json` skilar hver skrifskipun `{ "ok": true, "id": "<uuid>" }`.

- **Auðkenni.** `<id>` er heilt uuid eða að minnsta kosti 8 fyrstu stafir þess, eins og `#1a2b3c4d` aftast í línum `pull`. Ef forskeytið passar við fleiri en eina línu þarf lengra auðkenni.
- **Fólk.** `--waiting-on`, `--to` og `--owner` taka skammstöfun þátttakanda (H, Á, C), óháð stórum og litlum stöfum. `none` þýðir enginn (ekki fyrir `--owner`).
- **Staða.** Önnur staða en `waiting` hreinsar `waiting_on`. `--waiting-on H` án `--status` setur verkið í bið eftir H. `--status waiting` án manns er leyft.
- **Lokun.** `item close` og `item set --status done|dropped` neita ef verkið á ósvaraða spurningu eða opið handtak. `--force` lokar samt.
- **Handtök.** Handtak sem varð rangt er lagað með `action set`, aldrei hakað sem gert. Handtak sem á ekki lengur við er fellt niður með `action cancel`; það telst lokað (stöðvar hvorki `item close` né plan sem fer í done) en ekki gert.
- **Hreinsun.** `--module none` tekur verkið úr módúl, `--tags ""` tæmir merki, `--keywords ""` tæmir leitarorð, tómt gildi á textareit tæmir hann.
- **Tögg og leitarorð.** `--tags` tekur aðeins tögg af listanum (`tag list`); gagnagrunnurinn skrifar stafsetningu listans á verkið og hafnar öðru. `--keywords a,b` eru falin leitarorð (lágstafir, komma á milli), 10 til 15 á verk, íslensk og ensk; `item set --keywords` skiptir listanum út, `--keywords ""` tæmir. Þau standa í `item.md` sem `Leitarorð:`.
- **Skrár.** Sömu reglur og vefurinn: hámark 50 MB, nafn að hámarki 180 stafir, geymt í `hg-files`. `--file` má endurtaka. Skrá með --repo-path er eitt skjal á hverja slóð á hverju verki: sama slóð aftur uppfærir röðina og eintakið, sömu bæti gera ekkert, og slóðin er stöðluð (bakstrik, ./, bil).
- **Staðsetning.** Nýtt spjald lendir við hlið módúlsins eins og í vefnum, annars efst til vinstri við það sem er á borðinu, aldrei ofan á spjaldi eða pakka.
- **Rofar.** Óþekktur rofi er villa. Gildi sem byrjar á `--` þarf að gefa sem `--body=--gildi`.

Höfundar, tímar, saga (`hg_events`) og `closed_at` koma frá gagnagrunninum. Þegar síðustu spurningu er svarað fer verkið sjálfkrafa í bið eftir Claude.

Almennir rofar: `--project <slug>`, `--json`, `--debug` (stack við villu), `--help`.

Villur eru ein lína á íslensku á stderr og exit kóði 1. Lykilorðið birtist aldrei í úttaki eða villum.

## Staðan sem markdown

`pull` raðar opnum verkum í hópa í fastri röð: Nýtt, Bíður ákvörðunar, Bíður Claude, Bíður <þátttakanda>, Tilbúið til byggingar, Í byggingu, Í bið. Tómir hópar sleppa. Innan hóps nýjast fyrst. Undir hverju verki koma opin handtök og ósvaraðar spurningar. Dagsetningar eru ISO, svo sama gögn gefa sama texta.

## Spegill

`huginn sync` skrifar afrit af borðinu í repoið svo git eigi lesanlegt afrit og söguna. Sjálfgefin mappa er `docs/huginn` í möppunni sem geymir `.huginn-project`, eða í núverandi möppu ef `--project` er gefið og engin `.huginn-project` finnst. Ef `--project` nefnir annað verkefni en `.huginn-project` þarf `--out`.

- **Hvaða verk.** Öll opin verk á borðinu og verk með stöðuna Lokið sem lokuðust síðustu 30 daga. Verk sem hætt var við speglast ekki.
- **Mappa á verk.** `docs/huginn/<slug>/`, þar sem slug er titillinn í lágstöfum með íslenskum stöfum vörpuðum (á í a, þ í th, æ í ae, ö í o og svo framvegis), öðrum táknum breytt í `-`, að hámarki 60 stafir, og síðast fyrstu 6 stafir auðkennisins. Ef mappa sem endar á sömu `-<6 stafir>` er þegar til (titillinn breyttist) er hún notuð áfram. Mappa með núverandi slug gengur fyrir, annars sú fyrsta í stafrófsröð.
- **Verk sem fara af speglinum.** Verk sem hætt var við, eða lokuðust fyrir meira en 30 dögum, fá item.md skrifaða einu sinni enn í möppuna sína ef mappan er til og verkið er enn í gögnunum (90 dagar), án þess að skrár séu sóttar. Annars gerist ekkert.
- **item.md.** Titill, staða, hver bíður, módúll, merki, dagsetningar, Hvar erum við, lýsing, næsta skref, prompt fyrir næsta skref, plön með úrskurðum, handtök, spurningar og svör, spjall (skilaboð í tímaröð) og skráalisti. Spurningar og úrskurðir eru inni í item.md, ekki í sér skrám. Sama gögn gefa sömu skrá bæti fyrir bæti.
- **Skrár.** Skrá undir 10 MB er afrituð í möppu verksins, hvaða tegund sem hún er. 10 MB og stærri fær `<nafn>.pointer.json` með name, size, mime, storage_path og sha256 og býr áfram í Storage. Skrá sem hefur `repo_path` er þegar í repoinu og er bara talin upp í item.md. Ef tvær skrár verksins heita það sama (óháð stórum stöfum, eða `item.md`) fær sú seinni `-<6 fyrstu stafir auðkennis>` á undan endingunni. Nöfn eru hreinsuð: engin skástrik, engin Windows bönnuð tákn eða tækjanöfn, enginn punktur fremst. Skrá er aðeins sótt ef Storage slóðin er nákvæmlega `<verkefni>/<verk>/<uuid>_<nafn>` eins og upphleðsla býr hana til (nafnið aðeins A til Z, a til z, 0 til 9, punktur, undirstrik og bandstrik); annars fer hún á listann yfir það sem mistókst. Ef sótt skrá reynist 10 MB eða stærri þótt gagnagrunnurinn segi annað fær hún bendiskrá og viðvörun.
- **Bara breytingar.** item.md og STATUS.md eru bornar saman með sha256, afrit með stærð (skrár í Storage breytast aldrei) og bendiskrá með storage_path. Það sem er eins er ekki snert, svo git sér enga breytingu.
- **Öruggt.** Hver skrá er skrifuð í bráðabirgðaskrá og svo endurnefnd, svo hálfskrifuð skrá verður aldrei til. Tólið eyðir aldrei neinu og skrifar aldrei utan möppunnar.

- **Villur.** Ef ein skrá mistekst (niðurhal, skrif eða ógild Storage slóð) heldur keyrslan áfram, STATUS.md er alltaf skrifuð, og tólið hættir með exit kóða 1 í lokin.

Úttakið telur upp skrifað, óbreytt og bendiskrár, og viðvaranir og það sem mistókst ef eitthvað er. Með `--json`: `{ ok, out, dry_run, written, skipped, pointers, failed: [{ path, reason }], warnings }`.

## Próf

`npm run test` keyrir líka `cli/**/*.test.mjs`. `cli/lib/parity.test.mjs` passar að afrit tólsins haldist eins og vefurinn: föll úr `src/vinnubord/lib/status.ts`, upload reglur úr `upload.ts`, `placeNewCard` úr `placement.ts` og stærðir úr `--hg-*` tókunum í `vinnubord.css`. Hrein föll skrifskipana eru prófuð í `cli/lib/write.test.mjs`, gagnagrunnsköllin eru í `cli/lib/ops.mjs`. Spegillinn er hrein föll í `cli/lib/mirror.mjs` og skráavinnsla í `cli/lib/sync.mjs`, bæði prófuð í `cli/lib/mirror.test.mjs` (líka skrif í bráðabirgðamöppu og að seinni keyrsla skrifi ekkert).
