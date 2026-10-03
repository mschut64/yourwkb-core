// Kastscan — labelontwerp.
// ⚠️ VERHUISD UIT KASTSCAN op 03-10-2026, ongewijzigd. Hij staat in de motor omdat
// YourWkb dezelfde labels moet kunnen maken: één kast, één sticker, één ontwerp.
// Deze module is zuiver — tekenopdrachten in millimeters, geen DOM — en dus
// overal te gebruiken.
// Implementeert "Labelset YourWkb — revisie 3.0 (specificatie)", vastgesteld
// 1 september 2026. Sectienummers in commentaar verwijzen naar die spec.
//
// ─────────────────────────────────────────────────────────────────────────────
// TWEE REGELS DIE ALLES HIER BEPALEN
//
// 1 · NOOIT SCHALEN (spec §2, §3). Een label wordt beschreven als tekenopdrachten
//     in MILLIMETERS op 30 × 50 mm. Elke renderer rastert die zelf op zijn eigen
//     resolutie en tekent op ware grootte. De labelprinter krijgt exact
//     240 × 400 px (203 dpi). Er wordt nergens een bitmap herschaald: bilineair
//     verkleinen maakt zwarte lijnen grijs, en de zwart-witdrempel gooit ze
//     daarna weg. Tekst van 3,5 mm overleeft dat, een lijn van 0,55 mm niet.
//     Dát is de oorzaak van de weggevallen symbolen in v2.0.
//
// 2 · DE TYPESCHAAL LIGT VAST (spec §3). Auto-fit is VERWIJDERD. Past de inhoud
//     niet, dan is dat een INVOERFOUT — te veel velden of te lange waarden — en
//     geen reden om de typografie onder de kaphoogtevloer van 2,5 mm te duwen.
//     De generator meldt dan hoeveel tekens eraf moeten; zie controleerPassend().
// ─────────────────────────────────────────────────────────────────────────────

// ─── §1 · DRAGER ──────────────────────────────────────────────────────────────
//
// Rol 50 × 30 mm, STAAND gebruikt: 30 mm breed, 50 mm hoog. Het smalle label is
// een vol label over de lengte doorgeknipt op 15 mm — te gebruiken bij een
// toestel van 1 module (18 mm), waar een label van 30 mm over de buurgroep heen
// zou liggen.
// Wat `labelSelectie` nodig heeft om van een kast een stapel stickers te maken.
// Het ontwerp zelf (alles hierboven) blijft importvrij: tekenopdrachten in
// millimeters, meer niet.
import { toNum } from "./getallen.js";
import { groepsnummers, isGroepsoort, isMeerpolig, sorteerPosities, formatBeveiliging } from "./toestellen.js";
import { blokIndeling } from "./indeling.js";
import { aardlekCode, aardlekKleurNaam } from "./vormtaal.js";

export const DRAGER = {
  hoogteMm: 50,
  breedVolMm: 30,
  breedSmalMm: 15,
  margeMm: 3,
  // Op 15 mm draagt 3 mm marge de breedte niet. Vastgelegde uitzondering (§1).
  margeSmalMm: 1.75,
};

// Blijft bestaan voor de renderers en de printerdrivers.
export const LABEL = { breedteMm: 30, hoogteMm: 50, marge: DRAGER.margeMm };

// §9 — Barlow Condensed inbedden. Displaycijfers proportioneel; alleen de
// datakolommen krijgen tabelcijfers (tnum). Tabelcijfers maken de grote cijfers
// ~1,7 mm breder en duwen ze door de 3 mm marge.
export const FONT = "'Barlow Condensed','Arial Narrow',sans-serif";

// ─── §3 · TYPESCHAAL — VAST ───────────────────────────────────────────────────
//
// Maten zijn korpsgrootte in mm. De kaphoogtevloer van 2,5 mm is de harde
// ondergrens: bij Barlow Condensed is de kaphoogte ≈ 0,72 × korps, dus 3,5 mm
// korps geeft 2,52 mm kaphoogte — precies op de vloer. Onder 3,5 mm mag niets.
export const TYPE = {
  grootCijfer: 7.75,   // groepsnummer, of stroomsterkte bij de hoofdschakelaar
  aardlekCode: 4.5,    // A1–A4 of EIGEN
  titel: 4.25,         // naam / functie
  // §3 noemt 3,5 mm, maar met de GEMETEN kaphoogte van 0,700 × korps levert dat
  // 2,45 mm — onder de harde vloer van 2,5 mm die diezelfde paragraaf stelt.
  // Die twee getallen gingen 2% niet samen. Besluit Martin, 01-09-2026: de
  // vloer wint, dus het korps gaat naar 3,58 mm en haalt 2,506 mm kaphoogte.
  waarde: 3.58,        // gegevensregels en groepsnaam
  voet: 3.58,          // revisiedatum
};
export const KAPHOOGTE_VLOER_MM = 2.5;

// GEMETEN in Barlow Condensed op canvas (01-09-2026), niet geschat:
//   kaphoogte (HX)      0,700 × korps
//   stokletters (bdhkl) 0,730 × korps  — hóger dan de kaphoogte
//   staarten (gjpqy)    0,207 × korps
// Voor de plaatsing van een basislijn telt de kaphoogte; voor de vraag of twee
// regels elkaar raken tellen de stokletters en de staarten, want die steken er
// verder uit.
export const KAP_FACTOR = 0.70;
export const STOK_FACTOR = 0.73;
export const STAART_FACTOR = 0.207;
export const KORPS_VLOER_MM = KAPHOOGTE_VLOER_MM / KAP_FACTOR;

// ─── GEWICHT: WAAROM ER MAAR ÉÉN REGEL VET IS ─────────────────────────────────
//
// Op thermisch papier lopen de gaatjes in a, e, o en 8 dicht. §7 noemt voor de
// beeldmerken 4 dots op de printkop als ondergrens voor elke tussenruimte;
// diezelfde grens geldt voor de binnenruimte van een letter, want het is
// dezelfde kop en dezelfde inkt.
//
// GEMETEN op 203 dpi (01-09-2026), kleinste binnenruimte in dots over a, e en 8:
//
//   korps      gewicht 400   500   600   700
//   3,58 mm          4     4     3     3     ← alleen 400 en 500 halen het
//   4,25 mm          5     4     4     3
//   4,50 mm          5     5     4     3
//   7,75 mm          8     8     7     5
//
// Twee dingen om te onthouden:
//
// 1. Gewicht 700 zakt op élke tekstmaat onder de grens behalve op het grote
//    cijfer. Daar staat het en nergens anders.
// 2. Bij 3,58 mm haalt zelfs gewicht 600 het niet meer, terwijl het bij 3,50 mm
//    nog wel lukte. Dat is CONTRA-INTUÏTIEF — een groter korps zou een groter
//    gaatje moeten geven — en het is rasterisatie: op 28,6 dots hoogte rondt de
//    streek een dot dikker af, en dat gaat van de binnenruimte af. Precies de
//    reden om te meten in plaats van te redeneren.
export const GAATJE_DOTS = {
  3.58: { 400: 4, 500: 4, 600: 3, 700: 3 },
  4.25: { 400: 5, 500: 4, 600: 4, 700: 3 },
  4.5:  { 400: 5, 500: 5, 600: 4, 700: 3 },
  7.75: { 400: 8, 500: 8, 600: 7, 700: 5 },
};
export const MIN_GAATJE_DOTS = 4;

// Zoekt de gemeten binnenruimte op bij de dichtstbijzijnde korpsmaat. Kleinere
// korpsen hebben kleinere gaatjes, dus bij twijfel de ONGUNSTIGSTE kiezen.
export function gaatjeDots(korpsMm, gewicht) {
  const maten = Object.keys(GAATJE_DOTS).map(Number).sort((a, b) => a - b);
  const maat = maten.find((m) => korpsMm <= m + 0.01) || maten[maten.length - 1];
  const rij = GAATJE_DOTS[maat];
  const gewichten = Object.keys(rij).map(Number).sort((a, b) => a - b);
  const g = gewichten.find((w) => gewicht <= w) || gewichten[gewichten.length - 1];
  return rij[g];
}

export const GEWICHT_KOP = 700;    // alleen het grote cijfer bovenaan
export const GEWICHT_VET = 600;    // titels, namen, aardlekcode
export const GEWICHT_TEKST = 500;  // gegevensregels en voetregel

// Letterruimte op kleine tekst. Barlow Condensed staat van zichzelf strak, en
// op thermisch papier vloeit de inkt uit — dan lopen letters in elkaar over en
// slibben de gaatjes in a, e en o dicht. Een beetje extra ruimte per teken
// kost nauwelijks breedte en maakt het verschil tussen leesbaar en een veeg.
// Verhoogd na de veldproef van 01-09-2026: met 0,05 mm liepen de letters op de
// afdruk nog steeds tegen elkaar aan. De geometrische ruimte is niet wat je
// ziet — de thermokop legt inkt breder neer dan de dot groot is, dus een deel
// van de tussenruimte vloeit dicht. Wat op het scherm royaal lijkt, is op het
// label krap.
export const SPATIERING_KLEIN_MM = 0.09;
export const SPATIERING_GROOT_MM = 0.05;

export function spatieringVoor(korpsMm) {
  return korpsMm <= TYPE.titel ? SPATIERING_KLEIN_MM : SPATIERING_GROOT_MM;
}

// Groepsnaam past in 18,75 mm en blijft ALTIJD op één regel (§3). Een waarde die
// over twee regels breekt kost meer hoogte dan hij bespaart.
//
// LET OP WELKE REGEL DIT IS. De typeschaal van §3 kent twee verschillende
// dingen: "Titel (naam / functie)" op 4,25 mm en "Waarde, groepsnaam" op
// 3,5 mm. De 18,75 mm hoort bij die TWEEDE — een groepsnaam in waardepositie.
// De titel op regel 3 krijgt de volle inhoudsbreedte (24 mm op een vol label).
// Ze door elkaar halen maakt een gewone naam als "Zonnepanelen" ten onrechte
// tot invoerfout.
export const GROEPSNAAM_MAX_MM = 18.75;

// Gemiddelde tekenbreedte ÷ korpsgrootte voor Barlow Condensed. GEMETEN met het
// echte lettertype op canvas (01-09-2026), niet geschat: vette kopregels in
// gemengd schrift lopen 0,41–0,43, gegevensregels met cijfers en scheidingstekens
// 0,31–0,36. Eén gemiddelde factor voor beide maakte de gegevensregels ruim 15%
// te breed en dwong onnodige inkortingen af.
//
// Deze waarden zijn een BOVENGRENS voor de layoutbeslissingen die vóór het
// renderen vallen; de renderers meten alsnog echt.
export const TEKEN_FACTOR_VET = 0.43;
export const TEKEN_FACTOR_NORMAAL = 0.37;

export function tekenFactor(gewicht) {
  return (gewicht || 600) >= 600 ? TEKEN_FACTOR_VET : TEKEN_FACTOR_NORMAAL;
}

export function schatBreedteMm(t, korpsMm, gewicht) {
  const n = String(t == null ? "" : t).length;
  if (!n) return 0;
  return n * korpsMm * tekenFactor(gewicht) + (n - 1) * spatieringVoor(korpsMm);
}

// ─── §5 · MODULEBREEDTES (1 module = 18 mm) ───────────────────────────────────
//
// Let op: de MODERNE aardlekautomaat is één module. In v2.0 stond die als
// "dikke automaat" van 2 modules; dat was fout.
export const MODULE_MM = 18;
export const MODULEBREEDTES = [
  { toestel: "Standaard automaat (1-polig + nul)", mm: 18, modules: 1 },
  { toestel: "Aardlekautomaat (Alamat), modern",   mm: 18, modules: 1 },
  { toestel: "Aardlekautomaat, ouder model",       mm: 36, modules: 2 },
  { toestel: "Aardlekschakelaar, 2-polig",         mm: 36, modules: 2 },
  { toestel: "Aardlekschakelaar, 4-polig",         mm: 72, modules: 4 },
  { toestel: "Krachtgroep 3-fase (3-polig + nul)", mm: 72, modules: 4 },
  { toestel: "Hoofdschakelaar, 2-polig",           mm: 36, modules: 2 },
  { toestel: "Hoofdschakelaar, 4-polig",           mm: 72, modules: 4 },
  { toestel: "Hoofdschakelaar, compact 4-polig",   mm: 54, modules: 3 },
];

// Hoofdschakelaar wordt gekozen op stroomsterkte (§5).
export function hoofdschakelaarAdvies(fasen, hoofdzekering, heeftKrachtgroep) {
  const a = Number(hoofdzekering) || 0;
  if (heeftKrachtgroep || a > 35) return 63;
  if (fasen === 3 || a <= 35) return 40;
  return 40;
}

// DE BREEDTE IS HET MERKTEKEN (§5): een label van 15 mm betekent 1 module.
// Daarom vervalt het modulemerk op de smalle variant.
//
// 🚨 TWEE UITZONDERINGEN, EN DIE ZIJN BIJ DE VERHUIZING BIJNA ZOEKGERAAKT.
// Deze functie stond in twee versies naast elkaar: hier een met alleen het
// modulegetal, en in Kastscans model.js een met de twee uitzonderingen. Toen
// `labelSelectie` op 03-10-2026 hierheen verhuisde, riep hij de versie hiernaast
// aan — met drie argumenten, waarvan er twee werden genegeerd. JavaScript klaagt
// daar niet over. Gevolg: een pv-groep van één module kreeg een smal label waar
// zijn risicoregel niet op past, en een gewone groepsnaam liep over de rand. De
// tests hieronder bestaan daarom, en deze functie is nu de énige.
//
// 1 · EEN RISICOREGEL DWINGT EEN VOL LABEL. Bij 3,5 mm korps past er op 11,5 mm
//     ongeveer negen tekens, en daar past geen enkele risicoregel op. Een groep
//     met een reëel restrisico (pv, accu, laadpunt) krijgt daarom altijd 30 mm.
//     Het label steekt dan over de buurgroep — de mindere van twee kwaden
//     tegenover een pv-groep zonder markering, waar NEN 1010 712.514.101 juist
//     wél om vraagt.
//
// 2 · EEN NAAM DIE NIET OP 15 MM PAST DWINGT EEN VOL LABEL. Op 4,25 mm draagt
//     11,5 mm ongeveer zes tekens: "Keuken" en "Oven" passen, "Vaatwasser" en
//     "Wasmachine" niet. Zonder deze regel zou elke gewone groepsnaam een
//     invoerfout worden en zou de installateur namen gaan afkorten om de
//     generator tevreden te houden. Dat is de verkeerde kant op werken.
//
// ⚓ BEVESTIGD DOOR MARTIN, 03-10-2026: "risicoregel dwingt 30 mm blijft goed zo".
// Rev3.0 laat het open, dus dit is een normbesluit van de domeinexpert en geen
// implementatiekeuze — zet hem niet terug omdat een label over de buurgroep
// steekt. Dat oversteken is bewust de mindere van twee kwaden tegenover een
// pv-groep zonder markering.
export const RISICO_DWINGT_VOL_LABEL = true;

// Het tweede geval (een naam die niet op 15 mm past) is niet apart voorgelegd en
// staat gewoon aan. De andere uitweg zou zijn het smalle label zijn titel te
// ontnemen en de naam alleen op de uitlijnstrook en het groepenoverzicht te
// zetten; die vraag ligt er nog, maar hij is niet dringend — niemand heeft er
// last van, en wat niet past wordt sowieso als invoerfout gemeld.
export const LANGE_NAAM_DWINGT_VOL_LABEL = true;

export function labelBreedteVoorModules(modules, heeftRisico, titel) {
  if (heeftRisico && RISICO_DWINGT_VOL_LABEL) return DRAGER.breedVolMm;
  if (toNum(modules) !== 1) return DRAGER.breedVolMm;
  if (LANGE_NAAM_DWINGT_VOL_LABEL && !naamPastOpSmalLabel(titel)) return DRAGER.breedVolMm;
  return DRAGER.breedSmalMm;
}

// ─── HET AARDLEKMERK ──────────────────────────────────────────────────────────
//
// De aardlekregel draagt A1–A4 met STIPPEN: één stip voor A1, twee voor A2,
// enzovoort. Dat is monochroom leesbaar en telt sneller dan een vormcode. EIGEN
// krijgt geen stippen maar het modulemerk (§4, leesorde regel 2).
export const STIP_STRAAL_MM = 0.62;
export const STIP_AFSTAND_MM = 1.85;

export function stippenVoor(code) {
  const m = String(code || "").match(/^A(\d)$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 4 ? n : 0;
}

// ─── §7 · BEELDMERKEN — 1-BIT PROOF ───────────────────────────────────────────
//
// GEEN lijntekeningen: massieve silhouetten. Elk merk is beschreven in een
// genormaliseerd vierkant van 100 × 100 eenheden.
//
//   buiten        — het massieve silhouet
//   uitsparingen  — vormen die eruit worden gesneden (fill-rule evenodd)
//
// CLEARANCE (§7): elke tussenruimte én elke zwarte restband moet ≥ 4 px op de
// printkop zijn. Bij een merk van 5,75 mm op 203 dpi is dat 46 px breed, dus
// 4 px ≈ 8,7 eenheden in dit vierkant. Alles hieronder is op ≥ 10 eenheden
// ontworpen, met marge. Op het smalle label (3,25 mm ≈ 26 px) haalt geen enkele
// uitsparing die drempel — daar wordt alleen `buiten` getekend.
export const MERK_VOL_MM = 5.75;    // 30 mm labels
export const MERK_SMAL_MM = 3.25;   // 15 mm labels — zonder uitsparingen
export const CLEARANCE_PX = 4;

export const BEELDMERKEN = {
  // Zon boven paneel.
  pv: {
    buiten:
      "M50 2 a14 14 0 1 0 0.1 0 Z" +
      "M10 96 L32 46 L96 46 L74 96 Z",
    uitsparingen:
      "M40 58 L32 84 L52 84 L58 58 Z" +
      "M70 58 L64 84 L84 84 L90 58 Z",
    // Zon en paneel als twee losse massieven, 16 eenheden uit elkaar.
    smal: "M50 2 a14 14 0 1 0 0.1 0 Z" + "M10 96 L32 46 L96 46 L74 96 Z",
  },
  // Paal met arm.
  laadpunt: {
    buiten:
      "M22 6 h38 a6 6 0 0 1 6 6 v82 a6 6 0 0 1 -6 6 h-38 a6 6 0 0 1 -6 -6 v-82 a6 6 0 0 1 6 -6 Z" +
      "M66 22 h14 a10 10 0 0 1 10 10 v24 a8 8 0 0 1 -16 0 v-20 h-8 Z",
    uitsparingen: "M28 22 h26 v22 h-26 Z",
    smal:
      "M24 4 h36 a6 6 0 0 1 6 6 v86 a6 6 0 0 1 -6 6 h-36 a6 6 0 0 1 -6 -6 v-86 a6 6 0 0 1 6 -6 Z" +
      "M74 20 h22 v32 h-22 Z",
  },
  // Blok met polen. De polen raken het blok: één aaneengesloten silhouet, en
  // dat mag ook op het smalle label (§7).
  accu: {
    buiten:
      "M6 30 h88 a6 6 0 0 1 6 6 v48 a6 6 0 0 1 -6 6 h-88 a6 6 0 0 1 -6 -6 v-48 a6 6 0 0 1 6 -6 Z" +
      "M22 14 h18 v16 h-18 Z" + "M60 14 h18 v16 h-18 Z",
    uitsparingen: "M18 48 h22 v12 h-22 Z" + "M60 48 h22 v12 h-22 Z" + "M65 42 h12 v24 h-12 Z",
    smal:
      "M6 30 h88 a6 6 0 0 1 6 6 v48 a6 6 0 0 1 -6 6 h-88 a6 6 0 0 1 -6 -6 v-48 a6 6 0 0 1 6 -6 Z" +
      "M22 14 h18 v16 h-18 Z" + "M60 14 h18 v16 h-18 Z",
  },
  // Vlak met uitgespaarde zones. Op het smalle label worden het vier LOSSE
  // pitten: uitsparingen zouden op 26 px dichtlopen, vier massieven niet.
  kookplaat: {
    buiten: "M2 12 h96 a8 8 0 0 1 8 8 v60 a8 8 0 0 1 -8 8 h-96 a8 8 0 0 1 -8 -8 v-60 a8 8 0 0 1 8 -8 Z",
    uitsparingen:
      "M31 36 a13 13 0 1 0 0.1 0 Z" + "M69 34 a9 9 0 1 0 0.1 0 Z" +
      "M29 68 a9 9 0 1 0 0.1 0 Z" + "M67 66 a13 13 0 1 0 0.1 0 Z",
    smal:
      "M28 28 a14 14 0 1 0 0.1 0 Z" + "M72 28 a14 14 0 1 0 0.1 0 Z" +
      "M28 72 a14 14 0 1 0 0.1 0 Z" + "M72 72 a14 14 0 1 0 0.1 0 Z",
  },
  // Cirkel met drie polen. Smal: de drie polen zelf, los.
  cee: {
    buiten: "M50 4 a46 46 0 1 0 0.1 0 Z",
    uitsparingen:
      "M50 20 a11 11 0 1 0 0.1 0 Z" + "M28 60 a11 11 0 1 0 0.1 0 Z" + "M72 60 a11 11 0 1 0 0.1 0 Z",
    smal:
      "M50 24 a16 16 0 1 0 0.1 0 Z" + "M26 70 a16 16 0 1 0 0.1 0 Z" + "M74 70 a16 16 0 1 0 0.1 0 Z",
  },
  // Vlak met witte ventilator. De uitsparing is naar binnen gehaald zodat hij
  // niet meer door de rand van het vlak wordt afgesneden.
  warmtepomp: {
    buiten: "M2 12 h96 a8 8 0 0 1 8 8 v60 a8 8 0 0 1 -8 8 h-96 a8 8 0 0 1 -8 -8 v-60 a8 8 0 0 1 8 -8 Z",
    uitsparingen:
      "M50 26 a10 10 0 0 1 10 10 v10 a10 10 0 0 1 -20 0 v-10 a10 10 0 0 1 10 -10 Z" +
      "M24 66 a10 10 0 0 1 5 -14 l12 -5 a10 10 0 0 1 8 17 l-12 5 a10 10 0 0 1 -13 -3 Z" +
      "M76 66 a10 10 0 0 0 -5 -14 l-12 -5 a10 10 0 0 0 -8 17 l12 5 a10 10 0 0 0 13 -3 Z",
    // Smal: ventilator boven, unit onder — twee massieven, 14 eenheden uiteen.
    // Ventilator en unit 20 eenheden uiteen — op 26 px is dat ruim 5 dots,
    // veilig boven de 4 dots die de printkop nodig heeft (§7).
    smal: "M50 18 a16 16 0 1 0 0.1 0 Z" + "M8 54 h84 a6 6 0 0 1 6 6 v28 a6 6 0 0 1 -6 6 h-84 a6 6 0 0 1 -6 -6 v-28 a6 6 0 0 1 6 -6 Z",
  },
  // Balk met luchtstroom.
  airco: {
    buiten:
      "M2 10 h96 a8 8 0 0 1 8 8 v26 a8 8 0 0 1 -8 8 h-96 a8 8 0 0 1 -8 -8 v-26 a8 8 0 0 1 8 -8 Z" +
      "M20 62 h26 v11 h-26 Z" + "M54 62 h26 v11 h-26 Z" + "M34 84 h32 v11 h-32 Z",
    uitsparingen: "M14 24 h72 v10 h-72 Z",
    smal:
      "M4 10 h92 a6 6 0 0 1 6 6 v22 a6 6 0 0 1 -6 6 h-92 a6 6 0 0 1 -6 -6 v-22 a6 6 0 0 1 6 -6 Z" +
      "M16 58 h28 v12 h-28 Z" + "M58 58 h28 v12 h-28 Z" + "M32 84 h36 v12 h-36 Z",
  },
  // Draaiknop met wijzer.
  hoofdschakelaar: {
    buiten: "M50 2 a48 48 0 1 0 0.1 0 Z",
    uitsparingen: "M50 16 a34 34 0 1 0 0.1 0 Z",
    // De wijzer is een tweede massief bovenop de uitsparing.
    binnen: "M44 26 h12 v30 h-12 Z",
    // Smal: het aan/uit-teken als twee losse massieven — een ring van 4 px zou
    // op 26 px dichtlopen.
    // De streep begint op 4 in plaats van 0, zodat hij niet tegen de rand van
    // het merkvak aanloopt; 16 eenheden tussen streep en cirkel.
    smal: "M50 68 a26 26 0 1 0 0.1 0 Z" + "M42 4 h16 v22 h-16 Z",
  },
};

// Welk beeldmerk hoort bij een functienaam. Buiten de set: geen merk — een
// verzonnen pictogram is erger dan geen.
export function beeldmerkVoor(functie) {
  const n = String(functie || "").toLowerCase();
  if (/zonnepane|pv|omvormer/.test(n)) return "pv";
  if (/laadpaal|laadpunt|ev\b/.test(n)) return "laadpunt";
  if (/batterij|accu|opslag/.test(n)) return "accu";
  if (/kook|fornuis|kookplaat|oven/.test(n)) return "kookplaat";
  if (/kracht|cee|perilex|400/.test(n)) return "cee";
  if (/warmtepomp/.test(n)) return "warmtepomp";
  if (/airco|koeling/.test(n)) return "airco";
  if (/hoofdschakelaar/.test(n)) return "hoofdschakelaar";
  return "";
}

// ─── PRIMITIEVEN ──────────────────────────────────────────────────────────────
//
// Alle coördinaten in mm vanaf linksboven. Een renderer hoeft alleen deze
// vormen te kennen:
//
//   { t:"tekst",  x,y, tekst, korps, gewicht, uitlijn, tnum }
//   { t:"lijn",   x1,y1,x2,y2, dikte }
//   { t:"vlak",   x,y,b,h }
//   { t:"stip",   x,y, straal }
//   { t:"merk",   x,y, maat, naam, massief }   — beeldmerk, massief silhouet
//   { t:"kniplijn", x, y1,y2 }                 — deelvel met driehoekige aanzet

const tekst = (x, y, t, korps, opties) => ({
  t: "tekst", x, y, tekst: String(t == null ? "" : t), korps,
  gewicht: 600, uitlijn: "links", tnum: false,
  spatiering: spatieringVoor(korps),
  ...(opties || {}),
});
const lijn = (x1, y1, x2, y2, dikte) => ({ t: "lijn", x1, y1, x2, y2, dikte: dikte || 0.35 });

// ─── LAYOUTMATEN ──────────────────────────────────────────────────────────────
//
// Afgeleid uit §3 (typeschaal) en §4 (leesorde + ritmeregel). De baselines
// volgen uit de kaphoogte: een regel van korps k heeft kaphoogte 0,72k, dus de
// baseline ligt 0,72k onder de bovenkant van de regel.
const H = DRAGER.hoogteMm;
const kap = (korps) => korps * KAP_FACTOR;

// Voet: revisiedatum op ELK label (§9), met een dunne lijn erboven.
const VOET_LIJN_Y = 42.0;
const VOET_BASELINE_Y = H - 3 + kap(TYPE.voet) - kap(TYPE.voet); // = 47,0
const VOET_Y = 46.6;

function marge(breedteMm) {
  return breedteMm <= DRAGER.breedSmalMm ? DRAGER.margeSmalMm : DRAGER.margeMm;
}

// Op een smal label is er 11,5 mm inhoudsbreedte, en een datum als "01-09-2026"
// meet daar 12,95 mm — die werd dus stilletjes afgekapt aan de rand. Op het
// smalle label gaat het jaartal daarom met twee cijfers: "01-09-26" past met
// ruim een millimeter over. Het blijft een revisiedatum, en §9 vraagt niet om
// vier cijfers.
// ⚓ DE DATUM OP EEN LABEL IS dd-mm-jjjj, MET VOORLOOPNULLEN. Daar rekent
// `voetDatum` hieronder op: alleen een datum in díé vorm wordt op het smalle
// label ingekort tot een jaartal van twee cijfers. Een app die haar datum door
// `toLocaleDateString("nl-NL")` haalt krijgt "3-10-2026" terug — zonder nul, dus
// het inkorten grijpt niet, en de datum loopt op het smalle label één teken over
// de rand. Dat is precies wat er gebeurde, en het gaf een melding "kort de naam
// in" over een datum die niemand getypt had. Gebruik deze functie en niet je
// eigen opmaak; de eis hoort bij het label, niet bij het scherm.
export function labelDatum(d) {
  const t = d instanceof Date ? d : new Date(d || Date.now());
  const p = (n) => String(n).padStart(2, "0");
  return `${p(t.getDate())}-${p(t.getMonth() + 1)}-${t.getFullYear()}`;
}

export function voetDatum(datum, breedteMm) {
  const d = String(datum || "");
  if (breedteMm > DRAGER.breedSmalMm) return d;
  return d.replace(/^(\d{2}-\d{2}-)\d{2}(\d{2})$/, "$1$2");
}

function voet(datum, breedteMm) {
  const m = marge(breedteMm);
  return [
    lijn(m, VOET_LIJN_Y, breedteMm - m, VOET_LIJN_Y, 0.25),
    tekst(m, VOET_Y, voetDatum(datum, breedteMm), TYPE.voet, { gewicht: 500, tnum: true }),
  ];
}

// ─── §4 · LEESORDE ────────────────────────────────────────────────────────────
//
//   1  GROEPSNUMMER   linksboven, 7,75 mm, beeldmerk ernaast rechts
//   2  AARDLEK        regel eronder: A1–A4 met stippen, of EIGEN
//   3  TITEL          naam / functie
//   4  RISICOREGEL    alleen bij een reëel restrisico, tussen twee lijnen
//   5  GEGEVENS       zelf-uitschrijvende regels ("B16 · L2 · 5,0 kWh")
//   6  VOET           revisiedatum
//
// Alles links uitgelijnd op de marge. Het beeldmerk is het ENIGE rechtse
// element: één linkeras, geen accentstreep die tekst inspringt. Er is GEEN
// veldnamenkolom — 30 × 50 mm draagt die klasse niet, dus schrijven de waarden
// zichzelf uit.
//
// RITMEREGEL (§4): mét risicoregel ÉÉN gegevensregel, zonder risicoregel DRIE.
// Daarmee vullen alle stickers zich even ver en blijft de restruimte onder 9 mm.
export const GEGEVENSREGELS_MET_RISICO = 1;
export const GEGEVENSREGELS_ZONDER_RISICO = 3;

export function maxGegevensregels(heeftRisico) {
  return heeftRisico ? GEGEVENSREGELS_MET_RISICO : GEGEVENSREGELS_ZONDER_RISICO;
}

const Y_GROOT_CIJFER = 3 + kap(TYPE.grootCijfer);           // 8,58
// 2,6 mm en niet 2,0: bij 2,0 bleef er tussen de staart van het grote cijfer
// (7,75 mm korps) en de kophoogte van de aardlekregel maar 0,29 mm wit over, en
// dat liep in de afdruk in elkaar over.
const Y_AARDLEK = Y_GROOT_CIJFER + 2.6 + kap(TYPE.aardlekCode);
const Y_TITEL = Y_AARDLEK + 2.2 + kap(TYPE.titel);
const REGELHOOGTE = 4.8;

// Basislijnafstand in de legenda van een uitlijnstrook. Binnen een groep krap
// genoeg om als één geheel te lezen, tussen twee groepen ruim genoeg om ze uit
// elkaar te houden.
const BINNEN_GROEP_MM = 4.8;
const TUSSEN_GROEPEN_MM = 7.0;

// ─── LABELKLASSE 1 · APPARAATSTICKER (§10 · 01-07 en 40-44) ───────────────────
export function ontwerpApparaat(label) {
  const breedteMm = label.breedteMm || DRAGER.breedVolMm;
  const smal = breedteMm <= DRAGER.breedSmalMm;
  const m = marge(breedteMm);
  const d = [];

  // 1 · Groepsnummer, met het beeldmerk als enige rechtse element.
  d.push(tekst(m, Y_GROOT_CIJFER, label.groepsnummer || "", TYPE.grootCijfer, { gewicht: GEWICHT_KOP }));
  const merk = label.pict || beeldmerkVoor(label.titel);
  if (merk && BEELDMERKEN[merk]) {
    const maat = smal ? MERK_SMAL_MM : MERK_VOL_MM;
    d.push({
      t: "merk", naam: merk, maat,
      x: breedteMm - m - maat,
      y: 3 + (kap(TYPE.grootCijfer) - maat) / 2,
      // Op het smalle label geen uitsparingen: die lopen dicht (§7).
      massief: smal,
    });
  }

  // 2 · Aardlek: A1–A4 met stippen, of EIGEN met het modulemerk.
  if (label.aardlek) {
    const code = String(label.aardlek).toUpperCase();
    d.push(tekst(m, Y_AARDLEK, code, TYPE.aardlekCode, { gewicht: GEWICHT_VET }));
    const n = stippenVoor(code);
    const start = m + schatBreedteMm(code, TYPE.aardlekCode, 700) + 1.6;
    for (let i = 0; i < n; i++) {
      d.push({ t: "stip", x: start + i * STIP_AFSTAND_MM, y: Y_AARDLEK - kap(TYPE.aardlekCode) / 2, straal: STIP_STRAAL_MM });
    }
  }

  // 3 · Titel.
  d.push(tekst(m, Y_TITEL, label.titel || "", TYPE.titel, { gewicht: GEWICHT_VET }));

  // 4 · Risicoregel, tussen twee lijnen. Geen signaalwoord: "LET OP" hoort niet
  //     in de reeks GEVAAR / WAARSCHUWING / VOORZICHTIG (NEN-EN-ISO 3864-2) en
  //     een zwart-wit label is geen veiligheidsteken (NEN 3011 / ISO 7010).
  //     Deze set is expliciet een INFORMATIELABEL — spec §8, variant B.
  let y = Y_TITEL + 3.4;
  const heeftRisico = !!(label.risico && String(label.risico).trim());
  if (heeftRisico) {
    d.push(lijn(m, y, breedteMm - m, y, 0.25));
    y += kap(TYPE.waarde) + 1.5;
    for (const regel of String(label.risico).split("\n").slice(0, 2)) {
      d.push(tekst(m, y, regel, TYPE.waarde, { gewicht: 500 }));
      y += REGELHOOGTE;
    }
    y -= REGELHOOGTE - 1.6;
    d.push(lijn(m, y, breedteMm - m, y, 0.25));
    y += kap(TYPE.waarde) + 1.8;
  } else {
    y += kap(TYPE.waarde);
  }

  // 5 · Gegevens — zelf-uitschrijvende regels, geen veldnamenkolom.
  const regels = (label.gegevens || []).slice(0, maxGegevensregels(heeftRisico));
  for (const r of regels) {
    d.push(tekst(m, y, r, TYPE.waarde, { gewicht: 500, tnum: true }));
    y += REGELHOOGTE;
  }

  d.push(...voet(label.datum, breedteMm));
  return d;
}

// ─── LABELKLASSE 2 · HOOFDSCHAKELAAR (§10 · 08-09) ────────────────────────────
//
// Uitzondering op de leesorde (§4): de hoofdschakelaar hoort bij geen groep en
// heeft geen aardlek boven zich. Regel 1 draagt de STROOMSTERKTE, regel 2 de
// POLEN en de MODULEBREEDTE. De plek van het grote cijfer blijft dus gelijk.
export function ontwerpHoofdschakelaar(label) {
  const breedteMm = label.breedteMm || DRAGER.breedVolMm;
  const smal = breedteMm <= DRAGER.breedSmalMm;
  const m = marge(breedteMm);
  const d = [];

  d.push(tekst(m, Y_GROOT_CIJFER, label.stroom || "", TYPE.grootCijfer, { gewicht: GEWICHT_KOP }));
  const maat = smal ? MERK_SMAL_MM : MERK_VOL_MM;
  d.push({
    t: "merk", naam: "hoofdschakelaar", maat,
    x: breedteMm - m - maat,
    y: 3 + (kap(TYPE.grootCijfer) - maat) / 2,
    massief: smal,
  });

  d.push(tekst(m, Y_AARDLEK, label.polen || "", TYPE.aardlekCode, { gewicht: GEWICHT_VET }));
  // Geen titelregel: §4 kent de hoofdschakelaar alleen regel 1 (stroomsterkte)
  // en regel 2 (polen + modulebreedte). "Hoofdschakelaar" voluit is op 4,25 mm
  // bovendien 26,1 mm breed en past sowieso niet binnen de marge.
  if (label.titel) d.push(tekst(m, Y_TITEL, label.titel, TYPE.titel, { gewicht: GEWICHT_VET }));

  let y = Y_TITEL + 3.4 + kap(TYPE.waarde);
  for (const r of (label.gegevens || []).slice(0, GEGEVENSREGELS_ZONDER_RISICO)) {
    d.push(tekst(m, y, r, TYPE.waarde, { gewicht: 500, tnum: true }));
    y += REGELHOOGTE;
  }

  d.push(...voet(label.datum, breedteMm));
  return d;
}

// ─── LABELKLASSE 3 · UITLIJNSTROOK (§6, §10 · 10-13) ──────────────────────────
//
// Hartteken verticaal op 15 mm — het hart van het label. Dat leg je op de NAAD
// tussen twee automaten. Er is bewust GEEN horizontale maatlijn: het teken plus
// de cijferposities zeggen alles.
//
// Cijferhart op 9 mm van het midden, dus op 6 en 24 mm — precies boven het hart
// van een module van 18 mm. Cijfers bovenaan uitgelijnd op de 3 mm marge.
export const HART_MM = 15;
export const CIJFERHART_OFFSET_MM = 9;
export const HALVE_STROOK_HART_MM = 7.5;

export function ontwerpStrook(label) {
  const breedteMm = label.breedteMm || DRAGER.breedVolMm;
  const smal = breedteMm <= DRAGER.breedSmalMm;
  const m = marge(breedteMm);
  const d = [];
  const nummers = (label.nummers || []).slice(0, 2);

  // Breed toestel (2 of 4 modules): er is geen naad in het midden, dus geen
  // hartteken en één cijfer op het hart van het label (§6).
  const breedToestel = Number(label.modules) >= 2;
  const hart = smal ? HALVE_STROOK_HART_MM : HART_MM;

  if (smal || breedToestel || nummers.length < 2) {
    d.push(tekst(hart, Y_GROOT_CIJFER, String(nummers[0] == null ? "" : nummers[0]),
      TYPE.grootCijfer, { gewicht: GEWICHT_KOP, uitlijn: "midden" }));
  } else {
    d.push({ t: "hartteken", x: HART_MM, y1: 3, y2: 3 + kap(TYPE.grootCijfer) + 1.2 });
    d.push(tekst(HART_MM - CIJFERHART_OFFSET_MM, Y_GROOT_CIJFER, String(nummers[0]),
      TYPE.grootCijfer, { gewicht: GEWICHT_KOP, uitlijn: "midden" }));
    d.push(tekst(HART_MM + CIJFERHART_OFFSET_MM, Y_GROOT_CIJFER, String(nummers[1]),
      TYPE.grootCijfer, { gewicht: GEWICHT_KOP, uitlijn: "midden" }));
  }

  if (label.aardlek) {
    const code = String(label.aardlek).toUpperCase();
    d.push(tekst(m, Y_AARDLEK, code, TYPE.aardlekCode, { gewicht: GEWICHT_VET }));
    const n = stippenVoor(code);
    const start = m + schatBreedteMm(code, TYPE.aardlekCode, 700) + 1.6;
    for (let i = 0; i < n; i++) {
      d.push({ t: "stip", x: start + i * STIP_AFSTAND_MM, y: Y_AARDLEK - kap(TYPE.aardlekCode) / 2, straal: STIP_STRAAL_MM });
    }
  }

  // De legenda: per groep de naam op één regel (§3 — nooit afbreken), met de
  // beveiliging eronder.
  //
  // DE TWEE AFSTANDEN HIERONDER ZIJN NIET WILLEKEURIG. Een naam en zijn eigen
  // detailregel horen bij elkaar; twee groepen horen dat niet. Stonden die
  // afstanden dicht bij elkaar, dan las de strook als één blok van vier regels
  // in plaats van twee paren — en dat is precies wat er in de veldtest van
  // 01-09-2026 uit de printer kwam. De ruimte tussen twee groepen is daarom
  // ruim de helft groter dan die binnen een groep.
  let y = Y_TITEL;
  for (const r of (label.regels || []).slice(0, 2)) {
    d.push(tekst(m, y, r.naam || "", TYPE.titel, { gewicht: GEWICHT_VET }));
    y += BINNEN_GROEP_MM;
    d.push(tekst(m, y, r.detail || "", TYPE.waarde, { gewicht: 500, tnum: true }));
    y += TUSSEN_GROEPEN_MM;
  }

  // Een brede toestelrij draagt een extra gegevensregel om het vlak te vullen (§6).
  if (breedToestel && label.extra) {
    d.push(tekst(m, y, label.extra, TYPE.waarde, { gewicht: 500, tnum: true }));
  }

  d.push(...voet(label.datum, breedteMm));
  return d;
}

// ─── LABELKLASSE 4 · TAG OP DE AARDLEKSCHAKELAAR (§10 · 20-22) ────────────────
//
// Volgt dezelfde leesorde, maar regel 1 draagt de aardlekcode groot: dat is de
// hele functie van dit label — "welke is A2" van twee meter afstand.
export function ontwerpTag(label) {
  const breedteMm = label.breedteMm || DRAGER.breedVolMm;
  const m = marge(breedteMm);
  const d = [];
  const code = String(label.aardlek || "").toUpperCase();

  d.push(tekst(m, Y_GROOT_CIJFER, code, TYPE.grootCijfer, { gewicht: GEWICHT_KOP }));
  const n = stippenVoor(code);
  const start = m + schatBreedteMm(code, TYPE.grootCijfer, 700) + 1.8;
  for (let i = 0; i < n; i++) {
    d.push({ t: "stip", x: start + i * (STIP_AFSTAND_MM + 0.4), y: Y_GROOT_CIJFER - kap(TYPE.grootCijfer) / 2, straal: STIP_STRAAL_MM * 1.35 });
  }

  // Regel 2 op een tag staat op de WAARDE-maat en niet op de aardlekcode-maat.
  // Op de aardlekcode-maat is "30 mA · type A" 27,1 mm en past het niet binnen
  // de 24 mm inhoudsbreedte. Dat is ook inhoudelijk juister: regel 1 draagt hier
  // al de aardlekcode, dus regel 2 is een gegevensregel en geen code.
  d.push(tekst(m, Y_AARDLEK, label.ondertitel || "", TYPE.waarde, { gewicht: GEWICHT_TEKST, tnum: true }));
  d.push(tekst(m, Y_TITEL, label.titel || "", TYPE.titel, { gewicht: GEWICHT_VET }));

  let y = Y_TITEL + 3.4 + kap(TYPE.waarde);
  for (const r of (label.gegevens || []).slice(0, GEGEVENSREGELS_ZONDER_RISICO)) {
    d.push(tekst(m, y, r, TYPE.waarde, { gewicht: 500, tnum: true }));
    y += REGELHOOGTE;
  }

  d.push(...voet(label.datum, breedteMm));
  return d;
}

// ─── LABELKLASSE 5 · DEELVEL (§6, §10 · 30) ───────────────────────────────────
//
// Kniplijn op 15 mm met een driehoekige aanzet boven en onder, zodat de schaar
// zichzelf uitlijnt bij het doorknippen tot twee labels van 15 mm.
export function ontwerpDeelvel(label) {
  const d = [{ t: "kniplijn", x: HART_MM, y1: 0, y2: H }];
  // Beide helften krijgen hun eigen inhoud. Een deelvel met maar één helft is
  // ook geldig: dan zit de sticker links en knip je de lege helft eraf.
  for (const [i, helft] of [(label.links || null), (label.rechts || null)].entries()) {
    if (!helft) continue;
    const verschoven = ontwerp({ ...helft, breedteMm: DRAGER.breedSmalMm, datum: label.datum });
    const dx = i === 0 ? 0 : HART_MM;
    for (const op of verschoven) d.push(verschuif(op, dx));
  }
  return d;
}

// ─── SMALLE LABELS SAMENVOEGEN VOOR HET PRINTEN ───────────────────────────────
//
// Een labelrol kent maar één maat: 50 × 30 mm. Een label van 15 mm is een vol
// label dat je over de lengte doorknipt (§1). Bij rechtstreeks printen betekent
// dat: twee smalle stickers gaan op ÉÉN label met een kniplijn ertussen, en een
// enkele smalle sticker krijgt óók die kniplijn zodat de lege helft er netjes af
// kan.
//
// Zonder dit zou elke smalle sticker een heel label kosten en zou je hem
// bovendien op de gok moeten doorknippen.
export function combineerSmalleLabels(labels) {
  const uit = [];
  const lijst = labels || [];
  let wacht = null;

  for (const l of lijst) {
    if ((l.breedteMm || DRAGER.breedVolMm) > DRAGER.breedSmalMm) {
      uit.push(l);
      continue;
    }
    if (!wacht) { wacht = l; continue; }
    uit.push(deelvelVan(wacht, l));
    wacht = null;
  }
  if (wacht) uit.push(deelvelVan(wacht, null));
  return uit;
}

function deelvelVan(links, rechts) {
  return {
    soort: "deelvel",
    sleutel: `deelvel-${links.sleutel}${rechts ? "+" + rechts.sleutel : ""}`,
    breedteMm: DRAGER.breedVolMm,
    links, rechts,
    datum: links.datum,
  };
}

function verschuif(op, dx) {
  const k = { ...op };
  if (k.x !== undefined) k.x += dx;
  if (k.x1 !== undefined) k.x1 += dx;
  if (k.x2 !== undefined) k.x2 += dx;
  return k;
}

// ─── LABELKLASSE 6 · METERKASTPASPOORT ────────────────────────────────────────
//
// Hetzelfde paspoort dat op het A4-overzicht staat, maar dan als sticker die
// rechtstreeks uit de labelprinter komt. Geen knipwerk, geen kleurenprinter.
//
// EEN QR IS EEN RASTER, GEEN PLAATJE. Hij wordt hier niet als afbeelding
// ingevoegd maar als losse vlakjes in millimeters uitgeschreven, precies zoals
// alle andere tekenopdrachten. Daarmee valt hij onder regel 1 (nooit schalen):
// er is geen bitmap die eerst groot gemaakt en daarna weer verkleind wordt, en
// dus ook geen grijze randmodules die de zwart-witdrempel wegpoetst. Een QR
// overleeft dat namelijk slechter dan tekst: hij bestaat volledig uit lijnen
// van één module breed.
//
// DE MODULEMAAT IS EEN HEEL AANTAL PRINTERDOTS. Dat is de kern. Een module van
// 3,4 dots landt op de ene plek op 3 en op de andere op 4 dots, en zo'n
// onregelmatig raster is precies wat een scanner niet meer uitleest. Daarom
// rekenen we de modulemaat terug naar hele dots van de printer (203 dpi) en
// wordt de code liever iets kleiner dan de beschikbare ruimte.
export const DOT_MM = 25.4 / 203;

// Onder de drie dots (0,375 mm) wordt een module op thermisch papier te fijn:
// de kop smeert uit en de code loopt dicht. Dat is een harde ondergrens, geen
// richtlijn — net als de kaphoogtevloer bij de typografie.
//
// VELDBEVESTIGD 02-09-2026 (Martin, Niimbot B1): op precies deze drie dots komt
// de code er leesbaar uit en scant hij van de sticker. Dat getal is dus gemeten
// en niet geschat — en het is meteen de reden dat foutcorrectie L blijft staan.
// Wie hier naar M gaat, duwt de module naar 2,7 dots en maakt de code stuk;
// wie de drempel verhoogt, laat de gemiddelde kast niet meer passen.
export const QR_MIN_DOTS = 3;

// Stille zone volgens de QR-norm: vier modules wit rondom. Op dit label komt
// die uit de labelmarge zelf, dus hij moet meegerekend worden in de breedte.
export const QR_STIL_MODULES = 4;

// Verticaal is er tussen de titelregel en de voetlijn niet meer dan dit.
export const QR_MAX_MM = 26.0;

// Hoeveel dots per module passen er, of null als de code niet past.
export function paspoortRaster(modules, breedteMm) {
  const n = Math.round(modules);
  if (!(n > 0)) return null;
  const b = breedteMm || DRAGER.breedVolMm;
  const beschikbaar = Math.floor(b / DOT_MM);
  let dots = Math.floor(beschikbaar / (n + 2 * QR_STIL_MODULES));
  dots = Math.min(dots, Math.floor(QR_MAX_MM / DOT_MM / n));
  if (dots < QR_MIN_DOTS) return null;
  const moduleMm = dots * DOT_MM;
  return { dots, moduleMm, qrMm: n * moduleMm, modules: n };
}

// De kop staat op TWEE regels, en dat is geen opmaakvoorkeur. "Meterkastpaspoort"
// meet bij korps 4,25 mm 32,5 mm en de inhoudsbreedte is 24 mm. Regel 2 van dit
// bestand laat maar twee uitwegen: het woord inkorten of het over twee regels
// zetten. Inkorten kan niet — dit is de naam van een open standaard.
export const PASPOORT_KOP = ["Meterkast", "paspoort"];
const Y_PASPOORT_TITEL = 3 + kap(TYPE.titel);
const PASPOORT_KOPREGEL_MM = 4.3;
// De stille zone geldt RONDOM, niet alleen links en rechts. Boven de code moet
// dus net zo goed vier modules wit staan als ernaast — en de staart van de "p"
// in "paspoort" telt mee als inkt. Die vier modules zijn de reden dat het adres
// niet onder de code past en naar de voetregel is verhuisd.
const PASPOORT_STIL_MM = QR_STIL_MODULES * QR_MIN_DOTS * DOT_MM;   // 1,50 mm
export const PASPOORT_QR_Y =
  Y_PASPOORT_TITEL + PASPOORT_KOPREGEL_MM + STAART_FACTOR * TYPE.titel + PASPOORT_STIL_MM;

export function ontwerpPaspoort(label) {
  const breedteMm = label.breedteMm || DRAGER.breedVolMm;
  const m = marge(breedteMm);
  const d = [];

  let yk = Y_PASPOORT_TITEL;
  for (const regel of PASPOORT_KOP) {
    d.push(tekst(m, yk, regel, TYPE.titel, { gewicht: GEWICHT_VET }));
    yk += PASPOORT_KOPREGEL_MM;
  }

  const raster = paspoortRaster(label.qrModules, breedteMm);
  if (raster && typeof label.qrBit === "function") {
    const x0 = (breedteMm - raster.qrMm) / 2;
    const y0 = PASPOORT_QR_Y;
    // Aaneengesloten modules worden als één vlak weggeschreven. Dat scheelt
    // niet alleen opdrachten: het haalt ook de naden weg die ontstaan als twee
    // losse vlakjes elk apart op de dotgrens worden afgerond.
    for (let r = 0; r < raster.modules; r++) {
      let start = -1;
      for (let c = 0; c <= raster.modules; c++) {
        const aan = c < raster.modules && !!label.qrBit(c, r);
        if (aan && start < 0) start = c;
        if (!aan && start >= 0) {
          d.push({
            t: "vlak",
            x: x0 + start * raster.moduleMm,
            y: y0 + r * raster.moduleMm,
            b: (c - start) * raster.moduleMm,
            h: raster.moduleMm,
          });
          start = -1;
        }
      }
    }
  } else {
    // Past de code niet, dan wordt hij NIET kleiner gedrukt. Een onleesbare QR
    // op een kastdeur is erger dan geen QR: hij belooft iets wat hij niet doet.
    let y = PASPOORT_QR_Y + kap(TYPE.waarde);
    for (const regel of ["Past niet op 30 mm.", "Gebruik de uitknipbare", "sticker op het A4."]) {
      d.push(tekst(m, y, regel, TYPE.waarde, { gewicht: 500 }));
      y += REGELHOOGTE;
    }
  }

  // GEEN ADRESREGEL. Die is geprobeerd en past niet: "2691JJ 72a" meet met de
  // revisiedatum ernaast 26,5 mm op 22,5 mm beschikbaar, en boven de code is de
  // ruimte al aan de stille zone opgegaan. Regel 2 van dit bestand laat dan
  // maar één uitweg — hem weglaten — en dat kost hier weinig: het adres zit ín
  // de code, en die code is juist de reden dat het adres nergens in platte
  // tekst hoeft te staan.
  d.push(...voet(label.datum, breedteMm));
  return d;
}

// ─── DISPATCHER ───────────────────────────────────────────────────────────────

export function ontwerp(label) {
  if (!label) return [];
  if (label.soort === "strook") return ontwerpStrook(label);
  if (label.soort === "tag") return ontwerpTag(label);
  if (label.soort === "hoofdschakelaar") return ontwerpHoofdschakelaar(label);
  if (label.soort === "deelvel") return ontwerpDeelvel(label);
  if (label.soort === "paspoort") return ontwerpPaspoort(label);
  return ontwerpApparaat(label);
}

// ─── §3 / §9 · OVERLOOPCONTROLE ───────────────────────────────────────────────
//
// De auto-fit is verwijderd. Deze functie is wat ervoor in de plaats komt: hij
// meldt per veld hoeveel TEKENS eraf moeten. Dat is de melding die de generator
// aan de installateur toont — een invoerfout hoort zichtbaar te zijn, niet
// stilletjes weggetypografeerd.
export function controleerPassend(label, meet) {
  // Een deelvel draagt twee smalle labels; die moeten elk op hún breedte
  // getoetst worden, niet op de 30 mm van de drager.
  if (label.soort === "deelvel") {
    return [
      ...(label.links ? controleerPassend({ ...label.links, breedteMm: DRAGER.breedSmalMm }, meet) : []),
      ...(label.rechts ? controleerPassend({ ...label.rechts, breedteMm: DRAGER.breedSmalMm }, meet) : []),
    ];
  }
  const breedteMm = label.breedteMm || DRAGER.breedVolMm;
  const m = marge(breedteMm);
  const beschikbaar = breedteMm - 2 * m;
  const meten = meet || ((t, k, g) => schatBreedteMm(t, k, g));
  const fouten = [];

  // De QR heeft geen tekens maar wél een ondergrens, en die hoort in dezelfde
  // melding thuis: een code die te fijn wordt is net zo goed een overloop.
  if (label.soort === "paspoort" && !paspoortRaster(label.qrModules, breedteMm)) {
    fouten.push({
      veld: "qr", tekst: `${label.qrModules || 0} modules`, tekensTeveel: 0,
      breedteMm: (label.qrModules || 0) * QR_MIN_DOTS * DOT_MM,
      maxMm: breedteMm - 2 * QR_STIL_MODULES * QR_MIN_DOTS * DOT_MM,
    });
  }

  const toets = (veld, t, korps, maxMm, gewicht) => {
    const s = String(t == null ? "" : t);
    if (!s) return;
    const max = maxMm || beschikbaar;
    const breed = meten(s, korps, gewicht === undefined ? 700 : gewicht);
    if (breed <= max) return;
    // Hoeveel tekens eraf: op basis van de gemeten gemiddelde tekenbreedte.
    const perTeken = breed / s.length;
    const teveel = Math.ceil((breed - max) / perTeken);
    fouten.push({ veld, tekst: s, tekensTeveel: teveel, breedteMm: breed, maxMm: max });
  };

  toets("groepsnummer", label.groepsnummer, TYPE.grootCijfer);
  toets("stroom", label.stroom, TYPE.grootCijfer);
  toets("aardlek", label.aardlek, TYPE.aardlekCode);
  toets("titel", label.titel, TYPE.titel);
  if (label.soort === "paspoort") {
    for (const [i, r] of PASPOORT_KOP.entries()) toets(`kop[${i}]`, r, TYPE.titel, null, GEWICHT_VET);
  }
  // De voetregel stond niet in deze controle, en juist daar liep de datum op
  // een smal label over de rand. Alles wat op het label komt, hoort hier
  // getoetst te worden — ook wat de generator er zelf bij zet.
  toets("datum", voetDatum(label.datum, breedteMm), TYPE.voet, null, 500);
  toets("polen", label.polen, TYPE.aardlekCode);
  toets("ondertitel", label.ondertitel, TYPE.waarde, null, GEWICHT_TEKST);
  for (const [i, r] of (label.gegevens || []).entries()) toets(`gegevens[${i}]`, r, TYPE.waarde, null, 500);
  // De risicoregel mag over twee regels; elke regel apart toetsen.
  for (const [i, r] of String(label.risico || "").split("\n").filter(Boolean).entries()) {
    toets(`risico[${i}]`, r, TYPE.waarde, null, 500);
  }
  for (const [i, r] of (label.regels || []).entries()) {
    toets(`regel[${i}].naam`, r.naam, TYPE.titel);
    toets(`regel[${i}].detail`, r.detail, TYPE.waarde, null, 500);
  }

  const heeftRisico = !!(label.risico && String(label.risico).trim());
  const max = maxGegevensregels(heeftRisico);
  if ((label.gegevens || []).length > max) {
    fouten.push({
      veld: "gegevens",
      regelsTeveel: label.gegevens.length - max,
      tekst: `${label.gegevens.length} gegevensregels, ritmeregel staat er ${max} toe`,
    });
  }
  return fouten;
}

// Leesbare melding voor de installateur.
export function overloopMelding(fouten) {
  if (!fouten || !fouten.length) return "";
  return fouten
    .map((f) => {
      if (f.veld === "qr") {
        return `De paspoortcode telt ${f.tekst} en wordt op 30 mm te fijn om te scannen. ` +
               `Gebruik de uitknipbare sticker op het A4-groepenoverzicht, of kort de groepsnamen in.`;
      }
      return f.regelsTeveel
        ? `${f.regelsTeveel} gegevensregel(s) te veel — ${f.tekst}.`
        : `"${f.tekst}" is ${f.tekensTeveel} teken(s) te lang voor ${f.veld}.`;
    })
    .join(" ");
}


// ─── WELKE LABELS EEN KAST OPLEVERT ──────────────────────────────────────────
//
// Verhuisd uit Kastscan op 03-10-2026. De labelSPEC (wat er op een label staat en
// hoe groot) stond al hierboven; dit is de vraag wélke labels een kast oplevert:
// één per groep, één per aardlekschakelaar, één voor de hoofdschakelaar, en de
// afkortingen die een lange naam op een smal label passend maken.
//
// Het stond in Kastscans model.js omdat dat de enige plek was; het hoort hier,
// naast het ontwerp dat het voedt — en nu kan YourWkb dezelfde stickers maken.

export const AFKORTINGEN = {
  "kookgroep": "Kook",
  "koelkast": "Koelk.",
  "vaatwasser": "Vaatw.",
  "wasmachine": "Wasm.",
  "wasdroger": "Droger",
  "badkamer": "Badk.",
  "woonkamer": "Woonk.",
  "slaapkamers": "Slaapk",
  "verlichting bg": "Vl. bg",
  "verlichting 1e": "Vl. 1e",
  "wandcontactdozen": "WCD",
  "cv-ketel": "CV",
  "warmtepomp": "WP",
  "laadpaal": "Laadp.",
  "zonnepanelen": "PV",
  "koffiezet": "Koffie",
  "vriezer": "Vries.",
  "oven": "Oven",
  "fornuis": "Kook",
  "keuken": "Keuken",
  "zolder": "Zolder",
  "garage": "Garage",
  "buiten": "Buiten",
  "airco": "Airco",
};

// De naam zoals hij op een smal label komt: de afkorting als die er is, anders
// de naam zelf.
export function korteNaam(functie) {
  const n = String(functie || "").trim();
  if (!n) return "";
  return AFKORTINGEN[n.toLowerCase()] || n;
}

// 15 mm − 2 × 1,75 mm marge = 11,5 mm inhoud.
//
// LET OP: de LETTERRUIMTE telt mee. Die staat op kleine tekst en is er om
// dichtlopen op thermisch papier te voorkomen; hem hier vergeten betekent dat
// een naam die net past volgens deze functie, op het label alsnog over de rand
// loopt. Dat is precies het soort stille fout dat de datum eerder liet afkappen.
//
// Deze drie waarden spiegelen labels.js. Ze staan hier apart omdat dit bestand
// bewust geen imports heeft (zie de kopregel); een test bewaakt dat ze gelijk
// blijven aan wat labels.js werkelijk tekent.
export const SMAL_TITEL_MAX_MM = 15 - 2 * 1.75;
export const TITEL_KORPS_MM = 4.25;
export const TEKENBREEDTE_VET = 0.43;
export const TITEL_SPATIERING_MM = 0.09;

export function naamPastOpSmalLabel(titel) {
  // Wat er op het label komt is de AFKORTING, dus daar wordt op getoetst.
  const t = korteNaam(titel);
  if (!t) return true;
  const breed = t.length * TITEL_KORPS_MM * TEKENBREEDTE_VET
    + Math.max(0, t.length - 1) * TITEL_SPATIERING_MM;
  return breed <= SMAL_TITEL_MAX_MM;
}


// Restrisico's die op het label horen. §8: dit zijn INFORMATIELABELS, geen
// veiligheidstekens — een zwart-wit label voldoet niet aan NEN 3011 /
// NEN-EN-ISO 7010 (die vragen vorm én kleur). Daarom geen signaalwoord: "LET
// OP" hoort niet in de reeks GEVAAR / WAARSCHUWING / VOORZICHTIG van
// NEN-EN-ISO 3864-2 en is in rev3.0 vervallen. De regel benoemt het risico
// zelf, en dat is precies wat NEN 1010 712.514.101 voor pv vraagt: markering
// bij het voedingspunt, de meter of de verdeelinrichting.
// De regels zijn bewust als TWEE regels geschreven, met een harde
// regelovergang; automatisch afbreken gaf halve woorden op de tweede regel.
//
// MAXIMAAL 16 TEKENS PER REGEL. Op 30 mm is er 24 mm beschikbaar, en bij een
// korps van 3,58 mm met letterruimte past daar ongeveer 16 tekens op als je een
// millimeter speling wilt overhouden. Die speling is geen luxe: "Omvormer
// DC-zijde" en "aardlek B of A+DC" hielden er allebei 0,04 mm over, en dat is
// één lettertype-update van afkappen af.
//
// Het onderwerp mag weg waar het label het al zegt: op een pv-sticker staat
// "Zonnepanelen" er al boven, dus "Omvormer" hoeft niet in de risicoregel. Een
// test bewaakt de speling.
export function risicoRegelVoor(functie) {
  const n = String(functie || "").toLowerCase();
  if (/zonnepane|pv|omvormer/.test(n)) return "DC-zijde blijft\nonder spanning";
  if (/batterij|accu|opslag/.test(n)) return "Onder spanning\nna uitschakelen";
  if (/laadpaal|laadpunt/.test(n)) return "Eigen eindgroep\naardlek B/A+DC";
  return "";
}

// De gegevensregels schrijven zichzelf uit — er is geen veldnamenkolom, want
// 30 x 50 mm draagt die klasse niet (§4).
export function gegevensregels(positie, aardlekCodeTekst, fase, breedteMm) {
  const smal = toNum(breedteMm) === 15;
  const uit = [];
  const bev = formatBeveiliging(positie.karakteristiek, positie.In);

  // Op een VOL label is er 24 mm beschikbaar; bij 3,5 mm korps past dat op
  // ongeveer 19 tekens. "1 module" voluit haalt dat niet, "1M" wel — en "1M" is
  // bovendien de notatie die op de kast zelf gangbaar is.
  //
  // Op een SMAL label is er 11,5 mm, goed voor ongeveer 9 tekens. Daar vervalt
  // de modulebreedte helemaal: §5 zegt dat de BREEDTE het merkteken is, dus een
  // label van 15 mm zégt al dat het één module is. Hem er nogmaals bij zetten
  // kost precies de ruimte die de fase nodig heeft.
  // Op een SMAL label scheidt een spatie in plaats van " · ". Dat scheelt vier
  // tekens op de 11,5 mm die er is: "B16 · L1" hield 0,27 mm over, "B16 L1"
  // ruim 3 mm. De punt is daar een luxe die je een teken kost dat je nodig hebt.
  const eerste = [
    bev || null,
    isMeerpolig(positie) ? "L1+L2+L3" : (fase || null),
    smal ? null : `${positie.breedteModules}M`,
  ].filter(Boolean).join(smal ? " " : " · ");
  if (eerste) uit.push(eerste);

  if (aardlekCodeTekst) uit.push(smal ? String(aardlekCodeTekst) : `Aardlek ${aardlekCodeTekst}`);
  if (positie.type && !smal) uit.push(String(positie.type).slice(0, 16));
  return uit;
}

export function labelSelectie(verdeler, opties) {
  const o = opties || {};
  const posities = (verdeler && verdeler.posities) || [];
  const nrs = groepsnummers(posities);
  const datum = o.datum || "";
  const labels = [];
  let alIndex = 0;

  // Hoofdschakelaar (§4 uitzondering, §10 · 08-09): hoort bij geen groep en
  // heeft geen aardlek boven zich. Regel 1 draagt de STROOMSTERKTE, regel 2 de
  // POLEN en de MODULEBREEDTE; de plek van het grote cijfer blijft gelijk.
  for (const p of sorteerPosities(posities)) {
    if (p.soort !== "hoofdschakelaar") continue;
    const h = (verdeler && verdeler.hoofd) || {};
    const polen = toNum(p.polen) || (h.fasen === 3 ? 4 : 2);
    labels.push({
      soort: "hoofdschakelaar",
      sleutel: `hs-${p.id}`,
      breedteMm: 30,
      stroom: p.In ? `${p.In} A` : "",
      // Regel 2 draagt de polen en de modulebreedte (§4 uitzondering). "modules"
      // voluit maakt de regel 24 mm en duwt hem door de marge; "4M" is bovendien
      // de notatie die op de kast zelf gangbaar is.
      polen: `${polen}-polig · ${p.breedteModules}M`,
      // Geen titelregel: §4 kent de hoofdschakelaar alleen regel 1 en regel 2.
      titel: "",
      gegevens: [
        "Hoofdschakelaar",
        `${h.fasen === 3 ? "3" : "1"} × ${h.hoofdzekering || "—"} A`,
        p.type ? String(p.type).slice(0, 16) : (h.stelsel ? `Stelsel ${h.stelsel}` : null),
      ].filter(Boolean),
      datum,
    });
  }

  for (const blok of blokIndeling(posities)) {
    const groepen = blok.posities.filter((p) => isGroepsoort(p.soort));

    // EEN GROEP ZONDER AARDLEKSCHAKELAAR KRIJGT OOK EEN LABEL.
    //
    // Deze lus sloeg elk blok zonder aardlek over, inclusief de groepen erin.
    // In een stoppenkast is dat de héle kast — nul labels, terwijl het
    // groepenoverzicht ze wel netjes onder "zonder aardlekschakelaar" zette. En
    // ook in een moderne kast raakt een groep die rechtstreeks op de
    // hoofdschakelaar zit zo zijn sticker kwijt.
    //
    // Ze krijgen een apparaatsticker zonder A-code en zonder kleurband: er is
    // geen aardlek om naar te verwijzen, en een code suggereren die er niet is,
    // is erger dan hem weglaten.
    if (!blok.aardlek) {
      if (!groepen.length) continue;
      // Dezelfde stroken en stickers als hieronder, maar zonder A-code en
      // zonder kleurband: er is geen aardlek om naar te verwijzen, en een code
      // suggereren die er niet is, is erger dan hem weglaten.
      groepeerVoorStrook(groepen).forEach((rij, i) => {
        labels.push({
          soort: "strook",
          sleutel: `strook-los-${letter(i)}`,
          breedteMm: 30,
          aardlek: "",
          modules: rij.length === 1 ? toNum(rij[0].breedteModules) : 1,
          nummers: rij.map((p) => nrs.get(p.id)),
          regels: rij.map((p) => ({
            nr: nrs.get(p.id),
            naam: p.functie || p.standaardnaam || "",
            detail: [
              formatBeveiliging(p.karakteristiek, p.In) || null,
              isMeerpolig(p) ? "L1+L2+L3" : (p.fase || null),
            ].filter(Boolean).join(" · "),
          })),
          extra: rij.length === 1 && toNum(rij[0].breedteModules) >= 2
            ? `${rij[0].breedteModules}M · zonder aardlek`
            : "",
          datum,
        });
      });
      for (const p of groepen) {
        if (!p.functieEigen) continue;
        const risico = risicoRegelVoor(p.functie);
        const breedteMm = labelBreedteVoorModules(p.breedteModules, !!risico, p.functie);
        const fase = isMeerpolig(p) ? "L1+L2+L3" : p.fase;
        labels.push({
          soort: "apparaat",
          sleutel: `app-${p.id}`,
          breedteMm,
          groepsnummer: String(nrs.get(p.id) || ""),
          aardlek: "",
          titel: breedteMm <= 15 ? korteNaam(p.functie) : p.functie,
          pict: beeldmerkVoorFunctie(p.functie),
          risico,
          gegevens: gegevensregels(p, "", fase, breedteMm).slice(0, risico ? 1 : 3),
          datum,
        });
      }
      continue;
    }
    const a = blok.aardlek;
    alIndex += 1;
    const code = aardlekCode(alIndex);

    // Tag op de aardlekschakelaar (§10 · 20-22).
    labels.push({
      soort: "tag",
      sleutel: `tag-${code}-${a.id}`,
      breedteMm: 30,
      aardlek: code, bandKleur: a.kleur || "",
      ondertitel: [a.IAn ? `${a.IAn} mA` : null, a.aardlektype ? `type ${a.aardlektype}` : null]
        .filter(Boolean).join(" · "),
      titel: a.functieEigen ? a.functie : (a.standaardnaam || `RCD ${alIndex}`),
      gegevens: [
        beveiligtTekst(groepen.map((p) => nrs.get(p.id))),
        `${a.polen || 2}-polig · ${a.breedteModules}M`,
        a.type ? `${a.fabrikant ? a.fabrikant + " " : ""}${a.type}` : null,
      ].filter(Boolean),
      datum,
    });

    // Uitlijnstroken (§6, §10 · 10-13). Twee groepnummers per strook: het
    // hartteken op 15 mm ligt op de naad tussen twee automaten, de cijfers op
    // 6 en 24 mm staan boven het hart van elke module van 18 mm.
    //
    // Een groep van 2 of 4 modules heeft geen naad in het midden en krijgt
    // daarom een eigen strook met een enkel cijfer op het hart van het label.
    const rijen = groepeerVoorStrook(groepen);
    rijen.forEach((rij, i) => {
      labels.push({
        soort: "strook",
        sleutel: `strook-${code}-${letter(i)}`,
        breedteMm: 30,
        aardlek: code, bandKleur: a.kleur || "",
        modules: rij.length === 1 ? toNum(rij[0].breedteModules) : 1,
        nummers: rij.map((p) => nrs.get(p.id)),
        regels: rij.map((p) => ({
          nr: nrs.get(p.id),
          naam: p.functie || p.standaardnaam || "",
          detail: [
            formatBeveiliging(p.karakteristiek, p.In) || null,
            isMeerpolig(p) ? "L1+L2+L3" : (p.fase || null),
          ].filter(Boolean).join(" · "),
        })),
        extra: rij.length === 1 && toNum(rij[0].breedteModules) >= 2
          ? `${rij[0].breedteModules}M · aardlek ${code}`
          : "",
        datum,
      });
    });

    // Apparaatstickers (§10 · 01-07 en 40-44) — alleen waar de groep een eigen,
    // herkenbare naam heeft. Een sticker "Groep 4" naast de automaat die al 4
    // heet, voegt niets toe.
    for (const p of groepen) {
      if (!p.functieEigen) continue;
      const risico = risicoRegelVoor(p.functie);
      const breedteMm = labelBreedteVoorModules(p.breedteModules, !!risico, p.functie);
      const fase = isMeerpolig(p) ? "L1+L2+L3" : p.fase;
      labels.push({
        soort: "apparaat",
        sleutel: `app-${p.id}`,
        breedteMm,
        groepsnummer: String(nrs.get(p.id) || ""),
        aardlek: code, bandKleur: a.kleur || "",
        // Op een smal label de afkorting; op een vol label de naam voluit.
        titel: breedteMm <= 15 ? korteNaam(p.functie) : p.functie,
        pict: beeldmerkVoorFunctie(p.functie),
        risico,
        // Ritmeregel (§4): met risicoregel EEN gegevensregel, zonder DRIE.
        gegevens: gegevensregels(p, code, fase, breedteMm).slice(0, risico ? 1 : 3),
        datum,
      });
    }
  }
  return labels;
}

// Zet de groepen in rijen van twee, behalve waar een groep van 2 of 4 modules
// staat: die vult zijn strook alleen (§6 — breed toestel, geen hartteken).

export function beeldmerkVoorFunctie(functie) {
  const n = String(functie || "").toLowerCase();
  if (/zonnepane|pv|omvormer/.test(n)) return "pv";
  if (/laadpaal|laadpunt/.test(n)) return "laadpunt";
  if (/batterij|accu|opslag/.test(n)) return "accu";
  if (/kook|fornuis|kookplaat|oven/.test(n)) return "kookplaat";
  if (/kracht|cee|perilex/.test(n)) return "cee";
  if (/warmtepomp/.test(n)) return "warmtepomp";
  if (/airco|koeling/.test(n)) return "airco";
  return "";
}

// "groep 1 t/m 4" bij een aaneengesloten reeks, anders "groep 1, 3 en 7".

export function beveiligtTekst(nummers) {
  const nrs = (nummers || []).filter((n) => n > 0).sort((a, b) => a - b);
  if (!nrs.length) return "—";
  if (nrs.length === 1) return `groep ${nrs[0]}`;
  const aaneengesloten = nrs.every((n, i) => i === 0 || n === nrs[i - 1] + 1);
  if (aaneengesloten) return `groep ${nrs[0]} t/m ${nrs[nrs.length - 1]}`;
  return `groep ${nrs.slice(0, -1).join(", ")} en ${nrs[nrs.length - 1]}`;
}

export function letter(i) {
  return String.fromCharCode(97 + i);
}

export function groepeerVoorStrook(groepen) {
  const uit = [];
  let huidig = [];
  for (const p of groepen) {
    if (toNum(p.breedteModules) >= 2) {
      if (huidig.length) { uit.push(huidig); huidig = []; }
      uit.push([p]);
      continue;
    }
    huidig.push(p);
    if (huidig.length === 2) { uit.push(huidig); huidig = []; }
  }
  if (huidig.length) uit.push(huidig);
  return uit;
}

// Welk beeldmerk hoort bij een functienaam. Buiten de set: geen merk — een
// verzonnen pictogram is erger dan geen.
