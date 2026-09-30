# yourwkb-core — de gedeelde motor

De rekenkern onder **YourWkb** (opleverrapporten), **Kastscan** (foto → gelabelde kast)
en straks de bedrijfs- en onderwijsapp. Eén motor, meerdere verpakkingen.

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
| `prompt.js` | **apart importeren** (`yourwkb-core/prompt.js`): de instructie en het JSON-schema voor het beeldmodel. Staat niet in de index — het is 22 kB die alleen een serverroute nodig heeft, en de audit eist dat hij server-side blijft. |

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
npm test      # 247 tests
```

Geen framework: twee bestanden met eigen `eq()`, uitslag aan het eind, exitcode 1
bij een fout. Zelfde opzet als de suites van de apps.

## Versies

De apps hangen aan een **tag**, niet aan een branch — een push hier verandert de
apps dus niet vanzelf. Bij een gedragswijziging in een normregel: bewust bumpen
en hieronder een regel erbij.

| Versie | Wat |
|---|---|
| 0.6.1 | `strookUitAardlekgroepen` geeft per rij ook de `id` van de aardlekgroep terug. Een scherm kan daarmee van een tegel terug naar de groep zelf — op naam zoeken gaat mis zodra twee groepen dezelfde naam dragen. |
| 0.6.0 | **De vormtaal van de kast** (K4): `MODULE_PX`, `AARDLEK_KLEUR`, `aardlekCode` en `strookUitAardlekgroepen`, verhuisd uit Kastscan. De maatvoering en de kleuren zijn gedeeld, de tekening blijft per app — zoals bij de fasebalken. |
| 0.5.1 | Twee dingen die pas bleken toen er een echt paspoort doorheen ging: `parseBeveiliging` leest nu ook "gG20" (op een smeltpatroon staat geen B), en een aardlek zonder gelezen aanspreekstroom valt terug op 30 mA in plaats van leeg — leeg laten sloeg de ΔT/ΔI-toets stilletjes over. |
| 0.5.0 | **`positiesUitPaspoort`** (K4): een gescand meterkastpaspoort terug naar een kastbeeld. `mat[]` draagt de plaats op de rail, het merk en de typeaanduiding — en uit "B16" komen de karakteristiek en de nominale stroom, de twee velden die `grp[]` alléén niet kan leveren. De breedte wordt afgeleid uit de afstand tot het volgende toestel. Een driefasige groep verraadt dat zijn aardlek meerpolig is; eensgezinde fasenummers verraden op welke fase het blok hangt, en tegenstrijdige zwijgen. **Ook:** de warmtepomp is toegevoegd als eindgroeptype (besluit Martin), dus `EINDGROEP_ONBEKEND` is leeg. |
| 0.4.0 | **`aardlekgroepenUitPosities`** (K3): van modules op een rail naar aardlekgroepen met eindgroepen — de vorm waarin een opleverrapport een kast beschrijft. `mkpType` verhuisde mee uit Kastscan, zodat de vertaling naam → paspoorttype één tabel is. Niets wordt aangenomen: geen gelezen stroom geeft een leeg veld, een smeltveiligheid krijgt `gG` en niet stilletjes `B`, en de fase blijft leeg omdat die nooit uit een kastfoto komt. Bekend gat, vastgelegd in een test: het paspoort kent `wp` maar een eindgroep niet. |
| 0.3.0 | **De prompt erbij** (K2): `INSTRUCTIE`, `SCHEMA`, `INSTRUCTIE_SCHEMA`, `SCHEMA_TEKENING` en `PROMPTVERSIE`, als data en apart te importeren. **Promptwijziging:** het JSON-voorbeeld in de instructie sprak het afgedwongen schema op drie punten tegen — `zekerheid` als object in plaats van een getal, `"blokken"` twee keer, en `"smeltveiligheid"` ontbrak bij de soorten. Het model kreeg dus een voorbeeld dat de API zou afkeuren. `PROMPTVERSIE` naar `kastscan-2026-09-30-A`; ⚠️ dit valt onder de vrijgaveregel en vraagt een verse run over de referentieset. |
| 0.2.0 | **Het kastbeeld erbij** (K1): het lezen van een kastfoto, de blokindeling, de groepenverklaring, het correctielog en de leerlus — 34 exports uit Kastscans `model.js` plus heel `leerlus.js`. Inhoud ongewijzigd, op één punt na: `correctieStatistiek` en `correctieStatistiekVoorDelen` waren bijna gelijk en zijn er één, met `ZEKERHEIDSDREMPEL` in plaats van een tweede hardgecodeerde 0,75. Geen gedragswijziging. |
| 0.1.0 | Eerste versie. Inhoud ongewijzigd overgenomen uit YourWkb `components/wkb/model.js` + `fasebalans.js`, opgesplitst in modules met de namen van Kastscan. `faseCapaciteitKw` toegevoegd (stond als losse formule op drie plaatsen). Geen gedragswijziging. |
