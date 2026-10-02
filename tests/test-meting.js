// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de méting
//
// Deze code is op 02-10-2026 uit YourWkb verhuisd. Daar staan 105 tests op
// (tests/test.js, categorie 1 t/m 13) die ongewijzigd doorlopen. Wat hier wordt
// vastgelegd is wat de motor zélf moet garanderen aan de twee nieuwe apps: de
// grenzen, de gG-kromme, en de regel dat een norm bij een circuit hoort.
//
// Voer uit met:  node tests/test-meting.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  GG_TABEL, ggIaVoorTijd, KAR_FACTOR, zMaxVoorBeveiliging, maxAfschakeltijdVoor,
  zwaarsteEindgroep, veldBeveiliging, gkCrossChecks, pvCrossChecks,
} from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}
const heeft = (lijst, deel) => lijst.some((w) => w.msg.includes(deel));

console.log("▶ CATEGORIE 1: Z_max komt van de beveiliging van het circuit");
eq(KAR_FACTOR, { B: 5, C: 10, D: 20 }, "1.1 de factoren van B, C en D");
eq(zMaxVoorBeveiliging("B", 16, 0.4), 2.88, "1.2 B16 → 2,88 Ω");
eq(zMaxVoorBeveiliging("B", 40, 0.4), 1.15, "1.3 B40 → 1,15 Ω");
eq(zMaxVoorBeveiliging("C", 16, 0.4), 1.44, "1.4 C16 is strenger dan B16");
eq(zMaxVoorBeveiliging("D", 16, 0.4), 0.72, "1.5 D16 strenger nog");
// De gemelde casus van 02-10-2026: 1,8 Ω op de verste WCD van een B16 is goed,
// en werd afgekeurd tegen de B40 van de kookgroep. Dat verschil moet blijven
// bestaan, anders is de fout terug.
eq(1.8 <= zMaxVoorBeveiliging("B", 16, 0.4), true, "1.6 1,8 Ω haalt de norm van een B16");
eq(1.8 <= zMaxVoorBeveiliging("B", 40, 0.4), false, "1.7 en niet die van een B40 — vandaar de fout");
eq(zMaxVoorBeveiliging("B", 0, 0.4), null, "1.8 zonder stroom geen norm");
eq(zMaxVoorBeveiliging("X", 16, 0.4), null, "1.9 een onbekende karakteristiek geeft niets, niet B");

console.log("▶ CATEGORIE 2: gG gaat door een kromme, niet door een factor");
eq(GG_TABEL[16][0.4], 90.0, "2.1 gG 16 A bij 0,4 s vraagt 90 A");
eq(zMaxVoorBeveiliging("gG", 16, 0.4), 2.56, "2.2 → Z_max 2,56 Ω");
// Zou gG als B gerekend worden, dan stond er 2,88: een halve ohm te royaal.
eq(zMaxVoorBeveiliging("gG", 16, 0.4) < zMaxVoorBeveiliging("B", 16, 0.4), true,
   "2.3 en dat is strenger dan B16 — een gG als B rekenen is te royaal");
eq(ggIaVoorTijd(18, 0.4).inGebruikt, 16, "2.4 een niet-standaardmaat valt op de dichtstbijzijnde");
eq(ggIaVoorTijd(0, 0.4), null, "2.5 geen stroom, geen opzoeking");

console.log("▶ CATEGORIE 3: de afschakeltijd volgt uit stelsel en kastklasse");
eq(maxAfschakeltijdVoor("klasse1", "TN-C-S"), 5, "3.1 klasse 1 op TN: 5 s");
eq(maxAfschakeltijdVoor("klasse1", "TT"), 1, "3.2 klasse 1 op TT: 1 s");
eq(maxAfschakeltijdVoor("klasse2", "TN-C-S"), 0.4, "3.3 klasse 2 op TN: 0,4 s");
eq(maxAfschakeltijdVoor("klasse2", "TT"), 0.2, "3.4 klasse 2 op TT: 0,2 s");

console.log("▶ CATEGORIE 4: welke groep bepaalt de norm");
const AG = { id: "a1", naam: "Aardlek A", rcdType: "A", rcdMa: "30", eindgroepen: [
  { id: "e1", naam: "Licht", kar: "B", ampere: "16A" },
  { id: "e2", naam: "Kookplaat", kar: "B", ampere: "40A" },
  { id: "e3", naam: "Zolder" },
]};
eq(zwaarsteEindgroep(AG).id, "e2", "4.1 zonder keuze de zwaarste — de strengste norm");
eq(veldBeveiliging(AG, "e1").ampere, "16", "4.2 met keuze de gekozen groep");
eq(veldBeveiliging(AG, "e3"), null, "4.3 een groep zonder karakteristiek geeft null, geen gok");
eq(veldBeveiliging({ eindgroepen: [] }, null), null, "4.4 een leeg cluster ook");

console.log("▶ CATEGORIE 5: isolatie naar aarde is altijd ≥ 0,23 MΩ");
const basis = { stelsel: "TN-C-S", kastType: "klasse2", hoogstKar: "B", hoogstAmpere: "40" };
eq(heeft(gkCrossChecks([], {}, { ...basis, isoTotFA: 0.2 }), "ONDER NORM"), true,
   "5.1 0,20 MΩ fase→aarde is onder de norm");
eq(gkCrossChecks([], {}, { ...basis, isoTotFA: 0.23 }).length, 0, "5.2 0,23 MΩ haalt hem precies");
eq(heeft(gkCrossChecks([], {}, { ...basis, isoTotNA: 0.1 }), "Nul→Aarde"), true,
   "5.3 nul→aarde telt even zwaar");
// De fout die één keer gemaakt is: 0,40 MΩ hoort bij 400 V fase-fase, niet bij
// een meting naar aarde. Een driefasige groep op 0,3 MΩ moet dus goed zijn.
eq(gkCrossChecks([], {}, { ...basis, isoGroepen: [
  { naam: "Kookgroep", driefase: true, l1a: 0.3, l2a: 0.3, l3a: 0.3, na: 0.3 }] }).length, 0,
   "5.4 0,30 MΩ op een driefasige groep is goed — de 0,40 gold fase-fase");

console.log("▶ CATEGORIE 6: ΔT, ΔI en de testknop");
const ag1 = [{ id: "a1", naam: "Aardlek A", rcdType: "A", rcdMa: "30", eindgroepen: [] }];
eq(heeft(gkCrossChecks(ag1, { a1_dt: 320 }, basis), "boven 300ms"), true, "6.1 320 ms is te traag");
eq(gkCrossChecks(ag1, { a1_dt: 300 }, basis).length, 0, "6.2 300 ms haalt de apparaatnorm");
eq(heeft(gkCrossChecks(ag1, { a1_di: 45 }, basis), "type-A"), true, "6.3 45 mA boven 1,4× bij type A");
eq(gkCrossChecks(ag1, { a1_di: 42 }, basis).length, 0, "6.4 42 mA is precies 1,4× 30");
eq(gkCrossChecks([{ ...ag1[0], rcdType: "B" }], { a1_di: 58 }, basis).length, 0,
   "6.5 type B mag tot 2× In");
eq(heeft(gkCrossChecks(ag1, { a1_testknop: "NOK" }, basis), "vervang de RCD"), true,
   "6.6 een testknop die niet werkt is een afkeuring");
eq(gkCrossChecks([{ ...ag1[0], rcdType: "geen" }], { a1_dt: 999 }, basis).length, 0,
   "6.7 zonder aardlek wordt er geen aardlek getoetst");

console.log("▶ CATEGORIE 7: impedantie, met en zonder aardlek");
eq(heeft(gkCrossChecks([], {}, { ...basis, rcdAanwezig: true, zlpe: 200 }), "166Ω"), true,
   "7.1 achter een aardlek geldt de aanraakspanningsnorm");
eq(gkCrossChecks([], {}, { ...basis, rcdAanwezig: true, zlpe: 100 }).length, 0,
   "7.2 100 Ω achter een aardlek is goed");
eq(heeft(gkCrossChecks([], {}, { ...basis, rcdAanwezig: false, zlpe: 2 }), "boven Z_max"), true,
   "7.3 zonder aardlek geldt Z_max — 2 Ω boven de 1,15 van een B40");
eq(heeft(gkCrossChecks([], {}, { ...basis, rcdAanwezig: false, zlpe: 1.1 }), "nadert maximum"), true,
   "7.4 en net eronder is een waarschuwing, geen afkeuring");

console.log("▶ CATEGORIE 8: spanning en inspectiepunten");
eq(heeft(gkCrossChecks([], {}, { ...basis, "span_L1/N": 230, "span_L2/N": 230, "span_L3/N": 221 }),
         "asymmetrie"), true, "8.1 9 V verschil is een aandachtspunt");
eq(gkCrossChecks([], {}, { ...basis, "span_L1/N": 230, "span_L2/N": 228, "span_L3/N": 226 }).length, 0,
   "8.2 4 V verschil is normaal");
eq(heeft(gkCrossChecks([], {}, { ...basis, potentiaalvereffening: "NOK" }), "herstel vereist"), true,
   "8.3 een visueel punt op NOK is een afwijking");

console.log("▶ CATEGORIE 9: PV");
eq(heeft(pvCrossChecks([{ spanning: 400 }, { spanning: 350 }], {}, {}), "verschil"), true,
   "9.1 50 V verschil tussen strings");
eq(heeft(pvCrossChecks([{ iso: 0.8 }], {}, {}), "niet in bedrijf stellen"), true,
   "9.2 een string onder 1 MΩ gaat niet in bedrijf");
eq(heeft(pvCrossChecks([], { aardingOk: "NOK" }, {}), "Aarding draagconstructie"), true,
   "9.3 aarding NOK is een afkeuring");
eq(heeft(pvCrossChecks([], {}, { aantalPanelen: "20", paneelWp: "430", omvormerKw: "5" }), "ratio"), true,
   "9.4 8600 Wp op 5 kW is een hoge verhouding");

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) {
  console.log("\n⚠️  MISLUKTE TESTS:");
  failures.forEach((f) => console.log(f));
  process.exit(1);
}
