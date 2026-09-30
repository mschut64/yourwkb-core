// ─────────────────────────────────────────────────────────────────────────────
// Fasebalans — de belasting per fase, met capaciteit, reserve en oordeel
//
// Kernregel: fasecompensatie is boekhouding, stroom is fysiek. De slimme meter
// saldeert over drie fasen, de hoofdzekering niet. Drie groepen die toevallig
// allemaal op L2 zitten kunnen die fase overbelasten terwijl de meter netjes
// binnen de grenzen lijkt te blijven. Dus PER FASE rekenen.
//
// De boekhouding zelf is uit Kastscan (components/kastscan/model.js › faseBalans)
// overgenomen, waar zij is gebouwd en met tests vastgelegd. Twee dingen bewust
// anders gedaan, en precies daarom kan deze motor door beide apps gebruikt
// worden:
//
//   1. De invoer is de `grp[]` uit het meterkastpaspoort, niet het interne
//      datamodel van één app. Kastscan denkt in modules op een DIN-rail, YourWkb
//      in aardlekgroepen met eindgroepen — maar béíde bouwen een paspoort, en
//      daarin staat precies wat een fasebalans nodig heeft: type, rol, vermogen
//      en fasenummers. Daarmee is deze module deelbaar zonder vertaallaag, en
//      sluit hij naadloos aan op een P1-meting, die dezelfde vraag beantwoordt
//      met gemeten waarden.
//
//   2. Groepen met een ONBEKENDE fase worden apart geteld én opgeteld in kW, niet
//      stilzwijgend overgeslagen. Anders lijkt een kast waarvan de helft niet is
//      toegewezen ten onrechte licht belast. Dat getal is bovendien precies wat
//      de installateur motiveert om de aardlek-proef te doen.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { GELIJKTIJDIGHEID } from "./vermogen.js";
import { FASEN, FASE_RESERVE_KW, faseCapaciteitKw, belastingPerFase } from "./fasen.js";

export { FASEN };

// De normvraag "telt teruglevering mee als belasting?" is op 12-09-2026 door
// Martin beslist: ja, maar hij telt niet óp bij de afname. Zie de toelichting
// bij belastingPerFase in fasen.js — de regel zelf staat daar, want daar wordt
// hij toegepast.

/**
 * @param grp     groepen in paspoortvorm (spec v0.2 §4.4)
 * @param ha      hoofdaansluiting { f, a }
 * @param lbAan   gezamenlijke load balancing aanwezig
 * @param meting  optioneel { L1, L2, L3, bron, label } — gemeten piek in kW
 */
export function faseBalans({ grp, ha, lbAan, meting } = {}) {
  const ampere = toNum(ha && ha.a);
  if (!(ampere > 0)) return null;

  const capaciteit = faseCapaciteitKw(ha); // per fase
  // De optelling per fase staat in fasen.js, zodat de belastingcheck en deze
  // balans met dezelfde getallen werken. Wat hier bovenop komt is de capaciteit,
  // de reserve, het oordeel en het advies.
  const pf = belastingPerFase(grp, ha, lbAan);
  const gemeten = meting && FASEN.some((f) => toNum(meting[f]) > 0);

  const rijen = pf.fasen.map((f) => {
    // Bij een GEMETEN basisbelasting gaat de gelijktijdigheidsfactor er niet
    // overheen: wat de meter zag liep werkelijk tegelijk, dus de gelijktijdigheid
    // zit er al in. Hem er nogmaals overheen leggen strijkt 40% van een echte
    // meting weg — de verkeerde kant op voor een conservatieve toets.
    const belasting = gemeten ? toNum(meting[f]) : pf.belasting[f];
    const bezet = capaciteit > 0 ? belasting / capaciteit : 0;
    return {
      fase: f,
      capaciteitKw: capaciteit,
      belastingKw: belasting,
      // De reserve gaat van de vrije ruimte af, niet bij de belasting op: een
      // week in september zegt niets over januari met een warmtepomp.
      vrijKw: capaciteit - belasting - FASE_RESERVE_KW,
      bezet,
      niveau: bezet > 1 ? "afwijking" : bezet > 0.7 ? "let-op" : "ok",
      aantal: pf.aantal[f],
      groot: pf.groot[f],
      gewoon: pf.gewoon[f],
      // Welke van de twee richtingen deze fase bepaalt. Zonder dit staat er
      // "5,0 van 5,8 kW" bij een huis dat op dat moment niets verbruikt, en
      // zoekt de installateur zich suf naar de verbruiker die er niet is.
      voeding: pf.voeding[f],
      afnameKw: pf.afname[f],
      richting: gemeten ? "af" : pf.richting[f],
    };
  });

  const zwaarte = { ok: 0, "let-op": 1, afwijking: 2 };
  const ergste = rijen.reduce((b, r) => (zwaarte[r.niveau] > zwaarte[b.niveau] ? r : b), rijen[0]);
  const beste = rijen.reduce((b, r) => (r.vrijKw > b.vrijKw ? r : b), rijen[0]);

  return {
    rijen,
    bron: gemeten ? "gemeten" : "geschat",
    label: gemeten && meting.label ? meting.label : "indicatie o.b.v. schatting",
    factor: gemeten ? 1 : pf.factor,
    sturing: lbAan === true,
    // Hoeveel er NIET is toegerekend omdat de fase onbekend is. Zolang dit boven
    // nul staat is de balans onvolledig, en dat moet zichtbaar zijn in plaats van
    // verstopt in een te gunstige uitkomst.
    onbekendKw: pf.onbekendKw,
    onbekendAantal: pf.onbekendAantal,
    volledig: pf.onbekendAantal === 0,
    niveau: ergste ? ergste.niveau : "ok",
    besteFase: beste ? beste.fase : "L1",
  };
}

// ─── WAAR KAN HET NIEUWE APPARAAT HET BESTE BIJ? ─────────────────────────────
//
// De fasebalans zegt hoe de kast er NU voor staat. Dit zegt wat er gebeurt als
// je er een laadpaal, warmtepomp, batterij of omvormer bij hangt — per fase,
// vóór de installatie begint. Dat is de vraag waar de hele Fasecheck voor
// bestaat: niet "past het ergens", maar "waar".
//
// De gelijktijdigheidsfactor geldt hier WEL voor het nieuwe apparaat, ook als de
// basis gemeten is. Een gemeten piek bevat de gelijktijdigheid van wat er tóén
// hing; het apparaat dat er nu bij komt zat niet in die meting en moet dus zelf
// nog gewogen worden. Met gezamenlijke sturing vervalt de korting, net als
// overal elders.
//
// Een driefaseapparaat verdeelt zich over alle drie de fasen. Daar valt dus
// niets te kiezen, en dat zegt de uitkomst ook: `driefase: true` en geen
// besteFase. Een advies geven waar geen keuze is, is misleidend.
/**
 * @param balans  uitkomst van faseBalans
 * @param kw      vermogen van het nieuwe apparaat
 * @param fasen   1 of 3
 * @param groot   telt het als grote verbruiker (laadpaal, warmtepomp, kookgroep, batterij)
 */
export function faseAdvies(balans, { kw, fasen = 1, groot = true } = {}) {
  if (!balans || !Array.isArray(balans.rijen) || !balans.rijen.length) return null;
  const vermogen = toNum(kw);
  if (!(vermogen > 0)) return null;

  const factor = groot ? (balans.sturing ? 1 : GELIJKTIJDIGHEID) : 1;
  const erbijKw = vermogen * factor;
  // Op een eenfasige aansluiting valt er niets te verdelen: alles hangt aan
  // dezelfde fase. Dan is de vraag niet "waar", maar alleen "past het". Een
  // "beste fase" noemen waar er maar één is, is een advies zonder inhoud.
  const enkelfase = balans.rijen.length === 1;
  // Driefasig kan alleen op een aansluiting die drie fasen heeft.
  const driefase = toNum(fasen) === 3 && balans.rijen.length === 3;
  // Een driefaseapparaat op een eenfasige aansluiting is geen verdelingsvraag
  // maar een onmogelijkheid; dat hoort als zodanig terug te komen.
  const onmogelijk = toNum(fasen) === 3 && enkelfase;

  const opties = balans.rijen.map((r) => {
    const extra = driefase ? erbijKw / 3 : erbijKw;
    const naKw = r.belastingKw + extra;
    const bezetNa = r.capaciteitKw > 0 ? naKw / r.capaciteitKw : 0;
    return {
      fase: r.fase,
      erbijKw: extra,
      naKw,
      vrijNaKw: r.capaciteitKw - naKw - FASE_RESERVE_KW,
      bezetNa,
      niveauNa: bezetNa > 1 ? "afwijking" : bezetNa > 0.7 ? "let-op" : "ok",
    };
  });

  if (onmogelijk) return {
    opties, driefase: false, enkelfase: true, onmogelijk: true, besteFase: null,
    erbijKw, factor, past: false, krap: false,
  };

  if (driefase) {
    const ergste = opties.reduce((b, o) => (o.bezetNa > b.bezetNa ? o : b), opties[0]);
    return {
      opties, driefase: true, enkelfase: false, onmogelijk: false, besteFase: null,
      erbijKw, factor,
      past: ergste.niveauNa !== "afwijking",
      krap: ergste.niveauNa === "let-op",
    };
  }

  // Eénfasig apparaat: de fase waar ná plaatsing de meeste ruimte overblijft —
  // tenzij de aansluiting er maar één heeft, want dan is er niets te kiezen.
  const beste = opties.reduce((b, o) => (o.vrijNaKw > b.vrijNaKw ? o : b), opties[0]);
  return {
    opties, driefase: false, enkelfase, onmogelijk: false,
    besteFase: enkelfase ? null : beste.fase,
    erbijKw, factor,
    past: beste.niveauNa !== "afwijking",
    krap: beste.niveauNa === "let-op",
  };
}
