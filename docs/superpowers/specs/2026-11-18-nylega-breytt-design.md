# Huginn: nýlega breytt (hönnunarskjal)

Dagsetning: 2026-11-18
Staða: drög Claude (Fable) úr samtali við Heimi sama dag. Bíður samþykkis Heimis.
Stærð: lítið verk að umfangi en snertir fleiri en 5 kóðaskrár, svo það fer eftir fulla ferlinu: plan hér, bygging í Opus lotu.

## 1. Tilgangur

Heimir vill sjá á borðinu það sem hann er aðallega að vinna í núna. Í dag opnar hann listann og raðar eftir "Síðast breytt". Hann vill það sama á kortinu: eina pillu efst sem lýsir upp spjöldin sem hafa hreyfst nýlega og dofnar hin.

Listaröðunin les í dag aðeins stimpil verksins sjálfs (`hg_items.updated_at`), sem hreyfist við stöðu, titil, texta, tögg og næsta skref. Skilaboð í spjalli, skjal, spurning, svar og handtak hreyfa hann ekki. Það sem Heimir er að vinna í er oftar þetta seinna, svo reglan þarf að ná yfir allt á spjaldinu.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Ein regla, "síðasta hreyfing" spjalds: nýjasti tíminn af öllu sem fylgir því (kafli 4).
- Ný pilla fremst í pilluröðinni, á undan "ólesin": "nýlega breytt". Hún telur spjöldin á borðinu (í virku sýninni) sem hafa hreyfst innan gluggans og síar eins og "ólesin": spjöldin sem passa lýsa, hin dofna.
- Listinn les sömu reglu: röðunin "Síðast breytt", röðin innan stöðuhópa og dagsetningin í listalínunni. Pillan og listinn eru þá alltaf sammála.
- Glugginn er stillanlegur: 24 klst, 3 dagar (sjálfgefið) eða 7 dagar.

**Ekki-markmið**

- Engin breyting á gagnagrunni, engin migration.
- Stimpillinn á spjaldinu sjálfu ("H í gær 14:32") stendur óbreyttur. Hann segir hver færði verkið, ekki hvenær eitthvað gerðist síðast á því.
- Vistaðar sýnir geyma ekki "nýlega breytt". Sía sýnar er áfram tónar, pakkar og tögg.
- CLI breytist ekki (`pull`, `sync` og spegillinn óbreytt).
- Glugginn samstillist ekki milli tækja.

**And-markmið**

- Pillan og listinn mega aldrei vera ósammála um hvað er nýlegt. Þess vegna er reglan reiknuð einu sinni í kortalíkaninu sem bæði lesa.
- Tilfærsla á borðinu, Raða, leitarorð og þögul taggabreyting mega ekki gera spjald "nýlega breytt".

## 3. Leiðir

1. **Pillan les `updated_at`, eins og listinn í dag.** Minnst, en spjall, skjöl og handtök telja ekki.
2. **Ein regla yfir allt á spjaldinu, notuð af pillu og lista.** Valin af Heimi. Breytir listanum sem hann notar: spjald með nýjum skilaboðum fer efst.
3. **Öll hreyfing í pillunni, listinn óbreyttur.** Hafnað: pillan og listinn yrðu ósammála.

Reglan les töflurnar sem borðið sækir þegar (verk, spjall, skjöl, spurningar, handtök, plön, úrskurðir), ekki `hg_events`: atburðirnir eru sóttir með 500 raða þaki og næðu ekki alltaf 7 daga aftur.

## 4. Reglan: síðasta hreyfing

Nýjasti gildi tíminn af þessum, fyrir hvert verk:

| Hvað | Tímar |
|---|---|
| Verkið | `created_at`, `updated_at` |
| Skilaboð í spjalli verksins | `created_at` |
| Skjal | `created_at`, `updated_at` (skipt út) |
| Spurning | `created_at`, `answered_at` |
| Handtak | `created_at`, `done_at` (lokið eða hætt við), `updated_at` (breytt) |
| Plan | `created_at`, `updated_at` |
| Úrskurður á plani verksins | `created_at` |

- Allir telja, líka áhorfandinn sjálfur. Þetta er ólíkt "ólesin", sem telur bara aðra.
- Það sem hreyfir engan stimpil telur ekki: tilfærsla á borðinu, leitarorð, lýsing á skjali, þögul taggabreyting, lesmerki. Þetta fæst ókeypis því gagnagrunnurinn stimplar ekkert af því.
- Spjald er "nýlega breytt" þegar síðasta hreyfing er innan gluggans miðað við klukku borðsins (ein klukka á hverja hleðslu gagna, sú sama og þriggja daga reglan um lokuð spjöld notar). Spjald dettur því út við næstu gagnabreytingu eða endurhleðslu, ekki á mínútunni.
- Nýlokið spjald sem enn stendur dofnað á borðinu telur og er talið í pillunni, eins og í "ólesin".
- Athugasemdir á módúl (ekki á verki) telja ekki.

Þekkt frávik: endurröðun plana hreyfir `updated_at` á plani og telst því hreyfing. Sjaldgæft og meinlaust.

## 5. Pillan

```
[ ◷ 12 nýlega breytt ] [ ○ 9 ólesin ] [ ● 33 bíður þín ] [ ● 8 bíða annarra ] ...
```

- Fremst. Sýnd þegar hún telur eitthvað eða er kveikt, eins og hinar.
- Lítið klukkutákn í stað punkts, í hlutlausum lit (ekki einum af stöðulitunum fimm, því þeir þýða stöðu). Mitt val, Heimir getur breytt í tokenum.
- Ábending (title): "Hreyft síðustu 3 daga", eftir glugga.
- Síar með OG á móti öllu öðru, eins og "ólesin": "nýlega breytt" og "bíður þín" saman sýna nýlega hreyfð spjöld sem bíða þín. Lifir í sömu síu og hitt (lotugeymsla, "Hreinsa" slekkur).
- Á síma er hún fyrsta pillan í röðinni sem skrunar til hliðar.

## 6. Listinn

- "Síðast breytt" raðar eftir síðustu hreyfingu. Stöðuröðunin raðar eins innan hvers hóps.
- Dagsetningin hægra megin í línunni sýnir síðustu hreyfingu (stutta formið, óbreytt).
- Með pilluna kveikta sýnir listinn bara spjöldin sem passa, eins og með aðrar síur.

## 7. Glugginn

- Valinn í valmyndinni undir upphafsstaf notandans: lína "Nýlega breytt" með þremur kostum, 24 klst, 3 dagar, 7 dagar. Talan á pillunni breytist strax.
- Geymdur í vafranum (`localStorage`, lykill `hg.recent`), einn fyrir öll verkefni því hann er persónuleg stilling eins og tungumálið. Mitt val.
- Ógilt eða ekkert gildi: 3 dagar.

## 8. Eftir handa planinu

Nöfn falla og reita, nákvæm CSS og tokenar fyrir klukkutáknið, i18n lyklar og prófin. Planið skrifar þetta orðrétt.
