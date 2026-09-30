// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — het kastbeeld als contract tussen twee apps
//
// De uitgebreide toetsing van de fotoketen staat in de suite van Kastscan: daar
// is zij ontstaan, daar staan de echte kasten van Herman achter. Wat hier staat
// is het CONTRACT — wat YourWkb straks van dit kastbeeld mag verwachten, en wat
// er dus niet stilletjes mag veranderen.
//
// ⚓ De belangrijkste afspraak is die van Martin (30-09-2026): een scan moet in de
// app nog aan te vullen zijn. Alles wat uit de motor komt is een VOORSTEL, geen
// vaststelling — en dat moet aan het resultaat te zien zijn, anders kan een
// scherm het onderscheid niet maken.
//
// Voer uit met:  node tests/test-kastbeeld.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  parseBeveiliging, formatBeveiliging, isGroepsoort, isMeerpolig, heeftKarakteristiek,
  ZEKERHEIDSDREMPEL, INVULDREMPEL, zekerheidVan,
  normaliseerPositie, normaliseerAnalyse, blokIndeling, pasVuistregelToe,
  splitsVerklaring, sorteerPosities,
} from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

// Een kast zoals een foto hem oplevert: twee aardlekken met groepen erachter.
const ruw = {
  bruikbaar: true,
  hoofd: { fasen: 3, hoofdzekering: 25, stelsel: "TN" },
  posities: [
    { rail: 1, positie: 0, breedteModules: 3, soort: "hoofdschakelaar", In: 40, polen: 4, zekerheid: 0.95 },
    { rail: 1, positie: 3, breedteModules: 2, soort: "aardlek", IAn: 30, aardlektype: "A", polen: 2, zekerheid: 0.9 },
    { rail: 1, positie: 5, breedteModules: 1, soort: "automaat", karakteristiek: "B", In: 16, polen: 1, groepstekst: "Keuken", zekerheid: 0.88 },
    { rail: 1, positie: 6, breedteModules: 1, soort: "automaat", karakteristiek: "B", In: 16, polen: 1, zekerheid: 0.85 },
    { rail: 1, positie: 7, breedteModules: 2, soort: "aardlek", IAn: 30, aardlektype: "B", polen: 2, zekerheid: 0.9 },
    { rail: 1, positie: 9, breedteModules: 3, soort: "automaat", karakteristiek: "C", In: 16, polen: 3, zekerheid: 0.8 },
  ],
};

console.log("▶ CATEGORIE 1: het typeplaatje lezen — het scharnier naar het paspoort");
// "B16" staat op de automaat én in mat[].typ van een meterkastpaspoort. Zonder
// deze twee functies kan YourWkb uit een paspoort geen karakteristiek en geen
// ampère halen, en dat is precies wat stap 6 nodig heeft.
eq(parseBeveiliging("B16"), { karakteristiek: "B", In: 16 }, "1.1 B16 uit elkaar");
eq(parseBeveiliging("c 20"), { karakteristiek: "C", In: 20 }, "1.2 kleine letter en spatie");
eq(parseBeveiliging(""), { karakteristiek: "", In: null }, "1.3 niets leesbaars geeft niets");
eq(formatBeveiliging("B", 16), "B16", "1.4 en weer terug");
eq(formatBeveiliging("", 16), "16", "1.5 zonder karakteristiek alleen het getal");
// gG: op een smeltpatroon staat "gG20". Wie dat als B20 leest, toetst Z_max aan
// een vaste factor terwijl het uit een tijd-stroomkromme hoort te komen.
eq(parseBeveiliging("gG20"), { karakteristiek: "gG", In: 20 }, "1.6 een smeltpatroon gG20");
eq(parseBeveiliging("GG 63"), { karakteristiek: "gG", In: 63 }, "1.7 ook met hoofdletters en spatie");

console.log("▶ CATEGORIE 2: wat een groep is, en wat niet");
eq([isGroepsoort("automaat"), isGroepsoort("aardlekautomaat"), isGroepsoort("smeltveiligheid")],
   [true, true, true], "2.1 automaat, aardlekautomaat en stop zijn alle drie een groep");
eq([isGroepsoort("aardlek"), isGroepsoort("hoofdschakelaar")], [false, false],
   "2.2 een aardlekschakelaar en een hoofdschakelaar niet");
eq(heeftKarakteristiek("smeltveiligheid"), false, "2.3 een stop heeft geen B/C/D");
eq(isMeerpolig({ polen: 4 }), true, "2.4 vier polen is meerpolig");
eq(isMeerpolig({ polen: 2 }), false, "2.5 twee niet — dat is fase + nul");

console.log("▶ CATEGORIE 3: de zekerheid, in beide vormen");
eq(ZEKERHEIDSDREMPEL, 0.75, "3.1 de drempel is 0,75");
eq(INVULDREMPEL, 0.35, "3.2 en de invuldrempel 0,35");
eq(zekerheidVan({ zekerheid: 0.9 }, "type"), 0.9, "3.3 één getal geldt voor elk veld");
eq(zekerheidVan({ zekerheid: { type: 0.4 } }, "type"), 0.4, "3.4 de oude objectvorm wordt nog gelezen");
{
  // Onder de invuldrempel wordt een aflezing niet overgenomen: liever een leeg
  // veld dat de installateur invult dan een gok die eruitziet als een meting.
  const gok = normaliseerPositie({ soort: "automaat", karakteristiek: "D", In: 63, zekerheid: 0.2 }, 0);
  eq([gok.karakteristiek, gok.In], ["", null], "3.5 een gok onder 0,35 belandt niet in de velden");
  const zeker = normaliseerPositie({ soort: "automaat", karakteristiek: "D", In: 63, zekerheid: 0.9 }, 0);
  eq([zeker.karakteristiek, zeker.In], ["D", 63], "3.6 een zekere aflezing wel");
}

console.log("▶ CATEGORIE 4: een scan blijft aanvulbaar (besluit Martin, 30-09-2026)");
{
  const pos = normaliseerAnalyse(ruw, "v1");
  // Niets wat de motor teruggeeft mag bevroren zijn: de installateur moet elk
  // veld kunnen bijwerken, en het scherm moet kunnen tonen wat nog een voorstel is.
  eq(Object.isFrozen(pos[0]), false, "4.1 de posities zijn gewone objecten, niet bevroren");
  eq("functieEigen" in pos[2], true, "4.2 er staat bij of de naam bevestigd is");
  eq(pos[2].functieEigen, false, "4.3 en uit een foto is dat nooit vanzelf het geval");
  eq("zekerheid" in pos[2], true, "4.4 de zekerheid reist mee, zodat twijfel zichtbaar blijft");
  eq(typeof pos[2].standaardnaam, "string", "4.5 met een standaardnaam als de foto er geen gaf");
  // Een leeg veld is een uitnodiging, geen fout. Waar de foto niets zag, staat
  // niets — en dat is precies het veld dat de installateur in de app aanvult.
  const leeg = normaliseerPositie({ soort: "automaat", zekerheid: 0.9 }, 0);
  eq([leeg.karakteristiek, leeg.In, leeg.fabrikant], ["", null, ""], "4.6 niet gezien is leeg, niet geraden");
  // De fase komt NOOIT uit een kastfoto (prompt regel 5) en blijft dus handwerk.
  eq(pos.every((p) => p.fase === null), true, "4.7 een foto zegt niets over welke fase");
}

console.log("▶ CATEGORIE 5: blokIndeling — de brug naar de aardlekgroepen van YourWkb");
{
  const pos = normaliseerAnalyse(ruw, "v1");
  const blokken = blokIndeling(pos);
  // Dit is de vorm waar K3 op bouwt: elk blok is één aardlekgroep met zijn
  // eindgroepen. Verandert die vorm, dan breekt de vertaling naar YourWkb.
  eq(blokken.length, 2, "5.1 twee aardlekschakelaars, twee blokken");
  eq(blokken.map((b) => b.aardlek.soort), ["aardlek", "aardlek"], "5.2 elk blok heeft zijn aardlek");
  eq(blokken.map((b) => b.posities.length), [2, 1], "5.3 met de groepen die erachter hangen");
  eq(blokken[0].aardlek.aardlektype, "A", "5.4 het type van de aardlek is er — wordt rcdType");
  eq(blokken[0].aardlek.IAn, 30, "5.5 en de aanspreekstroom — wordt rcdMa");
  eq(blokken[1].posities[0].In, 16, "5.6 per groep de nominale stroom — wordt ampere");
  eq(blokken[1].posities[0].karakteristiek, "C", "5.7 en de karakteristiek — wordt kar");
  eq(isMeerpolig(blokken[1].posities[0]), true, "5.8 en of hij over drie fasen hangt");
  // De hoofdschakelaar is geen groep en hoort in geen enkel blok.
  eq(blokken.flatMap((b) => b.posities).some((p) => p.soort === "hoofdschakelaar"), false,
     "5.9 de hoofdschakelaar valt erbuiten");
}

console.log("▶ CATEGORIE 6: de vuistregel is een gok, en zegt dat ook");
{
  // Zonder zichtbare kleurband claimt elke aardlek alles rechts van zich, tot de
  // volgende. Dat is een aanname; ze mag nooit als waarneming worden getoond.
  const pos = pasVuistregelToe(ruw.posities.map((p, i) => normaliseerPositie(p, i)));
  const aardlekken = pos.filter((p) => p.soort === "aardlek").map((p) => p.id);
  eq(pos[2].aardlekId, aardlekken[0], "6.1 de groep erachter hangt aan de eerste aardlek");
  eq(pos[5].aardlekId, aardlekken[1], "6.2 en die na de tweede aan de tweede");
  eq(pos[0].aardlekId, null, "6.3 wat vóór de eerste aardlek staat hangt nergens aan");
}

console.log("▶ CATEGORIE 7: de groepenverklaring van de kastdeur");
eq(splitsVerklaring("3 — Wasmachine"), { nummer: 3, naam: "Wasmachine", rest: "" },
   "7.1 nummer en naam uit elkaar");
eq(splitsVerklaring("12. Vaatwasser").naam, "Vaatwasser", "7.2 ook met een punt");
eq(splitsVerklaring("").nummer, null, "7.3 een lege regel levert niets");

console.log("▶ CATEGORIE 8: de volgorde op de rail");
{
  const door = sorteerPosities([{ rail: 2, positie: 0 }, { rail: 1, positie: 5 }, { rail: 1, positie: 1 }]);
  eq(door.map((p) => [p.rail, p.positie]), [[1, 1], [1, 5], [2, 0]],
     "8.1 rail voor rail, links naar rechts — zoals je ervoor staat");
}

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) {
  console.log("\n⚠️  MISLUKTE TESTS:");
  failures.forEach((f) => console.log(f));
  process.exit(1);
}
