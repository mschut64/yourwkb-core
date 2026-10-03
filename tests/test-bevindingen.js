// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — bevindingen uit een kastfoto
//
// Drie regels uit de kalibratie op de kasten van Herman staan hier vast, en ze zijn
// alle drie een regel waarmee deze functie staat of valt:
//
//   • een vermoeden zonder controleactie VERVALT — een beschuldiging zonder uitweg
//     jaagt een installateur weg;
//   • stilzwijgen is GEEN bevestiging — wie niets aanklikt heeft niets gemeld, en
//     dat mag nooit als "het model had gelijk" tellen;
//   • wat naar de leeromgeving gaat is gestript — geen adres, geen plek, geen foto.
//
// Voer uit met:  node tests/test-bevindingen.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  BEVINDING_SOORTEN, CATEGORIEEN, CATEGORIE_IDS, OORDELEN, categorieLabel,
  normaliseerBevinding, normaliseerBeoordeling, sorteerBevindingen,
  correctieUitOordeel, correctiesUitBeoordeling, expertRondeUitBeoordeling,
  leerpuntUitBevinding, leerpuntenUitBeoordeling,
  correctieStatistiek, overtuigdFout, gewogenScore,
} from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

const CONSTATERING = {
  soort: "constatering", categorie: "verbindingsmiddel",
  waarneming: "Krimpverbinder voor soepele ader op een massieve ader van 2,5 mm²",
  gevolgtrekking: "De ader veert terug; het contactoppervlak is klein en niet gasdicht",
  controleactie: "Typeaanduiding van de verbinder opzoeken en de toegestane geleiderklasse nakijken",
  plek: "rail 1, derde module van links", zekerheid: 0.9,
};

console.log("▶ CATEGORIE 1: de zoeklijst van de kalibratie");
eq(BEVINDING_SOORTEN, ["constatering", "vermoeden", "niet-beoordeelbaar"], "1.1 drie uitkomsttypen");
eq(CATEGORIEEN.length, 8, "1.2 acht categorieën uit de zoeklijst");
eq(CATEGORIE_IDS.includes("verbindingsmiddel"), true,
   "1.3 verbindingsmiddel-versus-geleider staat erbij — daar komen de meeste vondsten vandaan");
eq(CATEGORIE_IDS.includes("privacy"), true, "1.4 en privacy, want de foto gaat mee in een rapport");
eq(categorieLabel("warmte"), "Warmte", "1.5 een categorie heeft een leesbaar label");
eq(categorieLabel("onzin"), "Overig", "1.6 en een onbekende valt netjes terug");
eq(CATEGORIEEN.every((c) => c.uitleg && c.uitleg.length > 20), true, "1.7 elke categorie legt zichzelf uit");

console.log("▶ CATEGORIE 2: een vermoeden zonder controleactie vervalt");
eq(normaliseerBevinding(CONSTATERING, 0).id, "b1", "2.1 een volledige bevinding komt binnen");
eq(normaliseerBevinding({ ...CONSTATERING, soort: "vermoeden" }, 0).soort, "vermoeden",
   "2.2 een vermoeden mét controleactie ook");
eq(normaliseerBevinding({ ...CONSTATERING, soort: "vermoeden", controleactie: "" }, 0), null,
   "2.3 maar een vermoeden zónder controleactie vervalt — dat is de hele regel");
eq(normaliseerBevinding({ ...CONSTATERING, controleactie: "" }, 0) !== null, true,
   "2.4 een constatering mag wél zonder controleactie: hij staat op het beeld");
eq(normaliseerBevinding({ ...CONSTATERING, waarneming: "   " }, 0), null,
   "2.5 zonder waarneming is er niets gezien");
eq(normaliseerBevinding({ ...CONSTATERING, categorie: "verzonnen" }, 0), null,
   "2.6 een onbekende categorie komt er niet in");
eq(normaliseerBevinding({ ...CONSTATERING, soort: "afkeuring" }, 0), null,
   "2.7 en 'afkeuring' bestaat niet — dit keurt niets");
eq(normaliseerBevinding(null, 0), null, "2.8 niets is niets");
eq(normaliseerBevinding({ ...CONSTATERING, zekerheid: 5 }, 0).zekerheid, null,
   "2.9 een zekerheid buiten 0–1 is geen zekerheid");
eq(normaliseerBevinding({ ...CONSTATERING, id: "van-het-model" }, 3).id, "b4",
   "2.10 het id komt van ons en is deterministisch — geen Date.now()");

console.log("▶ CATEGORIE 3: de hele uitkomst");
const RUW = { bruikbaar: true, reden: "", redenSoort: "", bevindingen: [
  { ...CONSTATERING, soort: "niet-beoordeelbaar", waarneming: "Achterzijde rail niet zichtbaar" },
  { ...CONSTATERING, soort: "vermoeden", waarneming: "Mogelijk twee aders in één klem", zekerheid: 0.4 },
  CONSTATERING,
  { ...CONSTATERING, categorie: "privacy", waarneming: "Sticker met naam en telefoonnummer leesbaar" },
  { ...CONSTATERING, soort: "vermoeden", controleactie: "" }, // vervalt
]};
const B = normaliseerBeoordeling(RUW);
eq(B.bevindingen.map((b) => b.categorie)[0], "privacy",
   "3.1 privacy staat bovenaan — dat moet weg vóór de foto in een rapport belandt");
eq(B.bevindingen.map((b) => b.soort).slice(1), ["constatering", "vermoeden", "niet-beoordeelbaar"],
   "3.2 daarna constateringen, vermoedens, en wat niet te beoordelen was");
eq(B.aantallen.totaal, 4, "3.3 vier bevindingen komen door de poort");
eq(B.aantallen.geweigerd, 1, "3.4 en één is geweigerd — zichtbaar, niet stilletjes weg");
eq(B.aantallen.privacy, 1, "3.5 met de privacymelding apart geteld");
eq(normaliseerBeoordeling({ bruikbaar: false, reden: "Te donker", redenSoort: "te-donker" }).bevindingen, [],
   "3.6 een onbruikbare foto levert geen bevindingen op");
eq(normaliseerBeoordeling({}).bruikbaar, true, "3.7 zonder oordeel over de foto gaan we uit van bruikbaar");
eq(normaliseerBeoordeling(null).aantallen.totaal, 0, "3.8 en niets levert niets op");

console.log("▶ CATEGORIE 4: stilzwijgen is geen bevestiging");
const bev = B.bevindingen.find((b) => b.categorie === "verbindingsmiddel");
eq(correctieUitOordeel({ bevinding: bev, oordeel: "bevestigd", projectId: "p1" }).actie, "bevestigd",
   "4.1 bevestigd telt als bevestiging");
eq(correctieUitOordeel({ bevinding: bev, oordeel: "ontkracht", projectId: "p1" }).actie, "gecorrigeerd",
   "4.2 ontkracht telt als correctie — het model zat ernaast");
eq(correctieUitOordeel({ bevinding: bev, oordeel: "nietgezien", projectId: "p1" }), null,
   "4.3 'niet gezien' levert NIETS op — een akkoord betekent alleen dat niemand keek");
eq(correctieUitOordeel({ bevinding: bev, oordeel: undefined }), null, "4.4 geen oordeel, geen signaal");
eq(correctieUitOordeel({ bevinding: bev, oordeel: "bevestigd" }).veld, "bevinding:verbindingsmiddel",
   "4.5 er wordt per categorie gemeten, niet per bevinding");
eq(correctieUitOordeel({ bevinding: bev, oordeel: "bevestigd", promptversie: "kastcheck-x" }).promptversie,
   "kastcheck-x", "4.6 met de promptversie erbij — anders meet een volgende ronde iets anders");
eq(correctieUitOordeel({ bevinding: bev, oordeel: "bevestigd" }).moment, "kastcheck",
   "4.7 en een eigen moment, los van de kastscan");

console.log("▶ CATEGORIE 5: het haakt in op de leerlus die er al was");
{
  const oordelen = {};
  B.bevindingen.forEach((b, i) => { oordelen[b.id] = i === 0 ? "ontkracht" : i === 1 ? "bevestigd" : "nietgezien"; });
  const correcties = correctiesUitBeoordeling({ bevindingen: B.bevindingen, oordelen, projectId: "p1" });
  eq(correcties.length, 2, "5.1 alleen de twee echte oordelen leveren een correctie op");
  const stat = correctieStatistiek(correcties);
  eq([stat.totaal, stat.gecorrigeerd], [2, 1],
     "5.2 de bestaande statistiek telt ze gewoon mee — bevindingen zijn correcties als alle andere");
  eq(stat.perVeld["bevinding:privacy"].gecorrigeerd, 1,
     "5.3 en houdt per categorie bij waar de check zwak is");
  // Een ontkrachte bevinding mét hoge zekerheid is het ergste wat er is: het model
  // was overtuigd én zat ernaast. Dat is precies wat `overtuigdFout` meet.
  eq(overtuigdFout(correcties).length, 1, "5.4 hoge zekerheid én ontkracht = overtuigd fout");
}
{
  const ronde = expertRondeUitBeoordeling({
    datum: "2026-10-03", inspecteur: "Herman",
    bevindingen: B.bevindingen,
    oordelen: Object.fromEntries(B.bevindingen.map((b) => [b.id, "bevestigd"])),
    gemist: ["ontbrekend scheidingsschot", "aardlek type AC"],
  });
  eq([ronde.gevonden, ronde.ontkracht, ronde.gemist], [4, 0, 2], "5.5 een expertronde telt ook wat er gemist is");
  const score = gewogenScore({ gecorrigeerd: 50 }, [ronde]);
  eq(score.doorslaggevend, "expert",
     "5.6 en twee gemissen van de expert wegen zwaarder dan vijftig correcties uit het veld");
}

console.log("▶ CATEGORIE 6: wat naar de leeromgeving mag");
eq(leerpuntUitBevinding(bev, "bevestigd").bron, "veld-bevestigd",
   "6.1 een bevestigde constatering wordt lesmateriaal");
eq(leerpuntUitBevinding(bev, "bevestigd").plek, undefined,
   "6.2 zonder de plek in de kast — die maakt een kast herkenbaar voor wie hem kent");
eq(Object.keys(leerpuntUitBevinding(bev, "bevestigd")).sort(),
   ["bron", "categorie", "categorieLabel", "controleactie", "gevolgtrekking", "waarneming"],
   "6.3 en zonder adres, project of foto — alleen wat in een leerboek zou staan");
eq(leerpuntUitBevinding(bev, "nietgezien"), null, "6.4 wat niet bevestigd is, is geen les");
eq(leerpuntUitBevinding({ ...bev, soort: "vermoeden" }, "bevestigd"), null,
   "6.5 een vermoeden is geen les");
eq(leerpuntUitBevinding({ ...bev, categorie: "privacy" }, "bevestigd"), null,
   "6.6 een privacymelding wordt opgeruimd, niet onderwezen");
eq(leerpuntenUitBeoordeling({ bevindingen: B.bevindingen,
     oordelen: Object.fromEntries(B.bevindingen.map((b) => [b.id, "bevestigd"])) }).length, 1,
   "6.7 van vier bevestigde bevindingen blijft er één over als lesmateriaal");

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) { console.log("\n⚠️  MISLUKTE TESTS:"); failures.forEach((f) => console.log(f)); process.exit(1); }
