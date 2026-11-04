# 15 Vinnuborð: kassar (plan 15)

Dagsetning: 2026-11-04
Grein: `vinnubord-15` (commits f76f6ef til 019a2c5 ofan á main 02e4fd5), lokayfirferð Fable lokið og athugasemdir lagaðar, sameinuð á main og pushuð.
Plan: `docs/superpowers/plans/2026-11-04-kassar.md`
Spekk: `docs/superpowers/specs/2026-11-04-kassar-og-tiltekt-design.md`

Staða: **smíðað, lokayfirferð lokið og lagað, sameinað á main og pushað**. Migration `0017_hg_zones` er beitt með MCP `apply_migration` 2026-11-04 (MCP samþykkti hana). Allir prófkassar úr handprófunum eru eyddir gegnum nýja spjaldið og `hg_zones` á metta var tóm eftir Task 7.

## Lokayfirferð og lagfæringar

Fable fór yfir alla greinina. Lagað í einni lotu: Kassi hnappur falinn undir 768 px, athugasemdarreitur spjaldsins 72 px (`--hg-zone-note-field-h`), Vista helst ekki virkt eftir titil með aukabilum, haus athugasemd í `TopBar`, komma í CLAUDE.md, próf fyrir `toggleMember` með kassa (600 próf). Skýrsla: `.superpowers/sdd/2026-11-04-kassar/final-fix-report.md`.

## Hvað var gert

**Task 1, gagnagrunnur** (f76f6ef). `0017_hg_zones`: `hg_zones` (titill allt að 60 stafir, litur einn af fimm tónum, athugasemd allt að 200 stafir, `pos_x`, `pos_y`, `w`, `h` með lágmark 160 og 120) og `hg_view_zone_positions` (staða kassa í sýn, lykill `(view_id, zone_id)`), samsettir verkefnislyklar eins og 0011b, RLS fyrir þátttakendur, rauntími. Engir atburðir og enginn `updated_at`: kassi er uppröðun, ekki verk. `Zone` og `ViewZonePosition` í `types.ts`, `loadBoard` les báðar töflur, `useBoardData` hlustar.

**Task 2, reglur og API** (fc0036c). `lib/zones.ts` (stærðarlágmark, nafnareglan, `zonePositionsOf`, `zoneRect`, `zoneMembers`, `clampZoneSize`, `draftBigEnough`), `SelTarget` fær `zone` (kassi er handfang hópfærslu, aldrei meðlimur), og `createZone`, `updateZone`, `updateZoneRect`, `deleteZone` og `upsertViewZonePosition` í `api.ts`. 11 ný próf.

**Task 3, litir og texti** (a34203c). `Kassar` tákn og reglur í `vinnubord.css`, `--hg-zone-title-h` í coarse blokk, `.hg-zone-btn`, `.hg-board-draw`, lyklar í `en.json` og `is.json`.

**Task 4, kassi á borðinu** (f682588). `Zone.tsx` teiknaður undir kortum, dreginn í nafninu (mús strax, snerting eftir 350 ms), staða á borði eða í sýn, `useCardDrag` þekkir `zone` og `zoneResize`.

**Task 5, meðlimir og stærð** (a32b079). Kassinn flytur kortin og pakkana sem eru inni í honum þegar ýtt er (miðja korts inni, titill pakka inni), kort sem dregið er út fer ekki með, og hornið breytir stærð. Stærð er sameiginleg yfir sýnir.

**Task 6, teikniham** (656ae76). Kassa-hnappur í topplínu kveikir teikniham, næsta ýting teiknar kassa (`useZoneDraw`, tekin í capture eins og marquee). Fyrir lítil drög verður enginn kassi, Esc og annar fingur hætta.

**Task 7, spjald** (d45a6af). `ZonePanel.tsx`: nafn, litur, athugasemd, Vista og Eyða (spyr fyrst, kortin standa kyrr). Nýr kassi opnar spjaldið með nafnið valið.

**Task 8, smoke atriði 14** (5ee7e12). Atriði 14 í `scripts/hg-smoke.mjs` og hreinsun á kössum og sýnum smoke.

## Ákvarðanir í byggingu

- R1: annar fingur í miðri snertiteikningu hættir við drögin, býr ekkert til og lýkur teikniham. Sýnin þarf ekki að þysja á sömu tveggja fingra hreyfingu (hún sá aðeins annan fingurinn), næsta hreyfing þysjar eins og venjulega. Kostnaður ef rangt: á síma flytur annar fingurinn borðið í stað þess að þysja í þessari einu hreyfingu.
- R2: prófkassar eru ekki eyddir með SQL eftir að `execute_sql` DELETE var hafnað, engin önnur leið reynd. Task 7 eyddi þeim gegnum spjaldið.
- R3: eyddur kassi (effect í `BoardPage`) notar "seen ref" mynstrið eins og verk, ekki mynstur eininga í planinu. `onDrawn` opnar kassann áður en `reload` skilar röðinni, svo effect planins hefði lokað hverju nýju spjaldi strax (galli í plani). Kostnaður ef rangt: kassi sem er teiknaður en röðin kemur aldrei heldur `openZoneId` (sama gat og hjá nýjum verkum).
- `DragTarget` í `useCardDrag.ts` er union eftir tegund, annars þrengdist `t.kind === 'zoneResize'` ekki í tegundaprófi.
- Ctrl ýting á horni kassa telst kassinn sjálfur í `useMarquee` (`zoneResize` varpast í `zone`), svo ekkert breytist í vali.
- `zoneSaveFailed` er sameiginlegt fyrir færslu og stærðarvistun og afturkallar aðeins þegar x, y, w, h og sýn eru nákvæmlega það sem sú vistun sendi, svo misheppnuð færsla afturkallar ekki nýrri stærð og öfugt.
- `useZoneDraw` er með `gestureRef` vörn: ekkert er teiknað meðan flug eða klípa hreyfir sýnina, ýtingin fer til sýnarinnar sem stöðvar hreyfinguna.
- `justCreatedZone` er hreinsað við hverja opnun spjalds (`select`, `openModule`, `openZone`, `closePanel`), annars veldi enduropnun nýs kassa nafnavali aftur.
- `toggleMember` skilar vali óbreyttu fyrir kassa (viðbót frá Task 2, prófuð í lokalagfæringu).

## Staðfesting

- `npm run test`: 600 próf græn (588 áður plús 12). `npm run build`: grænt.
- `npm run smoke:hg`: `ok 14/14`, engar `smoke%` raðir í `hg_zones` og engar `smoke zone%` sýnir eftir.
- `0017_hg_zones` beitt gegnum MCP `apply_migration` 2026-11-04. Lifandi athugun: 0 raðir í `hg_zones`, báðar töflur í `supabase_realtime`, 8 policy.
- Handprófanir hvers verkefnis (Chrome 1440 með mús, iPhone 14 með snertingu gegnum CDP) stóðust, sjá skýrslur í `.superpowers/sdd/2026-11-04-kassar/`.

## Það sem Heimir athugar

- Teikna kassa með músinni (Kassi hnappur, draga) og á iPad (einn fingur). Nafnið er valið og tilbúið til að skrifa yfir.
- Gefa honum nafn, lit og athugasemd og vista.
- Draga nafnið með þremur kortum og einum pakka inni: allt fylgir. Draga eitt kort út úr kassanum: kassinn flytur það ekki lengur.
- Breyta stærð frá horninu. Sama kassa á öðrum stað í sýn (draga hann í sýn, aðalborðið breytist ekki).
- Eyða kassanum: kortin standa kyrr.
- Tveir gluggar: breyting í öðrum sést í hinum án þess að endurhlaða.

## Opið

1. Á síma (undir 768 px) er Kassi hnappurinn falinn (`display: none`), kassar sjást, dragast og opnast þar áfram. Heimir getur beðið um teikningu á síma í staðinn, þá styttist verkefnisnafnið með úrfellingu.
2. Nafn kassa sem er undir kortum eða einingaspjöldum er ekki hægt að smella á, því kassinn er teiknaður undir þeim samkvæmt spekki. Þarf að draga eða þysja til að ná í hann.
3. Plan 16 (tiltekt) fylgir á nýrri grein af main.

Smávægilegt sem lokayfirferð lét standa: `Zone.color` er `string` í gerðinni þótt gagnagrunnur leyfi aðeins fimm tóna, tvöfaldur FK á `view_id` og `zone_id` (eins og 0013), `updateZone` og `updateZoneRect` með tóman patch senda `.update({})`, bókstafsgildi (letur, bil) í kassareglum eins og aðrar reglur, `Zone` memo sleppir aldrei (eins og `PackColumn`), venjulegur smellur á nafn kassa hreinsar Ctrl val, óaðgengilegir else-if varakostir í move, drop og cancel, færsla og stærðarvistun innan eins ferðs geta blikkað fyrri stöðu (lagast sjálft), Esc í teikniham hreinsar líka val og lokar spjaldi, smellur lekur eftir Esc í miðri ýtingu, hjól eða svif í miðri teikningu færir upphafshornið, `zoneError` skarast við endurnýjunartilkynninguna og hreinsast ekki við næstu velgengni, teiknistaða lifir verkefnaskipti, ýting á flug stöðvar það án þess að teikna, athugasemdarreitur býður línuskil sem `normalizeNote` fellir í bil, `openZoneId` helst ef teiknaður kassi nær aldrei í `data.zones`, smoke nær ekki til meðlimakorta (rökfræði í vef), smoke hreinsar `zoneId` og `zoneViewIds` án raðatalningar.
