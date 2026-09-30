// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — een meterkastpaspoort terug naar een kastbeeld
//
// De derde ingang naast de foto en de installateur. Hier wordt bewaakt dat de
// kast eruit komt zoals hij erin ging: Kastscan schrijft een paspoort, YourWkb
// leest het terug, en wat de een vastlegde moet de ander herkennen.
//
// Voer uit met:  node tests/test-paspoort-kastbeeld.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  positiesUitPaspoort, paspoortDraagtKast, leesPlaats, SOORT_UIT_MKP,
  aardlekgroepenUitPosities, blokIndeling,
} from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

// Een paspoort zoals Kastscan het schrijft: hoofdschakelaar, twee aardlekken,
// twee gemeten groepen met hun toestel, en één groep waarvan destijds geen merk
// is ingevuld — die staat dus wel in grp[] maar niet in mat[].
const PASPOORT = {
  v: 2, ha: { f: 3, a: 25 },
  mat: [
    { i: 1, s: "hs",  pos: "R1-1", fab: "Hager", typ: "HIM440" },
    { i: 2, s: "als", pos: "R1-4", fab: "Hager", typ: "CDA240D" },
    { i: 3, s: "als", pos: "R1-6", fab: "Hager", typ: "CDC440D" },
    { i: 4, s: "aut", pos: "R1-8", fab: "Hager", typ: "B16" },
    { i: 5, s: "aut", pos: "R1-9", fab: "Hager", typ: "C16" },
  ],
  grp: [
    { t: "kook", rol: "af", f: 1, fn: [2], a: 16, n: "Kookplaat", al: "A1", mat: 4 },
    { t: "lp",   rol: "af", f: 3, fn: [1, 2, 3], a: 16, n: "Laadpaal", al: "A2", mat: 5 },
    { t: "alg",  rol: "af", f: 1, fn: [2], n: "Zolder", al: "A1" },
  ],
};
const POSITIES = positiesUitPaspoort(PASPOORT);
const GROEPEN = aardlekgroepenUitPosities(POSITIES, { bron: "paspoort" });

console.log("▶ CATEGORIE 1: de plaats op de rail");
eq(leesPlaats("R1-5"), { verdeler: 1, rail: 1, positie: 5 }, "1.1 R1-5");
eq(leesPlaats("V2-R3-12"), { verdeler: 2, rail: 3, positie: 12 }, "1.2 een tweede verdeler");
eq(leesPlaats("onzin"), null, "1.3 onleesbaar geeft niets");
eq(leesPlaats(undefined), null, "1.4 en ontbrekend ook");

console.log("▶ CATEGORIE 2: elk toestel komt terug");
eq(POSITIES.length, 6, "2.1 vijf toestellen plus de groep zonder merk");
eq(POSITIES.map((p) => p.soort),
   ["hoofdschakelaar", "aardlek", "aardlek", "automaat", "automaat", "automaat"],
   "2.2 met hun soort, in railvolgorde");
eq(SOORT_UIT_MKP.ala, "aardlekautomaat", "2.3 een aardlekautomaat blijft een aardlekautomaat");
eq(SOORT_UIT_MKP.ov, "overig", "2.4 `ov` is dubbelzinnig en wordt 'overig'");

console.log("▶ CATEGORIE 3: de typeaanduiding levert de norm");
{
  const kook = POSITIES.find((p) => p.functie === "Kookplaat");
  // Dit is het hele punt van mat[]: "B16" is een karakteristiek én een stroom,
  // en die twee staan nergens anders in het paspoort.
  eq([kook.karakteristiek, kook.In], ["B", 16], "3.1 B16 wordt karakteristiek B, 16 A");
  eq(POSITIES.find((p) => p.functie === "Laadpaal").karakteristiek, "C", "3.2 en C16 wordt C");
  // Een merkaanduiding is geen beveiliging.
  eq(POSITIES.find((p) => p.soort === "hoofdschakelaar").karakteristiek, "",
     "3.3 HIM440 levert geen karakteristiek");
}

console.log("▶ CATEGORIE 4: de breedte komt uit de onderlinge afstand");
{
  // Het paspoort legt geen breedte vast. Wie op plaats 1 staat terwijl de
  // volgende op 4 begint, is drie modules breed.
  eq(POSITIES[0].breedteModules, 3, "4.1 de hoofdschakelaar beslaat drie modules");
  eq(POSITIES[1].breedteModules, 2, "4.2 de eerste aardlek twee");
  eq(POSITIES[3].breedteModules, 1, "4.3 en een automaat één");
}

console.log("▶ CATEGORIE 5: een groep zonder toestel raakt niet kwijt");
{
  const zolder = POSITIES.find((p) => p.functie === "Zolder");
  eq(!!zolder, true, "5.1 de groep zonder merk staat er wel");
  eq(zolder.plaatsOnbekend, true, "5.2 maar zonder vastgelegde plaats");
  eq([zolder.karakteristiek, zolder.In], ["", null], "5.3 en dus zonder karakteristiek of stroom");
  eq(POSITIES.indexOf(zolder), POSITIES.length - 1, "5.4 hij komt achteraan, niet tussen de rest");
}

console.log("▶ CATEGORIE 6: wat de groepen verraden over hun aardlek");
{
  // Het paspoort legt van een aardlek alleen merk en type vast. Maar een
  // driefasige groep kan er alleen achter hangen als hij meerpolig is.
  eq(GROEPEN[1].fase, "3", "6.1 de aardlek van de laadpaal is driefasig");
  eq(GROEPEN[0].fase, "1", "6.2 en die van de kookplaat niet");
  // Eén fasenummer bij alle groepen erachter zegt op welke fase het blok zit.
  eq([GROEPEN[0].L, GROEPEN[0].Lbron], ["L2", "paspoort"], "6.3 het blok hangt op L2, uit het paspoort");
  eq(GROEPEN[1].L, "", "6.4 een driefasig blok heeft geen enkele fase");
}
{
  // Spreken de groepen elkaar tegen, dan is de indeling veranderd sinds de
  // vorige klus. Zwijgen is dan eerlijker dan een van de twee kiezen.
  const oneens = positiesUitPaspoort({ ...PASPOORT, grp: [
    { t: "alg", rol: "af", f: 1, fn: [1], n: "A", al: "A1", mat: 4 },
    { t: "alg", rol: "af", f: 1, fn: [3], n: "B", al: "A1" },
  ] });
  eq(aardlekgroepenUitPosities(oneens)[0].L, "", "6.5 tegenstrijdige fasen geven geen uitspraak");
}

console.log("▶ CATEGORIE 7: de kast komt compleet terug");
{
  eq(GROEPEN.length, 2, "7.1 twee aardlekgroepen");
  eq(GROEPEN.map((g) => g.naam), ["RCD 1", "RCD 2"], "7.2 met een naam om naar te wijzen");
  eq(GROEPEN[0].eindgroepen.map((e) => e.naam), ["Kookplaat", "Zolder"], "7.3 en hun groepen");
  eq(GROEPEN[0].eindgroepen[0].type, "kook", "7.4 met het type uit het paspoort");
  eq(GROEPEN[1].eindgroepen[0].type, "laad", "7.5 ook de laadgroep");
  eq(GROEPEN[0].eindgroepen[0].ampere, "16A", "7.6 en de nominale stroom");
  eq(GROEPEN.every((g) => g.bron === "paspoort"), true, "7.7 alles draagt zijn herkomst");
}

console.log("▶ CATEGORIE 8: een thuisbatterij is twee regels, maar één groep");
{
  const metAccu = positiesUitPaspoort({ ...PASPOORT, grp: [
    { t: "bat", rol: "voed", f: 1, fn: [1], n: "Thuisbatterij", al: "A1", mat: 4 },
    { t: "bat", rol: "af",   f: 1, fn: [1], n: "Thuisbatterij", al: "A1", mat: 4 },
  ] });
  eq(metAccu.filter((p) => p.functie === "Thuisbatterij").length, 1,
     "8.1 ontladen en laden zijn samen één groep in de kast");
}

console.log("▶ CATEGORIE 9: draagt dit paspoort genoeg?");
eq(paspoortDraagtKast(PASPOORT), true, "9.1 met mat[] en grp[] wel");
eq(paspoortDraagtKast({ v: 2, ha: { f: 3, a: 25 } }), false, "9.2 een leeg paspoort niet");
eq(paspoortDraagtKast(null), false, "9.3 en geen paspoort ook niet");

console.log("▶ CATEGORIE 10: het blijft een gewoon, aanvulbaar kastbeeld");
{
  eq(blokIndeling(POSITIES).length, 2, "10.1 blokIndeling werkt erop zoals op een foto");
  eq(POSITIES.every((p) => !Object.isFrozen(p)), true, "10.2 niets is bevroren");
  eq(POSITIES.every((p) => p.bron === "paspoort"), true, "10.3 en alles draagt zijn herkomst");
  // Het RCD-type staat niet in het paspoort; het valt terug op de app-standaard
  // en moet dus door de installateur bevestigd worden.
  eq(GROEPEN.map((g) => g.rcdType), ["A", "A"], "10.4 het RCD-type valt terug op A — te bevestigen");
  eq(GROEPEN.map((g) => g.rcdMa), ["30", "30"], "10.5 en de aanspreekstroom op 30 mA — eveneens");
}

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) {
  console.log("\n⚠️  MISLUKTE TESTS:");
  failures.forEach((f) => console.log(f));
  process.exit(1);
}
