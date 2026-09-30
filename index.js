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

// ─── HET KASTBEELD ───────────────────────────────────────────────────────────
//
// Wat er in een kast hangt, hoe je dat uit een foto leest en hoe de app leert van
// wat de installateur eraan verbetert. Verhuisd uit Kastscan op 30-09-2026, zodat
// YourWkb dezelfde kast op dezelfde manier kan inlezen.
//
// ⚓ De foto vult in, de installateur bevestigt. Alles wat hier uitkomt is in de
// app aan te vullen en te corrigeren; de herkomst- en zekerheidsvelden reizen mee
// zodat een scherm kan laten zien wat voorgesteld is en wat bevestigd.

export {
  parseBeveiliging, formatBeveiliging,
  KARAKTERISTIEKEN, AARDLEKTYPEN, RCD_MA, SOORTEN,
  maakId, isGroepsoort, heeftKarakteristiek, isMeerpolig,
  sorteerPosities, groepsnummers,
} from "./toestellen.js";

export {
  pasVuistregelToe, indelingKoppeling, pasFotoIndelingToe, blokIndeling, indelingOnzeker,
} from "./indeling.js";

export {
  splitsVerklaring, soortVerklaringsregel, splitsVerklaringsregels,
  volgordeKandidaten, koppelOpVolgorde, koppelGroepenverklaring,
} from "./verklaring.js";

export {
  ZEKERHEIDSDREMPEL, INVULDREMPEL, zekerheidVan,
  zetStandaardnamen, ontdekVoortgang,
  normaliseerPositie, normaliseerAnalyse, normaliseerSchema,
} from "./normaliseren.js";

export { maakCorrectie, overtuigdFout, correctieStatistiek } from "./leren.js";

export {
  DREMPEL_BEVESTIGINGEN, CATALOGUS_VELDEN, materiaalSleutel, legeCatalogus,
  catalogusLeer, pseudoniem, catalogusZoek, vulAanUitCatalogus, saneerCatalogus,
  catalogusSamenvoegen, reviewRij, catalogusStatistiek,
  NAAMBRONNEN, naamMagGedeeld, bouwLeerset,
  vergelijkPromptversies, oordeelOverWijziging,
  EXPERT_WEGING, expertRonde, gewogenScore,
} from "./leerlus.js";

// ─── DE PROMPT STAAT BEWUST NIET IN DEZE LIJST ───────────────────────────────
//
// `prompt.js` is alleen bereikbaar via het eigen pad:
//
//     import { INSTRUCTIE, SCHEMA } from "yourwkb-core/prompt.js";
//
// Twee redenen. (1) Hij is 22 kB tekst die alleen een serverroute nodig heeft;
// via de index zou hij in de browserbundel van elke app kunnen belanden. (2) De
// audit (BEV-02) eist dat de instructie server-side blijft — de client stuurt
// alleen foto's. Een import die per ongeluk in schermcode terechtkomt valt zo op.

// De versie van de motor. Bij een gedragswijziging in een normregel hoort een
// bewuste bump én een regel in LEESMIJ.md — de apps volgen een tag, geen branch.
export const CORE_VERSIE = "0.3.0";
