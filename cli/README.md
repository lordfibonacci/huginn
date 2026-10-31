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

Almennir rofar: `--project <slug>`, `--json`, `--debug` (stack við villu), `--help`.

Villur eru ein lína á íslensku á stderr og exit kóði 1. Lykilorðið birtist aldrei í úttaki eða villum.

## Staðan sem markdown

`pull` raðar opnum verkum í hópa í fastri röð: Nýtt, Bíður ákvörðunar, Bíður Claude, Bíður <þátttakanda>, Tilbúið til byggingar, Í byggingu, Í bið. Tómir hópar sleppa. Innan hóps nýjast fyrst. Undir hverju verki koma opin handtök og ósvaraðar spurningar. Dagsetningar eru ISO, svo sama gögn gefa sama texta.

## Próf

`npm run test` keyrir líka `cli/**/*.test.mjs`. `cli/lib/parity.test.mjs` passar að afrit tólsins af föllum úr `src/vinnubord/lib/status.ts` haldist eins.
