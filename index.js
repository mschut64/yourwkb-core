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
  FASEN, FASE_KLEUR, FASE_PATROON, FASE_RESERVE_KW,
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
  sorteerPosities, groepsnummers, mkpType, materiaalUitPosities,
  vergelijkKastbeelden,
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
  positiesUitAnalyse, ONBRUIKBAAR_ADVIES, ONBRUIKBAAR_STANDAARD,
} from "./normaliseren.js";

export {
  EINDGROEP_UIT_MKP, EINDGROEP_ONBEKEND, eindgroepTypeUitFunctie, aardlekgroepenUitPosities,
} from "./aardlekgroepen.js";

export {
  SOORT_UIT_MKP, leesPlaats, positiesUitPaspoort, paspoortDraagtKast,
} from "./paspoort-kastbeeld.js";

export {
  MODULE_PX, AARDLEK_KLEUR, AARDLEK_KLEURNAAM, AARDLEK_BAND,
  aardlekCode, aardlekBandKleur, strookUitAardlekgroepen,
} from "./vormtaal.js";

// ─── DE MÉTING ───────────────────────────────────────────────────────────────
//
// De toets op wat gemeten is: de gG-tijd-stroomkromme, Z_max per beveiliging en
// de cross-checks over een opleverset. Verhuisd uit YourWkb op 02-10-2026 omdat de
// onderwijsapp dezelfde meetwaarden moet toetsen — en twee toetsingen van dezelfde
// meting lopen vroeg of laat uiteen. ⚓ Een norm hoort bij een circuit, niet bij
// een installatie.

export {
  GG_TABEL, GG_IN_WAARDEN, ggIaVoorTijd,
  KAR_FACTOR, zMaxVoorBeveiliging, maxAfschakeltijdVoor,
  zwaarsteEindgroep, veldBeveiliging,
  gkCrossChecks, pvCrossChecks,
} from "./meting.js";

// ─── ORGANISATIES, LEREN EN MONITOREN ────────────────────────────────────────
//
// De bedrijfs- en de onderwijsapp (02-10-2026, conform het concept op Drive).
// Wat hier staat is geen schermwerk maar afspraak: wie mag wat, wanneer is een
// beoordeling af, wanneer is een skill gehaald, en wanneer vraagt een fase
// aandacht. Dezelfde regels in beide apps, of ze lopen uiteen.

export {
  ORG_TYPES, ROLLEN, RECHTEN, mag, rollenVoor, magBeoordelen,
  isOefen, oefenVlagVoor, bewaakScheiding, scheidOefen,
} from "./organisatie.js";

export {
  STATUSSEN, STATUS_LABEL, ONDERDELEN, onderdelenVoor,
  beoordelingStatus, beoordelingVoortgang, beoordelingCompleet,
  cijferKader, volgendeActie, tellers,
} from "./beoordeling.js";

export {
  NIVEAUS, SKILLS, BADGES, POORT_CIJFER,
  skillsVoor, maxPunten, skillOpen, voortgang, streak, badges,
  skillsUitKlus, verwerkBeoordeling, verwerkKennisantwoord, toegangTotHoofdapp,
} from "./leerlijn.js";

export {
  NET_SPANNING, STIL_LETOP_MS, STIL_OFFLINE_MS,
  BEZET_LETOP, BEZET_ERNSTIG, ONBALANS_LETOP_A, ONBALANS_ERNSTIG_A,
  ampereUitKw, telegramNaarMeting, piekPerFase, bezetting, onbalans,
  dongleStatus, monitorOordeel, monitorAdvies,
  SESSIECODE_TEKENS, maakSessiecode, koppelControle,
} from "./fasecheck-monitor.js";

export { PALET, THEMAS, LETTERS, themaCss, kleuren } from "./palet.js";

export { maakCorrectie, overtuigdFout, correctieStatistiek } from "./leren.js";

// De beoordeling van een kastfoto: wat er te zien is dat niet klopt. Een andere
// taak dan het lezen van de kast, met een eigen prompt — en gekoppeld aan dezelfde
// leerlus, zodat het oordeel van de installateur de check scherper maakt.
export {
  BEVINDING_SOORTEN, CATEGORIEEN, CATEGORIE_IDS, OORDELEN, OORDEEL_LABEL, categorieLabel,
  normaliseerBevinding, normaliseerBeoordeling, sorteerBevindingen,
  correctieUitOordeel, correctiesUitBeoordeling, expertRondeUitBeoordeling,
  leerpuntUitBevinding, leerpuntenUitBeoordeling,
} from "./bevindingen.js";

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
export const CORE_VERSIE = "0.10.0";
