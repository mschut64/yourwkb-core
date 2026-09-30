// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — van modules op een rail naar aardlekgroepen
//
// De schakel waar K4 en K5 op staan: een foto of een paspoort levert posities,
// het opleverrapport wil aardlekgroepen met eindgroepen. Wat hier bewaakt wordt
// is vooral wat er NIET gebeurt — geen aangenomen ampère, geen stilzwijgende
// karakteristiek, geen gegokte fase.
//
// Voer uit met:  node tests/test-aardlekgroepen.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  normaliseerAnalyse, koppelGroepenverklaring, aardlekgroepenUitPosities,
  eindgroepTypeUitFunctie, EINDGROEP_UIT_MKP, EINDGROEP_ONBEKEND, mkpType,
} from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

// Een kast zoals de fotoketen hem oplevert: hoofdschakelaar, twee aardlekken,
// vier groepen — waarvan één stop en één driefasige laadpaal.
const RUW = {
  posities: [
    { rail: 1, positie: 0, breedteModules: 3, soort: "hoofdschakelaar", In: 40, polen: 4, zekerheid: 0.95 },
    { rail: 1, positie: 3, breedteModules: 2, soort: "aardlek", IAn: 30, aardlektype: "A", polen: 2, zekerheid: 0.9 },
    { rail: 1, positie: 5, breedteModules: 1, soort: "automaat", karakteristiek: "B", In: 16, polen: 1, groepstekst: "1", zekerheid: 0.88 },
    { rail: 1, positie: 6, breedteModules: 1, soort: "smeltveiligheid", In: 20, polen: 1, groepstekst: "2", zekerheid: 0.85 },
    { rail: 1, positie: 7, breedteModules: 2, soort: "aardlek", IAn: 30, aardlektype: "B", polen: 4, zekerheid: 0.9 },
    { rail: 1, positie: 9, breedteModules: 3, soort: "automaat", karakteristiek: "C", In: 16, polen: 3, groepstekst: "3", zekerheid: 0.8 },
  ],
};
// De hele keten, zoals een app hem doorloopt: normaliseren, dan de namen van de
// groepenverklaring op de kastdeur eroverheen.
const VERKLARING = ["1 — Keuken", "2 — Wasmachine", "3 — Laadpaal"];
const POSITIES = koppelGroepenverklaring(normaliseerAnalyse(RUW, "v1"), VERKLARING).posities;
const GROEPEN = aardlekgroepenUitPosities(POSITIES, { bron: "foto" });

console.log("▶ CATEGORIE 1: de clusters kloppen met de kast");
eq(GROEPEN.length, 2, "1.1 twee aardlekschakelaars, twee aardlekgroepen");
eq(GROEPEN.map((g) => g.eindgroepen.length), [2, 1], "1.2 met de groepen die erachter hangen");
eq(GROEPEN.flatMap((g) => g.eindgroepen).some((e) => e.naam === "Hoofdschakelaar"), false,
   "1.3 de hoofdschakelaar is geen eindgroep");
eq([GROEPEN[0].rcdType, GROEPEN[0].rcdMa], ["A", "30"], "1.4 type en mA van de eerste aardlek");
eq([GROEPEN[1].rcdType, GROEPEN[1].rcdMa], ["B", "30"], "1.5 en van de tweede");
// `fase` is het AANTAL fasen, niet welke. Dat verschil heeft in dit project al
// eens twee apps uit elkaar laten lopen.
eq([GROEPEN[0].fase, GROEPEN[1].fase], ["1", "3"], "1.6 een meerpolige aardlek maakt het cluster driefasig");

console.log("▶ CATEGORIE 2: niets wordt aangenomen wat niet gelezen is");
{
  // Een kale automaat: geen karakteristiek, geen stroom, geen merk gelezen.
  const kaal = aardlekgroepenUitPosities(
    normaliseerAnalyse({ posities: [
      { rail: 1, positie: 0, soort: "aardlek", polen: 2, zekerheid: 0.9 },
      { rail: 1, positie: 2, soort: "automaat", polen: 1, zekerheid: 0.9 },
    ] }, "v1"), { bron: "foto" });
  eq(kaal[0].eindgroepen[0].ampere, "", "2.1 geen gelezen stroom geeft een leeg veld, niet 16A");
  eq(kaal[0].eindgroepen[0].kar, "", "2.2 en geen karakteristiek, niet B");
  eq(kaal[0].rcdMa, "", "2.3 een aardlek zonder mA blijft leeg");
  // Het type van de aardlek is de enige terugval, en die is bewust: "A" is wat
  // een nieuwe groep in de app toch al krijgt, en `bron` zegt erbij dat het uit
  // een foto komt.
  eq(kaal[0].rcdType, "A", "2.4 het RCD-type valt terug op de app-standaard");
  eq(kaal[0].bron, "foto", "2.5 met de herkomst erbij, zodat een scherm dat kan tonen");
}

console.log("▶ CATEGORIE 3: een stop is geen automaat");
{
  const stop = GROEPEN[0].eindgroepen.find((e) => e.ampere === "20A");
  // gG en niet "B": Z_max komt bij een trage smeltveiligheid uit een
  // tijd-stroomkromme en niet uit factor × In. Stilletjes "B" invullen zou de
  // toets in het rapport laten slagen op een norm die er niet geldt.
  eq(stop.kar, "gG", "3.1 een smeltveiligheid krijgt gG");
}

console.log("▶ CATEGORIE 4: de fase komt nooit uit een kastfoto");
eq([GROEPEN[0].L, GROEPEN[1].L], ["", ""], "4.1 geen van beide clusters krijgt een fase");
eq([GROEPEN[0].Lbron, GROEPEN[1].Lbron], ["", ""], "4.2 en dus ook geen herkomst");
{
  // Uit een eendraadschema kan hij wél komen; dan reist de herkomst mee.
  const metFase = aardlekgroepenUitPosities(
    normaliseerAnalyse({ posities: [{ rail: 1, positie: 0, soort: "aardlek", polen: 2, zekerheid: 0.9 }] }, "v1")
      .map((p) => ({ ...p, fase: "L2" })), { bron: "schema" });
  eq([metFase[0].L, metFase[0].Lbron], ["L2", "schema"], "4.3 uit een schema wel, met herkomst");
}

console.log("▶ CATEGORIE 5: de namen van de kastdeur komen mee");
eq(GROEPEN[0].eindgroepen.map((e) => e.naam), ["Keuken", "Wasmachine"], "5.1 de groepenverklaring vult de namen");
eq(GROEPEN[1].eindgroepen[0].naam, "Laadpaal", "5.2 ook achter de tweede aardlek");
eq(GROEPEN[0].eindgroepen[0].naamBron, "foto", "5.3 met de herkomst van de naam erbij");

console.log("▶ CATEGORIE 6: het type van een eindgroep");
eq(eindgroepTypeUitFunctie("Laadpaal"), "laad", "6.1 een laadpaal wordt een laadgroep");
eq(eindgroepTypeUitFunctie("Kookplaat"), "kook", "6.2 een kookplaat een kookgroep");
eq(eindgroepTypeUitFunctie("Zonnepanelen"), "pv", "6.3 zonnepanelen een PV-groep");
eq(eindgroepTypeUitFunctie("Thuisbatterij"), "batterij", "6.4 een accu een thuisbatterij");
eq(eindgroepTypeUitFunctie("Krachtstroom"), "kracht", "6.5 krachtstroom een krachtgroep");
eq(eindgroepTypeUitFunctie("Wasmachine"), null, "6.6 een gewone groep krijgt geen type");
eq(GROEPEN[1].eindgroepen[0].type, "laad", "6.7 en zo komt het in de aardlekgroep terecht");
{
  // De warmtepomp was tot 30-09-2026 het gat: het paspoort kende `wp` mét de
  // gelijktijdigheidsfactor en een terugval van 6,9 kW, een eindgroep niet. Zo'n
  // groep belandde als `alg` in de QR. Besluit Martin: toegevoegd als zesde type.
  eq(mkpType("Warmtepomp"), "wp", "6.8 het paspoort kent een warmtepomp");
  eq(eindgroepTypeUitFunctie("Warmtepomp"), "wp", "6.9 en een eindgroep nu ook");
  eq(eindgroepTypeUitFunctie("Airco"), "wp", "6.10 een airco telt als warmtepomp, net als in het paspoort");
  eq(EINDGROEP_ONBEKEND, [], "6.11 er is geen paspoorttype meer zonder eindgroep");
  eq(Object.keys(EINDGROEP_UIT_MKP).sort().join(","),
     "bat,kook,lp,ov,pv,wp", "6.12 de lijst dekt elk paspoorttype behalve alg");
}

console.log("▶ CATEGORIE 7: de zwaarst belaste groep, zoals het scherm hem kiest");
eq(GROEPEN[0].hoogstId, GROEPEN[0].eindgroepen.find((e) => e.ampere === "20A").id,
   "7.1 20 A weegt zwaarder dan 16 A");
eq(GROEPEN[1].hoogstId, GROEPEN[1].eindgroepen[0].id, "7.2 met één groep is die het vanzelf");

console.log("▶ CATEGORIE 8: losse groepen zonder aardlekschakelaar");
{
  const los = aardlekgroepenUitPosities(
    normaliseerAnalyse({ posities: [
      { rail: 1, positie: 0, soort: "automaat", karakteristiek: "B", In: 16, polen: 1, zekerheid: 0.9 },
    ] }, "v1"), { bron: "foto" });
  eq(los.length, 1, "8.1 ze vormen samen één cluster");
  eq(los[0].rcdType, "geen", "8.2 met rcdType 'geen', wat de cross-checks kennen");
  eq(los[0].rcdMa, "", "8.3 en zonder aanspreekstroom");
}

console.log("▶ CATEGORIE 9: twee keer dezelfde kast geeft twee keer hetzelfde");
{
  // Geen Date.now() in de identifiers: anders verandert een tweede scan stil elke
  // verwijzing (hoogstId, de meetwaarden die aan een groep hangen).
  const a = aardlekgroepenUitPosities(POSITIES, { bron: "foto" });
  const b = aardlekgroepenUitPosities(POSITIES, { bron: "foto" });
  eq(JSON.stringify(a) === JSON.stringify(b), true, "9.1 de uitkomst is deterministisch");
  eq(a.flatMap((g) => g.eindgroepen.map((e) => e.id)).length,
     new Set(a.flatMap((g) => g.eindgroepen.map((e) => e.id))).size, "9.2 met unieke identifiers");
}

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) {
  console.log("\n⚠️  MISLUKTE TESTS:");
  failures.forEach((f) => console.log(f));
  process.exit(1);
}
