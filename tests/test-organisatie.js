// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — organisaties, rollen en de scheiding oefenen/opleveren
//
// Twee dingen worden hier bewaakt, en ze zijn beide hard: niemand beoordeelt zijn
// eigen werk, en oefendata komt nooit in een Wkb-archief. De eerste is het
// verkoopargument van de bedrijfsvariant (vier-ogenprincipe), de tweede maakt dat
// het bewijs dat een aannemer moet leveren bewijs blíjft.
//
// Voer uit met:  node tests/test-organisatie.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  ORG_TYPES, ROLLEN, mag, rollenVoor, magBeoordelen,
  isOefen, oefenVlagVoor, bewaakScheiding, scheidOefen,
} from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

console.log("▶ CATEGORIE 1: twee soorten organisatie, één rollenmodel");
eq(ORG_TYPES, ["bedrijf", "opleider"], "1.1 bedrijf en opleider");
eq(rollenVoor("bedrijf").map((r) => r.id).includes("docent"), false, "1.2 een bedrijf heeft geen docent");
eq(rollenVoor("opleider").map((r) => r.id).includes("monteur"), false, "1.3 een opleider geen monteur");
eq(rollenVoor("bedrijf").map((r) => r.id).includes("meester"), true, "1.4 de meester bestaat bij beide");
eq(rollenVoor("opleider").map((r) => r.id).includes("meester"), true, "1.5 ook bij de opleider");
eq(ROLLEN.leerling.bij, ["bedrijf", "opleider"], "1.6 de leerling ook — dat is de in-house modus");

console.log("▶ CATEGORIE 2: rechten");
eq(mag("meester", "cijfer.geven"), true, "2.1 de meester geeft het cijfer");
eq(mag("projectleider", "cijfer.geven"), false, "2.2 de projectleider niet");
eq(mag("projectleider", "project.beoordelen"), true, "2.3 die beoordeelt wel per onderdeel");
eq(mag("monteur", "project.inzien.alle"), false, "2.4 een monteur ziet niet alles");
eq(mag(["monteur", "meester"], "cijfer.geven"), true, "2.5 twee rollen tellen samen");
eq(mag("leerling", "fasecheck.koppelen"), false, "2.6 een leerling koppelt geen kastje bij een klant");
eq(mag("beheerder", "leden.beheren"), true, "2.7 de beheerder beheert leden");
eq(mag("onbekend", "project.beoordelen"), false, "2.8 een onbekende rol mag niets");

console.log("▶ CATEGORIE 3: niemand beoordeelt zijn eigen werk");
const project = { id: "p1", gebruikerId: "u7", oefen: false };
eq(magBeoordelen({ rollen: ["meester"], gebruikerId: "u1" }, project).mag, true,
   "3.1 een meester mag het werk van een ander beoordelen");
eq(magBeoordelen({ rollen: ["meester"], gebruikerId: "u7" }, project).mag, false,
   "3.2 en niet zijn eigen werk — ook niet als hij de baas is");
eq(magBeoordelen({ rollen: ["meester"], gebruikerId: "u7" }, project).reden,
   "Je kunt je eigen werk niet beoordelen", "3.3 met een reden die je kunt tonen");
eq(magBeoordelen({ rollen: ["monteur"], gebruikerId: "u1" }, project).mag, false,
   "3.4 een monteur beoordeelt niet");
eq(magBeoordelen({ rollen: ["meester"], gebruikerId: "u1" }, null).mag, false,
   "3.5 geen project, geen beoordeling");

console.log("▶ CATEGORIE 4: de oefenvlag is verplicht en expliciet");
eq(isOefen({ oefen: true }), true, "4.1 met de vlag aan is het een oefening");
eq(isOefen({ oefen: false }), false, "4.2 met de vlag uit echt werk");
eq(isOefen({}), false, "4.3 zonder vlag niet 'oefening' — dat zou het archief vervuilen");
eq(oefenVlagVoor("opleider", false), true, "4.4 bij een opleider is alles oefening, wat er ook gevraagd wordt");
eq(oefenVlagVoor("bedrijf", false), false, "4.5 bij een bedrijf is het echt werk");
eq(oefenVlagVoor("bedrijf", true), true, "4.6 tenzij het bedrijf zelf oefenen aanzet");

console.log("▶ CATEGORIE 5: de wacht aan de poort van het archief");
eq(bewaakScheiding({ oefen: true }, { orgType: "bedrijf", doel: "wkb-archief" }).ok, false,
   "5.1 een oefenproject hoort niet in het Wkb-archief");
eq(bewaakScheiding({ oefen: false }, { orgType: "bedrijf", doel: "wkb-archief" }).ok, true,
   "5.2 een echte oplevering wel");
eq(bewaakScheiding({}, { orgType: "bedrijf", doel: "wkb-archief" }).ok, false,
   "5.3 een project zonder vlag wordt geweigerd, niet aangenomen");
eq(bewaakScheiding({ oefen: false }, { orgType: "opleider", doel: "leerdossier" }).ok, false,
   "5.4 een opleider levert niet op aan een klant");
eq(bewaakScheiding({ oefen: true }, { orgType: "opleider", doel: "leerdossier" }).ok, true,
   "5.5 daar is oefenwerk juist het goede");

console.log("▶ CATEGORIE 6: scheiden van een lijst");
const lijst = [{ id: 1, oefen: false }, { id: 2, oefen: true }, { id: 3 }, { id: 4, oefen: false }];
const g = scheidOefen(lijst);
eq(g.echt.map((p) => p.id), [1, 4], "6.1 het echte werk");
eq(g.oefen.map((p) => p.id), [2], "6.2 het oefenwerk");
eq(g.zonderVlag.map((p) => p.id), [3], "6.3 en wat nergens hoort staat apart");
eq(g.echt.length + g.oefen.length + g.zonderVlag.length, lijst.length,
   "6.4 niets raakt onderweg kwijt");

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) { console.log("\n⚠️  MISLUKTE TESTS:"); failures.forEach((f) => console.log(f)); process.exit(1); }
