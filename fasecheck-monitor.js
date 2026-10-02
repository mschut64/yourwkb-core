// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — fasecheck-monitoring: van P1-telegram naar oordeel en advies
//
// Een oplevering is een momentopname; een fasecheck loopt een week door terwijl
// het kastje bij de klant staat. Dat verschil bepaalt alles hier: er komt data
// binnen die niemand ziet, dus moet de app zélf zeggen wanneer er iets aan de
// hand is — en wanneer er niets meer binnenkomt.
//
// ⚓ LOG VERMOGEN, GEEN STROOM. DSMR 5 geeft de stroom per fase als een GEHEEL
// getal zonder richting: 7 A en 7,4 A zijn niet te onderscheiden, en teruglevering
// ziet er hetzelfde uit als afname. Het vermogen per fase staat er wél in, in
// twee richtingen en met twee decimalen. Daarom rekenen we in kW en leiden we de
// stroom daaruit af, en niet omgekeerd.
//
// ⚓ DE ZWAARSTE VAN TWEE RICHTINGEN, NOOIT HUN SOM. Wat de PV levert en een groep
// tegelijk opneemt, loopt over de kam van de ene groep naar de andere en passeert
// de hoofdzekering nooit. (Besluit Martin, 12-09-2026 — dezelfde regel als in
// fasen.js, hier op gemeten waarden.)
//
// ⚓ EEN GEMETEN PIEK BEVAT DE GELIJKTIJDIGHEID AL. Op een meting gaat de factor
// 0,6 er dus niet nog eens overheen; die geldt alleen voor het apparaat dat er
// nog bij komt. Dat is waarom `faseBalans` een `meting` kent in plaats van dat
// deze module zelf aan het schatten gaat.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { FASEN } from "./fasen.js";

export { FASEN };

export const NET_SPANNING = 230;

// Wanneer heet een kastje offline? Een dongle stuurt elke paar seconden; een gat
// van een kwartier is geen hapering meer maar een probleem — stekker eruit,
// wifi weg, of de meterkast is dicht met de dongle erin. Ruim genomen, want een
// melding die te vaak komt wordt genegeerd en dan mist hij de echte keer.
export const STIL_LETOP_MS = 15 * 60 * 1000;
export const STIL_OFFLINE_MS = 2 * 60 * 60 * 1000;

// Bezetting van de hoofdzekering per fase. 80% is de grens waarboven het
// dashboard waarschuwt: daarboven is één extra apparaat genoeg om de zekering te
// laten komen, en dat gebeurt op het slechtste moment.
export const BEZET_LETOP = 0.6;
export const BEZET_ERNSTIG = 0.8;

// De vuistregel van Netbeheer Nederland, uit het onderzoek in het concept: meer
// dan 16 A verschil tussen de zwaarst en de lichtst belaste fase verdient
// aandacht, vanaf 20 A kunnen wijktransformatoren versneld slijten. Dat is geen
// NEN-norm en wordt in de app dus ook niet als norm gepresenteerd — het is de
// grens waarboven de installateur ernaar hoort te kijken.
export const ONBALANS_LETOP_A = 16;
export const ONBALANS_ERNSTIG_A = 20;

/** Stroom uit vermogen. Eén plek, want anders staat 230 straks op vijf plaatsen. */
export function ampereUitKw(kw) {
  const w = toNum(kw);
  if (!Number.isFinite(w)) return null;
  return (w * 1000) / NET_SPANNING;
}

/**
 * Eén telegram naar één meetpunt. De invoer is wat een P1-dongle doorgeeft; de
 * veldnamen van de bekende dongles (HomeWizard, Smartstuff) en de ruwe DSMR-
 * sleutels worden beide gelezen, want welk kastje er hangt is aan de installateur.
 *
 * Per fase komt er één getal uit: het zwaarste van afname en teruglevering, want
 * dat is wat de hoofdzekering voelt.
 */
export function telegramNaarMeting(t) {
  if (!t || typeof t !== "object") return null;
  // De eenheid hangt aan de VELDNAAM, niet aan de grootte van het getal. Een
  // eerdere opzet las "alles boven 100 is watt"; die las 100 W als 100 kW en
  // maakte van een rustig huis een industrieterrein. Een meeteenheid raden mag
  // niet — ook niet als het meestal goed gaat.
  const KW = "kw", W = "w";
  const velden = {
    L1: { af: [["l1kw", KW], ["L1kw", KW], ["active_power_l1_w", W], ["power_l1", W], ["1-0:21.7.0", KW]],
          op: [["l1kwTerug", KW], ["L1kwTerug", KW], ["active_power_returned_l1_w", W], ["1-0:22.7.0", KW]] },
    L2: { af: [["l2kw", KW], ["L2kw", KW], ["active_power_l2_w", W], ["power_l2", W], ["1-0:41.7.0", KW]],
          op: [["l2kwTerug", KW], ["L2kwTerug", KW], ["active_power_returned_l2_w", W], ["1-0:42.7.0", KW]] },
    L3: { af: [["l3kw", KW], ["L3kw", KW], ["active_power_l3_w", W], ["power_l3", W], ["1-0:61.7.0", KW]],
          op: [["l3kwTerug", KW], ["L3kwTerug", KW], ["active_power_returned_l3_w", W], ["1-0:62.7.0", KW]] },
  };
  const leesKw = (paren) => {
    for (const [naam, eenheid] of paren) {
      if (t[naam] === undefined || t[naam] === null || t[naam] === "") continue;
      const v = toNum(t[naam]);
      if (!Number.isFinite(v)) continue;
      return eenheid === W ? v / 1000 : v;
    }
    return NaN;
  };
  const tijd = t.tijd || t.timestamp || t.ts || null;
  const uit = { tijd: tijd ? new Date(tijd).toISOString() : new Date().toISOString(), fasen: {} };
  let gezien = 0;
  for (const f of FASEN) {
    const af = leesKw(velden[f].af);
    const op = leesKw(velden[f].op);
    if (!Number.isFinite(af) && !Number.isFinite(op)) { uit.fasen[f] = null; continue; }
    gezien++;
    // Een richting komt in DSMR als twee aparte velden, beide positief. Een
    // negatief getal uit een dongle die het anders doet gaat op de absolute
    // waarde mee: de hoofdzekering voelt geen teken.
    const afname = Number.isFinite(af) ? Math.abs(af) : 0;
    const terug = Number.isFinite(op) ? Math.abs(op) : 0;
    uit.fasen[f] = {
      kw: Math.max(afname, terug),
      afnameKw: afname,
      terugKw: terug,
      richting: terug > afname ? "terug" : "af",
      ampere: ampereUitKw(Math.max(afname, terug)),
    };
  }
  if (!gezien) return null;
  // Eenfasig is geen fout: dan staan L2 en L3 er niet, en dat moet zo blijven in
  // plaats van als nul meetellen in een gemiddelde.
  uit.fasenGezien = FASEN.filter((f) => uit.fasen[f]);
  return uit;
}

/**
 * De piek per fase over een reeks metingen, met het moment erbij. Dat moment is
 * wat de installateur nodig heeft: een piek om 19:40 is een auto die laadt, een
 * piek om 07:10 is een douche.
 */
export function piekPerFase(metingen) {
  const lijst = (Array.isArray(metingen) ? metingen : []).filter(Boolean);
  const uit = {};
  for (const f of FASEN) {
    let piek = null;
    for (const m of lijst) {
      const v = m.fasen && m.fasen[f];
      if (!v || !Number.isFinite(v.kw)) continue;
      if (!piek || v.kw > piek.kw) piek = { kw: v.kw, ampere: v.ampere, tijd: m.tijd, richting: v.richting };
    }
    uit[f] = piek;
  }
  return uit;
}

/** Hoe vol zit deze fase? `zekeringA` is de hoofdzekering per fase. */
export function bezetting(ampere, zekeringA) {
  const a = toNum(ampere), z = toNum(zekeringA);
  if (!Number.isFinite(a) || !(z > 0)) return null;
  const deel = a / z;
  return {
    ampere: a, zekeringA: z, deel,
    niveau: deel >= BEZET_ERNSTIG ? "ernstig" : deel >= BEZET_LETOP ? "let-op" : "ok",
  };
}

/**
 * De onbalans tussen de fasen, op de vuistregel van de netbeheerder.
 * Op een eenfasige aansluiting bestaat onbalans niet — dan is de uitkomst `null`
 * en niet "0 A, prima".
 */
export function onbalans(piek) {
  const rijen = FASEN.map((f) => ({ fase: f, ampere: piek && piek[f] ? piek[f].ampere : null }))
                     .filter((r) => Number.isFinite(r.ampere));
  if (rijen.length < 2) return null;
  const zwaarste = rijen.reduce((b, r) => (r.ampere > b.ampere ? r : b), rijen[0]);
  const lichtste = rijen.reduce((b, r) => (r.ampere < b.ampere ? r : b), rijen[0]);
  const verschil = zwaarste.ampere - lichtste.ampere;
  return {
    verschilA: verschil,
    zwaarste: zwaarste.fase, lichtste: lichtste.fase,
    niveau: verschil >= ONBALANS_ERNSTIG_A ? "ernstig" : verschil >= ONBALANS_LETOP_A ? "let-op" : "ok",
    // De bron hoort mee: dit is een vuistregel van de netbeheerder en geen
    // NEN-grens, en dat moet in de app ook zo staan.
    bron: "vuistregel Netbeheer Nederland",
  };
}

/**
 * De toestand van een kastje. Vier uitkomsten, en "offline" is er één van: een
 * kastje dat niets meer stuurt is het enige dat stil kan mislukken, en dus het
 * enige waar het dashboard uit zichzelf over moet piepen.
 */
export function dongleStatus(sessie, nu = new Date()) {
  const s = sessie || {};
  if (s.afgerondOp) return { status: "afgerond", stilMs: null, dag: null, toelichting: "Meting afgerond" };
  const laatste = s.laatsteTelegram ? new Date(s.laatsteTelegram) : null;
  const stil = laatste ? new Date(nu) - laatste : null;
  const start = s.startOp ? new Date(s.startOp) : null;
  const dag = start ? Math.floor((new Date(nu) - start) / 86400000) + 1 : null;
  const dagen = toNum(s.dagen) > 0 ? toNum(s.dagen) : 7;
  if (!laatste) return { status: "wacht", stilMs: null, dag, dagen, toelichting: "Nog geen telegram ontvangen" };
  if (stil >= STIL_OFFLINE_MS)
    return { status: "offline", stilMs: stil, dag, dagen, toelichting: `Laatste telegram ${stilLabel(stil)} geleden` };
  if (stil >= STIL_LETOP_MS)
    return { status: "hapert", stilMs: stil, dag, dagen, toelichting: `Even niets ontvangen (${stilLabel(stil)})` };
  return { status: "actief", stilMs: stil, dag, dagen, toelichting: `Laatste telegram ${stilLabel(stil)} geleden` };
}

function stilLabel(ms) {
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min`;
  return `${Math.round(m / 60)} u`;
}

/**
 * Het oordeel over één adres: de bezetting per fase, de onbalans en de toestand
 * van het kastje in één uitkomst, met het ergste bovenaan. Dat is wat de lijst in
 * het dashboard sorteert — niet de naam van de straat.
 */
export function monitorOordeel({ sessie, metingen, zekeringA } = {}, nu = new Date()) {
  const piek = piekPerFase(metingen);
  const z = toNum(zekeringA) || toNum(sessie && sessie.zekeringA);
  const fasen = FASEN.map((f) => ({
    fase: f,
    piek: piek[f] || null,
    bezet: piek[f] ? bezetting(piek[f].ampere, z) : null,
  })).filter((r) => r.piek);
  const ob = onbalans(piek);
  const dongle = dongleStatus(sessie, nu);
  const meldingen = [];
  for (const r of fasen) {
    if (r.bezet && r.bezet.niveau === "ernstig")
      meldingen.push({ niveau: "ernstig", tekst: `${r.fase} boven ${Math.round(BEZET_ERNSTIG * 100)} % van de zekering` });
    else if (r.bezet && r.bezet.niveau === "let-op")
      meldingen.push({ niveau: "let-op", tekst: `${r.fase} boven ${Math.round(BEZET_LETOP * 100)} % van de zekering` });
  }
  if (ob && ob.niveau !== "ok")
    meldingen.push({
      niveau: ob.niveau,
      tekst: `${Math.round(ob.verschilA)} A verschil tussen ${ob.zwaarste} en ${ob.lichtste} ` +
             `(${ob.bron}: aandacht vanaf ${ONBALANS_LETOP_A} A)`,
    });
  if (dongle.status === "offline")
    meldingen.push({ niveau: "ernstig", tekst: dongle.toelichting });
  else if (dongle.status === "hapert")
    meldingen.push({ niveau: "let-op", tekst: dongle.toelichting });

  const zwaarte = { ok: 0, "let-op": 1, ernstig: 2 };
  const niveau = meldingen.reduce((n, m) => (zwaarte[m.niveau] > zwaarte[n] ? m.niveau : n), "ok");
  return {
    fasen, onbalans: ob, dongle, meldingen, niveau,
    // Eén regel voor de lijst. "Aandacht" is het woord uit de mock-up; "offline"
    // gaat er vóór, want een kastje dat niets stuurt weet van niets.
    status: dongle.status === "afgerond" ? "Afgerond"
          : dongle.status === "offline" ? "Offline"
          : niveau === "ernstig" ? "Aandacht"
          : dongle.status === "wacht" ? "Wacht op data"
          : "Meting loopt",
  };
}

/**
 * Het herverdelingsadvies. Zegt wélke fase ruimte heeft en hoeveel — in ampère,
 * want dat is waarin een installateur over een groep denkt.
 *
 * Bewust geen "verplaats groep X": welke groep op welke fase hangt staat in het
 * kastbeeld, niet in de meting. De app zegt hoeveel er weg moet van welke fase
 * en waar het heen kan; wat er verplaatst wordt kiest de installateur.
 */
export function monitorAdvies(oordeel) {
  if (!oordeel || !Array.isArray(oordeel.fasen) || oordeel.fasen.length < 2) return null;
  const met = oordeel.fasen.filter((r) => r.bezet);
  if (met.length < 2) return null;
  const zwaarste = met.reduce((b, r) => (r.bezet.deel > b.bezet.deel ? r : b), met[0]);
  const lichtste = met.reduce((b, r) => (r.bezet.deel < b.bezet.deel ? r : b), met[0]);
  const z = zwaarste.bezet.zekeringA;
  if (zwaarste.bezet.niveau === "ok" && (!oordeel.onbalans || oordeel.onbalans.niveau === "ok")) {
    return { nodig: false, tekst: "De fasen liggen dicht bij elkaar en geen fase komt in de buurt van de zekering.", van: null, naar: null };
  }
  // Hoeveel moet er van de zwaarste fase af om onder de waarschuwingsgrens te
  // komen, en hoeveel past er op de lichtste zonder die daar overheen te duwen?
  const wegA = Math.max(0, zwaarste.bezet.ampere - BEZET_ERNSTIG * z);
  const ruimteA = Math.max(0, BEZET_ERNSTIG * z - lichtste.bezet.ampere);
  const verplaatsA = Math.min(wegA || ruimteA, ruimteA);
  return {
    nodig: true,
    van: zwaarste.fase, naar: lichtste.fase,
    wegA, ruimteA, verplaatsA,
    tekst: wegA > 0
      ? `Haal ongeveer ${Math.round(wegA)} A van ${zwaarste.fase}; op ${lichtste.fase} is ${Math.round(ruimteA)} A vrij.`
      : `${zwaarste.fase} en ${lichtste.fase} liggen ${Math.round((oordeel.onbalans || {}).verschilA || 0)} A uit elkaar; op ${lichtste.fase} is ${Math.round(ruimteA)} A vrij.`,
    // Wat er met een driefasig apparaat te doen valt staat erbij, want dat is de
    // andere helft van het antwoord: een laadpaal die per fase laadt lost het op
    // zonder dat er een groep verhuist.
    alternatief: "Een driefasige laadpaal of batterij kan de balans zelf regelen (laden per fase).",
  };
}

// ─── KOPPELEN OP DONGLE-ID PLUS SESSIECODE ───────────────────────────────────
//
// Uit het concept: koppeling op dongle-ID plus sessiecode via QR. Twee delen, en
// dat is met opzet: het dongle-ID staat op het kastje en is dus niet geheim, de
// sessiecode komt uit de app en hoort bij één adres en één periode. Zonder die
// tweede helft kan iemand die een ID afleest data in een vreemd dossier schrijven.
export const SESSIECODE_TEKENS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // zonder I, O, 0, 1

export function maakSessiecode(lengte = 6, rnd = Math.random) {
  let uit = "";
  for (let i = 0; i < lengte; i++) uit += SESSIECODE_TEKENS[Math.floor(rnd() * SESSIECODE_TEKENS.length)];
  return uit;
}

/**
 * Hoort dit telegram bij deze sessie? Geen "bijna goed": een verkeerde code is
 * een weigering, want anders schrijft het kastje van de buren in dit dossier.
 */
export function koppelControle({ dongleId, code }, sessie) {
  if (!sessie) return { ok: false, reden: "Onbekende sessie" };
  if (sessie.afgerondOp) return { ok: false, reden: "Deze meting is afgerond" };
  if (String(sessie.dongleId || "") !== String(dongleId || "")) return { ok: false, reden: "Dongle hoort niet bij deze sessie" };
  if (String(sessie.code || "").toUpperCase() !== String(code || "").toUpperCase())
    return { ok: false, reden: "Sessiecode klopt niet" };
  return { ok: true, reden: "" };
}
