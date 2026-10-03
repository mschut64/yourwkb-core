// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de documenten: groepenoverzicht, labelvel en installatieschema
//
// Verhuisd uit Kastscan op 03-10-2026 zodat YourWkb ze ook kan maken. Wat hier
// bewaakt wordt is niet de opmaak maar de twee dingen die bij een verhuizing
// stilletjes kunnen breken:
//
//   • dat een kast die in YourWkb MET DE HAND is ingevuld er net zo goed doorheen
//     komt als een kast die uit een foto is gelezen (`positiesUitAardlekgroepen`);
//   • dat de motor geen oordeel vélt. Signalen, samenvatting en fasebalans komen
//     van de app; krijgt het document ze niet, dan staat er niets in plaats van
//     iets beweerds.
//
// Voer uit met:  node tests/test-documenten.js
// ─────────────────────────────────────────────────────────────────────────────

import { positiesUitAardlekgroepen, aardlekgroepenUitPosities, komma, aardlekKleur,
         aardlekKleurNaam, faseBalans } from "../index.js";
import { labelSelectie, controleerPassend, korteNaam, labelDatum, voetDatum,
         labelBreedteVoorModules, RISICO_DWINGT_VOL_LABEL, LANGE_NAAM_DWINGT_VOL_LABEL } from "../labels.js";
import { groepenoverzichtHtml, labelvelHtml, schemaHtml, velIndeling, ontsmet } from "../documenten.js";
import { readFileSync } from "node:fs";
import { schemaVanKast, ontwerpSchema } from "../schema.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

// Een kast zoals YourWkb hem kent: met de hand ingevuld, dus zonder merk, zonder
// type en zonder plaats op de rail.
const AARDLEKGROEPEN = [
  { id: "a1", naam: "Aardlek 1–4", rcdType: "A", rcdMa: "30", fase: "1", L: "L1", eindgroepen: [
    { id: "e1", naam: "Licht", kar: "B", ampere: "16A" },
    { id: "e2", naam: "Wandcontactdozen", kar: "B", ampere: "16A" },
    { id: "e3", naam: "Kookplaat", kar: "B", ampere: "40A", modules: 2, type: "kook" },
  ]},
  { id: "a2", naam: "Aardlek 5–8", rcdType: "A", rcdMa: "30", fase: "1", L: "L2", eindgroepen: [
    { id: "e4", naam: "Zolder", kar: "B", ampere: "16A" },
  ]},
  { id: "a3", naam: "Zonder aardlekschakelaar", rcdType: "geen", rcdMa: "", eindgroepen: [
    { id: "e5", naam: "Beltrafo", kar: "gG", ampere: "2A" },
  ]},
];
const POSITIES = positiesUitAardlekgroepen(AARDLEKGROEPEN);
const VERDELER = { id: "v1", posities: POSITIES, hoofd: { hoofdzekering: 25, fasen: 3, kamMm2: 16 } };
const KAST = { adres: { postcode: "3151TJ", huisnummer: "14" }, verdelers: [VERDELER] };

console.log("▶ CATEGORIE 1: de brug terug, van groepen naar modules");
eq(POSITIES.filter((p) => p.soort === "aardlek").length, 2,
   "1.1 twee aardlekschakelaars — het blok 'zonder' levert er geen");
eq(POSITIES.filter((p) => p.soort === "automaat").length, 4, "1.2 vier automaten");
eq(POSITIES.filter((p) => p.soort === "smeltveiligheid").length, 1,
   "1.3 en de gG-groep wordt een smeltveiligheid, geen automaat");
eq(POSITIES.find((p) => p.functie === "Kookplaat").breedteModules, 2,
   "1.4 de modulebreedte reist mee");
// ⚓ `type` op een eindgroep is het EINDGROEPTYPE (kook, laad), niet de
// typeaanduiding van het toestel. Eén regel verschil, en zonder deze test had er
// "kook" als productcode op de sticker gestaan.
eq(POSITIES.every((p) => p.fabrikant === "" && p.type === ""), true,
   "1.5 ⚓ merk en type worden NIET verzonnen bij een handmatig ingevulde kast");
eq(POSITIES.some((p) => p.type === "kook"), false,
   "1.5b en het eindgroeptype belandt niet in het veld voor de typeaanduiding");
{
  const terug = aardlekgroepenUitPosities(POSITIES);
  eq(terug.length, 3, "1.6 heen en terug geeft dezelfde drie blokken");
  eq(terug.map((t) => t.eindgroepen.length), [3, 1, 1], "1.7 met dezelfde groepen erin");
  eq(terug[0].eindgroepen.map((e) => [e.naam, e.kar, e.ampere]),
     [["Licht", "B", "16A"], ["Wandcontactdozen", "B", "16A"], ["Kookplaat", "B", "40A"]],
     "1.8 en dezelfde namen, karakteristieken en stromen");
  eq(terug[2].rcdType, "geen", "1.9 het blok zonder aardlekschakelaar blijft wat het is");
}

console.log("▶ CATEGORIE 2: het groepenoverzicht op A4");
const HTML = groepenoverzichtHtml(KAST, { datum: "3 oktober 2026" });
eq(["Licht", "Wandcontactdozen", "Kookplaat", "Zolder", "Beltrafo"].every((n) => HTML.includes(n)), true,
   "2.1 alle groepen staan erop");
eq(HTML.includes("@page{size:A4"), true, "2.2 en het is een A4");
eq(HTML.includes("B40"), true, "2.3 met de beveiliging erbij");
eq(HTML.includes("3151TJ 14"), true, "2.4 en het adres in de titel");
// De motor velt geen oordeel: zonder signalen van de app staat er geen enkel punt.
eq(/<li class="[^"]*">/.test(HTML), false, "2.5 ⚓ zonder signalen van de app geen aandachtspunten");
eq(HTML.includes("Nog geen groepen."), false, "2.6 en het is niet leeg");
{
  const metOordeel = groepenoverzichtHtml(KAST, {
    signalen: () => [{ niveau: "let-op", tekst: "Groep 3 zit op dezelfde fase als de kookgroep" }],
    samenvatting: () => "5 groepen · 2 aardlekschakelaars",
  });
  eq(metOordeel.includes("dezelfde fase als de kookgroep"), true,
     "2.7 geeft de app wél een oordeel, dan staat het erop");
  eq(metOordeel.includes("5 groepen · 2 aardlekschakelaars"), true, "2.8 net als de samenvatting");
}
{
  // De fasebalans komt van de app en wordt hier niet opnieuw uitgerekend — twee
  // optellingen van dezelfde kast is hoe de apps ooit uit elkaar liepen.
  const bal = faseBalans({ grp: [{ t: "kook", r: "af", kw: 7.4, fn: [1] }], ha: { f: "3", a: "25" } });
  const metBalans = groepenoverzichtHtml(KAST, { balans: bal });
  // Op de markering van de kaart zelf toetsen en niet op "L3": dat staat ook in
  // een CSS-commentaar, en dan meet de test de opmaak in plaats van de inhoud.
  // Op het VAK van de balans toetsen, niet op "L1": dat staat ook in de
  // fasekolom van elke groepsrij, en dan meet de test iets anders dan hij denkt.
  const balansVak = (h) => (h.match(/<div class="kaart"><div class="rij">([\s\S]*?)<\/div><\/div>/) || [, ""])[1];
  eq(balansVak(metBalans).length > 0, true, "2.9 met een balans staan er fasekaarten in het vak");
  eq(balansVak(HTML), "", "2.10 ⚓ en zonder balans blijft dat vak leeg — de motor rekent hem niet zelf uit");
}

console.log("▶ CATEGORIE 3: de labels");
const LABELS = labelSelectie(VERDELER, { datum: "03-10-2026" });
eq(LABELS.length > 0, true, `3.1 een kast levert labels op (${LABELS.length})`);
eq(LABELS.some((l) => l.soort === "strook"), true, "3.2 een strook per aardlekblok");
eq(LABELS.some((l) => l.soort === "apparaat"), true, "3.3 en apparaatstickers");
eq(LABELS.every((l) => l.sleutel), true, "3.4 elk label heeft een eigen sleutel om op te selecteren");
{
  const vel = labelvelHtml(LABELS, {});
  eq(vel.includes("Kookplaat"), true, "3.5 het labelvel draagt de namen");
  eq(vel.includes("@page"), true, "3.6 en is op papier gezet");
}
// ⚓ NOOIT SCHALEN (labelspec §2/§3): wat niet past is een invoerfout met een
// telling, geen reden om de letter te verkleinen.
{
  const lang = labelSelectie({ ...VERDELER, posities: positiesUitAardlekgroepen([
    { id: "a1", naam: "A", rcdType: "A", rcdMa: "30", eindgroepen: [
      { id: "e1", naam: "Wandcontactdozen woonkamer en keuken", kar: "B", ampere: "16A" }]},
  ])}, {});
  const fouten = lang.flatMap((l) => controleerPassend(l));
  eq(fouten.length > 0, true, "3.7 een te lange naam wordt gemeld…");
  eq(typeof fouten[0].tekensTeveel, "number", "3.8 …met het aantal tekens dat er te veel is");
}
eq(korteNaam("wandcontactdozen").length < "wandcontactdozen".length, true,
   "3.9 en er is een afkortingenlijst voor het smalle label");
eq(velIndeling().perVel > 0, true, "3.10 een vel heeft een vaste indeling");

console.log("▶ CATEGORIE 4: het installatieschema");
const SVG = schemaVanKast(KAST, {});
eq(typeof SVG, "string", "4.1 het schema is een svg-string");
eq(SVG.includes("<svg"), true, "4.2 met een svg erin");
eq(["Licht", "Kookplaat", "Beltrafo"].every((n) => SVG.includes(n)), true,
   "4.3 en alle groepen erop");
eq(SVG.includes("B16"), true, "4.4 met de beveiliging per groep");
{
  const ontwerp = ontwerpSchema(KAST, {});
  eq(Boolean(ontwerp), true, "4.5 het ontwerp is apart op te vragen");
  const leeg = schemaVanKast({ verdelers: [{ id: "v1", posities: [], hoofd: {} }] }, {});
  eq(leeg.includes("<svg"), true, "4.6 een lege kast geeft een leeg schema, geen fout");
}
eq(schemaHtml(KAST, {}).includes("@page"), true, "4.7 en er is een A4-versie om af te drukken");

console.log("▶ CATEGORIE 5: de kleuren van de band en de komma");
eq(komma(1.25), "1,3", "5.1 een getal met een komma");
eq(komma("onzin"), "—", "5.2 en wat geen getal is wordt een streepje");
eq(aardlekKleur("A1"), "#8FC4E8", "5.3 de eerste aardlek is blauw");
eq(aardlekKleur("A1", "rode"), "#E9A0A0", "5.4 ⚓ maar een GELEZEN kleur gaat voor — ook verbogen");
eq(aardlekKleurNaam("A2"), "lichtgroen", "5.5 en de naam hoort bij de tint");

console.log("▶ CATEGORIE 6: afdrukken — twee lessen die elkaar bijten");
{
  // Les 1 (beveiligingsaudit 25-08-2026): wat in een tabblad van onze eigen
  // oorsprong belandt, mag geen script kunnen uitvoeren.
  const vuil = '<html><body><h1>Kast</h1>' +
    '<script>alert(1)<' + '/script><img src=x onerror="alert(2)">' +
    '<a href="javascript:alert(3)">x</a></body></html>';
  const schoon = ontsmet(vuil);
  eq(/script/i.test(schoon), false, "6.1 script eruit");
  eq(/onerror/i.test(schoon), false, "6.2 on*-attributen eruit");
  eq(/javascript:/i.test(schoon), false, "6.3 javascript:-urls eruit");
  eq(schoon.includes("<h1>Kast</h1>"), true, "6.4 en de inhoud blijft staan");

  // Les 2 (melding Maurits 20-09-2026): niet printen vanuit een verborgen frame
  // van 0×0 — WebKit print dan het BOVENLIGGENDE document. Deze test leest de
  // broncode, want het gedrag zelf vraagt een echte browser.
  const bron = readFileSync(new URL("../documenten.js", import.meta.url), "utf8");
  const fn = bron.slice(bron.indexOf("export function printHtml"));
  eq(/window\.open\(""\s*,\s*"_blank"\)/.test(fn), true, "6.5 het document gaat naar een ECHT tabblad");
  eq(/width:0;height:0/.test(fn), false, "6.6 en nooit meer naar een frame van 0 bij 0");
  // De balk zelf staat als constante bóven de functie; de functie plakt hem erin.
  eq(bron.includes("ywkb-printbalk") && /PRINTBALK/.test(fn), true,
     "6.7 met een printknop erin voor als de dialoog niet opent");
  eq(/ontsmet\(html\)/.test(fn), true, "6.8 en wat erin gaat is ontsmet");
}

console.log("▶ CATEGORIE 7: wiens document is dit");
{
  // Deze documenten komen uit Kastscan en droegen die naam in de kop, de voet en
  // onder de QR. Een overzicht dat YourWkb maakt met "Kastscan" erop is voor de
  // installateur die het ophangt onnavolgbaar.
  eq(/Kastscan/.test(HTML), false, "7.1 er staat geen vreemde merknaam op");
  eq((HTML.match(/class="merknaam">([^<]*)/) || [])[1], "YourWkb", "7.2 standaard staat er YourWkb");
  const vanKastscan = groepenoverzichtHtml(KAST, { merk: "Kastscan" });
  eq((vanKastscan.match(/class="merknaam">([^<]*)/) || [])[1], "Kastscan",
     "7.3 en elke app kan zeggen wie hij is");
  eq(vanKastscan.includes("opgesteld met Kastscan"), true, "7.4 ook in de voetregel");
  eq(labelvelHtml([], { merk: "Kastscan" }).includes("Labelvel Kastscan"), true,
     "7.5 en op het labelvel");
  // Een kop met een leeg vak eronder leest als een fout; dan liever geen kop.
  eq(HTML.includes("Verdeling over de fasen"), false,
     "7.6 zonder balans staat de fasekop er niet — een lege kop oogt als een storing");
}

// ─── CATEGORIE 8: de datum op het label ──────────────────────────────────────
//
// `voetDatum` kort het jaartal alleen in als de datum er als dd-mm-jjjj uitziet.
// YourWkb gaf hem door `toLocaleDateString("nl-NL")`, en die laat de voorloopnul
// weg: "3-10-2026". Het inkorten greep dus niet, de datum liep op het smalle
// label één teken over de rand, en de passendheidscontrole meldde "kort de naam
// in" over een datum die niemand had getypt. Deze tests leggen die eis vast.
{
  console.log("▶ CATEGORIE 8: de datum op het label");

  eq(labelDatum(new Date(2026, 9, 3)), "03-10-2026", "8.1 dag en maand met een voorloopnul");
  eq(labelDatum(new Date(2026, 11, 25)), "25-12-2026", "8.2 en zonder als ze niet nodig is");
  eq(/^\d{2}-\d{2}-\d{4}$/.test(labelDatum()), true, "8.3 zonder argument is het vandaag, in dezelfde vorm");

  // De negatieve controle: dit is precies wat er misging.
  eq(voetDatum("3-10-2026", 15), "3-10-2026",
     "8.4 een datum zonder voorloopnul wordt NIET ingekort — daar zat de fout");
  eq(voetDatum(labelDatum(new Date(2026, 9, 3)), 15), "03-10-26",
     "8.5 met labelDatum wordt hij dat wel");
  eq(voetDatum(labelDatum(new Date(2026, 9, 3)), 30), "03-10-2026",
     "8.6 op het brede label blijft het jaartal voluit");

  // En de controle die de installateur te zien krijgt, moet er dan ook over zwijgen.
  const smal = labelSelectie({ id: "v1", posities: positiesUitAardlekgroepen(AARDLEKGROEPEN) },
                             { datum: labelDatum(new Date(2026, 9, 3)) });
  const datumfouten = smal.flatMap(l => controleerPassend(l).filter(f => /\d{2}-\d{2}-\d{2}/.test(f.tekst)));
  eq(datumfouten.length, 0, "8.7 geen enkele sticker klaagt nog over de datum");
}

// ─── CATEGORIE 9: hoe breed een sticker wordt ────────────────────────────────
//
// 🚨 Deze tests bestaan om een fout die bij de verhuizing is ontstaan en die in
// YourWkb live heeft gestaan. `labelBreedteVoorModules` bestond in twee versies:
// in labels.js een met alleen het modulegetal, en in Kastscans model.js een met
// twee uitzonderingen erbij. Toen `labelSelectie` naar labels.js verhuisde, riep
// hij de versie náást zich aan — met drie argumenten, waarvan er twee werden
// genegeerd, en JavaScript zwijgt daarover. Een pv-groep van één module kreeg
// daardoor een smal label waar zijn risicoregel niet op past, en een gewone
// groepsnaam liep over de rand. Dezelfde gevallen als in Kastscans eigen suite.
{
  console.log("▶ CATEGORIE 9: hoe breed een sticker wordt");

  // Normbesluit van Martin, 03-10-2026 — geen implementatiekeuze. Deze test staat
  // er zodat een latere opruiming hem niet "logischer" maakt.
  eq(RISICO_DWINGT_VOL_LABEL, true,
     "9.1 een restrisico dwingt een vol label — bevestigd door Martin 03-10-2026");
  eq(LANGE_NAAM_DWINGT_VOL_LABEL, true, "9.2 en een naam die niet past ook");

  eq(labelBreedteVoorModules(1, true, "Zonnepanelen"), 30,
     "9.3 pv op één module krijgt 30 mm — anders past de risicoregel er niet op");
  eq(labelBreedteVoorModules(1, false, "Keuken"), 15, "9.4 een korte naam past op 15 mm");
  eq(labelBreedteVoorModules(1, false, "Vaatwasser"), 15,
     "9.5 en een standaardnaam met afkorting ook");
  eq(labelBreedteVoorModules(1, false, "Achterhuis mevrouw"), 30,
     "9.6 een lange naam zonder afkorting dwingt 30 mm");
  eq(labelBreedteVoorModules(1, false, "Bijkeuken achter"), 30, "9.7 net als deze");
  eq(labelBreedteVoorModules(2, false, "Oven"), 30, "9.8 twee modules is altijd 30 mm");

  // ⚓ En de weg erheen: `labelSelectie` moet die regel ook echt gebruiken. Dit
  // is wat er misging — de functie werkte, de aanroep gaf de argumenten door, en
  // tóch kwam er 15 mm uit.
  // De posities komen uit dezelfde brug als de rest van deze suite, zodat de
  // vorm klopt: een eigen naam (`functieEigen`) is wat een apparaatsticker
  // oplevert, en één module is wat de breedte op scherp zet.
  const eenGroep = (naam) => positiesUitAardlekgroepen([
    { id: "a1", naam: "Aardlek 1", rcdType: "A", rcdMa: "30", fase: "1", eindgroepen: [
      { id: "e1", naam, kar: "B", ampere: "16A", modules: 1 },
    ]},
  ]);
  const apparaatVan = (naam) => labelSelectie(
    { id: "v1", posities: eenGroep(naam) },
    { datum: labelDatum(new Date(2026, 9, 3)) },
  ).find((l) => l.soort === "apparaat");

  const pvLabel = apparaatVan("Zonnepanelen");
  eq(pvLabel ? pvLabel.breedteMm : null, 30,
     "9.9 een pv-groep van één module levert via labelSelectie een vol label op");

  const langLabel = apparaatVan("Bijkeuken");
  eq(langLabel ? langLabel.breedteMm : null, 30,
     "9.10 en een naam die niet op 15 mm past net zo");
  eq(langLabel ? controleerPassend(langLabel).length : -1, 0,
     "9.11 en dan past hij ook echt — geen overloopmelding meer");

  // ⚓ De regel maakt niet alles passend, en dat hoort ook niet. Een naam die op
  // 30 mm nog te lang is blijft een INVOERFOUT met een telling (§2/§3) — de
  // letter wordt niet verkleind, de installateur kort de naam in.
  const teLang = apparaatVan("Wandcontactdozen woonkamer");
  eq(teLang ? teLang.breedteMm : null, 30, "9.12 een heel lange naam krijgt het volle label");
  eq(teLang ? controleerPassend(teLang).length : 0, 1,
     "9.13 en wordt dan alsnog gemeld in plaats van weggetypografeerd");
}

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) { console.log("\n⚠️  MISLUKTE TESTS:"); failures.forEach((f) => console.log(f)); process.exit(1); }
