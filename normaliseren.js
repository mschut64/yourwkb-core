// ─────────────────────────────────────────────────────────────────────────────
// Van ruwe modeluitvoer naar een kastbeeld waar je op kunt rekenen
//
// Wat er uit een beeldmodel komt is een voorstel, geen waarneming. Deze module
// maakt er iets van dat de app kan tonen: waarden binnen hun grenzen, soorten uit
// de bekende lijst, en — het belangrijkste — een zekerheidsdrempel, zodat een
// gok niet als feit in een veld belandt.
//
// ⚓ DE FOTO VULT IN, DE INSTALLATEUR BEVESTIGT. Alles wat hier uitkomt is
// aanvulbaar en corrigeerbaar in de app; niets wordt vastgezet. De herkomstvelden
// (`functieBron`, `naamBron`, `functieEigen`) en de zekerheid gaan daarom mee,
// zodat een scherm kan tonen wat voorgesteld is en wat bevestigd.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { FASEN } from "./fasen.js";
import {
  maakId, SOORTEN, KARAKTERISTIEKEN, AARDLEKTYPEN, parseBeveiliging,
  isGroepsoort, heeftKarakteristiek, groepsnummers, sorteerPosities,
} from "./toestellen.js";
import { pasVuistregelToe } from "./indeling.js";

// Zekerheidsdrempel. Onder deze waarde wordt een veld LEEG getoond met een
// invulmarkering — nooit grijs voorgevuld (spec › Interactie 2: "Bij twijfel
// leeg, niet grijs voorgevuld"). Een overtuigend ogende verkeerde B20 wordt
// weggeklikt zonder lezen en belandt in het rapport; een leeg veld dwingt tot
// kijken.
// "Hoge zekerheid" — de grens waarboven een aflezing als overtuigd geldt. Dit
// getal is een MEETGRENS voor de leerlus (`overtuigdFout`) en voor de
// onzekerheidsmarkering in de UI. Het is uitdrukkelijk GEEN invulgrens.
export const ZEKERHEIDSDREMPEL = 0.75;

// De grens waaronder we een aflezing helemaal niet overnemen.
//
// Deze stond er niet, en dat was een fout die pas live zichtbaar werd. De
// invulcontrole gebruikte ZEKERHEIDSDREMPEL (0,75), en omdat er sinds
// promptversie B nog maar ÉÉN zekerheidsgetal per positie is, wiste één getal
// onder die grens in één klap fabrikant, type, karakteristiek, In, IAn, polen
// én aardlektype — ook alles wat het model wél goed had gelezen. Een model dat
// keurig doet wat de prompt vraagt ("wees streng") strafte zichzelf zo af.
//
// De prompt zegt het zelf, twee keer: een veld dat niet te lezen is, LAAT het
// model WEG — weglaten is het signaal, niet het getal. Deze drempel is daarom
// alleen nog een vangnet voor het omgekeerde geval: velden ingevuld mét een
// expliciet lage zekerheid, tegen regel 1 in.
export const INVULDREMPEL = 0.35;

// De zekerheid van één veld, ongeacht in welke vorm het model haar leverde.
//
// Tot promptversie A was `zekerheid` een object met een getal per veld; sinds B
// is het ÉÉN getal voor de hele positie. Beide vormen komen nog voor — uit
// localStorage, uit een gedeeld bestand, uit een oud project — dus beide worden
// gelezen. Deze functie bestaat omdat het verschil twee keer in een scherm is
// misgegaan: daar stond `(p.zekerheid || {})[veld]`, wat bij een getal altijd
// undefined geeft. Eén keer wiste dat de bevestigingen bij "Bevestigen en
// verder", de andere keer maakte het `overtuigdFout` structureel nul — precies
// de twee metingen waar de leerlus op draait.
export function zekerheidVan(positie, veld) {
  const z = positie && positie.zekerheid;
  if (typeof z === "number") return z;
  return z && typeof z === "object" ? z[veld] : undefined;
}

export function zetStandaardnamen(posities) {
  const volgorde = sorteerPosities(posities);
  let nRcd = 0;
  const namen = new Map();
  // De standaardnaam MOET hetzelfde nummer dragen als het label en de
  // groepenverklaring. Deze functie telde zelf door, en zodra het nummer op de
  // plaat ging winnen liep dat uiteen: de sticker zei "Groep 1" en de naam in
  // het overzicht "Groep 2". Eén bron voor het nummer, dus.
  const nrs = groepsnummers(posities);
  for (const p of volgorde) {
    if (p.soort === "aardlek") namen.set(p.id, `RCD ${++nRcd}`);
    else if (isGroepsoort(p.soort)) namen.set(p.id, `Groep ${nrs.get(p.id)}`);
    else if (p.soort === "hoofdschakelaar") namen.set(p.id, "Hoofdschakelaar");
    else namen.set(p.id, "Overig");
  }
  return posities.map((p) => ({
    ...p,
    standaardnaam: namen.get(p.id) || "",
    // functieEigen blijft leidend: een eigen naam overleeft hernummering.
    //
    // En sinds de app een INSTALLATIESCHEMA kan lezen, geldt hetzelfde voor een
    // naam met een bron. Op een tekening staat de functie van een groep gedrukt
    // — "Koelkast+Vaatwasser" — en dat is een aflezing, geen voorstel van ons.
    // Zonder deze regel overschreef de standaardnaam hem meteen met "Groep 1"
    // en ging precies de informatie verloren waarvoor die tekening is ingelezen.
    functie: (p.functieEigen || p.functieBron) ? p.functie : (namen.get(p.id) || ""),
  }));
}

// Hoe ver is de bewoner? En vooral: welke groep is de VOLGENDE. Zonder dat
// laatste moet hij na elke groep zelf de lijst afzoeken naar wat er nog open
// staat, en dat is precies het werk dat je wilt wegnemen.
export function ontdekVoortgang(posities) {
  const groepen = sorteerPosities(posities).filter((p) => isGroepsoort(p.soort));
  const benoemd = groepen.filter((p) => p.functieEigen && String(p.functie || "").trim());
  const volgende = groepen.find((p) => !(p.functieEigen && String(p.functie || "").trim()));
  return {
    totaal: groepen.length,
    benoemd: benoemd.length,
    volgende: volgende || null,
    klaar: groepen.length > 0 && benoemd.length === groepen.length,
  };
}

export function normaliseerPositie(ruw, index) {
  // De analyse geeft ÉÉN zekerheid per positie. Een oudere vorm gaf een object
  // met een waarde per veld; die wordt hier nog gelezen zodat opgeslagen
  // analyses van vóór promptversie B niet stukgaan.
  const z = ruw && ruw.zekerheid;
  const perPositie = typeof z === "number" ? toNum(z) : NaN;
  // Let op de asymmetrie, en die is bewust. Eén getal voor de hele positie mag
  // niet even streng zijn als een getal per veld: bij de oude vorm kostte een
  // lage zekerheid op "fabrikant" alleen dat ene veld, bij de nieuwe kost hij
  // de hele positie. Vandaar de lagere INVULDREMPEL voor het positiegetal en de
  // ongewijzigde grens voor de veldvorm.
  const zeker = (veld) => {
    if (!isNaN(perPositie)) return perPositie >= INVULDREMPEL;
    // GEEN UITSPRAAK OVER ZEKERHEID IS GEEN LAGE ZEKERHEID.
    //
    // Dit wiste in het veld 16 van de 22 posities. `zekerheid` is optioneel in
    // het schema, en een positie die het veld helemaal niet meebracht viel hier
    // door naar de veldvorm, waar een ontbrekend getal 0 werd en dus onder elke
    // drempel viel. Alles wat het model op die positie gelezen had, ging weg.
    //
    // De prompt is er duidelijk over: een veld dat niet te lezen is, LAAT het
    // model WEG — weglaten is het signaal, niet het getal. Staat er een waarde
    // zonder dat er iets over de zekerheid gezegd is, dan is dat een aflezing.
    const perVeld = (z || {})[veld];
    if (perVeld === undefined || perVeld === null || perVeld === "") return true;
    return toNum(perVeld) >= ZEKERHEIDSDREMPEL;
  };
  const bev = parseBeveiliging(ruw.beveiliging || "");
  const soort = SOORTEN.includes(ruw.soort) ? ruw.soort : "automaat";
  const polen = [1, 2, 3, 4].includes(toNum(ruw.polen)) ? toNum(ruw.polen) : null;

  return {
    id: maakId("p", index + 1),
    verdelerId: String(ruw.verdelerId || "v1"),
    rail: toNum(ruw.rail) > 0 ? toNum(ruw.rail) : 1,
    positie: toNum(ruw.positie) >= 0 ? toNum(ruw.positie) : index,
    breedteModules: toNum(ruw.breedteModules) > 0 ? toNum(ruw.breedteModules) : 1,
    soort,
    fabrikant: zeker("fabrikant") ? String(ruw.fabrikant || "").slice(0, 30) : "",
    type: zeker("type") ? String(ruw.type || "").slice(0, 30) : "",
    karakteristiek:
      zeker("karakteristiek") && KARAKTERISTIEKEN.includes(bev.karakteristiek || ruw.karakteristiek)
        ? (bev.karakteristiek || ruw.karakteristiek)
        : "",
    In: zeker("In") && (bev.In || toNum(ruw.In)) > 0 ? (bev.In || toNum(ruw.In)) : null,
    IAn: zeker("IAn") && toNum(ruw.IAn) > 0 ? toNum(ruw.IAn) : null,
    polen: zeker("polen") ? polen : null,
    aardlektype:
      soort === "aardlek" || soort === "aardlekautomaat"
        ? (zeker("aardlektype") && AARDLEKTYPEN.includes(ruw.aardlektype) ? ruw.aardlektype : null)
        : null,
    zekerheid: typeof z === "number" ? z : (z || {}),
    aardlekId: null,
    fase: null,
    // De stiftaanduiding op de automaat — R5, AC, L1. Wordt de eerste suggestie
    // in het naamblad; dat is wat de installateur zelf al bedacht heeft.
    stift: String(ruw.stift || "").slice(0, 20),
    // De groepstekst die fysiek bij deze module stond. Geen zekerheidscontrole:
    // dit is een aflezing van wat er staat, en de regel is dat het model weglaat
    // wat het niet kan lezen.
    groepstekst: String(ruw.groepstekst || "").slice(0, 40),
    // De kabelaanduiding — "VD 3 × 2,5 mm²". Uit een KASTFOTO komt dit vrijwel
    // nooit: de aders verdwijnen achter de afdekplaat. Uit een INSTALLATIESCHEMA
    // komt het er wel uit, want daar staat het onder elke groepslijn gedrukt.
    // Vandaar dat het veld bestaat maar meestal leeg is.
    kabel: String(ruw.kabel || "").slice(0, 30),
    // Staat er alleen een cijfer bij de module, dan is dat het GROEPSNUMMER van
    // de plaat en geen naam. Dat nummer is leidend boven onze eigen telling —
    // zie groepsnummers().
    plaatnummer: (() => {
      const m = String(ruw.groepstekst || "").trim().match(/^(\d{1,2})$/);
      return m ? toNum(m[1]) : null;
    })(),
    functie: "",
    functieEigen: false,
    standaardnaam: "",
    toelichting: "",
  };
}

export function normaliseerAnalyse(ruw, verdelerId) {
  const lijst = Array.isArray(ruw && ruw.posities) ? ruw.posities : [];
  const posities = lijst.slice(0, 80).map((p, i) =>
    ({ ...normaliseerPositie(p, i), verdelerId: verdelerId || "v1" })
  );
  return zetStandaardnamen(pasVuistregelToe(posities));
}

// ─── EEN GESCAND INSTALLATIESCHEMA ────────────────────────────────────────────
//
// Een tekening leest anders dan een kast, en beter. Op een kastfoto moet het
// model raden wat groep 7 doet; op een schema staat het er gedrukt — mét het
// groepsnummer, de fase, de kabeldoorsnede en de vraag welke aardlek erboven
// hangt. Alles wat de app anders van de installateur moet vragen.
//
// Daarom is dit géén tweede analyse die naast de eerste staat: het resultaat
// krijgt precies dezelfde positievorm, zodat de strook, de labels, het
// paspoort en het groepenoverzicht er ongewijzigd op draaien.
//
// Drie dingen zijn hier anders dan bij een kastfoto:
//
//   1. DE BLOKINDELING IS GELEZEN, NIET GERADEN. Op een schema is de beugel
//      tussen aardlek en groepen getekend; daar valt niets aan af te leiden.
//      De vuistregel wordt dus overgeslagen — die zou een waarneming
//      overschrijven met een gok.
//   2. DE FUNCTIE IS BEKEND. Wat boven de lijn staat is de functie zoals de
//      installateur hem zelf heeft opgeschreven. Die gaat rechtstreeks in
//      `functie`, met `functieBron: "schema"` zodat de app kan tonen waar de
//      naam vandaan komt.
//   3. ER IS GEEN FYSIEKE PLEK. Een schema zegt niet op welke rail of op welke
//      moduleplaats iets zit. De volgorde van de tekening is de enige ordening
//      die we hebben, en die is goed genoeg voor de nummering.
export function normaliseerSchema(ruw, verdelerId) {
  const lijst = Array.isArray(ruw && ruw.posities) ? ruw.posities : [];
  const vId = verdelerId || "v1";

  const posities = lijst.slice(0, 120).map((g, i) => {
    const basis = normaliseerPositie({ ...g, rail: 1, positie: i, groepstekst: "" }, i);
    const functie = String(g.functie || "").trim().slice(0, 60);
    const nummer = toNum(g.nummer);
    return {
      ...basis,
      verdelerId: vId,
      functie,
      // Een naam die van de tekening komt is een AFLEZING, geen voorstel van
      // ons. functieEigen blijft false — de installateur heeft hem in deze app
      // nog niet bevestigd — maar de bron staat erbij.
      functieBron: functie ? "schema" : "",
      kabel: String(g.kabel || "").trim().slice(0, 30),
      fase: FASEN.includes(g.fase) ? g.fase : null,
      plaatnummer: nummer > 0 ? nummer : null,
      groepstekst: nummer > 0 ? String(nummer) : "",
    };
  });

  // De koppeling groep → aardlek komt uit het schema zelf. `aardlekIndex` telt
  // de aardlekschakelaars in de volgorde waarin ze in de lijst staan.
  const aardlekken = posities.filter((p) => p.soort === "aardlek");
  const gekoppeld = posities.map((p, i) => {
    if (!isGroepsoort(p.soort)) return p;
    if (p.soort === "aardlekautomaat") return { ...p, aardlekId: null };
    const idx = toNum(lijst[i] && lijst[i].aardlekIndex);
    const a = idx >= 0 ? aardlekken[idx] : null;
    return { ...p, aardlekId: a ? a.id : null };
  });

  return zetStandaardnamen(gekoppeld);
}
