// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — het correctielog en de leerlus
//
// Hoe de app leert van wat de installateur verbetert, en wat daarvan het toestel
// mag verlaten. Deze tests stonden tot 30-09-2026 in de suite van Kastscan; ze
// horen bij de motor, want leerlus.js staat daar nu en YourWkb gaat hem gebruiken.
//
// Voer uit met:  node tests/test-leren.js
// ─────────────────────────────────────────────────────────────────────────────

import * as M from "../index.js";
const Leer = M;

let goed = 0, fout = 0;
const fouten = [];
function ok(naam, voorwaarde, detail) {
  if (voorwaarde) goed++;
  else { fout++; fouten.push(`  \u2717 ${naam}${detail ? " \u2014 " + detail : ""}`); }
}
function is(naam, gekregen, verwacht) {
  ok(naam, JSON.stringify(gekregen) === JSON.stringify(verwacht),
     `gekregen ${JSON.stringify(gekregen)}, verwacht ${JSON.stringify(verwacht)}`);
}

// ─── 9 · CORRECTIELOG ─────────────────────────────────────────────────────────

is("gelijke waarde = bevestigd",
   M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 16, zekerheid: 0.9 }).actie, "bevestigd");
is("gewijzigde waarde = gecorrigeerd",
   M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 20, zekerheid: 0.9 }).actie, "gecorrigeerd");
is("leeggemaakte waarde = geleegd",
   M.maakCorrectie({ veld: "In", voorstel: 16, definitief: "", zekerheid: 0.9 }).actie, "geleegd");

// De metriek die telt: hoge zekerheid én toch gecorrigeerd.
const correcties = [
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 20, zekerheid: 0.95 }),
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 20, zekerheid: 0.40 }),
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 16, zekerheid: 0.95 }),
];
is("overtuigd fout telt alleen de hoge zekerheid", M.overtuigdFout(correcties).length, 1);
is("statistiek telt correcties", M.correctieStatistiek(correcties).gecorrigeerd, 2);


// ─── 9b · DE ZEKERHEID VAN ÉÉN VELD ──────────────────────────────────────────
//
// Twee vormen, want promptversie A gaf een object per veld en B geeft één getal
// per positie. Beide komen nog voor. Dit is twee keer misgegaan in een scherm —
// daar stond `(p.zekerheid || {})[veld]`, wat bij een getal altijd undefined
// geeft — en dat sloopte precies de twee metingen waar de leerlus op draait.
{
  is("één getal geldt voor elk veld", M.zekerheidVan({ zekerheid: 0.9 }, "type"), 0.9);
  is("ook voor een ander veld", M.zekerheidVan({ zekerheid: 0.9 }, "In"), 0.9);
  is("de oude objectvorm wordt nog gelezen",
     M.zekerheidVan({ zekerheid: { type: 0.8, In: 0.4 } }, "In"), 0.4);
  is("een veld dat er niet in staat geeft undefined",
     M.zekerheidVan({ zekerheid: { type: 0.8 } }, "polen"), undefined);
  is("zonder zekerheid undefined", M.zekerheidVan({}, "type"), undefined);
  is("en zonder positie ook", M.zekerheidVan(null, "type"), undefined);
  // 0 is een geldige zekerheid en mag niet als "niets" gelden.
  is("nul is een waarde, geen leegte", M.zekerheidVan({ zekerheid: 0 }, "type"), 0);
  // De bevestigingslus slaat een veld over bij undefined. Met een getal mag dat
  // dus nooit gebeuren, anders legt "Bevestigen en verder" niets vast.
  const velden = ["fabrikant", "type", "karakteristiek", "In", "IAn", "polen", "breedteModules", "aardlektype"];
  ok("met één getal wordt geen enkel veld overgeslagen",
     velden.every((v) => M.zekerheidVan({ zekerheid: 0.82 }, v) !== undefined));
}


// ─── 15c · WAT ER VAN BUITEN BINNENKOMT ───────────────────────────────────────
//
// De catalogus is bedoeld om GEDEELD te worden tussen installateurs, dus een
// geïmporteerd bestand komt per definitie van buiten. Aangetoond op 03-09-2026:
// een gedeeld bestand kon een `functie` zetten — en die naam belandt op een
// sticker op de kastdeur en in de groepenverklaring, een document waar de
// installateur voor tekent.

{
  const kwaad = { versie: 1, items: {
    "hager|mks516": { sleutel: "x", velden: {
      functie: { waarde: "GEVAAR — niet aanraken", bevestigingen: 9, installateurs: ["a", "b", "c"] },
      functieEigen: { waarde: true, bevestigingen: 9, installateurs: ["a", "b", "c"] },
      id: { waarde: "p01", bevestigingen: 9, installateurs: ["a", "b", "c"] },
      karakteristiek: { waarde: "B", bevestigingen: 9, installateurs: ["a", "b", "c"] },
    }, betwist: {}, bronnen: [] },
  } };

  // 1 · De witte lijst op het AANVULLEN is de eigenlijke afsluiting: ook een
  //     ongesaneerde catalogus mag geen groepsnaam kunnen zetten.
  const samen = Leer.catalogusSamenvoegen({ versie: 1, items: {} }, kwaad);
  const r = Leer.vulAanUitCatalogus(samen,
    { id: "p07", fabrikant: "Hager", type: "MKS516", functie: "", functieEigen: false, karakteristiek: "" });
  is("een gedeelde catalogus kan geen groepsnaam zetten", r.positie.functie, "");
  ok("en geen eigen-naam-vlag", !r.positie.functieEigen);
  is("de id blijft van ons", r.positie.id, "p07");
  is("wat er WEL uit mag komt gewoon door", r.positie.karakteristiek, "B");
  is("en alleen dat wordt gemeld", JSON.stringify(r.aangevuld), JSON.stringify(["karakteristiek"]));

  // 2 · De sanering gooit de velden er al bij binnenkomst uit.
  const schoon = Leer.saneerCatalogus(kwaad);
  is("na sanering blijft alleen het witgelijste veld over",
     JSON.stringify(Object.keys(schoon.items["hager|mks516"].velden)), JSON.stringify(["karakteristiek"]));
}

// Sleutels die de prototypeketen omzetten in plaats van een gegeven op te slaan.
for (const sleutel of ["__proto__", "constructor", "prototype"]) {
  const schoon = Leer.saneerCatalogus({ versie: 1, items: {
    [sleutel]: { velden: { In: { waarde: 16, bevestigingen: 3, installateurs: ["a"] } } },
  } });
  ok(`"${sleutel}" wordt geweigerd als sleutel`, !Object.keys(schoon.items).includes(sleutel));
  ok(`en vergiftigt Object.prototype niet`, ({}).In === undefined);
}

// Onbegrensde invoer: de catalogus gaat naar localStorage, en een vol quotum
// maakt de app onbruikbaar zonder uitweg.
{
  const veel = { versie: 1, items: {} };
  for (let i = 0; i < 6000; i++) {
    veel.items[`m${i}`] = { velden: { In: { waarde: 16, bevestigingen: 1, installateurs: ["a"] } } };
  }
  ok("het aantal items is begrensd", Object.keys(Leer.saneerCatalogus(veel).items).length <= 5000);

  const lang = { versie: 1, items: { a: { velden: { karakteristiek:
    { waarde: "x".repeat(9000), bevestigingen: 1, installateurs: Array(400).fill("i") } } } } };
  const v = Leer.saneerCatalogus(lang).items.a.velden.karakteristiek;
  ok("lange waarden worden afgekapt", String(v.waarde).length <= 120, `${String(v.waarde).length}`);
  ok("en de installateurslijst ook", v.installateurs.length <= 50, `${v.installateurs.length}`);
}

is("onzin levert een lege catalogus op",
   JSON.stringify(Leer.saneerCatalogus(null)), JSON.stringify({ versie: 1, items: {} }));
is("een string ook",
   JSON.stringify(Leer.saneerCatalogus("stuk")), JSON.stringify({ versie: 1, items: {} }));

// ─── 16 · DE LEERLUS ──────────────────────────────────────────────────────────
//
// De brug naar YourWkb: wat Kastscan leert over het lezen van kasten, is niet
// Kastscan-eigen. Deze tests bewaken de twee dingen die stil fout kunnen gaan —
// dat de catalogus te snel iets als waarheid aanneemt, en dat er data meelekt
// die niet gedeeld mag worden.

is("materiaalsleutel normaliseert", Leer.materiaalSleutel("Hager", " MKS516 "), "hager|mks516");
is("zonder type geen sleutel", Leer.materiaalSleutel("Hager", ""), "");

// Eén aflezing is geen kennis: de drempel is meerdere ONAFHANKELIJKE
// bevestigingen door verschillende installateurs.
let cat = Leer.legeCatalogus();
const aflezing = { fabrikant: "Hager", type: "MKS516", karakteristiek: "B", In: 16, polen: 1, breedteModules: 1, soort: "automaat" };
cat = Leer.catalogusLeer(cat, aflezing, "martin");
is("één aflezing levert nog geen kennis", Leer.catalogusZoek(cat, "Hager", "MKS516"), null);

// Dezelfde installateur die tien kasten doet, levert één stem.
cat = Leer.catalogusLeer(cat, aflezing, "martin");
cat = Leer.catalogusLeer(cat, aflezing, "martin");
is("dezelfde installateur telt één keer", Leer.catalogusZoek(cat, "Hager", "MKS516"), null);

cat = Leer.catalogusLeer(cat, aflezing, "maurits");
cat = Leer.catalogusLeer(cat, aflezing, "herman");
const kennis = Leer.catalogusZoek(cat, "Hager", "MKS516");
ok("drie onafhankelijke bevestigingen leveren kennis", !!kennis, JSON.stringify(kennis));
is("de kennis klopt", kennis.velden.karakteristiek, "B");
is("de nominale stroom klopt", kennis.velden.In, 16);

// Een tegenstrijdige aflezing overschrijft niet, maar maakt het veld betwist.
cat = Leer.catalogusLeer(cat, { ...aflezing, In: 20 }, "iemand");
const naBetwist = Leer.catalogusZoek(cat, "Hager", "MKS516");
is("een betwist veld verdwijnt uit de kennis", naBetwist.velden.In, undefined);
is("de karakteristiek blijft wel staan", naBetwist.velden.karakteristiek, "B");
ok("het betwiste veld staat in de reviewrij",
   Leer.reviewRij(cat).some((r) => r.veld === "In"), JSON.stringify(Leer.reviewRij(cat)));

// De catalogus vult alleen LEGE velden aan. Wat het model op déze foto heeft
// gelezen is sterker bewijs dan een gemiddelde over andere kasten.
const leeg = { fabrikant: "Hager", type: "MKS516", karakteristiek: "", In: null, polen: null, soort: "automaat" };
const aangevuld = Leer.vulAanUitCatalogus(cat, leeg);
is("leeg veld wordt aangevuld", aangevuld.positie.karakteristiek, "B");
ok("betwist veld wordt niet aangevuld", aangevuld.positie.In === null, String(aangevuld.positie.In));
ok("soort komt nooit uit de catalogus", !aangevuld.aangevuld.includes("soort"));

const gevuld = { fabrikant: "Hager", type: "MKS516", karakteristiek: "C", In: null, soort: "automaat" };
is("een gelezen waarde wordt niet overschreven",
   Leer.vulAanUitCatalogus(cat, gevuld).positie.karakteristiek, "C");

// Samenvoegen is de vorm die het delen aanneemt.
let cat2 = Leer.legeCatalogus();
cat2 = Leer.catalogusLeer(cat2, { fabrikant: "ABB", type: "SN201", karakteristiek: "B", In: 16 }, "a");
cat2 = Leer.catalogusLeer(cat2, { fabrikant: "ABB", type: "SN201", karakteristiek: "B", In: 16 }, "b");
cat2 = Leer.catalogusLeer(cat2, { fabrikant: "ABB", type: "SN201", karakteristiek: "B", In: 16 }, "c");
const samen = Leer.catalogusSamenvoegen(cat, cat2);
ok("samenvoegen behoudt beide typen",
   !!Leer.catalogusZoek(samen, "Hager", "MKS516") && !!Leer.catalogusZoek(samen, "ABB", "SN201"));

// PRIVACY — dit is de test die ertoe doet. Een vrij ingetypte naam mag het
// toestel niet verlaten; een naam uit de eigen suggestielijst wel.
is("standaardnaam mag gedeeld", Leer.naamMagGedeeld("standaard"), true);
is("naam uit de lijst mag gedeeld", Leer.naamMagGedeeld("lijst"), true);
is("vrij getypte naam mag NIET gedeeld", Leer.naamMagGedeeld("vrij"), false);
is("naam uit de oude kast mag NIET gedeeld", Leer.naamMagGedeeld("oud"), false);

const kastMetNamen = {
  adres: { postcode: "2691JJ", huisnummer: "72" },
  verdelers: [{
    posities: [
      { functie: "Keuken", naamBron: "lijst" },
      { functie: "Achterhuis mevr. De Vries", naamBron: "vrij" },
      { functie: "Groep 3", naamBron: "standaard" },
      { functie: "Kookplaat", naamBron: "oud" },
    ],
    fotoDicht: "data:image/jpeg;base64,AAAA",
  }],
};
const leerset = Leer.bouwLeerset(kastMetNamen, cat, correcties, { promptversie: "p1", appversie: "a1" });
const leersetTekst = JSON.stringify(leerset);
ok("de vrij getypte naam gaat NIET mee", !leersetTekst.includes("De Vries"), leersetTekst);
ok("de naam uit de oude kast gaat NIET mee", !leersetTekst.includes("Kookplaat"));
ok("de foto gaat NIET mee", !leersetTekst.includes("data:image"));
ok("het adres gaat NIET mee", !leersetTekst.includes("2691JJ") && !leersetTekst.includes("72"));
ok("de naam uit de lijst gaat WEL mee", leersetTekst.includes("Keuken"));
ok("de standaardnaam gaat WEL mee", leersetTekst.includes("Groep 3"));
ok("de catalogus gaat mee", !!leerset.catalogus.items);
ok("de statistiek is geaggregeerd", typeof leerset.correctiestatistiek.totaal === "number");
ok("de statistiek bevat geen losse gevallen", !Array.isArray(leerset.correctiestatistiek.gevallen));

// De vrijgaveregel: een promptwijziging die de correctiegraad laat oplopen is
// fout, hoe aannemelijk de redenering ook was.
const vorige = Leer.correctieStatistiek([
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 16, zekerheid: 0.9, promptversie: "v1" }),
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 16, zekerheid: 0.9, promptversie: "v1" }),
  // Onzeker én gecorrigeerd: een gemiste aflezing, geen overtuigde fout.
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 20, zekerheid: 0.4, promptversie: "v1" }),
]);
const slechter = Leer.correctieStatistiek([
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 20, zekerheid: 0.5, promptversie: "v2" }),
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 20, zekerheid: 0.5, promptversie: "v2" }),
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 16, zekerheid: 0.5, promptversie: "v2" }),
]);
is("een stijgende correctiegraad wordt afgekeurd",
   Leer.oordeelOverWijziging(vorige, slechter).niveau, "afwijking");

const overtuigd = Leer.correctieStatistiek([
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 20, zekerheid: 0.95, promptversie: "v3" }),
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 16, zekerheid: 0.95, promptversie: "v3" }),
  M.maakCorrectie({ veld: "In", voorstel: 16, definitief: 16, zekerheid: 0.95, promptversie: "v3" }),
]);
is("meer overtuigd-fout wordt afgekeurd",
   Leer.oordeelOverWijziging(vorige, overtuigd).niveau, "afwijking");

// De expert-steekproef weegt zwaarder dan gebruiksdata.
const score = Leer.gewogenScore(vorige, [Leer.expertRonde({ gevonden: 4, gemist: 9, ontkracht: 2 })]);
is("bij een gemis wint de expert", score.doorslaggevend, "expert");
is("zonder gemis telt de gebruiksdata",
   Leer.gewogenScore(vorige, [Leer.expertRonde({ gevonden: 4, gemist: 0 })]).doorslaggevend, "gebruik");


console.log("\n" + (fout ? fouten.join("\n") + "\n" : "") +
  `${goed}/${goed + fout} tests groen` + (fout ? `\n${fout} FOUT` : ""));
if (fout) process.exit(1);
