// ─────────────────────────────────────────────────────────────────────────────
// Fasebalans — testsuite
//
// Hier hangt advies aan: "waar komt de uitbreiding het beste" en "staan de fasen
// scheef". Een fout hier leidt niet tot een zichtbare storing maar tot een
// verkeerd advies, en dat is erger — niemand merkt het tot de zekering eruit
// vliegt.
//
// Voer uit met:  node tests/test-fasebalans.js
// ─────────────────────────────────────────────────────────────────────────────

import { faseBalans, faseAdvies, FASEN,
         GELIJKTIJDIGHEID, FASE_RESERVE_KW, FASE_KLEUR } from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const gelijk = typeof expected === "number" && typeof actual === "number"
    ? Math.abs(actual - expected) < 0.001
    : JSON.stringify(actual) === JSON.stringify(expected);
  if (gelijk) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${JSON.stringify(expected)}\n     kreeg:    ${JSON.stringify(actual)}`); }
}
const rij = (b, f) => b.rijen.find((r) => r.fase === f);
const ha3 = { f: 3, a: 25 };  // 5,75 kW per fase
const ha1 = { f: 1, a: 25 };

console.log("▶ CATEGORIE 1: capaciteit en de kern van het verhaal");

const leeg = faseBalans({ grp: [], ha: ha3 });
eq(leeg.rijen.length, 3, "1.1 drie fasen bij een 3-fase aansluiting");
eq(rij(leeg, "L1").capaciteitKw, 5.75, "1.2 capaciteit per fase is A x 230 V");
eq(faseBalans({ grp: [], ha: ha1 }).rijen.length, 1, "1.3 één fase bij 1-fase aansluiting");
eq(faseBalans({ grp: [], ha: { f: 3, a: 0 } }), null, "1.4 zonder hoofdzekering valt er niets te toetsen");

// DIT is waarom de Fasecheck bestaat. Drie zware groepen op één fase: het
// TOTAAL past ruim binnen 3 x 25 A, maar L2 loopt over. Een toets op het totaal
// ziet dit niet, een toets per fase wel.
const alleOpL2 = [
  { t: "kook", rol: "af", kw: 7.4, f: 1, fn: [2] },
  { t: "wp",   rol: "af", kw: 6.9, f: 1, fn: [2] },
];
const scheef = faseBalans({ grp: alleOpL2, ha: ha3 });
eq(rij(scheef, "L2").belastingKw, (7.4 + 6.9) * GELIJKTIJDIGHEID, "1.5 beide groepen op L2, met factor");
eq(rij(scheef, "L1").belastingKw, 0, "1.6 L1 draagt niets");
eq(rij(scheef, "L2").niveau, "afwijking", "1.7 L2 loopt over");
eq(scheef.niveau, "afwijking", "1.8 het oordeel volgt de zwaarst belaste fase");
eq(scheef.besteFase, "L1", "1.9 beste fase voor iets nieuws");
// Ter contrast: opgeteld over de hele aansluiting zou dit ruim passen.
eq((7.4 + 6.9) * GELIJKTIJDIGHEID < 3 * 5.75, true, "1.10 hetzelfde totaal past wél op de hele aansluiting");

console.log("▶ CATEGORIE 2: gelijktijdigheid en load balancing");

const eenGroot = [{ t: "lp", rol: "af", kw: 11, f: 1, fn: [1] }];
eq(rij(faseBalans({ grp: eenGroot, ha: ha3 }), "L1").belastingKw, 11 * GELIJKTIJDIGHEID,
   "2.1 grote verbruiker krijgt de factor 0,6");
eq(rij(faseBalans({ grp: eenGroot, ha: ha3, lbAan: true }), "L1").belastingKw, 11,
   "2.2 mét sturing vervalt de korting — vol vermogen is de veilige kant");

// Een gewone groep is geen grote verbruiker en krijgt de korting niet.
const gewoon = [{ t: "alg", rol: "af", kw: 2, f: 1, fn: [1] }];
eq(rij(faseBalans({ grp: gewoon, ha: ha3 }), "L1").belastingKw, 2, "2.3 gewone groep telt vol mee");

// Driefasegroep verdeelt zich over drie fasen.
const drie = [{ t: "lp", rol: "af", kw: 11, f: 3, fn: [1, 2, 3] }];
const b3 = faseBalans({ grp: drie, ha: ha3 });
eq(rij(b3, "L1").belastingKw, (11 / 3) * GELIJKTIJDIGHEID, "2.4 driefasegroep gelijk over drie fasen");
eq(rij(b3, "L3").belastingKw, (11 / 3) * GELIJKTIJDIGHEID, "2.5 ook op L3");

console.log("▶ CATEGORIE 3: gemeten belasting (P1)");

// De kern van stap 1, nu per fase: op een GEMETEN piek gaat de factor niet.
const meting = { L1: 4.2, L2: 1.1, L3: 0.8, bron: "gemeten", label: "gemeten over 7 dagen" };
const gemeten = faseBalans({ grp: eenGroot, ha: ha3, meting });
eq(rij(gemeten, "L1").belastingKw, 4.2, "3.1 gemeten piek wordt onverkort overgenomen");
eq(gemeten.bron, "gemeten", "3.2 bron is gemeten");
eq(gemeten.factor, 1, "3.3 geen gelijktijdigheidsfactor over een meting");
eq(gemeten.label, "gemeten over 7 dagen", "3.4 het label komt uit de meting");
eq(rij(gemeten, "L1").belastingKw !== 4.2 * GELIJKTIJDIGHEID, true,
   "3.5 regressie: een gemeten piek wordt nooit met 0,6 vermenigvuldigd");

// Zonder bruikbare meting wint de schatting — een halve week mag niet als
// "gemeten" door het leven gaan.
eq(faseBalans({ grp: eenGroot, ha: ha3, meting: { L1: 0, L2: 0, L3: 0 } }).bron, "geschat",
   "3.6 meting zonder waarden valt terug op schatting");
eq(faseBalans({ grp: eenGroot, ha: ha3, meting: null }).bron, "geschat", "3.7 geen meting");
eq(faseBalans({ grp: eenGroot, ha: ha3 }).label, "indicatie o.b.v. schatting", "3.8 label bij schatting");

console.log("▶ CATEGORIE 4: onbekende fase wordt niet verzwegen");

const halfBekend = [
  { t: "kook", rol: "af", kw: 7.4, f: 1, fn: [1] },
  { t: "wp",   rol: "af", kw: 6.9, f: 1 },            // geen fn: fase onbekend
];
const half = faseBalans({ grp: halfBekend, ha: ha3 });
eq(half.onbekendKw, 6.9, "4.1 niet-toegerekend vermogen wordt opgeteld");
eq(half.onbekendAantal, 1, "4.2 en geteld");
eq(half.volledig, false, "4.3 de balans is onvolledig");
eq(rij(half, "L1").belastingKw, 7.4 * GELIJKTIJDIGHEID, "4.4 alleen de bekende groep is toegerekend");
eq(faseBalans({ grp: [halfBekend[0]], ha: ha3 }).volledig, true, "4.5 volledig als alles bekend is");

// Bij een 1-fase aansluiting is de fase per definitie bekend.
eq(faseBalans({ grp: halfBekend, ha: ha1 }).volledig, true, "4.6 op 1-fase valt niets te verdelen");

console.log("▶ CATEGORIE 5: vrije ruimte en reserve");

const vrij = faseBalans({ grp: [{ t: "kook", rol: "af", kw: 5, f: 1, fn: [1] }], ha: ha3 });
eq(rij(vrij, "L1").vrijKw, 5.75 - 5 * GELIJKTIJDIGHEID - FASE_RESERVE_KW,
   "5.1 vrije ruimte is capaciteit min belasting min reserve");
eq(rij(vrij, "L2").vrijKw, 5.75 - FASE_RESERVE_KW, "5.2 lege fase houdt de reserve over");
eq(vrij.besteFase !== "L1", true, "5.3 de belaste fase is niet de beste keuze");

console.log("▶ CATEGORIE 6: drempels");

const bij = (kw) => faseBalans({ grp: [{ t: "alg", rol: "af", kw, f: 1, fn: [1] }], ha: ha3 });
eq(rij(bij(4.0), "L1").niveau, "ok", "6.1 4,0 van 5,75 kW (70%) is nog ok");
eq(rij(bij(4.1), "L1").niveau, "let-op", "6.2 net boven 70% is let-op");
eq(rij(bij(5.75), "L1").niveau, "let-op", "6.3 precies vol is nog geen afwijking");
eq(rij(bij(5.8), "L1").niveau, "afwijking", "6.4 erboven is afwijking");

console.log("▶ CATEGORIE 7: teruglevering telt mee, maar telt niet op");
// Besluit Martin 12-09-2026: "teruglevering telt positief mee, stroom is stroom
// — let wel op dat eigengebruik binnen de meter blijft en niet de fasen zal
// raken." Dus per fase de zwaarste van twee richtingen, niet hun som.

const metPv = [{ t: "pv", rol: "voed", kw: 4, f: 1, fn: [1] }];
eq(rij(faseBalans({ grp: metPv, ha: ha3 }), "L1").belastingKw, 4,
   "7.1 teruglevering belast de zekering net zo goed als afname");
// Op de voedende kant gaat geen gelijktijdigheidsfactor: de zon schijnt op alle
// panelen tegelijk. Spec § kam spreekt van "de som van de voedende groepen".
eq(rij(faseBalans({ grp: metPv, ha: ha3 }), "L1").belastingKw !== 4 * GELIJKTIJDIGHEID, true,
   "7.2 geen 0,6 over teruglevering");

// DE KERN VAN HET BESLUIT. 4 kW PV en 3 kW verbruik op dezelfde fase is geen
// 7 kW: wat de panelen leveren en de wasmachine opneemt loopt over de kam van de
// ene groep naar de andere en passeert de hoofdzekering nooit. Het zwaarste
// moment is volle zon zonder verbruik — 4 kW.
{
  const beide = [...metPv, { t: "alg", rol: "af", kw: 3, f: 1, fn: [1] }];
  const r = rij(faseBalans({ grp: beide, ha: ha3 }), "L1");
  eq(r.belastingKw, 4, "7.3 eigengebruik telt niet op bij de teruglevering");
  eq(r.belastingKw !== 4 + 3, true, "7.4 regressie: nooit de som van twee richtingen");
  eq(r.afnameKw, 3, "7.5 de afnamekant blijft apart zichtbaar");
  eq(r.voeding, 4, "7.6 en de voedende kant ook");
  eq(r.richting, "voed", "7.7 de teruglevering bepaalt deze fase");
}
// Meer verbruik dan opwek: dan bepaalt de afname weer.
{
  const meerAf = [...metPv, { t: "alg", rol: "af", kw: 5, f: 1, fn: [1] }];
  const r = rij(faseBalans({ grp: meerAf, ha: ha3 }), "L1");
  eq(r.belastingKw, 5, "7.8 de zwaarste richting wint, hier de afname");
  eq(r.richting, "af", "7.9 en dat staat er ook bij");
}
eq(FASEN, ["L1", "L2", "L3"], "7.10 fasenamen gelijk aan Kastscan");

console.log("▶ CATEGORIE 8: dezelfde kleurtaal als Kastscan");
// Deze hexwaarden staan letterlijk in components/kastscan/model.js › FASE_KLEUR.
// Ze dragen dezelfde fase in de app, in het rapport en in het groepenoverzicht
// van het zusterproject; uit elkaar lopen betekent twee kleurtalen voor één
// installateur. Daarom vastgelegd in plaats van los onderhouden.
eq(FASE_KLEUR, { L1: "#2196F3", L2: "#9B59B6", L3: "#14B8A6" }, "8.1 fasekleuren gelijk aan Kastscan");
eq(FASEN.every((f) => !!FASE_KLEUR[f]), true, "8.2 elke fase heeft een kleur");

console.log("▶ CATEGORIE 9: waar kan het nieuwe apparaat het beste bij?");
// De vraag waar de Fasecheck voor bestaat. Niet "past het ergens", maar "waar" —
// beantwoord vóór de installateur zijn kabel trekt.

const kaal = faseBalans({ grp: [], ha: ha3 });   // 5,75 kW vrij per fase
{
  // Een laadpaal van 11 kW, eenfasig: 11 x 0,6 = 6,6 kW erbij. Dat past op geen
  // enkele fase van 3 x 25 A — ook niet op een lege.
  const a = faseAdvies(kaal, { kw: 11, fasen: 1 });
  eq(a.erbijKw, 11 * GELIJKTIJDIGHEID, "9.1 de factor geldt voor het nieuwe apparaat");
  eq(a.past, false, "9.2 6,6 kW past niet op 5,75 kW");
  eq(a.driefase, false, "9.3 eenfasig");
}
{
  // Diezelfde laadpaal driefasig verdeelt zich: 2,2 kW per fase. Dan past hij wel,
  // en valt er niets te kiezen.
  const a = faseAdvies(kaal, { kw: 11, fasen: 3 });
  eq(a.driefase, true, "9.4 driefasig verdeelt zich");
  eq(a.besteFase, null, "9.5 geen advies waar geen keuze is");
  eq(a.opties[0].erbijKw, (11 * GELIJKTIJDIGHEID) / 3, "9.6 een derde per fase");
  eq(a.past, true, "9.7 en dan past hij wel");
}
{
  // Met een kookgroep op L1 wijst het advies naar een lege fase.
  const b = faseBalans({ grp: [{ t: "kook", rol: "af", kw: 7.4, f: 1, fn: [1] }], ha: ha3 });
  const a = faseAdvies(b, { kw: 3.7, fasen: 1 });
  eq(a.besteFase !== "L1", true, "9.8 niet op de fase waar de kookgroep hangt");
  eq(a.past, true, "9.9 3,7 x 0,6 = 2,2 kW past op een lege fase");
  const opL1 = a.opties.find((o) => o.fase === "L1");
  eq(opL1.naKw, 7.4 * GELIJKTIJDIGHEID + 3.7 * GELIJKTIJDIGHEID, "9.10 op L1 komt het bovenop de kookgroep");
}
{
  // Mét gezamenlijke sturing vervalt de korting, ook voor het nieuwe apparaat:
  // de installatie moet ook bij falende sturing kloppen.
  const b = faseBalans({ grp: [], ha: ha3, lbAan: true });
  eq(faseAdvies(b, { kw: 4, fasen: 1 }).erbijKw, 4, "9.11 met sturing telt het volle vermogen");
}
// Een gewone verbruiker is geen grote verbruiker en krijgt de korting niet.
eq(faseAdvies(kaal, { kw: 2, fasen: 1, groot: false }).erbijKw, 2, "9.12 geen factor over een gewone groep");

// Op een GEMETEN basis gaat de factor niet over de meting, maar wél over het
// apparaat dat er nog bij komt: dat zat niet in die meting.
{
  const gem = faseBalans({ grp: [], ha: ha3, meting: { L1: 4, L2: 1, L3: 1, label: "gemeten" } });
  const a = faseAdvies(gem, { kw: 11, fasen: 1 });
  eq(gem.factor, 1, "9.13 de meting zelf krijgt geen factor");
  eq(a.erbijKw, 11 * GELIJKTIJDIGHEID, "9.14 het nieuwe apparaat wél");
  eq(a.besteFase !== "L1", true, "9.15 en het advies mijdt de zwaarst gemeten fase");
}

// OP ÉÉN FASE VALT ER NIETS TE VERDELEN. Dan is de vraag niet "waar", maar
// alleen "past het" — en een beste fase noemen waar er maar één is, is een
// advies zonder inhoud.
{
  const een = faseBalans({ grp: [{ t: "kook", rol: "af", kw: 7.4, f: 1 }], ha: ha1 });
  // 1 x 25 A = 5,75 kW. De kookgroep neemt daar 4,44 kW van; er blijft 1,3 kW
  // over, dus een apparaat van 2 kW (x 0,6 = 1,2) past net.
  const a = faseAdvies(een, { kw: 2, fasen: 1 });
  eq(a.enkelfase, true, "9.18 eenfasige aansluiting wordt als zodanig gemeld");
  eq(a.besteFase, null, "9.19 en geeft geen beste-fase-advies");
  eq(a.opties.length, 1, "9.20 er is één optie");
  eq(a.past, true, "9.21 de vraag of het past blijft wél beantwoord");
  eq(a.krap, true, "9.22 en of het krap is ook");
  // Een zwaarder apparaat past er niet meer bij.
  eq(faseAdvies(een, { kw: 3.7, fasen: 1 }).past, false, "9.23 3,7 kW erbij past niet op 1 x 25 A");

  // Een driefaseapparaat op een eenfasige aansluiting is geen verdelingsvraag
  // maar een onmogelijkheid.
  const drie = faseAdvies(een, { kw: 11, fasen: 3 });
  eq(drie.onmogelijk, true, "9.24 driefasig kan niet op één fase");
  eq(drie.past, false, "9.25 en past dus niet");
  eq(drie.besteFase, null, "9.26 zonder advies waar het wel zou kunnen");
}
// Op drie fasen blijft het advies gewoon staan.
eq(faseAdvies(kaal, { kw: 2, fasen: 1 }).enkelfase, false, "9.27 drie fasen is niet enkelfase");

eq(faseAdvies(null, { kw: 11 }), null, "9.16 zonder balans geen advies");
eq(faseAdvies(kaal, { kw: 0 }), null, "9.17 zonder vermogen geen advies");

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) {
  console.log("\n⚠️  MISLUKTE TESTS:");
  failures.forEach(f => console.log("  " + f));
  process.exit(1);
}
console.log("\n✅ De fasebalans rekent per fase, zoals de stroom loopt");
