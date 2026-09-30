// ─────────────────────────────────────────────────────────────────────────────
// De leerlus — hoe de app beter wordt van wat de installateur corrigeert
//
// Verhuisd uit Kastscan op 30-09-2026, ongewijzigd op twee punten na. De
// statistiek stond hier én in het correctielog, met de zekerheidsdrempel hier
// hardgecodeerd op 0,75 omdat dit bestand importvrij moest blijven; beide staan
// nu in leren.js. Verder is er niets aan veranderd: de catalogus, de
// pseudonimisering, wat er wel en niet gedeeld mag worden en de vrijgaveregel
// zijn precies zoals ze daar stonden.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { overtuigdFout, correctieStatistiek } from "./leren.js";

// Doorgeven: wie de leerlus gebruikt, gebruikt ook de statistiek erachter.
export { correctieStatistiek, overtuigdFout };

// Kastscan — de leerlus.
//
// Implementeert "Kastscan — feature-/ontwikkelprompt" › De leerlus. Dit bestand
// is de brug naar YourWkb: de kennis die hier ontstaat is niet Kastscan-eigen
// maar hoort bij het scannen van kasten, en YourWkb gebruikt hem in stap 6.
// Daarom staat hij, net als model.js, in PURE functies zonder imports.
//
// ─────────────────────────────────────────────────────────────────────────────
// DE KERNGEDACHTE
//
// De app leert niet vanzelf. Een promptbestand is een tekstbestand, het model
// onthoudt niets tussen twee aanroepen, en er is geen mechanisme dat een prompt
// bijstelt omdat er duizend foto's langs zijn gekomen. De leerlus moet gebouwd
// worden — maar het leersignaal ligt gratis in de flow.
//
// Elke keer dat de installateur een voorgevuld veld aanpast of bevestigt,
// ontstaat een gelabeld paar: modeluitkomst plus wat het werkelijk was.
//
// VIER MANIEREN OM DAT SIGNAAL OM TE ZETTEN, op afnemend rendement:
//   1. Materiaalcatalogus — verreweg het meeste effect. Data-leren, geen
//      model-leren; werkt al vanaf de eerste honderd installaties.
//   2. Promptaanpassing met een mens in de lus.
//   3. Voorbeelden in de prompt (few-shot). Selectief, en meet het effect.
//   4. Fine-tunen — voorlopig niet.
//
// Dit bestand bouwt (1) en levert de gegevens voor (2).
// ─────────────────────────────────────────────────────────────────────────────

// ─── MATERIAALCATALOGUS ───────────────────────────────────────────────────────
//
// Elke bevestigde aflezing verrijkt een tabel van merk en type naar
// karakteristiek, poolaantal, modulebreedte en aardlektype. De volgende scan
// hoeft dan niet meer te LEZEN wat er staat maar kan MATCHEN. Sneller,
// goedkoper en betrouwbaarder.

// Eén verkeerde aflezing mag de catalogus niet vergiftigen. Een waarde komt pas
// in de GEDEELDE catalogus na meerdere onafhankelijke bevestigingen door
// verschillende installateurs.
export const DREMPEL_BEVESTIGINGEN = 3;

// De velden die de catalogus per type onthoudt. Bewust beperkt tot wat op het
// toestel staat en niets over de woning zegt.
export const CATALOGUS_VELDEN = ["karakteristiek", "In", "IAn", "polen", "breedteModules", "aardlektype", "soort"];

export function materiaalSleutel(fabrikant, type) {
  const f = String(fabrikant || "").trim().toLowerCase();
  const t = String(type || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return "";
  return f ? `${f}|${t}` : `?|${t}`;
}

export function legeCatalogus() {
  return { versie: 1, items: {} };
}

// Neemt één bevestigde positie op in de catalogus. `installateur` is een
// pseudonieme sleutel — hij dient alleen om "onafhankelijke bevestigingen" te
// kunnen tellen, niet om iemand te identificeren.
export function catalogusLeer(catalogus, positie, installateur) {
  const sleutel = materiaalSleutel(positie && positie.fabrikant, positie && positie.type);
  if (!sleutel) return catalogus;

  const items = { ...(catalogus.items || {}) };
  const bestaand = items[sleutel] || { sleutel, velden: {}, betwist: {}, bronnen: [] };
  const velden = { ...bestaand.velden };
  const betwist = { ...bestaand.betwist };

  for (const veld of CATALOGUS_VELDEN) {
    const waarde = positie[veld];
    if (waarde === null || waarde === undefined || waarde === "") continue;
    const huidig = velden[veld];

    if (!huidig) {
      velden[veld] = { waarde, bevestigingen: 1, installateurs: [pseudoniem(installateur)] };
      continue;
    }
    if (String(huidig.waarde) === String(waarde)) {
      // Alleen ONAFHANKELIJKE bevestigingen tellen: dezelfde installateur die
      // tien kasten van hetzelfde merk doet, levert één stem.
      const p = pseudoniem(installateur);
      const lijst = huidig.installateurs || [];
      velden[veld] = {
        waarde: huidig.waarde,
        bevestigingen: lijst.includes(p) ? huidig.bevestigingen : huidig.bevestigingen + 1,
        installateurs: lijst.includes(p) ? lijst : [...lijst, p].slice(0, 50),
      };
      continue;
    }
    // Tegenstrijdige aflezing van hetzelfde type. De laatste OVERSCHRIJFT de
    // vorige niet; beide gaan naar een reviewrij en het veld blijft betwist,
    // zodat het niet opnieuw als waarheid binnenkomt.
    betwist[veld] = [...new Set([...(betwist[veld] || [huidig.waarde]), waarde].map(String))];
  }

  items[sleutel] = {
    sleutel,
    fabrikant: positie.fabrikant || bestaand.fabrikant || "",
    type: positie.type || bestaand.type || "",
    velden, betwist,
  };
  return { ...catalogus, items };
}

// Pseudonieme sleutel per installateur. Geen naam, geen e-mailadres: alleen een
// stabiele string die telt of twee bevestigingen van dezelfde persoon komen.
export function pseudoniem(installateur) {
  const s = String(installateur || "onbekend");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `i${Math.abs(h).toString(36)}`;
}

// Zoekt een type op. Geeft alleen velden terug die de drempel halen en niet
// betwist zijn — de rest is nog geen kennis.
export function catalogusZoek(catalogus, fabrikant, type, opties) {
  const o = opties || {};
  const drempel = o.drempel === undefined ? DREMPEL_BEVESTIGINGEN : o.drempel;
  const item = (catalogus.items || {})[materiaalSleutel(fabrikant, type)];
  if (!item) return null;
  const uit = {};
  let gevonden = 0;
  for (const [veld, v] of Object.entries(item.velden || {})) {
    if (item.betwist && item.betwist[veld]) continue;
    if (v.bevestigingen < drempel) continue;
    uit[veld] = v.waarde;
    gevonden += 1;
  }
  return gevonden ? { sleutel: item.sleutel, fabrikant: item.fabrikant, type: item.type, velden: uit } : null;
}

// Vult een positie aan uit de catalogus. LET OP: dit vult alleen velden die
// LEEG zijn. Een waarde die het model wél heeft gelezen wordt nooit door de
// catalogus overschreven — de foto van déze kast is altijd sterker bewijs dan
// een gemiddelde over andere kasten.
export function vulAanUitCatalogus(catalogus, positie) {
  const kennis = catalogusZoek(catalogus, positie.fabrikant, positie.type);
  if (!kennis) return { positie, aangevuld: [] };
  const nieuw = { ...positie };
  const aangevuld = [];
  // ALLEEN WITGELIJSTE VELDEN. Deze lus liep over Object.entries van de
  // catalogus en kopieerde dus élk veld dat erin stond. Een catalogus komt niet
  // altijd uit eigen huis — hij is bedoeld om tussen installateurs gedeeld te
  // worden — en een gedeeld bestand kon zo `functie` zetten. Die naam belandt
  // op een sticker op de kastdeur en in de groepenverklaring, een document
  // waar de installateur voor tekent. Aangetoond op 03-09-2026.
  //
  // `soort` staat wél in de lijst maar wordt hier overgeslagen: of iets een
  // aardlek of een automaat is bepaalt de blokindeling, en dat mag niet op een
  // gemiddelde over andere kasten leunen.
  for (const veld of CATALOGUS_VELDEN) {
    if (veld === "soort") continue;
    const waarde = (kennis.velden || {})[veld];
    if (waarde === null || waarde === undefined || waarde === "") continue;
    const leeg = nieuw[veld] === null || nieuw[veld] === undefined || nieuw[veld] === "";
    if (!leeg) continue;
    nieuw[veld] = waarde;
    aangevuld.push(veld);
  }
  return { positie: nieuw, aangevuld, bron: kennis.sleutel };
}

// ─── EEN BINNENGEKOMEN CATALOGUS SANEREN ──────────────────────────────────────
//
// De catalogus is bedoeld om GEDEELD te worden, dus een bestand komt per
// definitie van buiten. Tot 03-09-2026 ging een geïmporteerd bestand ongezien
// door `catalogusSamenvoegen` heen; YourWkb kreeg bij de beveiligingsaudit van
// 25-08 een `saneerProject` voor precies dit, en Kastscan nam wel `guard.js`
// over maar niet die sanering.
//
// Wat hier tegen beschermt:
//   • sleutels als "__proto__" of "constructor" — die zetten via obj[k] = v de
//     prototypeketen om in plaats van een gegeven op te slaan
//   • velden die hier niet horen — zie de witte lijst hierboven
//   • onbegrensde strings en aantallen: de catalogus gaat naar localStorage, en
//     een vol quotum maakt de app onbruikbaar zonder uitweg
const SLEUTEL_VERBODEN = new Set(["__proto__", "constructor", "prototype"]);
const MAX_ITEMS = 5000;
const MAX_TEKST = 120;
const MAX_INSTALLATEURS = 50;

function veiligeSleutel(k) {
  const s = String(k || "").slice(0, 120);
  return s && !SLEUTEL_VERBODEN.has(s) ? s : "";
}

function saneerWaarde(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  if (v === null || v === undefined) return null;
  return String(v).slice(0, MAX_TEKST);
}

export function saneerCatalogus(ruw) {
  const items = Object.create(null);
  const bron = (ruw && typeof ruw === "object" && ruw.items && typeof ruw.items === "object")
    ? ruw.items : {};
  let n = 0;
  for (const [sleutelRuw, itemRuw] of Object.entries(bron)) {
    if (n >= MAX_ITEMS) break;
    const sleutel = veiligeSleutel(sleutelRuw);
    if (!sleutel || !itemRuw || typeof itemRuw !== "object") continue;

    const velden = Object.create(null);
    for (const veld of CATALOGUS_VELDEN) {
      const h = (itemRuw.velden || {})[veld];
      if (!h || typeof h !== "object") continue;
      const waarde = saneerWaarde(h.waarde);
      if (waarde === null || waarde === "") continue;
      const inst = Array.isArray(h.installateurs)
        ? [...new Set(h.installateurs.map((x) => String(x).slice(0, 60)))].slice(0, MAX_INSTALLATEURS)
        : [];
      velden[veld] = {
        waarde,
        bevestigingen: Math.max(0, Math.min(9999, Math.round(Number(h.bevestigingen) || inst.length))),
        installateurs: inst,
      };
    }

    const betwist = Object.create(null);
    for (const veld of CATALOGUS_VELDEN) {
      const lijst = (itemRuw.betwist || {})[veld];
      if (!Array.isArray(lijst)) continue;
      const schoon = [...new Set(lijst.map((x) => String(x).slice(0, MAX_TEKST)))].slice(0, 20);
      if (schoon.length) betwist[veld] = schoon;
    }

    if (!Object.keys(velden).length && !Object.keys(betwist).length) continue;
    items[sleutel] = { sleutel, velden, betwist, bronnen: [] };
    n += 1;
  }
  return { versie: 1, items };
}

// Twee catalogi samenvoegen — de vorm die het delen tussen installateurs
// aanneemt, en waarmee de kennis naar YourWkb gaat.
export function catalogusSamenvoegen(a, b) {
  // Sleutels uit `b` kunnen van buiten komen; `obj[k] = v` met k = "__proto__"
  // zet de prototypeketen om in plaats van een gegeven op te slaan.
  const items = Object.assign(Object.create(null), a.items || {});
  for (const [sleutelRuw, item] of Object.entries(b.items || {})) {
    const sleutel = veiligeSleutel(sleutelRuw);
    if (!sleutel || !item || typeof item !== "object") continue;
    const bestaand = items[sleutel];
    if (!bestaand) { items[sleutel] = item; continue; }
    const velden = { ...bestaand.velden };
    const betwist = { ...bestaand.betwist };
    for (const [veld, v] of Object.entries(item.velden || {})) {
      const h = velden[veld];
      if (!h) { velden[veld] = v; continue; }
      if (String(h.waarde) === String(v.waarde)) {
        const samen = [...new Set([...(h.installateurs || []), ...(v.installateurs || [])])];
        velden[veld] = { waarde: h.waarde, bevestigingen: samen.length, installateurs: samen.slice(0, 50) };
      } else {
        betwist[veld] = [...new Set([...(betwist[veld] || []), String(h.waarde), String(v.waarde)])];
      }
    }
    for (const [veld, lijst] of Object.entries(item.betwist || {})) {
      betwist[veld] = [...new Set([...(betwist[veld] || []), ...lijst])];
    }
    items[sleutel] = { ...bestaand, velden, betwist };
  }
  return { versie: 1, items };
}

// Wat nog niet zeker genoeg is om te delen — de reviewrij.
export function reviewRij(catalogus) {
  const uit = [];
  for (const item of Object.values(catalogus.items || {})) {
    for (const [veld, waarden] of Object.entries(item.betwist || {})) {
      uit.push({ sleutel: item.sleutel, fabrikant: item.fabrikant, type: item.type, veld, waarden });
    }
  }
  return uit;
}

export function catalogusStatistiek(catalogus) {
  const items = Object.values(catalogus.items || {});
  let rijp = 0;
  let onrijp = 0;
  for (const item of items) {
    const velden = Object.values(item.velden || {});
    if (velden.some((v) => v.bevestigingen >= DREMPEL_BEVESTIGINGEN)) rijp += 1;
    else onrijp += 1;
  }
  return { typen: items.length, rijp, onrijp, betwist: reviewRij(catalogus).length };
}

// ─── WAT WEL EN NIET DE DEUR UIT GAAT ─────────────────────────────────────────
//
// De leerlus is GEDEELD tussen alle installateurs — daar zit het netwerkeffect:
// hoe meer gebruikers, hoe minder de app hoeft te lezen. Maar per soort data
// verschilt het antwoord, en dat verschil is hier code en geen belofte.
//
//   Materiaalcatalogus (merk → eigenschappen)  JA   bevat geen klantgegeven
//   Correctiestatistiek, geaggregeerd          JA   alleen tellingen
//   Gestandaardiseerde groepsnamen             JA   uit de eigen suggestielijst
//   Vrij ingetypte groepsnamen                 NEE  daar staat vroeg of laat
//                                                   "Achterhuis mevr. De Vries"
//   Foto's                                     NEE  opnames uit een woning:
//                                                   adressen, meternummers, en
//                                                   in de testset zelfs een
//                                                   routersticker met wachtwoord
//
// Hoe een naam is gekozen, bepaalt of hij mee mag. Daarom draagt elke positie
// een `naamBron`.
export const NAAMBRONNEN = ["standaard", "lijst", "oud", "stift", "vrij"];

export function naamMagGedeeld(naamBron) {
  return naamBron === "standaard" || naamBron === "lijst";
}

// Bouwt het pakket dat het toestel verlaat. Alles wat hier niet in staat, gaat
// niet mee — dat is de hele bedoeling van deze functie.
export function bouwLeerset(kast, catalogus, correcties, opties) {
  const o = opties || {};
  const namen = new Map();

  for (const verdeler of (kast && kast.verdelers) || []) {
    for (const p of verdeler.posities || []) {
      if (!naamMagGedeeld(p.naamBron)) continue;
      const n = String(p.functie || "").trim();
      if (!n) continue;
      namen.set(n, (namen.get(n) || 0) + 1);
    }
  }

  return {
    versie: 1,
    promptversie: o.promptversie || "",
    appversie: o.appversie || "",
    // Geen adres, geen postcode, geen foto's, geen vrij getypte namen.
    catalogus: { versie: 1, items: catalogus.items || {} },
    // Geaggregeerd: tellingen per veld, niet de onderliggende gevallen.
    correctiestatistiek: correctieStatistiek(correcties),
    gestandaardiseerdeNamen: [...namen.entries()].map(([naam, aantal]) => ({ naam, aantal })),
  };
}

// ─── DE NAUWKEURIGHEIDSMETER ──────────────────────────────────────────────────
//
// Het aantal correcties per foto is de nauwkeurigheidsmeter van het model in
// productie. Loopt dat op na een promptwijziging, dan is de wijziging fout —
// dezelfde regel als "geen normwijziging zonder verse testrun".
//
// GEEN PROMPTWIJZIGING LIVE ZONDER EEN VERSE RUN OVER DE REFERENTIESET. De
// correctiedata bepaalt WAT je verandert; de testrun bepaalt OF het mag.

export function vergelijkPromptversies(correcties) {
  const perVersie = new Map();
  for (const c of correcties || []) {
    const v = c.promptversie || "onbekend";
    if (!perVersie.has(v)) perVersie.set(v, []);
    perVersie.get(v).push(c);
  }
  return [...perVersie.entries()]
    .map(([promptversie, lijst]) => ({
      promptversie,
      ...correctieStatistiek(lijst),
    }))
    .sort((a, b) => String(a.promptversie).localeCompare(String(b.promptversie)));
}

// Oordeel over een promptwijziging. Bewust streng: gelijk blijven is geen
// verbetering, en een stijging is een reden om terug te draaien.
export function oordeelOverWijziging(vorige, nieuwe) {
  if (!vorige || !nieuwe || !vorige.totaal || !nieuwe.totaal) {
    return { niveau: "onbekend", tekst: "Nog te weinig gegevens om deze promptversie te beoordelen." };
  }
  const verschil = nieuwe.correctiegraad - vorige.correctiegraad;
  if (nieuwe.overtuigdFout > vorige.overtuigdFout) {
    return {
      niveau: "afwijking",
      tekst: `Meer gevallen van "overtuigd fout" (${nieuwe.overtuigdFout} tegen ${vorige.overtuigdFout}). Draai deze promptversie terug.`,
    };
  }
  if (verschil > 0.02) {
    return {
      niveau: "afwijking",
      tekst: `De correctiegraad steeg van ${Math.round(vorige.correctiegraad * 100)}% naar ${Math.round(nieuwe.correctiegraad * 100)}%. De wijziging is fout, hoe aannemelijk de redenering ook was.`,
    };
  }
  if (verschil < -0.02) {
    return {
      niveau: "ok",
      tekst: `De correctiegraad daalde van ${Math.round(vorige.correctiegraad * 100)}% naar ${Math.round(nieuwe.correctiegraad * 100)}%.`,
    };
  }
  return { niveau: "let-op", tekst: "De correctiegraad is niet meetbaar veranderd. Geen reden om de wijziging te houden." };
}

// ─── DE EXPERT-STEEKPROEF ─────────────────────────────────────────────────────
//
// De correctielus leert alleen van wat de installateur CORRIGEERT. Wat hij niet
// ziet, komt nooit in de data. In de kalibratieronde van 20-08 vond de AI vier
// constateringen en voegde Herman er negen toe; zonder zijn review was geen van
// die negen ooit als gemis zichtbaar geworden.
//
// Stuur je alleen op gebruiksdata, dan bevestigt het systeem zijn eigen blinde
// vlekken en wordt het meetbaar "beter" terwijl het dezelfde dingen blijft
// missen. Daarom weegt een gemis uit de expert-steekproef zwaarder dan duizend
// keer "installateur klikte akkoord": een akkoord is geen bevestiging dat er
// niets was, het betekent alleen dat niemand iets zag.
export const EXPERT_WEGING = 1000;

export function expertRonde({ datum, inspecteur, gevonden, gemist, ontkracht }) {
  return {
    datum: datum || "", inspecteur: inspecteur || "",
    gevonden: Number(gevonden) || 0,
    gemist: Number(gemist) || 0,
    ontkracht: Number(ontkracht) || 0,
  };
}

// Als de twee signalen elkaar tegenspreken, wint de expert.
export function gewogenScore(correctiestatistiek, expertrondes) {
  const rondes = expertrondes || [];
  const gemist = rondes.reduce((s, r) => s + r.gemist, 0);
  const gevonden = rondes.reduce((s, r) => s + r.gevonden, 0);
  const gebruik = correctiestatistiek ? correctiestatistiek.gecorrigeerd : 0;
  return {
    gebruikssignaal: gebruik,
    expertsignaal: gemist * EXPERT_WEGING,
    doorslaggevend: gemist > 0 ? "expert" : "gebruik",
    tekst: gemist > 0
      ? `De expert vond ${gemist} gemis(sen) die de gebruiksdata niet liet zien. Dat weegt zwaarder dan ${gebruik} correctie(s) uit het veld.`
      : `Geen gemissen in de laatste expertronde (${gevonden} constateringen bevestigd).`,
  };
}
