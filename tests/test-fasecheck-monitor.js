// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — fasecheck-monitoring
//
// Drie dingen worden hier bewaakt, en ze komen alle drie uit de featurespec van de
// P1-meting: er wordt in vermogen gerekend en niet in stroom, een fase voelt de
// zwaarste van twee richtingen en nooit hun som, en een kastje dat zwijgt is een
// melding en niet een lege grafiek.
//
// Voer uit met:  node tests/test-fasecheck-monitor.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  STIL_LETOP_MS, STIL_OFFLINE_MS, BEZET_LETOP, BEZET_ERNSTIG,
  ONBALANS_LETOP_A, ONBALANS_ERNSTIG_A,
  ampereUitKw, telegramNaarMeting, piekPerFase, bezetting, onbalans,
  dongleStatus, monitorOordeel, monitorAdvies, maakSessiecode, koppelControle,
} from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}
const rond = (v, n = 1) => (v == null ? null : Math.round(v * 10 ** n) / 10 ** n);

console.log("▶ CATEGORIE 1: van telegram naar meetpunt");
const t1 = telegramNaarMeting({ tijd: "2026-10-02T19:40:00Z",
  active_power_l1_w: 5313, active_power_l2_w: 3082, active_power_l3_w: 2254 });
eq(rond(t1.fasen.L1.kw, 3), 5.313, "1.1 watt wordt kW");
eq(rond(t1.fasen.L1.ampere), 23.1, "1.2 en de stroom volgt uit het vermogen, niet omgekeerd");
eq(t1.fasenGezien, ["L1", "L2", "L3"], "1.3 drie fasen gezien");
// DSMR-sleutels in kW moeten net zo goed werken: welk kastje er hangt is aan de
// installateur, niet aan ons.
const t2 = telegramNaarMeting({ "1-0:21.7.0": 1.5, "1-0:41.7.0": 0.8, "1-0:61.7.0": 0.4 });
eq(rond(t2.fasen.L1.kw, 2), 1.5, "1.4 ruwe DSMR-sleutels in kW worden niet door 1000 gedeeld");
const een = telegramNaarMeting({ active_power_l1_w: 2300 });
eq(een.fasenGezien, ["L1"], "1.5 een eenfasige meter geeft één fase");
eq(een.fasen.L2, null, "1.6 en L2 is null, geen nul");
eq(telegramNaarMeting({}), null, "1.7 een leeg telegram levert niets op");
eq(telegramNaarMeting(null), null, "1.8 en null ook niet");

console.log("▶ CATEGORIE 2: de zwaarste van twee richtingen, nooit de som");
const terug = telegramNaarMeting({ active_power_l1_w: 500, active_power_returned_l1_w: 3000 });
eq(rond(terug.fasen.L1.kw, 1), 3, "2.1 bij teruglevering weegt de teruglevering");
eq(terug.fasen.L1.richting, "terug", "2.2 en de richting staat erbij");
eq(rond(terug.fasen.L1.kw, 1) !== 3.5, true, "2.3 niet de som van 0,5 en 3,0");
const af = telegramNaarMeting({ active_power_l1_w: 4000, active_power_returned_l1_w: 100 });
eq([rond(af.fasen.L1.kw, 1), af.fasen.L1.richting], [4, "af"], "2.4 en andersom net zo");
eq(rond(ampereUitKw(5.75), 1), 25, "2.5 5,75 kW op 230 V is 25 A");

console.log("▶ CATEGORIE 3: piek per fase, met het moment erbij");
const reeks = [
  telegramNaarMeting({ tijd: "2026-10-02T07:10:00Z", active_power_l1_w: 3000, active_power_l2_w: 1000, active_power_l3_w: 900 }),
  telegramNaarMeting({ tijd: "2026-10-02T19:40:00Z", active_power_l1_w: 5313, active_power_l2_w: 3082, active_power_l3_w: 2254 }),
  telegramNaarMeting({ tijd: "2026-10-02T23:00:00Z", active_power_l1_w: 400, active_power_l2_w: 300, active_power_l3_w: 200 }),
];
const piek = piekPerFase(reeks);
eq(rond(piek.L1.ampere), 23.1, "3.1 de piek van L1");
eq(piek.L1.tijd, "2026-10-02T19:40:00.000Z", "3.2 met het moment — een piek om 19:40 is een auto");
eq(rond(piek.L3.ampere), 9.8, "3.3 en L3 blijft laag");
eq(piekPerFase([]).L1, null, "3.4 zonder metingen geen piek");

console.log("▶ CATEGORIE 4: hoe vol zit de zekering");
eq(BEZET_ERNSTIG, 0.8, "4.1 de waarschuwingsgrens staat op 80 %");
eq(bezetting(23.1, 25).niveau, "ernstig", "4.2 23,1 A op een 25 A-zekering is 92 %");
eq(bezetting(16, 25).niveau, "let-op", "4.3 64 % is een aandachtspunt");
eq(bezetting(10, 25).niveau, "ok", "4.4 40 % is gewoon goed");
eq(bezetting(10, 0), null, "4.5 zonder zekeringwaarde geen oordeel");
eq(bezetting(null, 25), null, "4.6 en zonder meting ook niet");

console.log("▶ CATEGORIE 5: onbalans is een vuistregel, niet een norm");
eq([ONBALANS_LETOP_A, ONBALANS_ERNSTIG_A], [16, 20], "5.1 16 A aandacht, 20 A ernstig");
eq(onbalans(piek).niveau, "ok", "5.2 13 A verschil blijft onder de vuistregel");
const scheef = piekPerFase([telegramNaarMeting({ active_power_l1_w: 6500, active_power_l2_w: 1000, active_power_l3_w: 900 })]);
const ob = onbalans(scheef);
eq(ob.niveau, "ernstig", "5.3 24 A verschil is ernstig");
eq([ob.zwaarste, ob.lichtste], ["L1", "L3"], "5.4 met de zwaarste en de lichtste erbij");
eq(ob.bron, "vuistregel Netbeheer Nederland", "5.5 en de bron, want dit is geen NEN-grens");
eq(onbalans(piekPerFase([telegramNaarMeting({ active_power_l1_w: 2300 })])), null,
   "5.6 op een eenfasige aansluiting bestaat onbalans niet — null, geen '0 A, prima'");

console.log("▶ CATEGORIE 6: een kastje dat zwijgt");
const nu = new Date("2026-10-02T20:00:00Z");
const sessie = { dongleId: "NRGD-4A17", code: "7F3K", zekeringA: 25, dagen: 7,
                 startOp: "2026-09-29T08:00:00Z", laatsteTelegram: "2026-10-02T19:59:54Z" };
eq(dongleStatus(sessie, nu).status, "actief", "6.1 zes seconden stil is actief");
eq(dongleStatus(sessie, nu).dag, 4, "6.2 dag 4 van de meting");
eq(dongleStatus({ ...sessie, laatsteTelegram: "2026-10-02T19:30:00Z" }, nu).status, "hapert",
   "6.3 een half uur stil hapert");
eq(dongleStatus({ ...sessie, laatsteTelegram: "2026-10-02T17:00:00Z" }, nu).status, "offline",
   "6.4 drie uur stil is offline");
eq(dongleStatus({ ...sessie, laatsteTelegram: null }, nu).status, "wacht",
   "6.5 nooit iets ontvangen is 'wacht', niet 'offline'");
eq(dongleStatus({ ...sessie, afgerondOp: "2026-10-01T09:00:00Z" }, nu).status, "afgerond",
   "6.6 een afgeronde meting hapert niet meer");
eq(STIL_LETOP_MS < STIL_OFFLINE_MS, true, "6.7 de grenzen staan in de juiste volgorde");

console.log("▶ CATEGORIE 7: het oordeel over één adres");
const o = monitorOordeel({ sessie, metingen: reeks }, nu);
eq(o.status, "Aandacht", "7.1 L1 op 92 % vraagt aandacht");
eq(o.niveau, "ernstig", "7.2 en dat is het zwaarste niveau");
eq(o.meldingen[0].tekst, "L1 boven 80 % van de zekering", "7.3 in de taal van de mock-up");
eq(o.fasen.length, 3, "7.4 drie fasen in de uitkomst");
const stil = monitorOordeel({ sessie: { ...sessie, laatsteTelegram: "2026-10-02T15:00:00Z" }, metingen: reeks }, nu);
eq(stil.status, "Offline", "7.5 offline gaat vóór 'aandacht' — een stil kastje weet van niets");
const rustig = monitorOordeel({ sessie, metingen: [reeks[2]] }, nu);
eq(rustig.status, "Meting loopt", "7.6 een rustige avond is gewoon 'meting loopt'");
eq(monitorOordeel({ sessie: { ...sessie, afgerondOp: "x" }, metingen: reeks }, nu).status, "Afgerond",
   "7.7 een afgeronde meting is afgerond");

console.log("▶ CATEGORIE 8: het advies zegt hoeveel en waarheen, niet wélke groep");
const advies = monitorAdvies(o);
eq([advies.nodig, advies.van, advies.naar], [true, "L1", "L3"], "8.1 van de zwaarste naar de lichtste");
eq(Math.round(advies.wegA), 3, "8.2 ruim 3 A moet van L1 af om onder 80 % te komen");
eq(Math.round(advies.ruimteA), 10, "8.3 en op L3 is 10 A vrij");
eq(advies.tekst.includes("groep"), false, "8.4 geen 'verplaats groep X' — welke groep staat in het kastbeeld");
eq(monitorAdvies(rustig).nodig, false, "8.5 is er niets aan de hand, dan zegt het advies dat");
eq(monitorAdvies({ fasen: [] }), null, "8.6 zonder fasen geen advies");

console.log("▶ CATEGORIE 9: koppelen op dongle-ID plus sessiecode");
const code = maakSessiecode(6, () => 0.5);
eq(code.length, 6, "9.1 een code van zes tekens");
eq(/^[A-HJ-NP-Z2-9]+$/.test(code), true, "9.2 zonder I, O, 0 en 1 — die worden verkeerd overgetypt");
eq(koppelControle({ dongleId: "NRGD-4A17", code: "7F3K" }, sessie).ok, true, "9.3 de juiste combinatie");
eq(koppelControle({ dongleId: "NRGD-4A17", code: "7f3k" }, sessie).ok, true, "9.4 kleine letters mogen");
eq(koppelControle({ dongleId: "NRGD-4A17", code: "XXXX" }, sessie).ok, false,
   "9.5 een verkeerde code is een weigering, geen 'bijna goed'");
eq(koppelControle({ dongleId: "ANDERS", code: "7F3K" }, sessie).ok, false,
   "9.6 het ID van de buren hoort hier niet");
eq(koppelControle({ dongleId: "NRGD-4A17", code: "7F3K" }, { ...sessie, afgerondOp: "x" }).ok, false,
   "9.7 na afronden komt er niets meer bij");
eq(koppelControle({ dongleId: "x", code: "y" }, null).ok, false, "9.8 een onbekende sessie weigert");

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) { console.log("\n⚠️  MISLUKTE TESTS:"); failures.forEach((f) => console.log(f)); process.exit(1); }
