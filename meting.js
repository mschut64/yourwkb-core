// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de MÉTING: normen, Z_max en de cross-checks
//
// Verhuisd uit YourWkb (components/wkb/model.js) op 02-10-2026, op de voorwaarde
// die daar zelf stond: "Zodra de onderwijsapp dezelfde meetwaarden moet toetsen,
// verhuist dit blok alsnog naar de motor." Dat moment is nu — een leerling levert
// in de onderwijsapp een oefenklus in met meetwaarden, en die moet aan dezelfde
// norm getoetst worden als een echte oplevering. Twee toetsingen van dezelfde
// meting lopen vroeg of laat uiteen, en dan keurt de school iets goed wat het
// veld afkeurt.
//
// Wat hier staat is de toets op wat GEMETEN is: de gG-tijd-stroomkromme, Z_max
// per beveiligingstoestel, en de cross-checks over een opleverset (isolatie,
// ΔT/ΔI, impedantie, spanningsasymmetrie, visuele inspectiepunten).
//
// ⚓ EEN NORM HOORT BIJ EEN CIRCUIT, NIET BIJ EEN INSTALLATIE. Z_max geldt per
// beveiligingstoestel; wie de verste wandcontactdoos van een lichtgroep meet,
// toetst aan de B16 van díé groep. Zie zMaxVoorBeveiliging.
//
// De vorm van de invoer (`instMet`, `grpMeet`, `aardlekgroepen`) is die van een
// opleverset in YourWkb. Die vorm is niet veranderd bij de verhuizing: de 105
// tests in YourWkb draaien ongewijzigd door over deze code.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";

export { toNum };

// ── gG-smeltzekering (trage patroon, D-patronen) — tijd-stroomkromme tabel ──
// In tegenstelling tot B/C/D-automaten (vaste factor × In) heeft een gG-zekering
// een niet-lineaire tijd-stroomkromme: de vereiste uitschakelstroom (Ia) per
// stroomwaarde moet per In en per tijdsduur worden opgezocht, niet berekend met
// een simpele factor. Bron: door Martin aangeleverde tabel "D-patronen Traag gG".
// Kolommen komen exact overeen met de vier afschakeltijden die de app al
// gebruikt (kastklasse × stelsel: Klasse1 TN=5s/TT=1s, Klasse2 TN=0,4s/TT=0,2s).
export const GG_TABEL = {
  2:  { 5:5.6,   1:6.6,   0.4:7.5,   0.2:8.3   },
  4:  { 5:11.1,  1:14.2,  0.4:15.7,  0.2:17.5  },
  6:  { 5:17.1,  1:22.0,  0.4:26.7,  0.2:33.7  },
  10: { 5:39.4,  1:50.0,  0.4:58.8,  0.2:67.1  },
  16: { 5:53.1,  1:73.3,  0.4:90.0,  0.2:110.5 },
  // 20A/0,2s gecorrigeerd naar 153,3A (was 43,3 — fout in brontabel, gecorrigeerd
  // door Martin op 28-7-2026 via 230/1,5 = 153,3, consistent met de stijgende
  // trend van de rest van de rij).
  20: { 5:75.7,  1:105.3, 0.4:130.0, 0.2:153.3 },
  25: { 5:92.0,  1:131.6, 0.4:164.3, 0.2:196.4 },
  35: { 5:139.5, 1:196.4, 0.4:260.0, 0.2:328.0 },
  50: { 5:206.6, 1:307.3, 0.4:362.5, 0.2:400.0 },
  63: { 5:274.3, 1:362.5, 0.4:423.8, 0.2:486.5 },
};

export const GG_IN_WAARDEN = Object.keys(GG_TABEL).map(Number).sort((a,b)=>a-b);

// Zoekt de dichtstbijzijnde In-waarde in de tabel (niet elke stroomwaarde is
// een standaard gG-maat) en geeft de vereiste Ia terug voor de gevraagde tijd.
export function ggIaVoorTijd(ampere, tijd) {
  const amp = toNum(ampere);
  if (isNaN(amp) || amp <= 0) return null;
  const dichtstbij = GG_IN_WAARDEN.reduce((best,cur) =>
    Math.abs(cur-amp) < Math.abs(best-amp) ? cur : best
  , GG_IN_WAARDEN[0]);
  const rij = GG_TABEL[dichtstbij];
  if (!rij || rij[tijd] === undefined) return null;
  return { ia: rij[tijd], inGebruikt: dichtstbij };
}

// ─── Z_max: WELKE BEVEILIGING SCHAKELT DÍT PUNT AF ───────────────────────────
//
// Z_max = U0 / Ia: de hoogste lusimpedantie waarbij de beveiliging nog binnen de
// vereiste tijd afschakelt. Voor B/C/D is Ia een vaste factor × In; voor gG een
// opzoeking in de tijd-stroomkromme, want die is niet lineair.
//
// ⚓ DE BEVEILIGING IS DIE VAN HET GEMETEN CIRCUIT, en niet die van de installatie
// als geheel. Dat lijkt vanzelfsprekend en ging toch mis: stap 8 legde élke
// veldmeting langs de hoogst afgaande groep uit sectie A. Die is per definitie de
// zwaarste, dus de strengste norm. Een correcte 1,8 Ω op de verste wandcontactdoos
// van een B16-lichtgroep (norm 2,88 Ω) werd zo afgekeurd tegen de 1,15 Ω van een
// B40-kookgroep — een "Afwijking" die nooit wegging, hoe goed je ook mat.
// Gemeld door Martin na een oplevering, 02-10-2026.
export const KAR_FACTOR = { B: 5, C: 10, D: 20 };

export function zMaxVoorBeveiliging(kar, ampere, maxAfschakeltijd) {
  const amp = toNum(ampere);
  if (String(kar || "") === "gG") {
    const g = ggIaVoorTijd(amp, maxAfschakeltijd);
    return g ? Math.round((230 / g.ia) * 100) / 100 : null;
  }
  const factor = KAR_FACTOR[kar];
  if (!factor || isNaN(amp) || amp <= 0) return null;
  // Afronden bij de bron, niet pas bij het tonen: anders keurt de app een waarde
  // af die op het scherm precies op de norm lijkt te staan.
  return Math.round((230 / (factor * amp)) * 100) / 100;
}

// De maximale afschakeltijd uit NEN 1010 tabel 41.1, afgeleid uit stelsel en
// kastklasse. Stond op drie plaatsen als dezelfde reeks vraagtekens.
export function maxAfschakeltijdVoor(kastType, stelsel) {
  const tt = stelsel === "TT";
  return kastType === "klasse1" ? (tt ? 1 : 5) : (tt ? 0.2 : 0.4);
}

// Welke eindgroep hoort bij de veldmeting van dit cluster. De installateur kiest
// hem; zolang hij dat niet heeft gedaan nemen we de ZWAARSTE van het cluster.
// Dat is dezelfde vuistregel als bij de RCD-test, en hij is veilig: de zwaarste
// automaat geeft binnen dit cluster de strengste Z_max, dus deze keuze kan een
// meting nooit ten onrechte goedkeuren.
export function zwaarsteEindgroep(ag) {
  const lijst = (ag && Array.isArray(ag.eindgroepen)) ? ag.eindgroepen : [];
  if (!lijst.length) return null;
  return lijst.reduce((best, e) =>
    (toNum(String(e.ampere || "").replace("A", "")) || 0) >
    (toNum(String(best.ampere || "").replace("A", "")) || 0) ? e : best, lijst[0]);
}

// De beveiliging waaraan een veldmeting in dit cluster getoetst wordt.
// `eindId` is de keuze van de installateur; zonder keuze de zwaarste groep.
// Levert `null` als de groep geen karakteristiek of stroom draagt — dan valt het
// scherm terug op sectie A en zegt dat er ook bij.
export function veldBeveiliging(ag, eindId) {
  const lijst = (ag && Array.isArray(ag.eindgroepen)) ? ag.eindgroepen : [];
  const gekozen = eindId != null ? lijst.find((e) => String(e.id) === String(eindId)) : null;
  const eg = gekozen || zwaarsteEindgroep(ag);
  if (!eg || !eg.kar || !eg.ampere) return null;
  return { id: eg.id, naam: eg.naam || "", kar: eg.kar, ampere: String(eg.ampere).replace("A", "") };
}

// ─── CROSS-CHECK LOGICA ───────────────────────────────────────────────────────

// Groepenkast cross-checks — werkt op aardlekgroepen (RCD-clusters), elk met 1+ eindgroepen.
// Norm bestaande installatie (1000Ω/V), gemeten NAAR AARDE: altijd ≥0,23 MΩ.
// Elke fase staat t.o.v. aarde op 230V (ook bij 3-fase); de 0,40 MΩ hoort bij
// 400V fase-tegen-fase, wat we hier niet meten.
// ΔT-norm is afhankelijk van het stelsel (TN of TT) — zie NEN1010 tabel 41.1:
//   TN-eindgroep ≤ 400ms · TT-eindgroep ≤ 200ms
export function gkCrossChecks(aardlekgroepen, grpMeet, instMet) {
  const warnings = [];
  const stelsel = instMet.stelsel || "TN-C-S";
  const isTT = stelsel === "TT";
  const dtNorm = 300; // EN 61008: apparaatnorm altijd 300ms bij 1× In, ongeacht stelsel

  // B) ISOLATIEWEERSTAND — ISO totaal is de hoofdmeting (alle groepen aan, hoofdvoeding uit)
  // Twee losse metingen: Fase→Aarde en Nul→Aarde, beide getoetst aan 0,23 MΩ.
  const isoTotFA = toNum(instMet.isoTotFA);
  const isoTotNA = toNum(instMet.isoTotNA);
  if (!isNaN(isoTotFA) && isoTotFA < 0.23)
    warnings.push({ level:"red", msg:`ISO totaal (Fase→Aarde) ${isoTotFA} MΩ — ONDER NORM (≥0,23 MΩ)` });
  if (!isNaN(isoTotNA) && isoTotNA < 0.23)
    warnings.push({ level:"red", msg:`ISO totaal (Nul→Aarde) ${isoTotNA} MΩ — ONDER NORM (≥0,23 MΩ)` });

  // ISO per groep (dynamische lijst) — waarschuw bij een waarde onder de norm.
  (instMet.isoGroepen || []).forEach((g, idx) => {
    const naam = g.naam || `Groep ${idx+1}`;
    const norm = 0.23; // naar aarde: elke fase staat t.o.v. aarde op 230V → ≥0,23 MΩ, ook bij 3-fase
    const velden = g.driefase
      ? [["l1a","L1→Aarde"],["l2a","L2→Aarde"],["l3a","L3→Aarde"],["na","N→Aarde"]]
      : [["fa","Fase→Aarde"],["na","Nul→Aarde"]];
    velden.forEach(([k,label]) => {
      const iso = toNum(g[k]);
      if (!isNaN(iso) && iso < norm)
        warnings.push({ level:"red", msg:`${naam} (${label}): ISO ${iso} MΩ — ONDER NORM (≥${norm} MΩ)` });
    });
  });

  (aardlekgroepen||[]).forEach(ag => {
    const geenRcd = ag.rcdType === "geen";

    if (!geenRcd) {
      const dt = toNum(grpMeet[`${ag.id}_dt`]);
      if (!isNaN(dt) && dt > dtNorm)
        warnings.push({ level:"red", msg:`${ag.naam}: ΔT ${dt}ms boven 300ms (EN 61008 apparaatnorm bij 1× In)` });

      // ΔI-norm per RCD-type (alleen bovengrens, geen ondergrens — fabrikantwaarden leidend):
      // Type AC: ≤ 1× In | Type A: ≤ 1,4× In (√2 factor pulserend DC) | Type B: ≤ 2× In
      const di = toNum(grpMeet[`${ag.id}_di`]);
      const mA = toNum(ag.rcdMa);
      if (!isNaN(di) && !isNaN(mA)) {
        const diMax = ag.rcdType==="B" ? mA*2 : ag.rcdType==="AC" ? mA*1 : mA*1.4;
        if (di > diMax)
          warnings.push({ level:"red", msg:`${ag.naam}: ΔI ${di}mA boven norm voor type-${ag.rcdType} (≤${diMax.toFixed(0)}mA bij ${mA}mA RCD)` });
      }

      // Testknop NOK betekent dat de RCD niet mechanisch/elektrisch reageert op de
      // ingebouwde testfunctie — dit is een directe afkeuring, RCD moet vervangen worden.
      const testknop = grpMeet[`${ag.id}_testknop`];
      if (testknop === "NOK")
        warnings.push({ level:"red", msg:`${ag.naam}: Testknop RCD geeft NOK — RCD reageert niet op de testfunctie, vervang de RCD` });
    }
  });

  // Spanning asymmetrie
  const l1 = toNum(instMet["span_L1/N"]);
  const l2 = toNum(instMet["span_L2/N"]);
  const l3 = toNum(instMet["span_L3/N"]);
  if (!isNaN(l1) && !isNaN(l2) && !isNaN(l3)) {
    const diff = Math.max(l1,l2,l3) - Math.min(l1,l2,l3);
    if (diff > 6) warnings.push({ level:"orange", msg:`Fasespanning asymmetrie ${diff.toFixed(1).replace(".",",")}V — controleer netaansluiting` });
  }

  // A) IMPEDANTIE — Z L-N/L-PE check op basis van hoogst afgaande groep (EN 60898/60269)
  // Z_max = 230 / Icc_min. Voor B/C/D: Icc_min = factor × In (B=5, C=10, D=20).
  // Voor gG (trage smeltzekering): Icc_min komt uit de tijd-stroomkromme tabel
  // (GG_TABEL), afhankelijk van de max. afschakeltijd (die zelf weer afhangt van
  // kastklasse × stelsel — zie maxAfschakeltijd-logica). Geldt voor ELK stelsel,
  // dus ook TT — de fysica van de automaat/zekering verandert niet door het stelsel.
  {
    const karFac = { B:5, C:10, D:20 };
    const vKar = instMet.hoogstKar || "B";
    const vA   = toNum(instMet.hoogstAmpere);
    const isKlasse1Chk = instMet.kastType === "klasse1";
    const isTTChk = (instMet.stelsel||"TN-C-S") === "TT";
    const maxAfschakeltijdChk = isKlasse1Chk ? (isTTChk ? 1 : 5) : (isTTChk ? 0.2 : 0.4);

    let zMax = null;
    if (vKar === "gG") {
      const ggLookupChk = ggIaVoorTijd(vA, maxAfschakeltijdChk);
      if (ggLookupChk) zMax = Math.round((230 / ggLookupChk.ia) * 100) / 100;
    } else if (!isNaN(vA) && vA > 0 && karFac[vKar]) {
      zMax = Math.round((230 / (karFac[vKar] * vA)) * 100) / 100;
    }

    {
      const rcdAanwezig = instMet.rcdAanwezig ?? true;
      const zlpe = toNum(instMet.zlpe);
      const zln  = toNum(instMet.zln);
      if (rcdAanwezig) {
        // Achter een aardlekschakelaar geldt de aanraakspanningsnorm Ra ≤166Ω i.p.v. de foutstroom-norm.
        if (!isNaN(zlpe) && zlpe > 166)
          warnings.push({ level:"red", msg:`Z L-PE ${zlpe}Ω boven 166Ω (aanraakspanningsnorm achter aardlekschakelaar)` });
      } else if (zMax) {
        if (!isNaN(zlpe) && zlpe > zMax * 0.9 && zlpe <= zMax)
          warnings.push({ level:"orange", msg:`Z L-PE ${zlpe}Ω nadert maximum voor ${vKar}${vA}A (Z_max=${zMax.toFixed(2).replace(".",",")}Ω) — bij uitbreiding opnieuw meten` });
        if (!isNaN(zlpe) && zlpe > zMax)
          warnings.push({ level:"red", msg:`Z L-PE ${zlpe}Ω boven Z_max (${zMax.toFixed(2).replace(".",",")}Ω voor ${vKar}${vA}A) — Icc te laag voor kortsluitbeveiliging` });
      }
      if (zMax && !isNaN(zln) && zln > zMax)
        warnings.push({ level:"red", msg:`Z L-N ${zln}Ω boven Z_max (${zMax.toFixed(2).replace(".",",")}Ω voor ${vKar}${vA}A) — Icc te laag voor kortsluitbeveiliging` });
    }
  }

  // Visuele inspectiepunten — bij NOK is dit een directe afwijking
  const inspectieLabels = {
    beschermingscontacten: "Beschermingscontacten wandcontactdozen/metalen gestellen",
    potentiaalvereffening: "Hoofd- en aanvullende potentiaalvereffening",
    leidingberekeningen:   "Leidingberekeningen",
    beveiligingen:         "Beveiligingen (incl. selectiviteit)",
  };
  Object.entries(inspectieLabels).forEach(([k,label]) => {
    if (instMet[k] === "NOK")
      warnings.push({ level:"red", msg:`${label}: NIET in orde bevonden — herstel vereist vóór ingebruikname` });
  });

  return warnings;
}

// PV cross-checks
export function pvCrossChecks(strings, instMet, materiaal) {
  const warnings = [];
  // String spanning vergelijken
  const spanningen = strings.map(s => toNum(s.spanning)).filter(v => !isNaN(v));
  if (spanningen.length > 1) {
    const max = Math.max(...spanningen);
    const min = Math.min(...spanningen);
    if (max - min > 30) warnings.push({ level:"orange", msg:`Stringspanning verschil ${(max-min).toFixed(0)}V — mogelijke schaduw, defect paneel of mismatch` });
  }
  // ISO per string
  strings.forEach((s,i) => {
    const iso = toNum(s.iso);
    if (!isNaN(iso) && iso > 1 && iso < 1.5)
      warnings.push({ level:"orange", msg:`String ${i+1}: ISO ${iso} MΩ — net boven minimum, controleer aansluitingen` });
    if (!isNaN(iso) && iso <= 1)
      warnings.push({ level:"red", msg:`String ${i+1}: ISO ${iso} MΩ — ONDER NORM, niet in bedrijf stellen` });
  });
  // Totaalvermogen vs omvormer
  const aantalPanelen = parseInt(materiaal.aantalPanelen);
  const paneelWp      = parseInt(materiaal.paneelWp);
  const omvormerKw    = toNum(materiaal.omvormerKw);
  if (!isNaN(aantalPanelen) && !isNaN(paneelWp) && !isNaN(omvormerKw)) {
    const totaalWp = aantalPanelen * paneelWp;
    const ratio    = totaalWp / (omvormerKw * 1000);
    if (ratio > 1.35) warnings.push({ level:"orange", msg:`DC/AC ratio ${ratio.toFixed(2).replace(".",",")} is hoog (>1,35) — controleer omvormer specificaties` });
    if (ratio < 0.8)  warnings.push({ level:"orange", msg:`DC/AC ratio ${ratio.toFixed(2).replace(".",",")} is laag (<0,8) — omvormer mogelijk te groot` });
  }
  // Aarding check
  if (instMet.aardingOk === "NOK")
    warnings.push({ level:"red", msg:`Aarding draagconstructie NOK — installatie niet in bedrijf stellen` });
  return warnings;
}
