// ─────────────────────────────────────────────────────────────────────────────
// De woordenschat van een module op een DIN-rail
//
// Wat er in een groepenkast hangt en hoe je het benoemt: soorten, karakteristieken,
// aardlektypen, aanspreekstromen, en de ordening van modules over rails en plaatsen.
//
// Deze taal komt uit Kastscan, waar zij is ontstaan bij het lezen van echte kasten.
// Zij staat hier omdat YourWkb haar nodig heeft zodra een kast ergens anders vandaan
// komt dan uit de handen van de installateur — uit een foto, of uit de materiaallijst
// van een meterkastpaspoort. `parseBeveiliging` is daarbij het scharnier: "B16" op een
// typeplaatje is een karakteristiek én een nominale stroom.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";

// "B16" → { karakteristiek:"B", In:16 }. Accepteert ook "b 16", "C32", "16A".
export function parseBeveiliging(s) {
  const t = String(s || "").toUpperCase().replace(/\s/g, "");
  // gG hoort erbij sinds een kast ook uit een meterkastpaspoort kan komen: op een
  // smeltpatroon staat "gG20" en niet "B20". Het verschil is niet cosmetisch —
  // bij gG komt Z_max uit een tijd-stroomkromme in plaats van uit factor × In,
  // en wie het als B leest, toetst aan een norm die daar niet geldt.
  const m = t.match(/^(GG|[BCD])?(\d{1,3})A?$/);
  if (!m) return { karakteristiek: "", In: null };
  return { karakteristiek: m[1] === "GG" ? "gG" : (m[1] || ""), In: parseInt(m[2], 10) };
}

export function formatBeveiliging(karakteristiek, In) {
  const a = toNum(In);
  if (isNaN(a)) return "";
  return `${karakteristiek || ""}${a}`;
}

export const KARAKTERISTIEKEN = ["B", "C", "D"];

export const AARDLEKTYPEN = ["AC", "A", "F", "B"];

// Gangbare aanspreekstromen in mA. 10 mA hoort bij een badkamergroep, 30 mA is
// de standaard voor eindgroepen, 100 en 300 mA komen voor als selectieve
// voorschakeling.
export const RCD_MA = [10, 30, 100, 300, 500];

// `smeltveiligheid` staat hier omdat de lijst hem miste, en dat bleek geen
// theoretisch gat. Bij een kalibratieronde op oude Nederlandse meterkasten
// (02-09-2026) las het model de kast prima — tien respectievelijk drie posities,
// keurig geteld, geen enkel verzonnen automaattype — maar er was geen soort om
// een STOP in te zetten. Alles belandde daarom in "overig", en "overig" telt in
// deze app niet als groep. Uitkomst: een geslaagde scan die nul groepen
// oplevert, dus geen nummering, geen labels en een leeg meterkastpaspoort.
//
// Juist de oudere woning is waar een meterkastpaspoort iets toevoegt, dus dit
// gat zat precies in de verkeerde helft van de markt.
export const SOORTEN = ["aardlek", "automaat", "aardlekautomaat", "smeltveiligheid", "hoofdschakelaar", "overig"];

export function maakId(prefix, n) {
  return `${prefix}${String(n).padStart(2, "0")}`;
}

export function isGroepsoort(soort) {
  return soort === "automaat" || soort === "aardlekautomaat" || soort === "smeltveiligheid";
}

// Een smeltveiligheid heeft GEEN karakteristiek. B, C en D beschrijven de
// uitschakelkromme van een installatieautomaat; een smeltpatroon heeft die
// niet. Een leeg karakteristiekveld bij een stop is dus geen ontbrekende
// aflezing maar de juiste weergave — en het hoort dus ook niet als "niet
// leesbaar" geteld te worden.
export function heeftKarakteristiek(soort) {
  return soort === "automaat" || soort === "aardlekautomaat";
}

// Meerpolige componenten (kookgroep, hoofdschakelaar) staan vast op L1+L2+L3;
// tikken doet niets dan dat bevestigen.
export function isMeerpolig(positie) {
  return toNum(positie && positie.polen) >= 3;
}

export function sorteerPosities(posities) {
  return [...(posities || [])].sort(
    (a, b) => (a.rail - b.rail) || (a.positie - b.positie)
  );
}

// Het groepsnummer zoals het op het label en in de groepenverklaring komt.
// Volgt de fysieke volgorde, telt alleen groepsposities mee.
// HET NUMMER OP DE PLAAT WINT VAN ONZE TELLING.
//
// Wij nummerden altijd op fysieke volgorde: eerste groep is 1, tweede is 2. Dat
// klopt vaak, maar niet altijd — en waar het niet klopt, drukken we een sticker
// die de kast tegenspreekt waar hij naast komt te hangen.
//
// Gevonden op een echte woningkast (03-09-2026): de fornuisgroep stond helemaal
// links en droeg géén nummer op de plaat; de nummering 1, 2, 3 begon pas bij de
// module daarna. Onze telling maakte de fornuisgroep tot "Groep 1" en schoof
// daarmee de hele kast één op. Elk label, de hele groepenverklaring en het
// meterkastpaspoort stonden dan één verkeerd ten opzichte van de kast zelf.
//
// Staat er dus een nummer op de plaat, dan is dat hét nummer. Groepen zonder
// nummer krijgen het eerstvolgende dat nog vrij is. De volgorde van de Map
// blijft de fysieke volgorde, want daar rekent de rest van de app op.
export function groepsnummers(posities) {
  const volgorde = sorteerPosities(posities).filter((p) => isGroepsoort(p.soort));
  const toegekend = new Map();
  const bezet = new Set();

  for (const p of volgorde) {
    const n = toNum(p.plaatnummer);
    if (n > 0 && n < 100 && !bezet.has(n)) { toegekend.set(p.id, n); bezet.add(n); }
  }
  let n = 1;
  for (const p of volgorde) {
    if (toegekend.has(p.id)) continue;
    while (bezet.has(n)) n += 1;
    toegekend.set(p.id, n);
    bezet.add(n);
  }

  const uit = new Map();
  for (const p of volgorde) uit.set(p.id, toegekend.get(p.id));
  return uit;
}

// De naam van een groep naar het paspoorttype (spec v0.2 §4.4). Beide apps
// hebben dit nodig: Kastscan om een gelezen groep in het paspoort te zetten,
// YourWkb om een gescand paspoort terug te vertalen naar zijn eigen eindgroepen.
// Eén tabel, want twee tabellen die hetzelfde bedoelen lopen uiteen.
export function mkpType(functie) {
  const n = String(functie || "").toLowerCase();
  if (/kook|fornuis|oven/.test(n)) return "kook";
  if (/zonnepane|pv/.test(n)) return "pv";
  if (/batterij|accu/.test(n)) return "bat";
  if (/laadpaal|laadpunt/.test(n)) return "lp";
  if (/warmtepomp|airco/.test(n)) return "wp";
  if (/kracht/.test(n)) return "ov";
  return "alg";
}

// ─── DE MATERIAALLIJST ────────────────────────────────────────────────────────
//
// Van modules op een rail naar "3× Hager MCN116". Dezelfde lijst die `mat[]` in
// het meterkastpaspoort draagt (spec v0.2 §4.5) en die een opleverrapport als
// materiaalstaat toont.
//
// ⚓ EEN KAST DIE GELEZEN IS, IS ÓÓK EEN MATERIAALLIJST. Dat lijkt vanzelfsprekend
// en werd het niet: de fotostap vulde wel de groepen maar niet het materiaal,
// terwijl merk en typeaanduiding al op de posities stonden. Hetzelfde geldt voor
// een gescand paspoort — daar staat `mat[]` letterlijk in, en dan hoeft er niets
// meer ingetikt of gefotografeerd te worden.
//
// Wat NIET gebeurt: een toestel waarvan het merk of het type niet gelezen is,
// wordt niet onder "Anders" geschoven of bij een ander merk geteld. Het telt
// apart, zodat het scherm kan zeggen hoeveel er nog met de hand bij moeten.
export function materiaalUitPosities(posities) {
  const lijst = [];
  const index = new Map();
  let zonderMerk = 0;

  for (const p of sorteerPosities(Array.isArray(posities) ? posities : [])) {
    const fabrikant = String(p.fabrikant || "").trim();
    const type = String(p.type || "").trim();
    if (!type) { zonderMerk++; continue; }
    const sleutel = `${fabrikant.toLowerCase()}|${type.toLowerCase()}`;
    if (index.has(sleutel)) { index.get(sleutel).aantal += 1; continue; }
    const regel = { fabrikant, type, soort: p.soort || "overig", aantal: 1 };
    index.set(sleutel, regel);
    lijst.push(regel);
  }
  return { lijst, zonderMerk };
}
