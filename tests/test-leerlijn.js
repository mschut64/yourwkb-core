// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de leerlijn
//
// De test die het hart raakt staat in categorie 5: punten komen alleen uit een
// beoordeling. Zou er een andere ingang zijn, dan is een level een getal dat
// niets zegt en is de erkenning aan het eind van de leerlijn waardeloos.
//
// Voer uit met:  node tests/test-leerlijn.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  NIVEAUS, SKILLS, BADGES, POORT_CIJFER,
  skillsVoor, maxPunten, skillOpen, voortgang, streak, badges,
  skillsUitKlus, verwerkBeoordeling, verwerkKennisantwoord, toegangTotHoofdapp,
} from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

console.log("▶ CATEGORIE 1: de leerlijn is een lijn, geen lijstje");
eq(NIVEAUS.length, 3, "1.1 drie niveaus");
eq(skillsVoor("groepenkast").length, 9, "1.2 negen skills voor de groepenkast");
eq(Object.keys(SKILLS).length, 6, "1.3 alle zes disciplines hebben een leerlijn");
eq(maxPunten("groepenkast"), 165, "1.4 de groepenkast is 165 punten waard");
const rcd = skillsVoor("groepenkast").find((s) => s.id === "gk-rcd");
eq(skillOpen(rcd, []), false, "1.5 de aardlektest gaat niet open zonder aarding");
eq(skillOpen(rcd, ["gk-aarding"]), true, "1.6 en daarna wel");
eq(skillsVoor("groepenkast").filter((s) => s.eis === "klus").map((s) => s.id),
   ["gk-kast", "gk-rapport"], "1.7 twee skills vragen een hele goedgekeurde klus");

console.log("▶ CATEGORIE 2: voortgang en level");
const v0 = voortgang("groepenkast", []);
eq([v0.punten, v0.level, v0.levelLabel], [0, 1, "Beginner"], "2.1 niets gehaald: beginner");
eq(v0.volgende.id, "gk-aarding", "2.2 en de eerste stap staat klaar");
eq(v0.open.includes("gk-rcd"), false, "2.3 wat nog op slot zit staat er niet bij");
const niveau1 = ["gk-aarding", "gk-indeling", "gk-isolatie"];
const v1 = voortgang("groepenkast", niveau1);
eq([v1.punten, v1.level], [35, 2], "2.4 heel niveau 1 af: level 2");
// Het level komt niet uit punten: wie de twee klus-skills van niveau 3 zou halen
// (65 punten) zonder niveau 1 blijft level 1 — dat is de hele reden.
const sluip = voortgang("groepenkast", ["gk-kast", "gk-rapport"]);
eq([sluip.punten, sluip.level], [65, 1], "2.5 veel punten zonder niveau 1 geeft géén level 2");
const alles = skillsVoor("groepenkast").map((s) => s.id);
const vA = voortgang("groepenkast", alles);
eq([vA.level, vA.af, vA.volgende], [3, true, null], "2.6 alles af: niveau 3 en niets meer open");

console.log("▶ CATEGORIE 3: de streak");
const dag = (n) => new Date(2026, 9, n, 14, 0, 0); // oktober 2026, lokale tijd
const nu = dag(5);
eq(streak([dag(3), dag(4), dag(5)], nu).dagen, 3, "3.1 drie dagen op rij");
eq(streak([dag(3), dag(4)], nu).dagen, 2, "3.2 vandaag nog niets gedaan breekt de streak niet");
eq(streak([dag(3), dag(4)], nu).actiefVandaag, false, "3.3 maar 'vandaag' staat wel op false");
eq(streak([dag(1), dag(2), dag(5)], nu).dagen, 1, "3.4 een dag overslaan breekt hem wel");
eq(streak([dag(1), dag(2), dag(5)], nu).langste, 2, "3.5 de langste reeks ooit blijft bewaard");
eq(streak([], nu).dagen, 0, "3.6 niets is nul");
eq(streak([dag(5), dag(5), dag(4)], nu).dagen, 2, "3.7 twee keer op één dag is één dag");

console.log("▶ CATEGORIE 4: badges hangen aan beoordeeld werk");
const stand = {
  gehaald: niveau1, disciplines: ["groepenkast"], streakDagen: 8,
  klussen: [{ discipline: "groepenkast", goedgekeurd: true, afwijkingen: 0,
              onderdelenAkkoord: 6, onderdelenTotaal: 6, cijfer: 8 }],
};
const b = badges(stand).map((x) => x.id);
eq(b.includes("eerste-klus"), true, "4.1 een goedgekeurde klus geeft de eerste badge");
eq(b.includes("foutloze-kast"), true, "4.2 zonder normafwijking de foutloze kast");
eq(b.includes("meetstaat"), true, "4.3 en met alle onderdelen akkoord de perfecte meetstaat");
eq(b.includes("week"), true, "4.4 acht dagen op rij is de weekbadge");
eq(b.includes("maand"), false, "4.5 maar nog niet de maand");
eq(badges({ ...stand, klussen: [{ discipline: "groepenkast", goedgekeurd: false }] })
     .map((x) => x.id).includes("eerste-klus"), false,
   "4.6 een ingeleverde maar niet goedgekeurde klus geeft niets");
eq(badges({ gehaald: [], klussen: [], streakDagen: 0 }).length, 0, "4.7 een lege stand geeft geen badges");
eq(BADGES.every((x) => x.uitleg && x.uitleg.length > 10), true, "4.8 elke badge zegt waarvoor hij is");

console.log("▶ CATEGORIE 5: punten komen ALLEEN uit een beoordeling");
const na = verwerkBeoordeling({ gehaald: [] },
  { goedgekeurd: true, skills: ["gk-aarding"], discipline: "groepenkast" });
eq(na.erbij, ["gk-aarding"], "5.1 wat de beoordelaar aftekent komt erbij");
eq(verwerkBeoordeling({ gehaald: [] },
     { goedgekeurd: false, skills: ["gk-aarding"] }).erbij, [],
   "5.2 een niet-goedgekeurde beoordeling geeft niets — ook niet de afgetekende skills");
const klaar = verwerkBeoordeling({ gehaald: ["gk-rcd", "gk-impedantie", "gk-indeling"] },
  { goedgekeurd: true, discipline: "groepenkast", onderdelenAkkoord: 6, onderdelenTotaal: 6 });
eq(klaar.erbij, ["gk-kast"], "5.3 een volledig akkoord bevonden klus tekent de klus-skill af");
eq(verwerkBeoordeling({ gehaald: ["gk-rcd", "gk-impedantie", "gk-indeling"] },
     { goedgekeurd: true, discipline: "groepenkast", onderdelenAkkoord: 5, onderdelenTotaal: 6 }).erbij,
   [], "5.4 met één onderdeel afgekeurd niet");
eq(skillsUitKlus({ discipline: "groepenkast", gehaald: [], onderdelenAkkoord: 6, onderdelenTotaal: 6 }),
   [], "5.5 en de klus-skill gaat niet open zonder zijn voorwaarden");
eq(verwerkBeoordeling({ gehaald: ["gk-aarding"] },
     { goedgekeurd: true, skills: ["gk-aarding"] }).erbij, [],
   "5.6 wat al gehaald was komt niet twee keer");

console.log("▶ CATEGORIE 6: een kennisvraag telt alleen voor een kennis-skill");
const VRAAG = { skill: "gk-aarding", goed: 1 };
eq(verwerkKennisantwoord({ gehaald: [] }, VRAAG, 1).erbij, ["gk-aarding"],
   "6.1 een juist antwoord tekent de kennisskill af");
eq(verwerkKennisantwoord({ gehaald: [] }, VRAAG, 0).erbij, [],
   "6.2 een fout antwoord levert niets op");
eq(verwerkKennisantwoord({ gehaald: [] }, VRAAG, 0).juist, false, "6.3 en zegt dat het fout was");
// Dit is de kern: een skill die om een meting of een hele klus vraagt, kan nooit
// uit een vraag komen. Anders haalt iemand "aardlekschakelaar testen" op papier.
eq(verwerkKennisantwoord({ gehaald: ["gk-aarding"] }, { skill: "gk-rcd", goed: 0 }, 0).erbij, [],
   "6.4 een meting-skill komt niet uit een vraag");
eq(verwerkKennisantwoord({ gehaald: [] }, { skill: "gk-kast", goed: 0 }, 0).erbij, [],
   "6.5 een klus-skill al helemaal niet");
eq(verwerkKennisantwoord({ gehaald: [] }, { skill: "bestaat-niet", goed: 0 }, 0).erbij, [],
   "6.6 een onbekende skill bestaat niet");
eq(verwerkKennisantwoord({ gehaald: ["gk-aarding"] }, VRAAG, 1).erbij, [],
   "6.7 en wat al gehaald was komt niet twee keer");

console.log("▶ CATEGORIE 7: de poort naar de echte app");
eq(POORT_CIJFER, 5.5, "7.1 de drempel staat op 5,5");
const poortDicht = toegangTotHoofdapp({ gehaald: niveau1, klussen: [] }, "groepenkast");
eq(poortDicht.open, false, "7.2 halverwege de leerlijn gaat de poort niet open");
eq(poortDicht.ontbreekt.length, 2, "7.3 en er staat wát er nog moet");
const poortOpen = toegangTotHoofdapp({ gehaald: alles,
  klussen: [{ discipline: "groepenkast", goedgekeurd: true, cijfer: 7 }] }, "groepenkast");
eq(poortOpen.open, true, "7.4 alles gehaald met een goedgekeurde klus: open");
eq(toegangTotHoofdapp({ gehaald: alles,
  klussen: [{ discipline: "groepenkast", goedgekeurd: true, cijfer: 4 }] }, "groepenkast").open,
   false, "7.5 een 4 is geen afronding");
eq(toegangTotHoofdapp({ gehaald: alles,
  klussen: [{ discipline: "pv", goedgekeurd: true, cijfer: 8 }] }, "groepenkast").open,
   false, "7.6 een klus van een andere discipline opent deze poort niet");

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) { console.log("\n⚠️  MISLUKTE TESTS:"); failures.forEach((f) => console.log(f)); process.exit(1); }
