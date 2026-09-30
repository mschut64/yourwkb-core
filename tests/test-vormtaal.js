// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de vormtaal van de kast
//
// De strook is wat de installateur ziet, en daarmee waarop hij zijn oordeel
// baseert: past er nog een groep bij, en achter welke aardlek. Dat mag niet stil
// verschuiven. Hier wordt bewaakt dat één kast één rail oplevert, in de volgorde
// waarin hij hangt, met de maten en kleuren die beide apps delen.
//
// Voer uit met:  node tests/test-vormtaal.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  MODULE_PX, AARDLEK_KLEUR, AARDLEK_BAND, AARDLEK_KLEURNAAM,
  aardlekCode, aardlekBandKleur, strookUitAardlekgroepen,
} from "../index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

// Twee aardlekgroepen en een blok zonder aardlekschakelaar: de drie vormen die
// in een woningkast voorkomen.
const KAST = [
  { id: "a1", naam: "Aardlek A", rcdType: "A", rcdMa: "30", fase: "1", L: "L2", bron: "paspoort",
    eindgroepen: [
      { id: "e1", naam: "Keuken", kar: "B", ampere: "16A" },
      { id: "e2", naam: "Zolder" },
    ] },
  { id: "a2", naam: "Aardlek B", rcdType: "B", rcdMa: "30", fase: "3", L: "",
    eindgroepen: [{ id: "e3", naam: "Laadpaal", kar: "C", ampere: "16A", type: "laad", modules: 3 }] },
  { id: "a3", naam: "Los", rcdType: "geen", rcdMa: "", fase: "1", L: "",
    eindgroepen: [{ id: "e4", naam: "Zonnepanelen", kar: "B", ampere: "20A", type: "pv" }] },
];
const S = strookUitAardlekgroepen(KAST);

console.log("▶ CATEGORIE 1: één kast is één rail, in hangvolgorde");
eq(S.modules.map((m) => m.soort),
   ["rcd", "eind", "eind", "rcd", "eind", "eind"],
   "1.1 aardlek, zijn groepen, volgende aardlek");
eq(S.modules.map((m) => m.naam),
   ["Aardlek A", "Keuken", "Zolder", "Aardlek B", "Laadpaal", "Zonnepanelen"],
   "1.2 en de namen in dezelfde volgorde");
// Een blok zonder aardlekschakelaar krijgt er géén: die staat niet in de kast.
eq(S.modules.filter((m) => m.soort === "rcd").length, 2, "1.3 'geen RCD' zet geen module op de rail");

console.log("▶ CATEGORIE 2: de breedte is de breedte");
eq(MODULE_PX, 52, "2.1 een module is 52 px — de tapmaat uit design-spec §1.3");
eq(S.modules[0].modules, 2, "2.2 een aardlekschakelaar beslaat twee modules");
eq(S.modules[4].modules, 3, "2.3 een driefasige automaat wat hij zegt te zijn");
eq(S.modules[1].breedtePx, MODULE_PX, "2.4 en de pixels volgen de modules");
// 2 + 1 + 1 + 2 + 3 + 1: de aardlekschakelaars tellen mee, anders klopt het beeld
// van hoe vol de kast is niet — en dat is de vraag bij een uitbreiding.
eq([S.breedte, S.breedtePx], [10, 520], "2.5 de kast is tien modules breed");

console.log("▶ CATEGORIE 3: twee kleurladders, en dat is opzet");
eq(aardlekCode(1), "A1", "3.1 de eerste aardlek is A1");
eq(aardlekCode(5), "EIGEN", "3.2 vanaf de vijfde is er geen kleur meer over");
eq(S.modules[0].kleur, AARDLEK_KLEUR.A1, "3.3 het label draagt de pastelkleur");
eq(S.modules[0].kleurnaam, AARDLEK_KLEURNAAM.A1, "3.4 met de naam die op de sticker komt");
eq(S.modules[0].band, AARDLEK_BAND.A1, "3.5 het scherm de verzadigde band");
eq(AARDLEK_KLEUR.A1 !== AARDLEK_BAND.A1, true, "3.6 en dat zijn niet dezelfde tinten");
eq(aardlekBandKleur("EIGEN"), AARDLEK_BAND.EIGEN, "3.7 een code zonder cijfer valt op grijs");
eq(aardlekBandKleur(""), AARDLEK_BAND.EIGEN, "3.8 en een lege code ook");
eq(S.modules[5].band, AARDLEK_BAND.EIGEN, "3.9 dus het losse blok krijgt grijs");

console.log("▶ CATEGORIE 4: de tegel zegt wat er nog ontbreekt");
eq([S.modules[1].beveiliging, S.modules[1].regel], ["B16", "B16"], "4.1 B16 leest als één ding");
eq(S.modules[2].onvolledig, true, "4.2 een groep zonder karakteristiek is onvolledig");
eq(S.modules[2].regel, "invullen", "4.3 en zegt dat, in plaats van een half getal");
eq(S.modules[1].onvolledig, false, "4.4 een volledige groep niet");
eq(S.modules[0].regel, "30mA", "4.5 bij een aardlek staat de aanspreekstroom onderaan");
eq(strookUitAardlekgroepen([{ id: "x", rcdType: "A", rcdMa: "", eindgroepen: [] }]).modules[0].regel,
   "?mA", "4.6 een onbekende aanspreekstroom is een vraagteken, geen 30");

console.log("▶ CATEGORIE 5: de fase, en wat er niet in staat");
eq(S.modules[1].fase, "L2", "5.1 de groepen dragen de fase van hun blok");
eq(S.modules[4].fase, "3F", "5.2 een driefasig blok is 3F, niet L1");
eq(S.modules[5].fase, "", "5.3 en een onbekende fase blijft leeg");
eq(S.modules[0].bron, "paspoort", "5.4 de herkomst reist mee naar de tegel");

console.log("▶ CATEGORIE 6: de nummers en de plek waar de groep bij komt");
eq(S.modules.filter((m) => m.soort === "eind").map((m) => m.nr), [1, 2, 3, 4],
   "6.1 groepen zijn doorlopend genummerd over de hele rail");
eq(S.modules.filter((m) => m.soort === "rcd").every((m) => m.nr === undefined), true,
   "6.2 een aardlekschakelaar is geen groep en heeft geen nummer");
// Achter de laatste module van een blok komt de uitbreiding te hangen. Dát is de
// reden dat de strook er staat.
eq(S.modules.filter((m) => m.laatsteVanBlok).map((m) => m.naam),
   ["Zolder", "Laadpaal", "Zonnepanelen"], "6.3 elke blok wijst zijn laatste module aan");
{
  const leeg = strookUitAardlekgroepen([{ id: "a", naam: "Nieuw", rcdType: "A", rcdMa: "30", eindgroepen: [] }]);
  eq(leeg.modules.map((m) => [m.soort, m.laatsteVanBlok]), [["rcd", true]],
     "6.4 bij een blok zonder groepen wijst de aardlek zelf de plek aan");
}

console.log("▶ CATEGORIE 7: de identiteit, zodat een tegel terug kan naar zijn groep");
eq(S.modules.map((m) => m.agId), ["a1", "a1", "a1", "a2", "a2", "a3"], "7.1 elke module kent zijn aardlekgroep");
eq(S.modules[1].eindId, "e1", "7.2 en een groepstegel zijn eindgroep");
eq(S.modules[0].eindId, null, "7.3 een aardlektegel niet");
eq(new Set(S.modules.map((m) => m.id)).size, S.modules.length, "7.4 de identifiers zijn uniek");

console.log("▶ CATEGORIE 8: een lege of kapotte kast geeft geen kapot beeld");
eq(strookUitAardlekgroepen([]), { modules: [], breedte: 0, breedtePx: 0 }, "8.1 geen kast, geen strook");
eq(strookUitAardlekgroepen(null).modules, [], "8.2 en geen lijst ook niet");
eq(strookUitAardlekgroepen([{ id: "a" }]).modules.length, 1, "8.3 een groep zonder eindgroepen valt niet om");

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) {
  console.log("\n⚠️  MISLUKTE TESTS:");
  failures.forEach((f) => console.log(f));
  process.exit(1);
}
