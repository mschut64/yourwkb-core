# yourwkb-core — de gedeelde motor

De rekenkern onder **YourWkb** (opleverrapporten), **Kastscan** (foto → gelabelde kast),
**YourWkb Bedrijf** (dashboard en fasecheck) en **YourWkb Leren** (de leeromgeving).
Eén motor, vier verpakkingen.

Geen afhankelijkheden, draait in de browser én in Node 18+.

---

*Publieke repo, maar geen open source: alle rechten voorbehouden. De code is te
lezen — dat is zij in de browser toch al — en niet vrijgegeven voor hergebruik.
Het meterkastpaspoort is dat wél (CC BY 4.0); dat is een standaard, dit is een
motor.*

---

## Waarom dit bestaat

Tot 30-09-2026 hadden YourWkb en Kastscan elk hun eigen `model.js` met dezelfde
begrippen erin: `faseBalans`, `belastingcheck`, `FASE_RESERVE_KW`, de
gelijktijdigheidsfactor. Ze zijn uit elkaar gaan lopen. Twee voorbeelden:

- Kastscan telde teruglevering als **negatieve** belasting (`−3,0 kW`), YourWkb
  als de **zwaarste van twee richtingen** (besluit Martin, 12-09-2026).
- Kastscan schreef een thuisbatterij als **één** regel, YourWkb als **twee**
  (ontladen `voed`, laden `af` — spec v0.2 §4.4, besluit Martin 12-09-2026).

Dezelfde kast kon daardoor in de ene app groen zijn en in de andere rood. Dat is
geen verschil van mening maar een fout: er is één installatie en één norm.

## De datavorm is het meterkastpaspoort

Elke functie hier werkt op `grp[]`, `ha` en `lb` uit spec v0.2 §4.4 — niet op het
interne model van één app. Kastscan denkt in modules op een DIN-rail, YourWkb in
aardlekgroepen met eindgroepen; die twee zijn niet te verenigen, maar hun
**paspoort** wel. Dat is precies waarvoor de standaard bestaat, en het betekent
dat een P1-meting er zonder vertaling in past.

Een app voedt de motor dus met wat haar eigen `mkpBouw` al oplevert.

## Wat hier NIET in hoort

| | Waar dan wel |
|---|---|
| Het paspoortformaat: coderen, afkappen, handtekeningen | pakket `meterkastpaspoort` — dat is de open standaard en moet **normneutraal** blijven |
| `mkpBouw` (app-gegevens → paspoort) | in de app zelf; die vertaling verschilt per app |
| Schermen, teksten, opmaak | in de app |

## Modules

| Bestand | Wat |
|---|---|
| `getallen.js` | `toNum` — komma én punt als decimaalteken |
| `vermogen.js` | `GELIJKTIJDIGHEID` (0,6), de vier grote verbruikers, `groepVermogenKw` |
| `fasen.js` | `FASEN`, `FASE_KLEUR`, `FASE_RESERVE_KW`, `faseCapaciteitKw`, `fasenVanGroep`, **`belastingPerFase`** |
| `belasting.js` | `periodeLabel`, `basisbelastingKw` (geschat/gemeten), `belastingcheck` → `{ r, d }` |
| `fasebalans.js` | `faseBalans` (capaciteit, reserve, oordeel, beste fase), `faseAdvies` (waar past een nieuw apparaat) |
| `toestellen.js` | de woordenschat van een module op een rail: soorten, `parseBeveiliging` (`"B16"` ↔ karakteristiek + stroom), ordening |
| `normaliseren.js` | ruwe modeluitvoer → een kastbeeld: `ZEKERHEIDSDREMPEL`, `INVULDREMPEL`, `normaliseerPositie`/`-Analyse`/`-Schema` |
| `indeling.js` | welke groep achter welke aardlek: `pasVuistregelToe`, `pasFotoIndelingToe`, **`blokIndeling`** |
| `verklaring.js` | de groepenverklaring van de kastdeur lezen en aan groepen koppelen |
| `leren.js` | het correctielog: `maakCorrectie`, `overtuigdFout`, `correctieStatistiek` |
| `leerlus.js` | de catalogus, wat het toestel mag verlaten, en de vrijgaveregel voor een promptwijziging |
| `paspoort-kastbeeld.js` | **een meterkastpaspoort terug naar een kastbeeld**: `mat[]` levert de plaats, het merk en — via de typeaanduiding — de karakteristiek en de stroom |
| `aardlekgroepen.js` | **de brug naar het opleverrapport**: modules op een rail → aardlekgroepen met eindgroepen |
| `labels.js` | **het labelontwerp** (labelspec rev 3.0) plus `labelSelectie`: welke stickers een kast oplevert. ⚓ Nooit schalen — wat niet past is een invoerfout met een telling. |
| `render.js` | **apart importeren**, browser-only: een label rasteren op de dot-afstand van een labelprinter, of als svg |
| `schema.js` | **het installatieschema** (eendraadschema) van dezelfde kastgegevens |
| `documenten.js` | **apart importeren**: de A4-documenten — groepenoverzicht, labelvel, schema — en `printHtml`. ⚓ De motor velt geen oordeel op papier: signalen, samenvatting en fasebalans komen van de app. |
| `bevindingen.js` | **wat er aan een kast te zien is dat niet klopt**: de zoeklijst uit de kalibratie op de kasten van Herman, drie uitkomsttypen, en de koppeling naar de leerlus. ⚓ Een vermoeden zonder controleactie vervalt; stilzwijgen is geen bevestiging. |
| `vormtaal.js` | **hoe de kast eruitziet**: `MODULE_PX`, de twee kleurladders (label én scherm) en `strookUitAardlekgroepen` — aardlekgroepen → één rail met modules, klaar om te tekenen |
| `prompt.js` | **apart importeren** (`yourwkb-core/prompt.js`): de instructie en het JSON-schema voor het beeldmodel. Staat niet in de index — het is 22 kB die alleen een serverroute nodig heeft, en de audit eist dat hij server-side blijft. |
| `meting.js` | **de toets op wat gemeten is**: de gG-tijd-stroomkromme, `zMaxVoorBeveiliging` (⚓ van het gemeten circuit, niet van de installatie) en de cross-checks over een opleverset. Verhuisd uit YourWkb op 02-10-2026, op de voorwaarde die daar zelf stond: zodra de onderwijsapp dezelfde meetwaarden moet toetsen, hoort dit hier. |
| `organisatie.js` | **wie mag wat**: organisatietypen (bedrijf/opleider), rollen, rechten, `magBeoordelen` (⚓ nooit je eigen werk) en de scheiding tussen oefendata en echte opleverdata |
| `beoordeling.js` | **de keten** leerling → beoordelaar → meester: de rubriek per discipline, de toestanden, en `cijferKader` — dat feiten levert en géén cijfer |
| `leerlijn.js` | **skills, punten, levels, streaks en badges**, met precies twee ingangen: een beoordeling door een mens en een vraag met een antwoordsleutel. Plus de poort naar de echte app. |
| `fasecheck-monitor.js` | **van P1-telegram naar oordeel**: vermogen per fase (⚓ nooit stroom, nooit de som van twee richtingen), de piek, de onbalans op de vuistregel van de netbeheerder, de toestand van het kastje en het herverdelingsadvies |
| `palet.js` | de kleuren van de dashboards (bedrijf en leren), licht en donker, als CSS-variabelen |
| `kastbeeld-route.js` | **apart importeren**: de serverkant van de foto-analyse. ⚠️ Een app die deze route gebruikt moet `@anthropic-ai/sdk` **zelf in zijn package.json zetten** — hier is hij een optionele peerDependency en npm installeert hem dan niet mee. De route zegt het nu zelf met een 503 in plaats van om te vallen (zie v0.9.0) — de route die Kastscan al draaide, met de 4,5 MB-muur van de hostingrand, de zestig seconden van het hobbyplan en de foutmeldingen die zeggen wát je moet doen. De bewaking (origin, rate limit) komt van de app, de analyse van hier. Trekt de Anthropic-SDK mee, dus nooit in een browserbundel. |

⚓ **Een scan blijft aanvulbaar.** Alles wat het kastbeeld oplevert is een voorstel,
geen vaststelling: de herkomstvelden (`functieEigen`, `functieBron`, `naamBron`) en de
zekerheid reizen mee, niets wordt bevroren, en wat de foto niet zag blijft leeg in plaats
van geraden. Een scherm kan daardoor tonen wat voorgesteld is en wat bevestigd, en de
installateur vult de rest in de app aan. Besluit Martin, 30-09-2026; bewaakt in
`tests/test-kastbeeld.js` categorie 4.

`belastingPerFase` is de **enige** optelling van een installatie. De
belastingcheck en de fasebalans leunen er allebei op; een tweede optelling
ernaast is hoe de drift is ontstaan.

## Tests

```bash
npm test      # 678 tests
```

Geen framework: twee bestanden met eigen `eq()`, uitslag aan het eind, exitcode 1
bij een fout. Zelfde opzet als de suites van de apps.

## Versies

De apps hangen aan een **tag**, niet aan een branch — een push hier verandert de
apps dus niet vanzelf. Bij een gedragswijziging in een normregel: bewust bumpen
en hieronder een regel erbij.

| Versie | Wat |
|---|---|
| 0.11.0 | **De papieren kant van de kast** (03-10-2026). Vraag Martin: het groepenoverzicht, de labels, A4 printen en het schema ook in YourWkb. Vier modules verhuisd uit Kastscan — `labels.js` (incl. `labelSelectie`), `render.js`, `schema.js` en `documenten.js` — plus het kleurvocabulaire van een kastband en `komma` naar de bestaande modules. Alleen de imports zijn omgezet; de inhoud is ongewijzigd. **Twee dingen zijn wél veranderd, en allebei met reden:** (1) `signalen`, `samenvatting` en de fasebalans zijn OPTIES geworden in plaats van imports — dat zijn oordelen over een kast, en elke app heeft zijn eigen; krijgt een document ze niet, dan staat er niets in plaats van iets beweerds. (2) `printHtml` printte vanuit een **verborgen iframe van 0×0** — precies de constructie die YourWkb op 20-09-2026 heeft weggehaald na de melding van Maurits (WebKit print dan het bovenliggende document). Nu een echt tabblad met een printknop, en het document gaat er **ontsmet** in, want de reden voor dat iframe was een beveiligingsreden uit de audit van 25-08. Nieuw: **`positiesUitAardlekgroepen`** — de weg terug van groepen naar modules op een rail, zodat ook een met de hand ingevulde kast een sticker, een overzicht en een schema oplevert. ⚠️ **Deze vier modules staan voorlopig óók nog in Kastscan.** Die app hangt aan v0.7.0; hem omzetten naar re-exports is een bewuste stap met zijn 1238 tests als vangnet. 50 tests erbij (751 → 801). |
| 0.10.0 | **De foto kijkt ook naar wat er níét klopt** (K6, 03-10-2026). Vraag Martin: bij de fotoscan ook gelijk een check op fouten in de bekabeling, zoals geleerd op de foute kasten van Herman, gekoppeld aan de leermodule. Drie dingen erbij: `INSTRUCTIE_BEOORDELING` + `SCHEMA_BEOORDELING` in `prompt.js` (een EIGEN promptversie, `kastcheck-2026-10-03-A`), een derde modus `beoordeling` in de analyseroute, en `bevindingen.js`. **De leesprompt is niet aangeraakt** — regel 6 daarvan zegt zelf dat beoordelen een andere taak met een andere prompt is, en die prompt is gekalibreerd. De zoeklijst is overgeschreven uit de kalibratienotitie: verbindingen, verbindingsmiddel-versus-geleider, beschermingsleidingen, opbouw, warmte, materiaalstaat, beveiliging, privacy. ⚓ Drie regels staan in code en niet alleen in de prompt: **een vermoeden zonder controleactie vervalt**, **stilzwijgen is geen bevestiging** (`correctieUitOordeel` geeft bij "niet gezien" niets terug — dezelfde les als EXPERT_WEGING), en **wat naar de leeromgeving gaat is gestript** (geen adres, geen plek, geen foto). Het oordeel van de installateur gaat als gewone correctie de bestaande leerlus in, dus `correctiegraad` en `overtuigdFout` meten nu ook de check. ⚠️ Nieuwe prompt = vrijgaveregel: een ronde over de referentieset vóór je erop vertrouwt. 78 tests erbij (673 → 751). |
| 0.9.0 | **De bedrijfs- en de onderwijsapp erbij** (02-10-2026, conform het concept op Drive). Vijf modules: `meting.js` (verhuisd uit YourWkb — de normen van een meting horen in de motor zodra een tweede app ze toetst), `organisatie.js` (rollen, rechten, en de harde scheiding tussen oefendata en echte opleverdata), `beoordeling.js` (de keten, en een `cijferKader` dat met opzet géén cijfer geeft), `leerlijn.js` (skills, punten, levels, streaks, badges, de poort) en `fasecheck-monitor.js` (P1-telegram → piek per fase → oordeel → advies). Plus `palet.js`, de kleuren die beide dashboards delen. ⚓ Drie regels liggen hier vast en niet in een scherm: **niemand beoordeelt zijn eigen werk**, **punten komen alleen uit beoordeeld werk** (en een kennisvraag kan nooit een meting- of klus-skill aftekenen), en **oefendata komt nooit in een Wkb-archief**. Geen gedragswijziging voor YourWkb of Kastscan: `meting.js` is woordelijk de code die in YourWkb stond, en de 304 tests daar draaien er ongewijzigd overheen zodra die app meeschuift. 228 tests erbij (450 → 678). |
| 0.8.1 | **De kast op meerdere rails.** `aardlekgroepenUitPosities` draagt `rail` en `plek` mee, en `strookUitAardlekgroepen` geeft `rails[]` terug in plaats van één rij. Een kast van twintig modules hangt op twee of drie rails, en een blok loopt vaak over de overgang heen — als één rij getekend klopt het beeld niet met de kast waar de installateur voor staat. Binnen een rail staan de modules **op plek en niet op blokvolgorde**; de kleurband houdt de blokken uit elkaar en loopt mee naar de volgende rail. Een met de hand ingevoerde kast heeft geen plaatsen en valt terug op één rail. Ook erbij: `materiaalUitPosities` (een gelezen kast is óók een materiaallijst) en `vergelijkKastbeelden` (is de kast veranderd t.o.v. de eerste foto — op kenmerk, niet op plaats). |
| 0.8.0 | **De analyseroute erbij** (K5): `kastbeeld-route.js`, de serverkant van het lezen van een kastfoto. Stond alleen in Kastscan en gaat nu ook YourWkb bedienen — besluit Martin: *"het inlezen van de kast bij kastscan via foto moet ook als motor ingeregeld worden zodat beide apps hiervan gebruik kunnen maken"*. Inhoud ongewijzigd overgenomen, inclusief alle lessen die erin zitten: de foto's als ruwe bytes (base64 maakt een iPhone-opname een derde groter en breekt op de 4,5 MB van de hostingrand), een eigen tijdmuur net onder de zestig seconden, en een afbreking die als `APIUserAbortError` binnenkomt in plaats van als timeout. **De bewaking blijft van de app** — elke app heeft zijn eigen origin-lijst — en komt als parameter binnen: `maakKastbeeldRoute({ rateLimit, origineOk, fout, logNaam })`. 25 tests, statisch: zwevende aanroepen, de grenzen die om een gemeten reden staan waar ze staan, en de foutafhandeling die een avond zoeken heeft gekost. |
| 0.7.0 | **De strook is één rail** (vraag Martin): `strookUitAardlekgroepen` gaf een rij per aardlekgroep en geeft nu `{ modules, breedte, breedtePx }` — één rail waarop de aardlekschakelaar een gewone module van twee is, precies zoals Kastscan de kast al tekende. Wie de kast in stukken knipt kan niet meer zien dat er achter de tweede aardlek nog vier modules ruimte is, en dát is de vraag bij een uitbreiding. **Twee gedragswijzigingen:** `MODULE_PX` 26 → 52 (de tapmaat uit design-spec §1.3, de maat die Kastscan gebruikt), en `AARDLEK_BAND` erbij — de verzadigde schermladder van Kastscan, náást de pastelladder van het label. Twee dragers, twee ladders: een pastelband van 7 px is op een donker scherm niet te zien, en dezelfde tint moet op stickerpapier juist wijken voor de tekst erboven. 38 tests erbij; de vormtaal had er nog geen. |
| 0.6.1 | `strookUitAardlekgroepen` geeft per rij ook de `id` van de aardlekgroep terug. Een scherm kan daarmee van een tegel terug naar de groep zelf — op naam zoeken gaat mis zodra twee groepen dezelfde naam dragen. |
| 0.6.0 | **De vormtaal van de kast** (K4): `MODULE_PX`, `AARDLEK_KLEUR`, `aardlekCode` en `strookUitAardlekgroepen`, verhuisd uit Kastscan. De maatvoering en de kleuren zijn gedeeld, de tekening blijft per app — zoals bij de fasebalken. |
| 0.5.1 | Twee dingen die pas bleken toen er een echt paspoort doorheen ging: `parseBeveiliging` leest nu ook "gG20" (op een smeltpatroon staat geen B), en een aardlek zonder gelezen aanspreekstroom valt terug op 30 mA in plaats van leeg — leeg laten sloeg de ΔT/ΔI-toets stilletjes over. |
| 0.5.0 | **`positiesUitPaspoort`** (K4): een gescand meterkastpaspoort terug naar een kastbeeld. `mat[]` draagt de plaats op de rail, het merk en de typeaanduiding — en uit "B16" komen de karakteristiek en de nominale stroom, de twee velden die `grp[]` alléén niet kan leveren. De breedte wordt afgeleid uit de afstand tot het volgende toestel. Een driefasige groep verraadt dat zijn aardlek meerpolig is; eensgezinde fasenummers verraden op welke fase het blok hangt, en tegenstrijdige zwijgen. **Ook:** de warmtepomp is toegevoegd als eindgroeptype (besluit Martin), dus `EINDGROEP_ONBEKEND` is leeg. |
| 0.4.0 | **`aardlekgroepenUitPosities`** (K3): van modules op een rail naar aardlekgroepen met eindgroepen — de vorm waarin een opleverrapport een kast beschrijft. `mkpType` verhuisde mee uit Kastscan, zodat de vertaling naam → paspoorttype één tabel is. Niets wordt aangenomen: geen gelezen stroom geeft een leeg veld, een smeltveiligheid krijgt `gG` en niet stilletjes `B`, en de fase blijft leeg omdat die nooit uit een kastfoto komt. Bekend gat, vastgelegd in een test: het paspoort kent `wp` maar een eindgroep niet. |
| 0.3.0 | **De prompt erbij** (K2): `INSTRUCTIE`, `SCHEMA`, `INSTRUCTIE_SCHEMA`, `SCHEMA_TEKENING` en `PROMPTVERSIE`, als data en apart te importeren. **Promptwijziging:** het JSON-voorbeeld in de instructie sprak het afgedwongen schema op drie punten tegen — `zekerheid` als object in plaats van een getal, `"blokken"` twee keer, en `"smeltveiligheid"` ontbrak bij de soorten. Het model kreeg dus een voorbeeld dat de API zou afkeuren. `PROMPTVERSIE` naar `kastscan-2026-09-30-A`; ⚠️ dit valt onder de vrijgaveregel en vraagt een verse run over de referentieset. |
| 0.2.0 | **Het kastbeeld erbij** (K1): het lezen van een kastfoto, de blokindeling, de groepenverklaring, het correctielog en de leerlus — 34 exports uit Kastscans `model.js` plus heel `leerlus.js`. Inhoud ongewijzigd, op één punt na: `correctieStatistiek` en `correctieStatistiekVoorDelen` waren bijna gelijk en zijn er één, met `ZEKERHEIDSDREMPEL` in plaats van een tweede hardgecodeerde 0,75. Geen gedragswijziging. |
| 0.1.0 | Eerste versie. Inhoud ongewijzigd overgenomen uit YourWkb `components/wkb/model.js` + `fasebalans.js`, opgesplitst in modules met de namen van Kastscan. `faseCapaciteitKw` toegevoegd (stond als losse formule op drie plaatsen). Geen gedragswijziging. |
