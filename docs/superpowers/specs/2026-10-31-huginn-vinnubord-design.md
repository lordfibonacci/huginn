# Huginn: vinnuborð Mettu (hönnunarskjal)

Dagsetning: 2026-10-31
Staða: drög eftir hugmyndavinnu Heimis og Claude (Fable). Heimir ætlar að breyta og bæta við. Útlitið í mockupinu er upphafspunktur, ekki niðurstaða.
Mockup: `D:\Claude Code\Huginn\huginn\.superpowers\brainstorm\770768-1793436912\content\whiteboard-v7.html` (v5 til v7 sýna raunstöðu 31. október, v2 til v4 sýna fyrri skref). Þetta er throwaway. Ekkert úr því er kóði sem á að halda, en hegðunin sem það sýnir er sú sem á að byggja.

## 1. Tilgangur

Metta er byggð af þremur: Heimir (ákvarðanir, keyrsla), Árni (hönnun, módular, hvað á að gerast, 20 ára reynsla úr mötuneytisrekstri) og Claude (greining, plön, smíði). Árni skrifar aldrei kóða og kemur ekki með kóðatilvísanir. Hann segir hvað hann vill, í Markdown og HTML-prototypum, og Claude smíðar.

Ferlið í dag er brotið á tveimur stöðum:

1. **Engin yfirsýn.** Hvað er inni, hvað er í vinnslu, hvað bíður svars frá Árna, hvað er næst (plan 2 af 3). Í dag lifir þetta í Pending-kafla CLAUDE.md, í minni Claude, á WhatsApp og í hausnum á Heimi.
2. **Pípan er handvirk.** Hvert skjal fer Árni, WhatsApp, Heimir, lokal mappa, Claude, spurningaskjal, WhatsApp, Árni, hans Claude, WhatsApp, Heimir, Claude. Átta handtök, hvert þeirra getur gleymst, ekkert skráð.

Huginn leysir hvort tveggja: einn sameiginlegur staður sem allir þrír lesa og skrifa, með yfirlitsmynd (whiteboard, ekki kanban) og lifandi stöðu.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Ein mynd af verkefninu: módularnir fastir, opin verk á borðinu, þráður frá verki í módul, litur segir stöðu.
- Hvert skjal frá Árna á sér eitt heimilisfang sem allir sjá. "Sendu mér aftur" hverfur.
- Claude les og skrifar sama stað beint úr Claude Code, án þess að Heimir þurfi að vista neitt handvirkt.
- Skyndigreining um leið og eitthvað kemur inn, án þess að Heimir opni lotu.
- Allar hráar skrár og greiningar enda samt í git á tölvu Heimis, því hann er sá eini sem pushar.
- Verkefnaskipt frá fyrsta degi: Metta fyrst, Fjarðabyggðarappið og fleiri síðar.
- Lítur vel út og er gaman að nota. Þetta er innanhússtól en það er ekki afsökun.

**Ekki-markmið**

- Ekki kanban, ekki listar sem spjöld eru dregin á milli, ekki sprettir, ekki tímamat.
- Ekki verkefnastjórnunartól fyrir aðra en okkur þrjá (og Claude Code hjá hvorum).
- Ekki geymsla fyrir prógress-skjöl eða kóða. Þau eru áfram í repoinu, Huginn vísar á þau.
- Ekki tilkynningar (push, póstur) í fyrstu útgáfu. Heimir og Árni kíkja sjálfir inn.

**And-markmið (mistök sem gera þetta ónýtt þótt það virki)**

- Ef staða verks er breytt með því að draga það. Staða er læst, Claude færir hana. Dráttur er bara skipulag á borðinu.
- Ef borðið verður dálkar með kössum. Þá er það kanban með öðru nafni.
- Ef Heimir þarf að opna lotu í Claude Code til að sjá nýtt frá Árna.
- Ef eitthvað sem Árni hleður inn endar ekki í repoinu.
- Ef innanhússverkefnið lendir inni í Mettu sjálfri eða gagnagrunni kúnnanna.

## 3. Skorður

- **Huginn-repoið er endurnýtt og straujað.** `D:\Claude Code\Huginn\huginn`, huginn.pro á Vercel, Supabase-verkefni `czdjxtsjgughimlazdmu` (deilt með öðrum smáverkefnum, allar Huginn-töflur með forskeytinu `huginn_`). Núverandi Trello-tafla, inbox, runes og social-hlutinn eru lagðir niður. Login, viðhengi, kommentaþráður, markdown-lesari og realtime eru það sem má stela úr undirlaginu. Aðrir notendur (Iceland Cover) fara út.
- **Gagnagrunnsskeman er ekki í repoinu.** Engin `supabase/migrations` mappa í Huginn. Nýju töflurnar fá nýtt forskeyti (`hg_` eða sambærilegt) svo gamla kerfið sé ekki snert fyrr en Heimir eyðir því sjálfur. Byggingaraðili skrifar migrations inn í repoið frá og með þessu verki.
- **Supabase MCP:** migrations fara í gegnum `apply_migration`, aldrei `db push` (sjá minnisregluna í metta2). Connector-inn hafnar DROP og DELETE, þau fara handvirkt hjá Heimi.
- **Stórar skrár:** ókeypis áskrift leyfir um 50 MB á skrá. Zip og vídeó þurfa Pro á Huginn-verkefninu þegar kennsluvídeó byrja að fara inn. Ekki fyrr.
- **Hver pushar:** Heimir einn pushar í metta2_new. Árni hefur lesaðgang, pullar, pushar aldrei. Huginn-repoið sjálft: Heimir.
- **Claude Code hjá Árna** er ekki komið upp (sett upp eftir sýninguna). Þangað til hleður hann inn á vefnum.
- **Stíll:** engir þankastrik eða bandstrik í texta (sjá feedback_no_dashes_anywhere), íslenskt viðmót, ekki hástafaborðar, ekki punktar á milli orða.
- **Engin fjöldakeyrsla** á ferlum á PC Heimis (feedback_no_mass_process_spawn).

## 4. Hugtök og gagnalíkan

Allt er skráð á verkefni (`project`). Metta er fyrsta verkefnið.

| Hugtak | Hvað það er |
|---|---|
| **Verkefni** (project) | Metta, Fjarðabyggðarappið, ... Eigið borð, eigin módular, eigin þátttakendur, eigin repo-slóð. |
| **Pakki** (package) | Hópun módula á borðinu: Grunnur, Stóreldhús, Rekstur, Þvert á allt, Sala og samstarf. Fastur dálkur á borðinu, föst staðsetning. Röð módula innan pakka er handstillt. |
| **Módull** (module) | Fast eining, ekki færanleg. Nafn, einnar línu staða, pakki, litur, hvort hann er smíðaður eða draumur (ghost). Lokin verk hengjast undir hann. |
| **Verk** (item) | Það sem hreyfist. Nýtt spekk frá Árna, breyting, villa, hugmynd, ákvörðun sem bíður, smokes sem bíða. Á sér módul (einn, má vera enginn ef óflokkað), stöðu, tögg, stofnanda, síðasta hreyfanda, staðsetningu á borðinu, stutta lýsingu frá Claude, heimild (slóð í repo eða minni). |
| **Plan** (plan) | Barn af verki. "Plan 2 af 3". Nafn, slóð í repoið, staða (ekki byrjað, í byggingu, lokið). Framvindustikur á kortinu teiknast úr þessum. |
| **Skjal** (file) | Viðhengi við verk. Hver setti inn, hvenær, tegund, stærð, slóð í Storage, og slóð í repoinu þegar Claude hefur speglað. |
| **Spurning** (question) | Claude til Árna (eða Heimis), með svari. Verk með ósvöruðum spurningum er "bíður Árna". |
| **Athugasemd** (comment) | Frjáls texti frá hverjum sem er, á verk eða módul. |
| **Atburður** (event) | Tímalína verks: stofnað, skjal bætt við, greint, spurt, svarað, staða breytt, opnað af X. Skrifast sjálfkrafa. |
| **Handtak** (action) | Lítið verkefni á verki með eiganda (Heimir, Árni, Claude), texta, mögulega skrá eða SQL-blokk, og hak. "Keyra SQL úr kafla Handover", "Svara spurningu 2", "Athuga á iPad". Teljarinn "bíður þín" telur líka ósvöruð handtök. |
| **Úrskurður** (ruling) | Ákvörðun sem Claude tók í byggingu án þess að spyrja (R1 til R18 í Efnaskrá A). Texti og hvað það kostar ef rangt. Liggur á plani, sést í felliglugga, Heimir getur merkt "snúa við". |
| **Næsta skref** (next step) | Á verki: hvað gerist næst og nákvæmlega hvernig, með afritanlegu prompti ef næsta skref er lota í Claude Code ("claude --model opus í d:\Claude Code\metta2, segðu: keyrðu plan B1"). |
| **Opnun** (read mark) | Hver hefur opnað verkið eftir síðustu breytingu. Ræður "glóir" (ekki opnað) og "brotalína" (opnað en ekki svarað). |

**Stöður verks** (ein í einu, Claude færir þær nema annað sé tekið fram):

| Staða | Litur | Merking |
|---|---|---|
| Nýtt | gull | Komið frá Árna, Claude hefur ekki greint. Glóir hjá Claude. |
| Bíður ákvörðunar | kóral | Greint, Heimir þarf að ákveða (byggja núna, samhliða, bíða) eða gera handtak. |
| Bíður Árna | lilla | Spurningar ósvaraðar eða Árni á næsta leik. Glóir þar til hann opnar, brotalína þar til hann svarar. |
| Tilbúið til byggingar | sægrænt | Plan skrifað, ekki byrjað. |
| Í byggingu | sægrænt | Plan í gangi, framvinda sýnd. |
| Í bið | steingrátt | Lagt til hliðar með ástæðu og mögulega dagsetningu. Hugmyndir byrja hér. |
| Lokið | (hverfur af borðinu) | Smoke-testað, spurningum svarað, pússað. Hengist undir módulinn. |
| Hætt við | (hverfur af borðinu) | Hafnað, tvítekið eða fellt niður, með ástæðu. Sést í sögu módulsins undir eigin fyrirsögn, aldrei sem lokið. |

Staða er vistuð, ekki reiknuð. Við hliðina á henni er `waiting_on`, vísun í þátttakanda (Heimir, Árni, Claude eða enginn). "Bíður Árna" er staðan Bíður með `waiting_on` = Árni, "Bíður ákvörðunar" er sama staða með `waiting_on` = Heimir. Þannig virkar þetta óbreytt í verkefni með öðrum þátttakendum. Teljararnir í toppstikunni eru miðaðir við þann sem horfir: "bíður þín" er það sem bíður mín. Ein sjálfvirk breyting: þegar síðustu ósvöruðu spurningu er svarað á vefnum færist `waiting_on` á Claude og kortið segir "Svarað, bíður Claude", svo næsta lota taki það upp.

Heimir og Árni mega líka færa stöðu í vefnum (til dæmis "í bið"), en venjan er að Claude geri það í lok lotu. Hver breyting skráist sem atburður með geranda.

**Tögg:** frjáls strengir á verki. Claude stingur upp á töggum við greiningu, allir mega breyta. Dæmi úr raunstöðunni: fyrir sýningu, eftir sýningu, pakki Árna, kennsla, smokes, hugmynd, villa, redeploy, ákvörðun.

**Gerendur:** Heimir, Árni og Claude. Claude er sér auðkenni í kerfinu (service-notandi), ekki Heimir í dulargervi, svo tímalínan segi satt. Claude Code hjá Árna skrifar sem Árni.

## 5. Flæðið

1. **Inn.** Árni setur inn verk: titill, texti, skjöl (md, html, zip, myndir, vídeó). Annaðhvort á vefnum eða úr sínu Claude Code með `/huginn`. Staða: Nýtt.
2. **Skyndigreining (án Heimis).** Gagnagrunnsatburður ræsir edge function sem sendir skjölin og samhengisbúnt úr repoinu til Claude API. Niðurstaða skrifast á verkið innan mínútu: hvað þetta er, hvaða módul (tillaga), stærð, áhætta, hvað þarf að spyrja um, hvort þetta er byggjanlegt núna, samhliða eða seinna. Staða: Bíður ákvörðunar. Árni sér þetta um leið.
3. **Djúpvinna (í Claude Code hjá Heimi).** Lotan keyrir `/huginn`: sækir nýtt, speglar skrár í repoið, les skyndigreininguna, bætir við því sem repoið veit, skrifar spurningar til Árna beint á verkið (staða: Bíður Árna) eða spekk og plan (staða: Tilbúið til byggingar, plön skráð sem börn).
4. **Svar.** Árni opnar (opnun skráist, glóðin fer), svarar spurningum á verkinu. Claude sér það næst.
5. **Bygging.** Opus-lota byggir plan. Skillið færir plan í "í byggingu" og "lokið". Kortið sýnir framvindu.
6. **Lok.** Þegar allt er smoke-testað og pússað lokar Claude verkinu. Það hverfur af borðinu og hengist undir módulinn, opnanlegt með allri sögu.

Allt sem Claude skrifar birtist á borðinu samstundis (Supabase realtime). Allt sem Árni og Heimir gera sömuleiðis.

### 5b. Dæmi: lotulok Efnaskrá A (dæmi Heimis, 2026-10-31)

Opus-lota kláraði plan A af þremur. Í lok hennar urðu til framvinduskjal 141, prófunarbók, breytingaskjal fyrir Árna um kennsluklippurnar, SQL-blokk sem Heimir þarf að keyra, 18 úrskurðir, og fyrirmæli um að B fari í sér lotu. Í dag liggur þetta í fjórum skrám á tölvu Heimis og í spjallglugga sem lokast.

Það sem lotulok á að skrifa inn á verkið "Efnaskrá A og B: endurhönnun" í Huginn, sjálfkrafa í gegnum skillið:

- Plan A: lokið. Plan B1 og B2: næst. Framvindustikan á kortinu uppfærist.
- Skjöl: framvinduskjalið, prófunarbókin og breytingaskjalið hengjast á verkið með slóð í repoið.
- Handtök: "Heimir: keyra SQL úr kafla Handover í skjali 141" með SQL-blokkinni sjálfri á handtakinu, "Árni: fara yfir breytingaskjal kennsluklippa, 13 upp aftur, 2 út".
- Úrskurðir R1 til R18 í felliglugga á plani A, hver með "hvað kostar ef rangt".
- Næsta skref: "B1 í nýrri lotu: claude --model opus í d:\Claude Code\metta2, grein efnaskra er á sama stað og main, flutningar 00402 og 00403 fráteknir", afritanlegt.
- Staða verks: Bíður ákvörðunar, `waiting_on` Heimir, því hann á handtak.

Heimir opnar Huginn í síma, sér að A er búið, keyrir SQL-ið (eða lætur Claude Code gera það um Remote Control), hakar í handtakið, les úrskurðina ef hann vill, afritar promptið og byrjar B1. Hann leitar hvergi að skrám. Huginn er heimildin fyrir hann, í rauntíma, þótt Claude Code sé opið við hliðina.

### 5c. Síminn á kvöldin: Huginn sem samhengisakkeri (Heimir, 2026-10-31)

Heimir notar símann aðallega á kvöldin til að halda áfram með plön eða hugmyndavinnu sem byrjaði í tölvunni. Í Claude Code í símanum getur hann haft eitt eða tvö Metta-spjöll opin, getur ekki opnað nýja lotu án þess að hreinsa aðra, og tapar þá samhenginu: var A búið, er B næst, hvað með C og D. Huginn á að vera staðurinn sem svarar því, og staðurinn þar sem allt sem þarf að líma inn í nýtt Fable- eða Opus-spjall liggur tilbúið.

Kröfur sem fylgja:

- **Allt afritanlegt með einu taki.** Hvert prompt, hver SQL-blokk, hver slóð í plan eða skjal, hvert næsta skref, hefur afritunartakka sem virkar í síma. Engin textavalsvinna.
- **"Hvar erum við" efst á hverju verki.** Ein til þrjár línur sem Claude skrifar í lotulok: "A lokið og sameinað. B1 næst, í sér lotu. SQL hjá þér fyrst." Plönin sem listi með stöðu hvers.
- **"Halda áfram" takki á verki.** Býr til afritanlegt samhengisprompt fyrir nýtt spjall: hvað verkið er, hvað er búið, hvað er næst, slóðir í spekk og plön, opin handtök og úrskurðir sem skipta máli, og í hvaða möppu og á hvaða módeli lotan á að keyra. Heimir límir það í hreint spjall í símanum og er kominn á sama stað og tölvan. Skillið skrifar innihaldið, Huginn setur það saman.
- **Handtök afgreiðanleg í síma:** haka, svara, afrita SQL. Það sem þarf tölvuna er merkt þannig.

## 6. Borðið

**Uppbygging.** Eitt frjálst borð með punktagrind, pan með drætti á autt svæði, zoom með músarhjóli og tökkum (inn, út, sýna allt). Pakkar eru fastir lóðréttir dálkar á borðinu, hver með fyrirsögn og teini. Þeir skalast og panast með öllu öðru, en eru ekki færanlegir. Verk eru kort sem svífa frjáls og eru færanleg; staðsetning vistast sameiginlega (sá sem dró síðast ræður). Þráður tengir hvert verk við módulinn sinn, finnur sjálfur hvora hlið módulsins verkið er nær.

**Kort verks sýnir:** stöðupunkt og stöðutexta, titil, hver hreyfði síðast og hvenær, tögg, skjalamerki, framvindustikur plana ef þau eru til. Glóð á punkti og hringur á horni þegar það er nýtt hjá þeim sem horfir. Lagt til hliðar er daufara og með brotalínu.

**Módull sýnir:** nafn, einnar línu stöðu, fjölda opinna verka. Smellur opnar módulinn í spjaldinu: lýsing, opin verk, lokin verk (opnanleg, föst), skjöl módulsins.

**Spjaldið** (hægra megin, rennur inn) opnast við smell á verk eða módul og lokast við smell á autt borð eða Esc. Enginn x-takki. Flipar verks: Staða (greining Claude, næsta skref, heimild), Skjöl (hver setti hvað inn, slóð í repo), Spurningar (með svörum, svarreitur), Saga (tímalína). Neðst: athugasemdareitur.

**Síur** búa í toppstikunni, ekki í eigin röð. Teljararnir (12 bíður þín, 12 bíða Árna, ...) eru sjálfir stöðusían, smellur kveikir og slekkur. Pakki og Tögg eru fellivalmyndir með fjöldatölu þegar eitthvað er valið. Leit er lítill reitur. "Hreinsa" birtist bara þegar sía er á. Verk sem passa ekki dofna, þráðurinn þeirra hverfur, módular án sýnilegra verka dofna. Borðið fær allt lóðrétta plássið.

**Toppstika:** merki, verkefnaval, teljarar/síur, leit, fellivalmyndir, "Lifandi" punktur, þátttakendur.

**Snerting, frá fyrsta degi (Heimir 2026-10-31).** Spjaldtölva og sími eru jafngild tölvunni, ekki pússun seinna. Árni vinnur á iPad, Heimir vill geta gert sem mest í síma, líka um Remote Control í Claude Code. Kröfur: pinch-zoom og tveggja fingra pan; einn fingur á autt borð panar, einn fingur á kort opnar það, langt hald á korti tekur það upp til að draga; spjaldið verður botnblað á mjóum skjám með dragræmu, fullri hæð þegar það er dregið upp; allir hnappar og hök að minnsta kosti 44 px; toppstikan brotnar í tvær raðir eða fellivalmynd undir 768 px; handtök, spurningasvör og athugasemdir virka að fullu í síma.

**Hreyfing.** Ein samhæfð innkoma þegar borðið hleðst (kort spretta inn, þræðir dragast upp). Þræðir glóa, ljósneistar ferðast eftir þráðum sem bíða einhvers, sjaldan á rólegum. Verk eltir músina með smá fjöðrun. Nýtt verk kemur inn með neistahrinu og lítilli tilkynningu neðst. Norðurljósaslæða líður hægt í bakgrunni. prefers-reduced-motion slekkur á öllu þessu.

**Útlit.** Dökkt blágrátt borð, ein leturfjölskylda (Manrope í mockupinu), stöðulitir gull, lilla, kóral, sægrænt, steingrátt. Heimir hafnaði fyrstu tveimur útgáfunum sem "glorified kanban" og "AI-slop" og tók þeirri þriðju sem "allt að koma". Byggingaraðili má bæta útlitið en má ekki fara til baka í kassa og dálka. Heimir ætlar að breyta útlitinu mikið eftir á, svo kóðinn á að gera það ódýrt: litir, bil og hreyfing í tokens og einum stað.

## 7. Hliðarnar

**7.1 Vefurinn** (Huginn-repo). React + Vite + Tailwind v4 + Supabase eins og er. Nýjar síður: borð per verkefni, verkefnaval, innstillingar verkefnis (módular, pakkar, þátttakendur, repo-slóð). Gamlar síður fara. PWA helst (gagnast seinna fyrir push).

**7.2 Claude Code hjá Heimi og Árna.** Eitt lítið skipanalínutól í Huginn-repoinu, sett upp sem `/huginn` skill í metta2 (og seinna í öðrum verkefnum). Það skráir sig inn sem viðkomandi Huginn-notandi með eigin login (engir gagnagrunnslyklar hjá Árna), RLS ræður. Skillið kann: sækja nýtt, stofna verk með skrám, skrifa greiningu, spyrja, svara, færa stöðu, skrá plan og framvindu, skrá handtök með eiganda, skrá úrskurði á plan, skrifa næsta skref með prompti, loka, spegla skrár í repoið, skrifa `docs/huginn/STATUS.md`. Lotulok í metta2 kallar á það (sjá 5b), svo ekkert af þessu sé handskrifað. Claude notar auk þess Supabase MCP fyrir frjálsar fyrirspurnir ("hvað bíður Árna lengst?"). Lotustart-áminning í metta2 segir "3 verk bíða þín, 1 bíður Árna".

**7.3 Skyndigreining.** Edge function í Huginn-verkefninu, ræst af database webhook á nýtt verk (og þegar skjali er bætt við verk í stöðu Nýtt). Sækir skrárnar, sækir samhengisbúntið, kallar á Claude API (nýjasta Opus eða Fable), skrifar greiningu, tillögð tögg og tillagðan módul á verkið, færir stöðu í Bíður ákvörðunar. Ef kallið bregst helst verkið Nýtt og villan skráist sem atburður.

**Samhengisbúntið** er texti sem Claude Code hjá Heimi uppfærir í lok hverrar lotu (sama handtak og uppfærir CLAUDE.md): CLAUDE.md verkefnisins, módulalisti með stöðu, opin plön og síðustu prógress-skjöl í stuttu máli. Geymt á verkefninu í Huginn. Repoið er privat, svo búntið er leiðin, ekki GitHub-kall.

**7.4 Spegill í repoið.** Hvert verk fær möppu `docs/huginn/<slug>/` í metta2_new með hráu skjölunum frá Árna, greiningu Claude, spurningum og svörum. Skillið skrifar þetta þegar það sækir og uppfærir. Að auki `docs/huginn/STATUS.md`, sjálfvirk skrá með öllu opnu, skrifuð í lok lotu, svo repoið eigi alltaf lesanlegt afrit og git eigi söguna. Prógress-skjölin sjálf eru áfram í `docs/progress`, verk vísar á þau.

**7.5 CLAUDE.md í metta2_new.** Pending-kaflinn flyst í Huginn (einu sinni, sjá 10). Í staðinn kemur ein lína: opin verk búa í Huginn, keyrðu `/huginn` í upphafi lotu, STATUS.md er afrit. Complete-kaflinn, Deferred smoke tests og allt annað helst. Lotulokaritúalið uppfærir Huginn í stað þess að handskrifa Pending-línur.

**7.6 Aðgangur.** Supabase Auth eins og er. Þrír notendur: Heimir, Árni, Claude (service). Allir þátttakendur verkefnis sjá og skrifa allt í því verkefni. Enginn stigveldismunur í fyrstu útgáfu. Aðrir núverandi notendur eru fjarlægðir.

**7.7 Geymsla.** Supabase Storage, einn bucket per verkefni eða ein með slóð `<project>/<item>/<file>`. Privat, aðgangur í gegnum RLS. Resumable upphlaðning fyrir stórar skrár þegar Pro er komið.

**7.8 Fleiri verkefni.** Verkefni er fyrsta flokks hlutur frá degi eitt. Skillið veit í hvaða verkefni það er út frá repoinu sem það keyrir í. Fjarðabyggðarappið er næsta, ekki í þessari lotu.

## 8. Ákvarðanir Heimis (eins og hann tók þær)

- Huginn-taflan deyr, nafnið og repoið halda sér, nýtt yfirborð á sama undirlag.
- Enginn dregur til að breyta stöðu. Claude færir hana. Dráttur er skipulag.
- Módular eru fastir, í lóðréttum dálki per pakka, ekki í hliðarstiku. Maður á að komast hinum megin við þá.
- Lokin verk festast undir módulinn, opnanleg, föst.
- Verkefnaskipt frá fyrsta degi.
- Fyrir utan Supabase Mettu, í Huginn-verkefninu.
- Árni jafningi með fullan aðgang, kommentar, bætir við skjölum hvar sem er.
- Hans Claude Code á að geta skrifað beint, ekki í gegnum upphlaðningu.
- Zip og vídeó þurfa að komast inn.
- Realtime: upplýsingar birtast um leið og þær koma, án þess að opna lotu.
- Smellur utan korts lokar því, enginn x.
- Zoom inn og út.
- Síur: stöður, flokkar, tögg. Mega ekki taka pláss frá borðinu.
- Engar tilkynningar fyrst um sinn.
- Sameiginlegt skipulag á borðinu.
- Pending-kaflinn speglast, ekki fluttur: Huginn er meistari fyrir opin verk, repoið á sjálfvirkt afrit.

## 9. Ákvarðanir Claude (má snúa við)

- Skyndigreining í tveimur lögum: edge function með Claude API strax, djúpvinna í Claude Code. Samhengisbúnt uppfært í lotulok.
- Skipanalínutól með eigin login notanda í stað MCP-lykla hjá Árna.
- Claude er sér auðkenni í kerfinu.
- Nýtt töfluforskeyti, gamlar töflur látnar í friði þar til Heimir eyðir þeim.
- Tögg eru frjáls strengir, ekki fyrirfram skilgreindur listi.
- Öryggisfundir settir undir Stóreldhús og Verkferlar undir Grunn í raunstöðunni. Heimir leiðréttir ef rangt.
- Spjaldið er hægra megin og fast, ekki hluti af borðinu.
- Pro-áskrift á Huginn-verkefnið bíður þar til fyrsta vídeóið þarf að fara inn.

### 9b. Ákvarðanir eftir byggingaryfirlestur (Claude, má snúa við)

Byggingaraðili á Opus las skjalið og skilaði níu spurningum. Þessar sjö afgreiddi Claude:

- **Tvær tegundir skráa frá Árna.** (a) Vöruefni sem á heima í vörunni: kennsluklippurnar (JS-teiknaðar, smáar, búa í `public/hjalp/` og `storage-seed/` í dag), sýningarskjár-HTML, myndir í landing. Þær fara þangað sem þær eiga heima í repoinu, eins og í dag, Claude Code sækir þær úr Huginn og setur á réttan stað. (b) Viðhengi til viðmiðunar: spekk, prototype, skjáupptaka af villu, zip með vinnuskjölum. Texti og skrár undir 10 MB speglast í `docs/huginn/<slug>/`, stærri (mp4, stórt zip) fá bendiskrá þar (nafn, stærð, Storage-slóð, hash) og búa í Storage. Reglan "ekkert vídeó í git" á bara við um (b). Ef kennsla færist einhvern tíma yfir í alvöru mp4 er það vöruefni og fer í Storage eða CDN Mettu, ekki í Huginn.
- **Skyndigreining skrifar módul og tögg beint**, ekki sem bið-tillögu. Heimir vill sjá þráðinn tengjast um leið. Atburðurinn segir "tillaga Claude API" og Claude Code eða Heimir breytir ef rangt.
- **Auðkenni í Claude Code hjá Heimi:** skipanalínutólið þar er alltaf skráð inn sem Claude (service-notandinn). Heimir gerir hlutina sjálfur bara á vefnum. Lykilorð Claude býr í lokal stillingaskrá utan repos (sama fyrirkomulag og `C:/Users/Notandi/metta-creds/`). Opnunarmerki eru per þátttakanda: Claude sem opnar verk hreinsar bara glóð Claude. Claude Code hjá Árna skrifar sem Árni með merkingunni "um Claude Code", tímalínan sýnir "Árni (Claude Code)".
- **Minnisskrár Claude** (Heimir efast, 2026-10-31, svo þetta er mjúkt): minnisskrárnar halda áfram eins og í dag, gotchur, reglur, ákvarðanir og stutt staða verkefna. Það sem breytist er bara að þær eru ekki lengur meistarinn fyrir "hvað er opið"; Huginn er það, og `/huginn` sækir opin verk í upphafi lotu með öllu sem fylgir (skjöl, spurningar, úrskurðir, handtök). Samhengið verður meira, ekki minna: tveggja lína minnisnóta verður að heilu verki. Ef Heimir vill má minnið áfram geyma stöðulínur líka, það kostar bara tvöfalt viðhald. `metta2/from_arni/` flyst inn í `docs/huginn/<slug>/` í fyrstu fyllingu.
- **Aðrir notendur:** fjarlægðir úr Huginn með þátttakendatöflu (aðgangur að verkefni ræður öllu), opna boðskóða-nýskráningin lokar. Auth-reikningarnir sjálfir eru ekki eyddir nema Heimir staðfesti að þeir séu ekki notaðir í hinum smáverkefnunum á sama Supabase.
- **Tímasetning (Heimir 2026-10-31: halda áfram strax):** bygging byrjar um leið og plan er tilbúið, í eigin Opus-lotum í Huginn-repoinu, samhliða sýningarverkunum. Þetta er hliðarverkefni en mikilvægt. Röðin: borð, verk, skjöl, handtök og realtime fyrst (með snertingu), svo skipanalínutól, lotulok og spegill, svo skyndigreining. Gamla Huginn-yfirborðið fer niður þegar v1 fer upp.
- **Hætt við** er bætt við sem lokastaða (sjá töfluna í kafla 4) svo hafnað efni þurfi hvorki að liggja í bið að eilífu né líta út sem lokið.

Heimir svaraði 2026-10-31: snerting að fullu frá fyrsta degi (kafli 6), bygging heldur áfram strax (hér að ofan).

## 10. Fyrsta fylling

Einu sinni, af Claude í Claude Code: Pending-kafli CLAUDE.md (um 66 línur), verkefnalisti Heimis (minni: project_todo_pre_storeldhusid), pakkatriage Árna frá 31. október og opnir hlutir úr minnisskrám. Sama efni og v5 til v7 mockupið sýnir (46 verk). Hvert verk fær heimild (slóð í skjal). Lokið efni er ekki flutt. Módular og pakkar eru stofnaðir úr `src/lib/modules.ts` í metta2_new (tier 1, 2, 3) plús Þvert á allt og Sala og samstarf sem Heimir ræður röðinni á.

## 11. Eftirlátið byggingaraðila

- Nákvæmt töfluskema, RLS og vísar. Realtime-rásir.
- Útfærsla þráða (canvas eða SVG), fjöðrunar og neista, svo lengi sem hegðunin í kafla 6 helst.
- Hvernig staðsetning vistast (per verk, debounced).
- Uppbygging skipanalínutólsins (Node eða Deno), hvernig login er geymt lokalt, og hvernig skillið er sett upp í metta2.
- Snið samhengisbúntsins og prompt skyndigreiningarinnar.
- Hvernig edge function sækir stór skjöl (vídeó eru ekki send til Claude, bara nafn og stærð).
- Hreinsun Huginn-repos: hvað fer, hvað helst, í hvaða röð.
- Vercel og lén: huginn.pro helst.

## 12. Það sem er opið og Heimir ætlar að breyta

Heimir sagði við lok hugmyndavinnunnar: "ég kem til með að breyta þessu helling og bæta við, ég er langt því frá sáttur en veit ekki alveg hverju ég á að breyta núna". Skjalið er því grunnur, ekki samningur. Byggingaraðili skal gera ráð fyrir endurteknum útlitsumferðum og halda útliti í tokens og einum stað.
