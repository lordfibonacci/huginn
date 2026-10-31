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

Með `npm link` í rót repoins verður til skipunin `huginn`. Annars `node "D:/Claude Code/Huginn/huginn/cli/huginn.mjs" <skipun>`.

## Skipanir

| Skipun | Hvað hún gerir |
|---|---|
| `huginn login` | Skráir sig inn með lykilorði og prófar credentials |
| `huginn whoami` | Notandi, verkefni og þátttakandi |
| `huginn pull` | Sækir borðið og prentar stöðuna sem markdown |
| `huginn pull --json` | Allt borðið sem JSON (sama lögun og `BoardData` í vefnum) |
| `huginn pull --since <ISO>` | Aðeins verk sem breyttust frá þeim tíma, með því sem þeim fylgir |

### Skrifskipanir

| Skipun | Dæmi |
|---|---|
| `item create` | `huginn item create --title "Nýtt verk" --body-file lysing.md --module efnaskra --tags a,b --file mynd.png --file skjal.pdf` |
| `item set <id>` | `huginn item set 1a2b3c4d --status waiting --waiting-on H --summary "Bíður svars"` |
| `item close <id>` | `huginn item close 1a2b3c4d` (staðan Lokið), `--dropped` fyrir Hætt við |
| `question ask <item>` | `huginn question ask 1a2b3c4d --to Á --body "Hvaða litur?"` |
| `question answer <qid>` | `huginn question answer 9f8e7d6c --body "Blár"` |
| `action add <item>` | `huginn action add 1a2b3c4d --owner H --body "Keyra SQL" --payload-file 0007.sql` |
| `action done <aid>` | `huginn action done 5e6f7a8b` |
| `plan add <item>` | `huginn plan add 1a2b3c4d --name "Plan A" --path docs/plan.md --status todo` |
| `plan set <pid>` | `huginn plan set 0c1d2e3f --status building` |
| `ruling add <plan>` | `huginn ruling add 0c1d2e3f --code R1 --body "Engin ný tafla" --cost "Lítill"` |
| `file add <item> <path>` | `huginn file add 1a2b3c4d skyrsla.pdf --repo-path docs/skyrsla.pdf` |
| `file get <fileid>` | `huginn file get 7a8b9c0d --out ./skyrsla.pdf` (`--force` skrifar yfir) |
| `comment add <item>` | `huginn comment add 1a2b3c4d --body "Lítur vel út"` |
| `bundle push` | `huginn bundle push --file bundle.md` (setur samhengi verkefnisins) |

Með `--json` skilar hver skrifskipun `{ "ok": true, "id": "<uuid>" }`.

- **Auðkenni.** `<id>` er heilt uuid eða að minnsta kosti 8 fyrstu stafir þess, eins og `#1a2b3c4d` aftast í línum `pull`. Ef forskeytið passar við fleiri en eina línu þarf lengra auðkenni.
- **Fólk.** `--waiting-on`, `--to` og `--owner` taka skammstöfun þátttakanda (H, Á, C), óháð stórum og litlum stöfum. `none` þýðir enginn (ekki fyrir `--owner`).
- **Staða.** Önnur staða en `waiting` hreinsar `waiting_on`. `--waiting-on H` án `--status` setur verkið í bið eftir H. `--status waiting` án manns er leyft.
- **Lokun.** `item close` og `item set --status done|dropped` neita ef verkið á ósvaraða spurningu eða opið handtak. `--force` lokar samt.
- **Hreinsun.** `--module none` tekur verkið úr módúl, `--tags ""` tæmir merki, tómt gildi á textareit tæmir hann.
- **Skrár.** Sömu reglur og vefurinn: hámark 50 MB, nafn að hámarki 180 stafir, geymt í `hg-files`. `--file` má endurtaka.
- **Staðsetning.** Nýtt spjald lendir við hlið módúlsins eins og í vefnum, annars efst til vinstri við það sem er á borðinu, aldrei ofan á spjaldi eða pakka.
- **Rofar.** Óþekktur rofi er villa. Gildi sem byrjar á `--` þarf að gefa sem `--body=--gildi`.

Höfundar, tímar, saga (`hg_events`) og `closed_at` koma frá gagnagrunninum. Þegar síðustu spurningu er svarað fer verkið sjálfkrafa í bið eftir Claude.

Almennir rofar: `--project <slug>`, `--json`, `--debug` (stack við villu), `--help`.

Villur eru ein lína á íslensku á stderr og exit kóði 1. Lykilorðið birtist aldrei í úttaki eða villum.

## Staðan sem markdown

`pull` raðar opnum verkum í hópa í fastri röð: Nýtt, Bíður ákvörðunar, Bíður Claude, Bíður <þátttakanda>, Tilbúið til byggingar, Í byggingu, Í bið. Tómir hópar sleppa. Innan hóps nýjast fyrst. Undir hverju verki koma opin handtök og ósvaraðar spurningar. Dagsetningar eru ISO, svo sama gögn gefa sama texta.

## Próf

`npm run test` keyrir líka `cli/**/*.test.mjs`. `cli/lib/parity.test.mjs` passar að afrit tólsins haldist eins og vefurinn: föll úr `src/vinnubord/lib/status.ts`, upload reglur úr `upload.ts`, `placeNewCard` úr `placement.ts` og stærðir úr `--hg-*` tókunum í `vinnubord.css`. Hrein föll skrifskipana eru prófuð í `cli/lib/write.test.mjs`, gagnagrunnsköllin eru í `cli/lib/ops.mjs`.
