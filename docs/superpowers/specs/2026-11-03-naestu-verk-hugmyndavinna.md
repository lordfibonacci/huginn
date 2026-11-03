# Næstu verk eftir plan 12: ákvarðanir úr hugmyndavinnu 3. nóv

Staða: minnispunktar, ekki hönnunarskjal. Heimir og Claude (Fable) fóru yfir níu atriði 3. nóv 2026 með mockupum í vafra (`.superpowers/brainstorm/877553-1793721116/content/`, gitignored, á disk Heimis). Verk 1 varð `2026-11-03-spjold-og-spjall-design.md` og plan 12. Hin þrjú fá hvert sitt hönnunarskjal í Fable lotu og svo plan. Röðin: skjöl, leit og tögg, kassar og tiltekt.

Gildir í þeim öllum: engin lituð rönd eða bar vinstra megin á neinu (Heimir, "gervigreindarröndin"), athygli er daufur gullbjarmi, módúll er texti. Engin Raða aðgerð sem færir kort án þess að Heimir velji þau sjálfur: hann hugsar myndrænt og man hvar kort eru.

## Verk 2: skjöl (lýsing, sækja, lesari)

Ákveðið:

- **Lýsing á skjali.** `hg_files` fær `note text` (migration 0015). `huginn file add --note "..."`, ein setning: hvað skjalið er og fyrir hvern. Sýnd undir nafninu í Skjöl flipanum og í `item.md` skráalistanum. Reglan fer í `/huginn` skillið (metta2_new): hvert `file add` ber `--note`. Vefupphleðsla fær valfrjálsan lýsingarreit í upphleðslublaðinu.
- **Sækja.** Hnappur á hverri röð í Skjöl flipanum og efst í lesaranum. Undirritaða slóðin (`fileUrl` í `lib/api.ts`) er til; skjalið sækist með sínu nafni (`download` eigindi eða blob). Md skjöl sem nú opnast í lesaranum fá líka Sækja.
- **Lesari, valkostur B** (`reader.html` B, Heimir 3. nóv): hliðarspjaldið breikkar meðan skjal er opið (um tvöfalt, borðið sést áfram vinstra megin), efnisyfirlit úr fyrirsögnum vinstra megin í lesaranum, 65 til 72 stafir í línu, töflur skrolla til hliðar í stað þess að brotna, hnappar efst: Sækja, Afrita slóð, "Til baka" í Skjöl flipann og spjaldið mjókkar aftur. Esc lokar lesaranum. Á síma: fullur skjár, efnisyfirlitið fellilisti efst.
- Lýsingin stendur í Skjöl listanum, ekki í lesaranum.

Opið við hönnun: breidd breiða spjaldsins sem tókens (`--hg-panel-w-reader`), hvað `freeRect` (listi, spjald) gerir við breiðara spjald, hvort `fileCountsByItem` og `sortFiles` breytast (líklega ekki).

## Verk 3: leit og tögg

Ákveðið:

- **Ctrl+F** (og Cmd+F) á borðsíðunni fer í leitarreitinn þegar ekkert svæði er í fókus, `preventDefault` svo vafraleitin opnist ekki. Esc hreinsar og skilar fókus.
- **Leitin nær víðar.** Í dag: titill, samantekt, meginmál, tögg (`filters.ts:31`). Bæta við: skjalanöfn og lýsingar, spurningar og svör, handtök, skilaboð í spjalli, og `keywords`.
- **`keywords`.** Nýr dálkur `hg_items.keywords text[]` (migration), falinn, aðeins fyrir leit. 10 til 15 samheiti á íslensku og ensku (samfélagsmiðlar, social media, content, efni, Instagram). Skrifað af `hg-analyse` (nýr reitur í SYSTEM_PROMPT og skema, `lib.ts`) og af Claude í lotum (`huginn item set --keywords`). Hvergi sýnt.
- **Tögg úr föstum lista.** Taggalisti verkefnisins í stillingum (`ProjectSettingsPage`, nýr editor): fjöldi á hverju taggi, endurnefna, sameina tvö í eitt (skrifar á öll verk). `hg-analyse` velur úr listanum (listinn fer með í búntið eða í promptið), frjáls tögg frá módelinu verða `keywords`. Tögg sjást bara í síuvalmyndinni og í haus spjaldsins, ekki á kortum (plan 12 tók þau af kortum).
- **Hreinsun einu sinni.** Lágstafir, broddstafir jafnaðir þar sem sama orð er til í tveimur myndum ("sýning" og "syning"), tvítök sameinuð. Listi yfir breytingar sem Heimir staðfestir áður en hann keyrir (SQL í skrá, handtak á Heimi eins og 0014 hreinsunin).

Opið við hönnun: geymsla taggalistans (eigin tafla `hg_tags` eða `jsonb` á `hg_projects`), hvort stafsetningarjöfnun er regla í kóða (`normalizeTag`) eða bara hreinsun, og hvað CLI `parity` þarf (CLI splittar tögg á kommu, `cli/lib/write.mjs`).

## Verk 4: kassar og tiltekt

Ákveðið:

- **Kassar, valkostur A** (`zones.html` A, Heimir 3. nóv): gegnsæ fylling í lit kassans (`color-mix` 11% fylling, 40% brún), nafnið á brúninni efst til vinstri, lítill texti neðst í kassanum ef vill. Ný tafla (`hg_zones`: project_id, title, color, note, pos_x, pos_y, w, h, created_by) með participant RLS og realtime, og staða per sýn eins og kort (`hg_view_zone_positions` með sömu reglu og `hg_view_positions`). Kassi er sýnilegur öllum.
- **Hvernig kassi verður til.** "+ Kassi" í toppstikunni, svo dregur Heimir ramma á borðinu. Nafn og litur í litlu spjaldi sem opnast. Að draga nafnið færir kassann með öllu sem er inni í honum (hópfærslan úr `useCardDrag` og `selection.ts`), að draga brúnina stækkar hann. Kort sem er dregið út úr kassa er bara ekki lengur í honum (aðild er rúmfræði, ekki gögn). Teiknaður undir kortunum á world laginu, snertir ekki vírana.
- **Fella pakka saman.** Pakkatitill fær rofa: samanfelldur pakki sýnir fjölda módúla og korta í einni línu ("2 módúlar · 6 kort · fellt saman"), kortin hans hverfa af borðinu þar til hann er opnaður. Per vafra (`localStorage`), ekki sameiginlegt.
- **Raða valin.** Aðeins kort sem Heimir valdi sjálfur með Ctrl ramma: þau raðast í grid þar sem þau eru (miðja valsins). Allt annað stendur kyrrt. Ein "afturkalla" rétt á eftir (toast með hnappi, skrifar gömlu stöðurnar aftur). Enginn hnappur sem raðar öllu borðinu.
- **Lokuð kort dofna** og fara af borðinu eftir nokkra daga (`isOnBoard` í `status.ts` og `cli/lib/status.mjs` ráða hvenær; CLI parity).

Opið við hönnun: hvort kassi á að virka sem sía (sýn úr kassa), snertihegðun (langpress á kassa), hvað gerist þegar kassi er eyddur (kortin standa), og hvort samanfelldur pakki er í `hg.list.<projectId>` lyklinum eða eigin lykli.

## Svarað í samtalinu, engin smíð

- Svör við spurningum Claude skila sér: `huginn sync` skrifar svarið í `item.md`, "Halda áfram" promptið segir lotunni að lesa það, `pull --brief` sýnir aðeins ósvaraðar. Ekkert ýtir svari inn í lotu sem er í gangi.
