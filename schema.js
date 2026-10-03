// Kastscan — installatieschema (eendraadschema).
// ⚠️ VERHUISD UIT KASTSCAN op 03-10-2026. Alleen de imports zijn omgezet: wat
// eerst uit Kastscans eigen model.js kwam, komt nu uit de motor zelf — het zijn
// dezelfde functies, die daar al heen verhuisd waren.
//
// Van dezelfde kastgegevens waarmee de labels en het groepenoverzicht worden
// gemaakt, tekent dit bestand het INSTALLATIESCHEMA: één lijn per groep, met de
// beveiligingen als symbolen ertussen. Hetzelfde document dat een installateur
// met de hand in Visio of AutoCAD maakt en dat bij oplevering in de meterkast
// hoort.
//
// ─── WAAROM DIT ER IS ────────────────────────────────────────────────────────
//
// Het schema is de ENIGE plek waar de installatie als samenhangend geheel staat.
// Een labelstrook zegt wat groep 7 doet; het schema zegt dat groep 7 achter
// aardlek 2 hangt, op L1, met 3 × 2,5 mm² naar de keuken. Bij een verbouwing,
// een storing of een uitbreiding is dat het eerste wat iemand zoekt en het
// laatste wat er ligt.
//
// En het werkt twee kanten op: `schema.js` tekent er een, en de analyseroute
// kan er een LEZEN (modus "schema"). Een getekend schema is voor het model
// vriendelijker dan een foto van een kast — de groepsnummers staan er gedrukt,
// de fasen staan erbij, de functie staat uitgeschreven en de kabeldoorsnede
// ook. Wie een schema heeft, heeft dus in één scan een vollediger kast dan
// welke foto dan ook kan opleveren.
//
// ─── ONTWERPREGELS ───────────────────────────────────────────────────────────
//
// 1. MILLIMETERS, GEEN PIXELS. Net als bij de labels (labels.js) is de uitvoer
//    een declaratieve tekenlijst in mm. De SVG krijgt een viewBox in dezelfde
//    maat, dus hetzelfde ontwerp schaalt zonder herberekening naar een telefoon,
//    een laptop en een vel A4-liggend.
//
// 2. DE SYMBOLENSET IS DIE VAN HET VAK, niet een eigen vinding. IEC 60617 /
//    NEN-EN-IEC 60617 zoals die in Nederlandse eendraadschema's wordt gebruikt:
//    het schakelteken is een schuine streep vanaf het vaste contact, en wat er
//    bij staat maakt er een automaat, een aardlek of een scheider van. Zie
//    SYMBOLEN hieronder; elk teken staat daar met zijn herkomst.
//
// 3. DE MAATVOERING IS AFLEESBAAR, ook als het schema een halve meter breed
//    wordt. De aanduiding staat horizontaal onder het teken en niet gedraaid
//    langs de lijn. Dat is de enige bewuste afwijking van het handgetekende
//    voorbeeld, waar ruimtegebrek de tekst verticaal dwong; de TEKENS zijn
//    gelijk gehouden.

import { toNum, komma } from "./getallen.js";
import { groepsnummers, isGroepsoort, sorteerPosities, formatBeveiliging } from "./toestellen.js";
import { blokIndeling } from "./indeling.js";
import { aardlekCode } from "./vormtaal.js";

// ─── MAATVOERING ──────────────────────────────────────────────────────────────
//
// Alle maten in millimeters. De x-kolommen liggen vast zodat elke groep, in elk
// blok en in elke verdeler, precies onder elkaar staat — dat is wat een schema
// leesbaar maakt.
export const MAAT = {
  marge: 10,

  // Hart-op-hart tussen twee groepen. 9 mm geeft ruimte voor een functieregel
  // boven de lijn (2,6 mm) en een kabelaanduiding eronder (2,2 mm) zonder dat
  // ze elkaar raken.
  rij: 9,
  // Lucht tussen twee aardlekblokken, zodat de beugels los van elkaar staan.
  blokLucht: 5,

  xVoeding: 16,
  xMeter: 36,
  xHoofd: 58,
  xRail: 72,
  xAardlek: 88,
  xBeugel: 104,
  xNummer: 108,
  xGroep: 128,
  xLijnEind: 286,

  // De tekstregels langs de groepslijn.
  functieBoven: 1.5,
  kabelOnder: 3.4,

  korpsKlein: 2.2,
  korpsTekst: 2.6,
  korpsKop: 4.2,
  korpsTitel: 5.2,

  lijnDun: 0.25,
  lijnDik: 0.45,
};

// ─── DE SYMBOLEN ──────────────────────────────────────────────────────────────
//
// Elk teken is opgebouwd uit primitieven (lijn, cirkel, rechthoek, pad) zodat er
// geen lettertype of afbeelding aan te pas komt: het schema drukt scherp af op
// elke printer en schaalt zonder verlies.
//
// Het gedeelde grondvorm is het SCHAKELTEKEN: de geleider komt horizontaal aan,
// wordt onderbroken, en het beweegbare contact staat als schuine streep open.
// Wat er vervolgens bij komt te staan, bepaalt wát voor schakelaar het is:
//
//   automaat            + thermische uitschakeling (het haakje)
//   aardlekschakelaar   + ΔI (de som-stroommeting)
//   aardlekautomaat     + beide  — vandaar dat hij zichzelf beveiligt
//   scheider / hoofd    + het dwarsstreepje aan het vrije contact
//   smeltveiligheid     geen schakelteken maar het patroonrechthoekje
export const SYMBOLEN = ["automaat", "aardlek", "aardlekautomaat", "smeltveiligheid", "hoofdschakelaar", "scheider"];

const CONTACT_HALF = 2.6;   // halve onderbreking van de geleider
const CONTACT_HOOG = 3.8;   // hoogte van het open contact

// Het schakelteken zelf: vast contact links, beweegbaar contact schuin omhoog.
function schakelteken(x, y) {
  return [
    { t: "cirkel", cx: x - CONTACT_HALF, cy: y, r: 0.45, vul: true },
    { t: "lijn", x1: x - CONTACT_HALF, y1: y, x2: x + CONTACT_HALF - 0.4, y2: y - CONTACT_HOOG, dik: MAAT.lijnDik },
  ];
}

// De thermische uitschakeling — het haakje. In IEC 60617 het teken voor een
// thermisch bekrachtigd relais; in het eendraadschema is het precies wat een
// automaat van een gewone schakelaar onderscheidt.
function haakje(x, y) {
  const hx = x - CONTACT_HALF - 1.6;
  const hy = y - 1.4;
  return [{ t: "pad", d: `M ${hx} ${hy + 1.4} L ${hx} ${hy} L ${hx + 1.5} ${hy}`, dik: MAAT.lijnDun }];
}

// ΔI — de som-stroommeting van een aardlekbeveiliging. Geen grafisch teken maar
// de genormeerde aanduiding; zo staat hij ook op het apparaat zelf.
function deltaI(x, y) {
  return [{ t: "tekst", x: x + 0.6, y: y + 2.6, tekst: "ΔI", korps: MAAT.korpsKlein, vet: true, anker: "start" }];
}

// Het dwarsstreepje aan het vrije contact: scheider / lastscheider. Zegt dat het
// toestel zichtbaar scheidt en niet alleen schakelt.
function scheiderstreep(x, y) {
  const ex = x + CONTACT_HALF - 0.4;
  const ey = y - CONTACT_HOOG;
  return [{ t: "lijn", x1: ex - 1.0, y1: ey - 1.0, x2: ex + 1.0, y2: ey + 1.0, dik: MAAT.lijnDun }];
}

// De smeltveiligheid: het patroon als rechthoek óm de geleider, met de dikke
// zijde aan de voedende kant. Geen schakelteken — een stop schakelt niet.
function smeltteken(x, y) {
  return [
    { t: "rechthoek", x: x - 2.8, y: y - 1.6, b: 5.6, h: 3.2, dik: MAAT.lijnDun },
    { t: "lijn", x1: x - 2.8, y1: y - 1.6, x2: x - 2.8, y2: y + 1.6, dik: 0.7 },
  ];
}

// Tekent het beveiligingsteken dat bij `soort` hoort, op (x, y).
export function beveiligingsteken(soort, x, y) {
  if (soort === "smeltveiligheid") return smeltteken(x, y);
  const ops = schakelteken(x, y);
  if (soort === "automaat" || soort === "aardlekautomaat") ops.push(...haakje(x, y));
  if (soort === "aardlek" || soort === "aardlekautomaat") ops.push(...deltaI(x, y));
  if (soort === "hoofdschakelaar" || soort === "scheider") ops.push(...scheiderstreep(x, y));
  return ops;
}

// De netaansluiting: twee elkaar overlappende cirkels, het teken voor de
// voedende bron.
function voedingteken(x, y) {
  return [
    { t: "cirkel", cx: x - 1.8, cy: y, r: 2.6 },
    { t: "cirkel", cx: x + 1.8, cy: y, r: 2.6 },
  ];
}

// De kWh-meter: rechthoek met de aanduiding erin, zoals op elk Nederlands
// schema.
function meterteken(x, y, tekst) {
  return [
    { t: "rechthoek", x: x - 7, y: y - 3.5, b: 14, h: 7, dik: MAAT.lijnDun },
    { t: "tekst", x, y: y + 1.1, tekst, korps: MAAT.korpsKlein, anker: "middle" },
  ];
}

// Het aardingsteken: drie strepen die korter worden. Daarboven de
// hoofdaardrail met zijn aftakkingen.
function aardingteken(x, y) {
  return [
    { t: "lijn", x1: x, y1: y, x2: x, y2: y + 3, dik: MAAT.lijnDun },
    { t: "lijn", x1: x - 3.2, y1: y + 3, x2: x + 3.2, y2: y + 3, dik: MAAT.lijnDik },
    { t: "lijn", x1: x - 2.0, y1: y + 4.4, x2: x + 2.0, y2: y + 4.4, dik: MAAT.lijnDun },
    { t: "lijn", x1: x - 0.9, y1: y + 5.6, x2: x + 0.9, y2: y + 5.6, dik: MAAT.lijnDun },
  ];
}

// ─── HET ONTWERP ──────────────────────────────────────────────────────────────

// Wat er als functieregel boven de lijn komt. De naam die de installateur heeft
// bevestigd wint; anders wat er op de plaat stond; anders niets — en niets is
// beter dan "groep 7" nog eens herhalen, want het nummer staat er al voor.
function functieregel(p) {
  const naam = String(p.functie || "").trim();
  if (naam) return naam;
  const tekst = String(p.groepstekst || "").trim();
  if (tekst && !/^\d{1,2}$/.test(tekst)) return tekst;
  return "";
}

// De aanduiding onder het teken: B16, 40 A, 30 mA.
export function tekenAanduiding(p) {
  if (p.soort === "aardlek") {
    const a = toNum(p.In) > 0 ? `${toNum(p.In)} A` : "";
    const ma = toNum(p.IAn) > 0 ? `${toNum(p.IAn)} mA` : "";
    return [a, ma].filter(Boolean).join(" · ") || "aardlek";
  }
  const bev = formatBeveiliging(p.karakteristiek, p.In);
  if (p.soort === "aardlekautomaat") {
    const ma = toNum(p.IAn) > 0 ? `${toNum(p.IAn)} mA` : "";
    return [bev, ma].filter(Boolean).join(" · ") || "aardlekautomaat";
  }
  if (p.soort === "smeltveiligheid") return toNum(p.In) > 0 ? `${toNum(p.In)} A` : "stop";
  return bev || "";
}

// Groepsaanduiding links van het teken: "12  L2". Het nummer komt uit
// groepsnummers() zodat schema, label en naam hetzelfde zeggen.
function groepsaanduiding(p, nr) {
  const n = nr ? String(nr) : "";
  const f = p.fase ? String(p.fase) : "";
  return [n, f].filter(Boolean).join("  ");
}

// Één verdeler wordt een blok tekenwerk. `y` is de bovenkant; de functie geeft
// terug hoe hoog het blok geworden is, zodat de volgende verdeler eronder past.
function tekenVerdeler(v, y0, opties) {
  const ops = [];
  const posities = sorteerPosities(v.posities || []);
  const nrs = groepsnummers(posities);
  const blokken = blokIndeling(posities);
  const codes = new Map();
  let n = 0;
  // aardlekCode telt vanaf 1 — bij 0 levert hij "EIGEN" op, de code voor een
  // groep met eigen aardlekbeveiliging. Vandaar ++n en niet n++.
  for (const b of blokken) if (b.aardlek) codes.set(b.aardlek.id, aardlekCode(++n));

  const isEerste = !!opties.eerste;
  const hoofd = v.hoofd || {};

  // ── De voedende kant ───────────────────────────────────────────────────────
  let y = y0 + 12;
  const yVoeding = y;

  if (isEerste) {
    ops.push(...voedingteken(MAAT.xVoeding, y));
    const fasen = toNum(hoofd.fasen) === 1 ? 1 : 3;
    const hz = toNum(hoofd.hoofdzekering);
    ops.push({
      t: "tekst", x: MAAT.xVoeding, y: y + 7, anker: "middle", korps: MAAT.korpsKlein,
      tekst: hz > 0 ? `${fasen} × ${hz} A` : `${fasen}-fase`,
    });
    ops.push({
      t: "tekst", x: MAAT.xVoeding, y: y + 10, anker: "middle", korps: MAAT.korpsKlein,
      tekst: hoofd.stelsel ? `${hoofd.stelsel}-stelsel` : "",
    });
    ops.push({ t: "lijn", x1: MAAT.xVoeding + 4.4, y1: y, x2: MAAT.xMeter - 7, y2: y, dik: MAAT.lijnDun });
    ops.push(...meterteken(MAAT.xMeter, y, "kWh"));
    ops.push({ t: "lijn", x1: MAAT.xMeter + 7, y1: y, x2: MAAT.xRail, y2: y, dik: MAAT.lijnDun });
  } else {
    // Een onderverdeler wordt gevoed vanuit de verdeler erboven. De voedende
    // lijn komt van links binnen; wát er aan de andere kant hangt staat in de
    // verdeler waar hij vandaan komt.
    ops.push({ t: "lijn", x1: MAAT.xVoeding, y1: y, x2: MAAT.xRail, y2: y, dik: MAAT.lijnDun });
    ops.push({
      t: "tekst", x: MAAT.xVoeding, y: y - 2, anker: "start", korps: MAAT.korpsKlein,
      tekst: "voeding uit hoofdverdeler",
    });
  }

  // De hoofdschakelaar staat als module in de kast; is er geen, dan tekenen we
  // de kam als scheider met de kamwaarde. Een schema zonder iets tussen meter
  // en rail suggereert dat je de groepen niet spanningsloos kunt maken.
  const hoofdmodule = posities.find((p) => p.soort === "hoofdschakelaar");
  ops.push(...beveiligingsteken("hoofdschakelaar", MAAT.xHoofd, y));
  const hoofdA = toNum(hoofdmodule && hoofdmodule.In) || toNum(hoofd.kamA);
  ops.push({
    t: "tekst", x: MAAT.xHoofd, y: y + 3.4, anker: "middle", korps: MAAT.korpsKlein,
    tekst: hoofdA > 0 ? `${hoofdA} A` : "hoofdschakelaar",
  });

  // ── De blokken ─────────────────────────────────────────────────────────────
  const rijen = [];
  y += 8;
  for (const blok of blokken) {
    const groepen = blok.posities.filter((p) => isGroepsoort(p.soort));
    if (!groepen.length) continue;
    const yBoven = y;
    for (const p of groepen) {
      rijen.push({ p, y: y + MAAT.rij / 2 });
      y += MAAT.rij;
    }
    const yOnder = y - MAAT.rij / 2;
    const yMidden = (yBoven + MAAT.rij / 2 + yOnder) / 2;

    if (blok.aardlek) {
      const a = blok.aardlek;
      ops.push({ t: "lijn", x1: MAAT.xRail, y1: yMidden, x2: MAAT.xAardlek - CONTACT_HALF, y2: yMidden, dik: MAAT.lijnDun });
      ops.push(...beveiligingsteken("aardlek", MAAT.xAardlek, yMidden));
      ops.push({ t: "lijn", x1: MAAT.xAardlek + CONTACT_HALF, y1: yMidden, x2: MAAT.xBeugel, y2: yMidden, dik: MAAT.lijnDun });
      ops.push({
        t: "tekst", x: MAAT.xAardlek, y: yMidden + 6.2, anker: "middle", korps: MAAT.korpsKlein,
        tekst: tekenAanduiding(a),
      });
      const code = codes.get(a.id);
      if (code) ops.push({
        t: "tekst", x: MAAT.xAardlek, y: yMidden - 5.4, anker: "middle", korps: MAAT.korpsKlein, vet: true, tekst: code,
      });
      if (a.aardlektype) ops.push({
        t: "tekst", x: MAAT.xAardlek, y: yMidden + 9, anker: "middle", korps: MAAT.korpsKlein,
        tekst: `type ${a.aardlektype}`,
      });
      // De beugel: één verticale lijn waar alle groepen van dit blok aan hangen.
      ops.push({ t: "lijn", x1: MAAT.xBeugel, y1: yBoven + MAAT.rij / 2, x2: MAAT.xBeugel, y2: yOnder, dik: MAAT.lijnDun });
      for (const r of rijen.slice(rijen.length - groepen.length)) {
        ops.push({ t: "lijn", x1: MAAT.xBeugel, y1: r.y, x2: MAAT.xGroep - CONTACT_HALF, y2: r.y, dik: MAAT.lijnDun });
      }
    } else {
      // Zonder aardlekschakelaar hangen de groepen rechtstreeks aan de rail.
      // Dat is géén afwijking als het aardlekautomaten zijn — die dragen hun
      // beveiliging zelf — en daarom staat er hier geen oordeel bij.
      for (const r of rijen.slice(rijen.length - groepen.length)) {
        ops.push({ t: "lijn", x1: MAAT.xRail, y1: r.y, x2: MAAT.xGroep - CONTACT_HALF, y2: r.y, dik: MAAT.lijnDun });
      }
    }
    y += MAAT.blokLucht;
  }

  // ── De groepen ─────────────────────────────────────────────────────────────
  for (const { p, y: yr } of rijen) {
    ops.push(...beveiligingsteken(p.soort, MAAT.xGroep, yr));
    const aand = tekenAanduiding(p);
    if (aand) ops.push({
      t: "tekst", x: MAAT.xGroep, y: yr + 3.4, anker: "middle", korps: MAAT.korpsKlein, tekst: aand,
    });
    // Het nummer staat BOVEN de voedende lijn en niet erop. Op de lijn liep hij
    // er dwars doorheen en las als doorgestreept — precies de indruk die een
    // vervallen groep wekt.
    const nr = groepsaanduiding(p, nrs.get(p.id));
    if (nr) ops.push({
      t: "tekst", x: MAAT.xNummer, y: yr - MAAT.functieBoven, anker: "start", korps: MAAT.korpsTekst, vet: true, tekst: nr,
    });
    ops.push({ t: "lijn", x1: MAAT.xGroep + CONTACT_HALF, y1: yr, x2: MAAT.xLijnEind, y2: yr, dik: MAAT.lijnDun });

    const functie = functieregel(p);
    if (functie) ops.push({
      t: "tekst", x: MAAT.xGroep + 8, y: yr - MAAT.functieBoven, anker: "start", korps: MAAT.korpsTekst, tekst: functie,
    });
    const kabel = String(p.kabel || "").trim();
    if (kabel) ops.push({
      t: "tekst", x: MAAT.xGroep + 8, y: yr + MAAT.kabelOnder, anker: "start", korps: MAAT.korpsKlein, tekst: kabel,
    });
  }

  // ── De rail ────────────────────────────────────────────────────────────────
  const yRailEind = rijen.length ? Math.max(...rijen.map((r) => r.y)) : yVoeding;
  ops.push({ t: "lijn", x1: MAAT.xRail, y1: yVoeding, x2: MAAT.xRail, y2: yRailEind, dik: MAAT.lijnDik });
  const kam = toNum(hoofd.kamMm2);
  if (kam > 0) ops.push({
    t: "tekst", x: MAAT.xRail + 2.5, y: yVoeding + 4, anker: "start", korps: MAAT.korpsKlein, tekst: `kam ${komma(kam, 0)} mm²`,
  });

  // ── De aarding ─────────────────────────────────────────────────────────────
  //
  // Alleen bij de eerste verdeler: de hoofdaardrail hoort bij de aansluiting,
  // niet bij elke onderverdeler.
  let yEind = yRailEind + 6;
  if (isEerste) {
    const yH = yEind + 6;
    ops.push({ t: "lijn", x1: MAAT.xRail, y1: yRailEind, x2: MAAT.xRail, y2: yH, dik: MAAT.lijnDun });
    ops.push({ t: "lijn", x1: MAAT.xVoeding, y1: yH, x2: MAAT.xBeugel, y2: yH, dik: MAAT.lijnDik });
    ops.push({ t: "tekst", x: MAAT.xVoeding - 4, y: yH - 2.4, anker: "start", korps: MAAT.korpsKlein, vet: true, tekst: "HAR" });
    ops.push(...aardingteken(MAAT.xVoeding, yH));
    const aansluitingen = ["gas", "water", "cv", "data"];
    aansluitingen.forEach((naam, i) => {
      // Links van de rail, want de raildaling komt op xRail naar beneden en een
      // aftakking op diezelfde plek leest als één doorlopende lijn.
      const x = MAAT.xVoeding + 12 + i * 12;
      ops.push({ t: "lijn", x1: x, y1: yH, x2: x, y2: yH + 4, dik: MAAT.lijnDun });
      ops.push({ t: "tekst", x, y: yH + 6.6, anker: "middle", korps: MAAT.korpsKlein, tekst: naam });
    });
    ops.push({
      t: "tekst", x: MAAT.xBeugel + 3, y: yH + 0.9, anker: "start", korps: MAAT.korpsKlein,
      tekst: "hoofdaardrail — RA gemeten waarde invullen",
    });
    yEind = yH + 10;
  }

  // ── De kastgrens ───────────────────────────────────────────────────────────
  //
  // De streepjeslijn om de verdeler heen zegt wat er in één kast zit. Zonder die
  // grens is een schema met twee verdelers niet te lezen.
  // De hoofdschakelaar zit fysiek IN de kast en hoort dus binnen de grens; de
  // meter staat ervoor en blijft erbuiten.
  const kaderLinks = MAAT.xHoofd - 8;
  const kader = {
    t: "rechthoek", x: kaderLinks, y: y0 + 4, b: MAAT.xLijnEind - kaderLinks + 4,
    h: (rijen.length ? Math.max(...rijen.map((r) => r.y)) + 6 : yVoeding + 6) - (y0 + 4),
    streep: true, dik: MAAT.lijnDun,
  };
  ops.unshift(kader);
  ops.unshift({
    t: "tekst", x: kaderLinks, y: y0 + 2.4, anker: "start", korps: MAAT.korpsKlein, vet: true,
    tekst: String(v.naam || "Verdeler"),
  });

  return { ops, hoogte: yEind - y0 };
}

// ─── HET HELE SCHEMA ──────────────────────────────────────────────────────────
//
// `opties`: { adres, datum, installateur, titel }.
export function ontwerpSchema(kast, opties) {
  const o = opties || {};
  const verdelers = (kast && Array.isArray(kast.verdelers) ? kast.verdelers : []).filter(Boolean);
  const ops = [];

  // Titelregel bovenaan: wat is dit, van welk adres, van wanneer.
  ops.push({
    t: "tekst", x: MAAT.marge, y: MAAT.marge + 4, anker: "start", korps: MAAT.korpsTitel, vet: true,
    tekst: o.titel || "Installatieschema",
  });
  const onder = [o.adres, o.datum].filter(Boolean).join(" · ");
  if (onder) ops.push({
    t: "tekst", x: MAAT.marge, y: MAAT.marge + 9, anker: "start", korps: MAAT.korpsTekst, tekst: onder,
  });

  let y = MAAT.marge + 14;
  verdelers.forEach((v, i) => {
    const deel = tekenVerdeler(v, y, { eerste: i === 0 });
    ops.push(...deel.ops);
    y += deel.hoogte + 8;
  });

  // De onderregel. Het schema is een INVULHULP en geen keuring; dat hoort op het
  // vel te staan waar het vel zelf op wordt nagekeken.
  const voet = [
    "Voorstel uit Kastscan — door de installateur te controleren en aan te vullen.",
    o.installateur || "",
  ].filter(Boolean).join("  ");
  ops.push({ t: "tekst", x: MAAT.marge, y: y + 4, anker: "start", korps: MAAT.korpsKlein, tekst: voet });

  return {
    breedteMm: MAAT.xLijnEind + MAAT.marge,
    hoogteMm: Math.max(y + 8, 120),
    ops,
  };
}

// ─── DE SVG ───────────────────────────────────────────────────────────────────
//
// Eén renderer voor scherm én papier. De viewBox staat in millimeters, dus
// hetzelfde ontwerp past zich aan de beschikbare breedte aan zonder dat er iets
// wordt herberekend of geïnterpoleerd.
function tekstEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function opNaarSvg(op, kleur) {
  const dik = op.dik || MAAT.lijnDun;
  if (op.t === "lijn") {
    return `<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}" stroke="${kleur}" ` +
      `stroke-width="${dik}" stroke-linecap="square"${op.streep ? ' stroke-dasharray="1.6 1.2"' : ""}/>`;
  }
  if (op.t === "rechthoek") {
    return `<rect x="${op.x}" y="${op.y}" width="${op.b}" height="${op.h}" fill="${op.vul ? kleur : "none"}" ` +
      `stroke="${kleur}" stroke-width="${dik}"${op.streep ? ' stroke-dasharray="2.2 1.6"' : ""}/>`;
  }
  if (op.t === "cirkel") {
    return `<circle cx="${op.cx}" cy="${op.cy}" r="${op.r}" fill="${op.vul ? kleur : "none"}" ` +
      `stroke="${kleur}" stroke-width="${dik}"/>`;
  }
  if (op.t === "pad") {
    return `<path d="${op.d}" fill="none" stroke="${kleur}" stroke-width="${dik}" stroke-linecap="square"/>`;
  }
  if (op.t === "tekst") {
    if (!String(op.tekst || "").length) return "";
    const anker = op.anker === "middle" ? "middle" : op.anker === "end" ? "end" : "start";
    const draai = op.draai ? ` transform="rotate(${op.draai} ${op.x} ${op.y})"` : "";
    return `<text x="${op.x}" y="${op.y}" text-anchor="${anker}" font-size="${op.korps}" ` +
      `font-family="'IBM Plex Sans',sans-serif" font-weight="${op.vet ? 700 : 400}" ` +
      `fill="${op.kleur || kleur}"${draai}>${tekstEsc(op.tekst)}</text>`;
  }
  return "";
}

// `opties.kleur` — de inkt. Op papier zwart, op het donkere scherm licht.
// `opties.attributen` — extra attributen op het <svg>-element.
export function schemaSvg(ontwerp, opties) {
  const o = opties || {};
  const kleur = o.kleur || "#111318";
  const inhoud = ontwerp.ops.map((op) => opNaarSvg(op, kleur)).join("\n");
  const attr = o.attributen || `width="100%" height="auto"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ontwerp.breedteMm} ${ontwerp.hoogteMm}" ` +
    `${attr} role="img" aria-label="Installatieschema">\n${inhoud}\n</svg>`;
}

// Gemak: van kast naar SVG in één stap.
export function schemaVanKast(kast, opties) {
  return schemaSvg(ontwerpSchema(kast, opties), opties);
}
