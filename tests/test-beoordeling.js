// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de beoordelingsketen
//
// De belangrijkste test staat in categorie 5: de app geeft geen cijfer. Zou daar
// ooit een getal uit komen, dan doet software een uitspraak over een persoon en
// is de zuiverheidsregel van dit project weg.
//
// Voer uit met:  node tests/test-beoordeling.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  STATUSSEN, STATUS_LABEL, ONDERDELEN, onderdelenVoor,
  beoordelingStatus, beoordelingVoortgang, beoordelingCompleet,
  cijferKader, volgendeActie, tellers,
} from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

const ONDER = ONDERDELEN.groepenkast;

console.log("▶ CATEGORIE 1: de rubriek");
eq(STATUSSEN, ["concept", "ingeleverd", "retour", "goedgekeurd"], "1.1 vier toestanden, niet meer");
eq(ONDER.length, 6, "1.2 zes onderdelen voor een groepenkast, als in de mock-up");
eq(ONDER.map((o) => o.id).includes("metingen"), true, "1.3 metingen staat erbij");
eq(Object.keys(ONDERDELEN).length, 6, "1.4 alle zes disciplines hebben een rubriek");
eq(onderdelenVoor("laadpaal").some((o) => o.id === "rcd"), true, "1.5 bij een laadpaal het RCD-type");
eq(onderdelenVoor("groepenkast", [{ id: "eigen1", label: "Eigen punt" }]).length, 7,
   "1.6 een organisatie mag een eigen onderdeel toevoegen");
eq(onderdelenVoor("groepenkast", [{ id: "aarding", label: "Dubbel" }]).length, 6,
   "1.7 en een bestaand onderdeel wordt niet verdubbeld");
eq(onderdelenVoor("bestaatniet").length, 6, "1.8 een onbekende discipline valt terug op de groepenkast");

console.log("▶ CATEGORIE 2: de toestand volgt uit wat er gebeurd is");
eq(beoordelingStatus({}), "concept", "2.1 niets gebeurd: loopt nog");
eq(beoordelingStatus({ ingeleverdOp: "2026-10-01T09:00:00Z" }), "ingeleverd", "2.2 ingeleverd");
eq(beoordelingStatus({ ingeleverdOp: "2026-10-01T09:00:00Z", retourOp: "2026-10-01T11:00:00Z" }),
   "retour", "2.3 daarna teruggestuurd: de leerling is weer aan zet");
eq(beoordelingStatus({ ingeleverdOp: "2026-10-02T09:00:00Z", retourOp: "2026-10-01T11:00:00Z" }),
   "ingeleverd", "2.4 opnieuw ingeleverd ná de retour: weer aan de beoordelaar");
eq(beoordelingStatus({ ingeleverdOp: "2026-10-01T09:00:00Z", retourOp: "2026-10-01T11:00:00Z",
                       goedgekeurdOp: "2026-10-03T09:00:00Z" }), "goedgekeurd",
   "2.5 goedgekeurd overstemt de rest");
eq(STATUS_LABEL.retour, "Terug naar leerling", "2.6 en het label is de taal van de mock-up");

console.log("▶ CATEGORIE 3: voortgang van de beoordeling");
const alleOk = {}; ONDER.forEach((o) => { alleOk[o.id] = { ok: true, opmerking: "" }; });
eq(beoordelingVoortgang(ONDER, alleOk).volledig, true, "3.1 alles beoordeeld");
eq(beoordelingVoortgang(ONDER, {}).beoordeeld, 0, "3.2 niets beoordeeld");
const half = { indeling: { ok: true }, aarding: { ok: false, opmerking: "Klem los" } };
eq(beoordelingVoortgang(ONDER, half).afgekeurd, 1, "3.3 één onderdeel afgekeurd");
eq(beoordelingVoortgang(ONDER, half).volledig, false, "3.4 maar nog niet af");
eq(beoordelingVoortgang(ONDER, { aarding: { ok: false } }).zonderUitleg, ["aarding"],
   "3.5 afgekeurd zonder opmerking wordt gemeld — anders weet de leerling niets");

console.log("▶ CATEGORIE 4: afronden kan alleen compleet");
const compleet = beoordelingCompleet({ onderdelen: ONDER, oordelen: alleOk, cijfer: "7,5",
                                       samenvatting: "Netjes gewerkt." });
eq(compleet.kan, true, "4.1 alles afgevinkt, cijfer en samenvatting: afronden kan");
eq(compleet.advies, "goedgekeurd", "4.2 en het advies is goedkeuren");
eq(compleet.cijfer, 7.5, "4.3 een komma wordt gelezen als decimaal");
eq(beoordelingCompleet({ onderdelen: ONDER, oordelen: alleOk, samenvatting: "x" }).kan, false,
   "4.4 zonder cijfer niet");
eq(beoordelingCompleet({ onderdelen: ONDER, oordelen: alleOk, cijfer: 7.5 }).kan, false,
   "4.5 zonder samenvatting ook niet — de leerling moet weten waarom");
eq(beoordelingCompleet({ onderdelen: ONDER, oordelen: alleOk, cijfer: 11, samenvatting: "x" }).kan,
   false, "4.6 een 11 bestaat niet");
const retour = beoordelingCompleet({ onderdelen: ONDER,
  oordelen: { ...alleOk, aarding: { ok: false, opmerking: "Klem los" } },
  cijfer: 5, samenvatting: "Aarding opnieuw." });
eq(retour.advies, "retour", "4.7 één afgekeurd onderdeel betekent terug");
eq(retour.kan, true, "4.8 en dat mag afgerond worden");

console.log("▶ CATEGORIE 5: de app geeft GEEN cijfer");
const kader = cijferKader({ onderdelen: ONDER, oordelen: alleOk,
  normcheck: [{ level: "red", msg: "ΔT 320ms" }, { level: "orange", msg: "asymmetrie" }] });
eq(kader.cijfer, null, "5.1 er komt geen cijfer uit — en dat is de hele regel");
eq(kader.normAfwijkingen, 1, "5.2 wel het aantal normafwijkingen");
eq(kader.normLetOp, 1, "5.3 en het aantal aandachtspunten apart");
eq(kader.toelichting.includes("6 van 6 onderdelen akkoord"), true, "5.4 de feiten in woorden");
eq(cijferKader({ onderdelen: ONDER, oordelen: alleOk, normcheck: [] }).toelichting
     .includes("geen normafwijkingen"), true, "5.5 ook als er niets aan de hand is");

console.log("▶ CATEGORIE 6: wat de knop in de lijst zegt");
const p = { id: "p1", gebruikerId: "u7", ingeleverdOp: "2026-10-01T09:00:00Z" };
eq(volgendeActie(p, { rollen: ["meester"], gebruikerId: "u1" }), "Beoordelen", "6.1 ingeleverd: beoordelen");
eq(volgendeActie({ id: "p2", gebruikerId: "u7" }, { rollen: ["meester"], gebruikerId: "u1" }),
   "Meekijken", "6.2 nog bezig: meekijken");
eq(volgendeActie(p, { rollen: ["meester"], gebruikerId: "u7" }), "Verder werken",
   "6.3 je eigen project: verder werken");
eq(volgendeActie({ ...p, goedgekeurdOp: "x" }, { rollen: ["meester"], gebruikerId: "u1" }),
   "Bekijken", "6.4 goedgekeurd: bekijken");
eq(volgendeActie(p, { rollen: ["monteur"], gebruikerId: "u1" }), "Bekijken",
   "6.5 wie niet beoordeelt, kijkt");

console.log("▶ CATEGORIE 7: de vier tellers");
const lijst = [
  { id: 1, gebruikerId: "a", ingeleverdOp: "2026-10-01T09:00:00Z" },
  { id: 2, gebruikerId: "b", ingeleverdOp: "2026-10-01T09:00:00Z" },
  { id: 3, gebruikerId: "a" },
  { id: 4, gebruikerId: "c", ingeleverdOp: "x", goedgekeurdOp: "2026-09-24T09:00:00Z" },
  { id: 5, gebruikerId: "m", ingeleverdOp: "2026-10-01T09:00:00Z" },
];
const t = tellers(lijst, { gebruikerId: "m" });
eq(t.wachtOpJou, 2, "7.1 eigen werk telt niet mee in 'wacht op jou'");
eq(t.looptNog, 1, "7.2 wat nog loopt");
eq(t.goedgekeurd, 1, "7.3 goedgekeurd");
eq(t.mensenActief, 3, "7.4 mensen, niet projecten — a telt één keer");

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) { console.log("\n⚠️  MISLUKTE TESTS:"); failures.forEach((f) => console.log(f)); process.exit(1); }
