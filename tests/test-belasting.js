// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — belastingcheck en belasting per fase
//
// De normregels die YourWkb en Kastscan delen: de gelijktijdigheidsfactor 0,6,
// de toets per fase, teruglevering als zwaarste-van-twee-richtingen, en de
// herkomst van de basisbelasting (geschat of gemeten).
//
// Deze tests stonden tot 30-09-2026 in de suite van YourWkb. Ze horen bij de
// motor: zodra Kastscan dezelfde motor gebruikt, moeten de regels op één plek
// bewaakt worden en niet in de app die ze toevallig het eerst nodig had.
//
// Voer uit met:  node tests/test-belasting.js
// ─────────────────────────────────────────────────────────────────────────────

import { isGroteVerbruikerMkp, groepVermogenKw, belastingcheck, belastingPerFase,
         GELIJKTIJDIGHEID, GROOT_STANDAARD_KW,
         FASE_RESERVE_KW, periodeLabel, basisbelastingKw } from "../index.js";

let passed = 0, failed = 0;
const failures = [];

function eq(actual, expected, label) {
  const beideNaN = typeof expected === "number" && typeof actual === "number" && isNaN(expected) && isNaN(actual);
  const match = beideNaN ? true
    : typeof expected === "number" ? Math.abs(actual - expected) < 0.001
    : actual === expected;
  if (match) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${expected}\n     kreeg:    ${actual}`); }
}

// ═════════════════════════════════════════════════════════════════════════════
// 13 · BELASTINGCHECK — gelijktijdigheidsfactor 0,6 (roadmap 2.1)
// ═════════════════════════════════════════════════════════════════════════════
//
// Overgenomen uit Kastscan, 03-09-2026. De regel staat in deze app zelf:
// "Zonder gezamenlijke sturing rekent de belastingcheck conservatief met
// gelijktijdigheidsfactor 0,6 over de grote verbruikers (NEN-EN-IEC 61439)."
// De factor gaat OP die verbruikers en niet eromheen.

eq(GELIJKTIJDIGHEID, 0.6, "13.1 de factor is 0,6");
["lp", "wp", "kook", "bat"].forEach(t =>
  eq(isGroteVerbruikerMkp(t), true, `13.2 ${t} is een grote verbruiker`));
["alg", "ov", "pv", "", null].forEach(t =>
  eq(isGroteVerbruikerMkp(t), false, `13.3 ${t || "(leeg)"} is dat niet`));

// Een ingevuld vermogen wint van de terugvalwaarde.
eq(groepVermogenKw({ t: "lp", kw: 11 }), 11, "13.4a ingevuld vermogen telt");
eq(groepVermogenKw({ t: "lp" }), GROOT_STANDAARD_KW.lp, "13.4b terugval bij een grote verbruiker");
eq(isNaN(groepVermogenKw({ t: "alg" })), true, "13.4c geen terugval bij een gewone groep");

const ha3 = { f: 3, a: 25 };   // 3 × 25 A = 17,25 kW

// De factor raakt alleen de grote verbruikers.
{
  // 2 kW gewoon + 11 kW laadpaal. Zonder sturing: 2 + 11 × 0,6 = 8,6 van 17,25.
  const grp = [{ t: "alg", rol: "af", kw: 2 }, { t: "lp", rol: "af", kw: 11 }];
  eq(belastingcheck(grp, ha3, false, "2026-09-03").r, "groen", "13.5a onder 70% is groen");
  // Mét sturing vervalt de korting: 2 + 11 = 13 van 17,25 = 75%.
  eq(belastingcheck(grp, ha3, true, "2026-09-03").r, "oranje", "13.5b met sturing vervalt de korting");
}
{
  // Twee laadpalen en een warmtepomp: 11 + 11 + 12 = 34 kW aansluitwaarde.
  // Zonder sturing 20,4 van 17,25 — nog altijd boven de capaciteit.
  const grp = [{ t: "lp", rol: "af", kw: 11 }, { t: "lp", rol: "af", kw: 11 }, { t: "wp", rol: "af", kw: 12 }];
  eq(belastingcheck(grp, ha3, false, "2026-09-03").r, "rood", "13.6 boven de capaciteit is rood");
}

// Voedende groepen tellen niet mee: het slechtste geval is geen zon en een lege
// accu. PV als negatieve belasting hoort bij de Fasecheck (R3b), niet hier.
{
  const grp = [{ t: "lp", rol: "af", kw: 11 }, { t: "pv", rol: "voed", kw: 8 }];
  const zonderPv = belastingcheck([{ t: "lp", rol: "af", kw: 11 }], ha3, false, "2026-09-03");
  eq(belastingcheck(grp, ha3, false, "2026-09-03").r, zonderPv.r, "13.7 PV verlaagt de uitkomst niet");
}

// Geen uitspraak doen waar niets te toetsen valt — "groen" zou dan nergens op
// steunen.
eq(belastingcheck([{ t: "lp", rol: "af", kw: 11 }], { f: 3 }, false, "d"), null,
   "13.8a zonder hoofdzekering geen check");
eq(belastingcheck([], ha3, false, "d"), null, "13.8b zonder groepen geen check");
eq(belastingcheck([{ t: "alg", rol: "af" }], ha3, false, "d"), null,
   "13.8c zonder een enkel bekend vermogen geen check");
// Alleen PV is wél te toetsen — sinds 12-09-2026. Die omvormer duwt zijn stroom
// door dezelfde hoofdzekering; dat er niets afneemt maakt hem niet onzichtbaar.
eq(belastingcheck([{ t: "pv", rol: "voed", kw: 8 }], ha3, false, "d").r, "groen",
   "13.8d alleen voedende groepen geven wél een check: 8 van 17,3 kW over de aansluiting");
eq(belastingcheck([{ t: "pv", rol: "voed", kw: 8, f: 1, fn: [1] }], ha3, false, "d").r, "rood",
   "13.8e en op één fase is diezelfde omvormer 8 van 5,8 kW");

// De woorden volgen chkKleur in WkbApp.jsx: die leest op "groen" en "rood" en
// valt voor al het overige terug op oranje. Een eigen woordkeus zou daar stil
// oranje opleveren in plaats van een fout.
{
  const uit = belastingcheck([{ t: "lp", rol: "af", kw: 11 }], ha3, false, "2026-09-03");
  eq(["groen", "oranje", "rood"].includes(uit.r), true, "13.9a alleen de drie bekende woorden");
  eq(uit.d, "2026-09-03", "13.9b met de datum erbij");
}

// Een enkelfasige aansluiting heeft een derde van de capaciteit.
eq(belastingcheck([{ t: "kook", rol: "af", kw: 7.4 }], { f: 1, a: 25 }, false, "d").r, "oranje",
   "13.10a 1 x 25 A: kookgroep met factor is 4,44 van 5,75 = 77% — oranje");
eq(belastingcheck([{ t: "kook", rol: "af", kw: 7.4 }, { t: "wp", rol: "af", kw: 6.9 }],
   { f: 1, a: 25 }, false, "d").r, "rood",
   "13.10b met de warmtepomp erbij 8,58 van 5,75 — rood");

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n▶ CATEGORIE 13b: de belastingcheck toetst PER FASE (besluit Martin 11-09-2026)");
// ═════════════════════════════════════════════════════════════════════════════
//
// Net als Kastscan. Hier zat het echte verschil tussen de twee apps: niet in
// waar de gelijktijdigheidsfactor op wordt losgelaten — 0,6 x (A+B) is
// hetzelfde als 0,6xA + 0,6xB — maar in waartegen er wordt getoetst. Kastscan
// legt elke fase langs de capaciteit van díé fase, YourWkb legde het totaal
// langs drie fasen samen. Daardoor kon dezelfde kast daar rood zijn en hier
// groen.

// HET GEVAL WAAR HET OM DRAAIT. Kookgroep en warmtepomp allebei op L2:
// 8,58 kW van de 17,25 kW van de aansluiting — de helft, dus over het totaal
// ruim groen. Maar op L2 zelf is het 8,58 van 5,75 kW: 149%.
{
  const beideOpL2 = [
    { t: "kook", rol: "af", kw: 7.4, f: 1, fn: [2] },
    { t: "wp",   rol: "af", kw: 6.9, f: 1, fn: [2] },
  ];
  eq((7.4 + 6.9) * GELIJKTIJDIGHEID / 17.25 < 0.7, true,
     "13b.1 over het totaal zou dit onder de 70% blijven");
  eq(belastingcheck(beideOpL2, ha3, false, "d").r, "rood",
     "13b.2 maar op L2 loopt het over: rood");

  // Dezelfde twee groepen, verdeeld: 4,44 op L1 en 4,14 op L2 van 5,75.
  const verdeeld = [
    { t: "kook", rol: "af", kw: 7.4, f: 1, fn: [1] },
    { t: "wp",   rol: "af", kw: 6.9, f: 1, fn: [2] },
  ];
  eq(belastingcheck(verdeeld, ha3, false, "d").r, "oranje",
     "13b.3 verdelen over twee fasen maakt van rood oranje — zonder dat er iets verdwijnt");
}

// Een driefasegroep verdeelt zich en loopt dus niet als geheel over één fase.
eq(belastingcheck([{ t: "lp", rol: "af", kw: 11, f: 3, fn: [1, 2, 3] }], ha3, false, "d").r, "groen",
   "13b.4 driefasig verdeelt zich over drie fasen");
eq(belastingcheck([{ t: "lp", rol: "af", kw: 11, f: 1, fn: [1] }], ha3, false, "d").r, "rood",
   "13b.5 diezelfde laadpaal op één fase is 6,6 van 5,75 — rood");

// HET VANGNET. Zonder vastgelegde fase kan er per fase niets getoetst worden.
// Dan blijft de totaaltoets over — anders zou een kast groen worden door wat
// er ontbreekt in plaats van door wat er staat.
{
  const zonderFase = [{ t: "kook", rol: "af", kw: 7.4 }, { t: "wp", rol: "af", kw: 6.9 }];
  eq(belastingcheck(zonderFase, ha3, false, "d").r, "groen",
     "13b.6 zonder fase valt de check terug op het totaal");
  const pf = belastingPerFase(zonderFase, ha3, false);
  eq(pf.onbekendAantal, 2, "13b.7 en die groepen staan als onbekend geteld");
  eq(pf.onbekendKw, 7.4 + 6.9, "13b.8 inclusief hun vermogen");
}

// Teruglevering telt mee maar telt niet op (besluit Martin 12-09-2026).
{
  const pvEnVerbruik = [
    { t: "pv",  rol: "voed", kw: 5, f: 1, fn: [1] },
    { t: "alg", rol: "af",   kw: 3, f: 1, fn: [1] },
  ];
  const pf = belastingPerFase(pvEnVerbruik, ha3, false);
  eq(pf.belasting.L1, 5, "13b.12 de zwaarste richting bepaalt de fase, niet de som");
  eq(pf.belasting.L1 !== 5 + 3, true, "13b.13 regressie: geen 8 kW op een fase die nooit 8 kW ziet");
  eq(pf.richting.L1, "voed", "13b.14 hier is dat de teruglevering");
  eq(basisbelastingKw(pvEnVerbruik, false).richting, "voed",
     "13b.15 de totaaltoets kijkt dezelfde kant op");
}

// Een thuisbatterij staat sinds 12-09-2026 als twee regels in het paspoort, en
// dat maakt uit zodra laden en ontladen niet even zwaar zijn. Laden is een
// afname van een grote verbruiker (dus mét de factor 0,6), ontladen levert aan
// de kam (dus zonder korting).
{
  const accu = [
    { t: "bat", rol: "voed", kw: 3,  f: 1, fn: [1] },   // ontladen
    { t: "bat", rol: "af",   kw: 11, f: 1, fn: [1] },   // laden
  ];
  const pf = belastingPerFase(accu, ha3, false);
  eq(pf.voeding.L1, 3, "13b.16 ontladen aan de leverende kant");
  eq(pf.afname.L1, 11 * GELIJKTIJDIGHEID, "13b.17 laden aan de afnemende kant, mét de factor");
  eq(pf.belasting.L1, 11 * GELIJKTIJDIGHEID, "13b.18 de ladende kant is hier de zwaarste");
  eq(pf.richting.L1, "af", "13b.19 en dat is de afnemende richting");
  eq(belastingcheck(accu, ha3, false, "d").r, "rood", "13b.20 6,6 van 5,8 kW op L1 — rood");
  // Vóór de tweede regel telde alleen het ontlaadvermogen mee: 3 van 5,8 = 52%.
  eq(belastingcheck([accu[0]], ha3, false, "d").r, "groen",
     "13b.21 met alleen de ontladende regel zou dezelfde accu groen zijn");

  // Zonder vastgelegde fase geldt ook in de onbekend-pot de zwaarste richting,
  // niet de som: die accu laadt en ontlaadt nooit tegelijk.
  const zonderFase = accu.map(({ fn, ...rest }) => rest);
  eq(belastingPerFase(zonderFase, ha3, false).onbekendKw, 11,
     "13b.22 onbekend vermogen is de zwaarste richting, geen 14 kW");
}

// Een enkelfasige aansluiting had de toets al per fase — die heeft er maar één.
eq(belastingcheck([{ t: "kook", rol: "af", kw: 7.4 }], { f: 1, a: 25 }, false, "d").r, "oranje",
   "13b.9 op 1 fase verandert er niets");

// belastingPerFase gebruikt DEZELFDE terugvalwaarde als basisbelastingKw. Anders
// zou een laadpaal zonder ingevuld vermogen in de totaaltoets als 7,4 kW meetellen
// en in de fasetoets als nul — dan is de strengste van twee toetsen ineens de
// minst goed geïnformeerde.
{
  const pf = belastingPerFase([{ t: "lp", rol: "af", f: 1, fn: [1] }], ha3, false);
  eq(pf.belasting.L1, GROOT_STANDAARD_KW.lp * GELIJKTIJDIGHEID,
     "13b.10 laadpaal zonder kw valt terug op de standaardwaarde");
  eq(belastingPerFase([{ t: "alg", rol: "af", f: 1, fn: [1] }], ha3, false).belasting.L1, 0,
     "13b.11 een gewone groep zonder kw heeft geen terugvalwaarde");
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n▶ CATEGORIE 14: herkomst basisbelasting — geschat vs gemeten (fasecheck v1)");

// De kern van stap 1. Dezelfde installatie, twee bronnen:
//   geschat  → 11 kW laadpaal × 0,6 = 6,6 kW
//   gemeten  → wat de meter zag, ONGEKORT
const lpAlleen = [{ t: "lp", rol: "af", kw: 11 }];

eq(basisbelastingKw(lpAlleen, false, null).kw, 6.6,
   "14.1 geschat: de factor 0,6 gaat over de grote verbruiker");
eq(basisbelastingKw(lpAlleen, false, null).bron, "geschat", "14.2 bron is geschat");

eq(basisbelastingKw(lpAlleen, false, { piekKw: 6.6, dagen: 7 }).kw, 6.6,
   "14.3 gemeten: de gemeten piek wordt onverkort overgenomen");
eq(basisbelastingKw(lpAlleen, false, { piekKw: 6.6, dagen: 7 }).bron, "gemeten",
   "14.4 bron is gemeten");

// Dít is de fout die stap 1 moet voorkomen: de factor nogmaals over een
// gemeten piek leggen strijkt 40% van een echte meting weg.
eq(basisbelastingKw(lpAlleen, false, { piekKw: 10, dagen: 7 }).kw, 10,
   "14.5 de gelijktijdigheidsfactor gaat NIET over een gemeten piek");
eq(basisbelastingKw(lpAlleen, false, { piekKw: 10, dagen: 7 }).kw !== 10 * GELIJKTIJDIGHEID, true,
   "14.6 regressie: een gemeten piek wordt nooit met 0,6 vermenigvuldigd");

// Load balancing raakt alleen de schatting. Een meting is een meting.
eq(basisbelastingKw(lpAlleen, true, null).kw, 11,
   "14.7 geschat met sturing: korting vervalt, vol vermogen");
eq(basisbelastingKw(lpAlleen, true, { piekKw: 7.2, dagen: 7 }).kw, 7.2,
   "14.8 gemeten: de lbAan-vlag verandert een meting niet");

// Terugval: zonder bruikbare piek wint de schatting. beoordeelMeetkwaliteit
// levert bij te weinig dekking geen piek, en een halve week mag niet als
// "gemeten" door het leven gaan.
eq(basisbelastingKw(lpAlleen, false, { piekKw: 0, dagen: 7 }).bron, "geschat",
   "14.9 piek 0 telt niet als meting");
eq(basisbelastingKw(lpAlleen, false, { dagen: 7 }).bron, "geschat",
   "14.10 meting zonder piek valt terug op schatting");
eq(basisbelastingKw(lpAlleen, false, {}).bron, "geschat",
   "14.11 leeg meetobject valt terug op schatting");
eq(basisbelastingKw([], false, null), null,
   "14.12 zonder groepen en zonder meting valt er niets te toetsen");
eq(basisbelastingKw([], false, { piekKw: 4.2, dagen: 6 }).kw, 4.2,
   "14.13 een meting staat op eigen benen — ook zonder paspoortgroepen");

// Het label is wat de installateur leest. "indicatie" moet weg zodra er
// gemeten is, anders blijft het rapport zichzelf tegenspreken.
eq(basisbelastingKw(lpAlleen, false, null).label, "indicatie o.b.v. schatting",
   "14.14 label bij schatting");
eq(basisbelastingKw(lpAlleen, false, { piekKw: 5, dagen: 7 }).label.startsWith("gemeten over 7 dagen"), true,
   "14.15 label bij meting noemt het aantal dagen");
eq(basisbelastingKw(lpAlleen, false, { piekKw: 5, dagen: 1 }).label, "gemeten over 1 dag",
   "14.16 enkelvoud bij één dag");

// De periode komt uit epoch-seconden (formaat yourwkb-p1).
eq(periodeLabel(1788998400, 1789603200), "10-09 t/m 17-09", "14.17 periodelabel dd-mm");
eq(periodeLabel(null, null), null, "14.18 zonder periode geen periodelabel");

// De reserve blijft staan: een week in september zegt niets over januari met
// een warmtepomp.
eq(FASE_RESERVE_KW, 1.0, "14.19 reserve blijft 1,0 kW");

// En de doorwerking naar de check zelf: dezelfde kast, gemeten zwaarder dan
// geschat, geeft een strenger oordeel.
const ha3ref = { f: 3, a: 25 };
eq(belastingcheck(lpAlleen, ha3ref, false, "2026-09-11").r, "groen",
   "14.20 geschat 6,6 van 17,25 kW is groen");
eq(belastingcheck(lpAlleen, ha3ref, false, "2026-09-11", { piekKw: 13, dagen: 7 }).r, "oranje",
   "14.21 gemeten 13 van 17,25 kW is oranje — de meting stuurt het oordeel");
eq(belastingcheck(lpAlleen, ha3ref, false, "2026-09-11", { piekKw: 18, dagen: 7 }).r, "rood",
   "14.22 gemeten boven de capaciteit is rood");

// De uitkomstvorm blijft ongewijzigd: p.chk gaat rechtstreeks de QR in en het
// meterkastpaspoort is een open standaard.
eq(Object.keys(belastingcheck(lpAlleen, ha3ref, false, "d", { piekKw: 13, dagen: 7 })).sort().join(","),
   "d,r", "14.23 uitkomst blijft {r,d} — geen stille spec-wijziging in de QR");

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length > 0) {
  console.log("\n⚠️  MISLUKTE TESTS:");
  failures.forEach(f => console.log("  " + f));
  process.exit(1);
} else {
  console.log("\n✅ Alle tests geslaagd — de belastingregels van de motor kloppen");
  process.exit(0);
}
