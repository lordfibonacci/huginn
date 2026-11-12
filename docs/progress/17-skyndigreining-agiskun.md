# 17 Vinnuborð: skyndigreining án ágiskana (plan 9c514d50)

Dagsetning: 2026-11-12
Grein: `skyndigreining-agiskun` (commits b2df584 og 755e1b9 ofan á main, auk þessa skjals)
Plan: `docs/superpowers/plans/2026-11-12-skyndigreining-agiskun.md`

Staða: **hg-analyse útgáfa 13 er í loftinu** (2026-11-12). Sameining á main bíður lokayfirferðar. Eftir er að sjá fyrstu raunverulegu greininguna á útgáfu 13 (sjá Opið).

## Hvað var gert

Greinirinn sér aðeins atriðið, textaskrárnar, módúlalistann, taggalistann og samhengisbúntið. Hann hefur engan kóða, engan gagnagrunn og engin tól. Samt lét fyrri leiðbeiningin hann enda hverja greiningu undir fyrirsögninni "Byggjanlegt núna, samhliða eða seinna", svo hann kvað upp dóm um það sem hann gat ekki vitað, og textinn lenti í verkinu án þess að nokkuð greindi hann frá greiningu sem Claude Code lota skrifaði með repoið opið.

**Task 1, `lib.ts`** (b2df584, 755e1b9). Fimmta fyrirsögnin er nú `Hvað þarf að kanna áður en byggt er`. Regla 3 bannar dóm um hvort eða hvenær megi byggja í samantektinni. Regla 4 segir að undir síðustu fyrirsögninni séu talin upp þau atriði sem lota með kóðann þarf að kanna og það sem verkið sjálft segir að gerist fyrst, og að greinirinn segi aldrei að eitthvað sé byggjanlegt núna. Regla 12 segir að hann hafi ekki séð kóðann eða gagnagrunninn, fullyrði aðeins það sem stendur í gögnunum og merki allt annað með orðinu `ágiskun` eða sleppi því. Regla 13 segir að stærðin undir Stærð og áhætta sé mat út frá lýsingunni einni og að hann segi það berum orðum. `ANALYSIS_NOTICE` er flutt út og `mergeIntoItem` setur hana efst í hvern greiningartexta, skrifaða af kóða en ekki af líkaninu. `index.ts` er óbreytt.

**Task 3, skillið** (metta2_new commit 89d003c2, ýtt). Regla 0b í `/huginn` skillinu segir lotum að sannreyna skyndigreiningu í repoinu áður en þær skrifa greiningu, spurningar eða plan á henni. Eldri greiningar bera ekki línuna en þekkjast á fyrirsögninni "Byggjanlegt núna, samhliða eða seinna", og sama regla gildir um þær.

**Task 2, útsetning og skjöl** (þetta skjal og CLAUDE.md). Kaflarnir "Edge function hg-analyse" og "Analysis rules" fengu útgáfu 13 og regluna um greininn, og prófafjöldinn í "Current state" er 655.

## Mælt dæmi sem ollu breytingunni

Verkið `7a35df18` (Vörumóttaka, greint 2026-11-10 á útgáfu 12):

- "Bakendann má byggja núna, því kröfurnar þar eru fastar": dómur sem ekkert stendur á bak við, og samantektin endurtók hann.
- "nýjar töflur með RLS eftir company/department": Metta skiptir gögnum eftir deild, ekki fyrirtæki.
- "Í kóðanum verður þetta líklega sér módúll (`receiving`, liturinn `--color-m-inventory`)": ágiskun sett fram sem niðurstaða.

## Útsetning

- Sett í loftið með MCP `deploy_edge_function` (verkefni `czdjxtsjgughimlazdmu`, `verify_jwt` false), tvær skrár (`index.ts`, `lib.ts`) úr HEAD greinarinnar. Íslenskir stafir voru sendir sem `\u` kóðar eins og í útgáfum 11 og 12.
- Svar útsetningar og `get_edge_function`: `hg-analyse` útgáfa 13, staða ACTIVE, 2026-11-12.
- Samanburður: `get_edge_function` skilaði báðum skránum afkóðuðum og þær voru lesnar línu fyrir línu á móti repoinu. Þær eru eins (kerfisleiðbeiningin með reglum 1 til 13, fyrirsagnalistinn, `ANALYSIS_NOTICE`, `mergeIntoItem`, öll villuskilaboð í `index.ts`). Samanburðurinn var gerður með lestri, ekki með sjálfvirku diff, því MCP skilar textanum aðeins í svarinu.
- Leyndarmál, Vault og aðrar föll voru ekki snert.

## Staðfesting

- `npm run test`: 655 próf græn.
- Útgáfa 13 í loftinu, birti textinn eins og í repo.

## Opið

- Lesa fyrstu raunverulegu greininguna á útgáfu 13 (næsta nýja verk frá Heimi eða Árna): hún byrjar á línunni um skyndigreiningu, síðasta fyrirsögnin er `Hvað þarf að kanna áður en byggt er`, ekkert segir að eitthvað sé byggjanlegt núna og ágiskanir um kóðann eru merktar. Skrá niðurstöðuna hér. Handtak á Claude er skráð í Huginn á verkinu 08db5a35.
- Ef lokayfirferðin breytir `lib.ts`, þarf að setja útgáfu 14 í loftið og bera saman aftur áður en sameinað er.
