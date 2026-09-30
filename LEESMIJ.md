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

`belastingPerFase` is de **enige** optelling van een installatie. De
belastingcheck en de fasebalans leunen er allebei op; een tweede optelling
ernaast is hoe de drift is ontstaan.

## Tests

```bash
npm test      # 146 tests
```

Geen framework: twee bestanden met eigen `eq()`, uitslag aan het eind, exitcode 1
bij een fout. Zelfde opzet als de suites van de apps.

## Versies

De apps hangen aan een **tag**, niet aan een branch — een push hier verandert de
apps dus niet vanzelf. Bij een gedragswijziging in een normregel: bewust bumpen
en hieronder een regel erbij.

| Versie | Wat |
|---|---|
| 0.1.0 | Eerste versie. Inhoud ongewijzigd overgenomen uit YourWkb `components/wkb/model.js` + `fasebalans.js`, opgesplitst in modules met de namen van Kastscan. `faseCapaciteitKw` toegevoegd (stond als losse formule op drie plaatsen). Geen gedragswijziging. |
