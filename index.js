// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de gedeelde rekenkern
//
// Eén motor onder YourWkb (opleverrapporten), Kastscan (foto naar gelabelde
// kast) en straks de bedrijfs- en onderwijsapp. Alles wat hier staat is een
// normkeuze of een rekenregel, en géén schermwerk: het draait in de browser én
// in Node, zonder afhankelijkheden.
//
// DE DATAVORM IS HET METERKASTPASPOORT. Elke functie hier werkt op `grp[]`,
// `ha` en `lb` uit spec v0.2 §4.4. Dat is met opzet: het paspoort is het enige
// datamodel dat beide apps al opbouwen, dus niemand hoeft er een nieuw model
// bij te leren en een P1-meting past er zonder vertaling in.
//
// WAT HIER NIET IN HOORT
//   • het paspoortformaat zelf (coderen, afkappen, handtekeningen) — dat is de
//     open standaard en staat in het pakket `meterkastpaspoort`, dat
//     normneutraal moet blijven;
//   • de vertaling van app-gegevens naar een paspoort (`mkpBouw`) — die is per
//     app anders en hoort daarom in de app;
//   • schermen, teksten en opmaak.
// ─────────────────────────────────────────────────────────────────────────────

export { toNum } from "./getallen.js";

export {
  GROTE_VERBRUIKERS_MKP, GELIJKTIJDIGHEID, GROOT_STANDAARD_KW,
  isGroteVerbruikerMkp, groepVermogenKw,
} from "./vermogen.js";

export {
  FASEN, FASE_KLEUR, FASE_RESERVE_KW,
  faseCapaciteitKw, fasenVanGroep, belastingPerFase,
} from "./fasen.js";

export { periodeLabel, basisbelastingKw, belastingcheck } from "./belasting.js";

export { faseBalans, faseAdvies } from "./fasebalans.js";

// De versie van de motor. Bij een gedragswijziging in een normregel hoort een
// bewuste bump én een regel in LEESMIJ.md — de apps volgen een tag, geen branch.
export const CORE_VERSIE = "0.1.0";
