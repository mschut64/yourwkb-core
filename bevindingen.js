// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — bevindingen: wat er op een kastfoto te zien is dat niet klopt
//
// De tegenhanger van `normaliseren.js`. Dat bestand maakt van een kastfoto een
// kastbeeld — wat er hángt. Dit maakt van dezelfde foto een lijst bevindingen —
// wat er aan die kast te zíén is. Twee taken, twee prompts, twee uitkomsten, en
// met opzet gescheiden: de leesprompt is gekalibreerd op het vóórvullen van een
// formulier en zegt in regel 6 zelf dat beoordelen een andere taak is.
//
// ⚓ DIT KEURT NIETS. Drie uitkomsttypen en geen enkel eindoordeel. De
// zuiverheidsregel van dit project geldt onverkort: wij verifiëren niets, wij maken
// controleerbaar. Een bevinding is een aanwijzing voor de installateur, die zelf
// bepaalt wat hij ermee doet — en die verantwoordelijk blijft.
//
// ⚓ EEN VERMOEDEN ZONDER CONTROLEACTIE VERVALT. Dat is de harde regel uit de
// kalibratie op de kasten van Herman, en hij staat hier in code en niet alleen in
// de prompt: `normaliseerBevinding` gooit zo'n vermoeden weg. Een vermoeden zonder
// "ga dit meten of opzoeken" is een beschuldiging zonder uitweg, en dat is precies
// wat een installateur van deze app wegjaagt.
//
// ⚓ STILZWIJGEN IS GEEN BEVESTIGING. Als de installateur een bevinding laat staan
// zonder er iets van te vinden, telt dat NIET als "het model had gelijk". Diezelfde
// les staat al bij EXPERT_WEGING in leerlus.js: een akkoord betekent alleen dat
// niemand iets zag. Daarom levert `correctieUitOordeel` bij "nietgezien" niets op.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { maakCorrectie } from "./leren.js";
import { expertRonde } from "./leerlus.js";

export const BEVINDING_SOORTEN = ["constatering", "vermoeden", "niet-beoordeelbaar"];

// De zoeklijst uit de kalibratie, in dezelfde volgorde waarin hij afgelopen hoort
// te worden. De labels zijn wat de installateur op zijn scherm ziet.
export const CATEGORIEEN = [
  { id: "verbindingen", label: "Verbindingen en afmontage",
    uitleg: "Blank koper, niet-afgemonteerde aders, soepeldraad zonder huls, meerdere aders in één klem." },
  { id: "verbindingsmiddel", label: "Verbindingsmiddel versus geleider",
    uitleg: "Hoort de verbinder bij de ader? Massief in een soepel-verbinder is de klassieker." },
  { id: "beschermingsleiding", label: "Beschermingsleidingen",
    uitleg: "Het losnemen van één aarddraad mag de continuïteit van de andere niet onderbreken." },
  { id: "opbouw", label: "Opbouw van de kast",
    uitleg: "Scheidingsschotten, SELV naast 230 V, aftakking vóór de hoofdschakelaar." },
  { id: "warmte", label: "Warmte",
    uitleg: "Een warmteproducerend component tegen een automaat aan verschuift diens karakteristiek." },
  { id: "materiaalstaat", label: "Materiaalstaat",
    uitleg: "Oxidatie, corrosie, verkleuring, roet- of brandsporen." },
  { id: "beveiliging", label: "Beveiliging",
    uitleg: "Aardlektype, hoofdzekering, overspanningsbeveiliging — vaak een vraag, geen afkeur." },
  { id: "privacy", label: "Privacy in beeld",
    uitleg: "Leesbare namen, wachtwoorden of stickers. Geen installatiegebrek — de foto gaat mee in een rapport." },
];

export const CATEGORIE_IDS = CATEGORIEEN.map((c) => c.id);
const CATEGORIE_OP_ID = new Map(CATEGORIEEN.map((c) => [c.id, c]));

export function categorieLabel(id) {
  const c = CATEGORIE_OP_ID.get(String(id));
  return c ? c.label : "Overig";
}

const tekst = (v, max = 400) => String(v == null ? "" : v).trim().slice(0, max);

/**
 * Eén ruwe bevinding van het model naar de vorm waarin de app ermee werkt.
 *
 * Geeft `null` als de bevinding niet door de poort komt. Drie redenen, en ze zijn
 * alle drie een regel uit de kalibratie:
 *   • geen waarneming — dan is er niets gezien;
 *   • een onbekende soort of categorie — dan weet niemand wat ermee moet;
 *   • een vermoeden zonder controleactie — zie de kop.
 */
export function normaliseerBevinding(ruw, index = 0) {
  if (!ruw || typeof ruw !== "object") return null;
  const soort = BEVINDING_SOORTEN.includes(ruw.soort) ? ruw.soort : null;
  const categorie = CATEGORIE_IDS.includes(ruw.categorie) ? ruw.categorie : null;
  if (!soort || !categorie) return null;

  const waarneming = tekst(ruw.waarneming);
  if (!waarneming) return null;

  const controleactie = tekst(ruw.controleactie);
  if (soort === "vermoeden" && !controleactie) return null;

  const z = toNum(ruw.zekerheid);
  return {
    // Deterministisch, zodat een oordeel van de installateur aan dezelfde
    // bevinding blijft hangen als het scherm opnieuw tekent. Geen Date.now().
    id: `b${index + 1}`,
    soort, categorie,
    categorieLabel: categorieLabel(categorie),
    waarneming,
    gevolgtrekking: tekst(ruw.gevolgtrekking),
    controleactie,
    plek: tekst(ruw.plek, 120),
    zekerheid: Number.isFinite(z) && z >= 0 && z <= 1 ? z : null,
  };
}

// Constateringen eerst, dan vermoedens, dan wat niet te beoordelen was; binnen een
// soort de zekerste bovenaan. Privacy springt naar voren: dat moet weg vóór de foto
// in een rapport belandt, en het heeft niets met de installatie te maken.
const SOORT_RANG = { constatering: 0, vermoeden: 1, "niet-beoordeelbaar": 2 };

export function sorteerBevindingen(lijst) {
  return [...(lijst || [])].sort((a, b) => {
    if ((a.categorie === "privacy") !== (b.categorie === "privacy"))
      return a.categorie === "privacy" ? -1 : 1;
    const r = (SOORT_RANG[a.soort] ?? 9) - (SOORT_RANG[b.soort] ?? 9);
    if (r) return r;
    return (b.zekerheid ?? 0) - (a.zekerheid ?? 0);
  });
}

/** De hele uitkomst van een beoordeling, klaar voor het scherm. */
export function normaliseerBeoordeling(json) {
  const d = json && typeof json === "object" ? json : {};
  const bruikbaar = d.bruikbaar !== false;
  const ruw = Array.isArray(d.bevindingen) ? d.bevindingen : [];
  const bevindingen = sorteerBevindingen(
    ruw.map((b, i) => normaliseerBevinding(b, i)).filter(Boolean)
  );
  const tel = (s) => bevindingen.filter((b) => b.soort === s).length;
  return {
    bruikbaar,
    reden: tekst(d.reden, 300),
    redenSoort: tekst(d.redenSoort, 40),
    bevindingen,
    aantallen: {
      totaal: bevindingen.length,
      constateringen: tel("constatering"),
      vermoedens: tel("vermoeden"),
      nietBeoordeelbaar: tel("niet-beoordeelbaar"),
      privacy: bevindingen.filter((b) => b.categorie === "privacy").length,
      // Weggevallen omdat ze de poort niet haalden. Zichtbaar houden: als dit
      // getal structureel oploopt, levert de prompt vermoedens zonder uitweg.
      geweigerd: ruw.length - bevindingen.length,
    },
  };
}

// ─── WAT DE INSTALLATEUR ERVAN VINDT ─────────────────────────────────────────
//
// Drie antwoorden, en het derde is er een met opzet: "niet gezien" is geen oordeel
// en levert dus geen leersignaal op.
export const OORDELEN = ["bevestigd", "ontkracht", "nietgezien"];

export const OORDEEL_LABEL = {
  bevestigd: "Klopt — gezien",
  ontkracht: "Klopt niet",
  nietgezien: "Niet te zien / niet nagekeken",
};

/**
 * Het oordeel van de installateur over één bevinding, in de vorm van het
 * correctielog — zodat dezelfde leerlus die het kastbeeld meet ook de beoordeling
 * meet, met dezelfde begrippen (`correctiegraad`, `overtuigdFout`).
 *
 * Geeft `null` bij "nietgezien". Dat is de belangrijkste regel van dit bestand:
 * stilzwijgen is geen bevestiging.
 */
export function correctieUitOordeel({ bevinding, oordeel, projectId, verdelerId, promptversie, tijdstip } = {}) {
  if (!bevinding || !OORDELEN.includes(oordeel) || oordeel === "nietgezien") return null;
  const kern = `${bevinding.categorie}: ${bevinding.waarneming}`.slice(0, 200);
  return maakCorrectie({
    projectId, verdelerId,
    positieId: bevinding.id,
    moment: "kastcheck",
    promptversie,
    // Per categorie meten, niet per bevinding: dan is te zien wáár de check sterk
    // is en waar hij zwak is. Dat is wat een volgende promptronde nodig heeft.
    veld: `bevinding:${bevinding.categorie}`,
    voorstel: kern,
    definitief: oordeel === "bevestigd" ? kern : "ontkracht",
    zekerheid: bevinding.zekerheid,
    tijdstip,
  });
}

/** Alle oordelen van één scan naar correcties. `oordelen` is { [bevindingId]: oordeel }. */
export function correctiesUitBeoordeling({ bevindingen, oordelen, projectId, verdelerId, promptversie, tijdstip } = {}) {
  return (bevindingen || [])
    .map((b) => correctieUitOordeel({
      bevinding: b, oordeel: (oordelen || {})[b.id],
      projectId, verdelerId, promptversie, tijdstip,
    }))
    .filter(Boolean);
}

/**
 * Een ronde van een expert (Herman) over dezelfde foto's: wat de check vond, wat
 * zij ten onrechte meldde, en — het zwaarste — wat zij MISTE. Dat laatste komt
 * nooit uit gebruiksdata: wie niets aanklikt, heeft niets gemeld.
 *
 * `gemist` zijn de bevindingen die de expert zelf toevoegt en die de check niet had.
 */
export function expertRondeUitBeoordeling({ datum, inspecteur, bevindingen, oordelen, gemist } = {}) {
  const o = oordelen || {};
  const lijst = bevindingen || [];
  return expertRonde({
    datum, inspecteur,
    gevonden: lijst.filter((b) => o[b.id] === "bevestigd").length,
    ontkracht: lijst.filter((b) => o[b.id] === "ontkracht").length,
    gemist: Array.isArray(gemist) ? gemist.length : (Number(gemist) || 0),
  });
}

// ─── NAAR DE LEEROMGEVING ────────────────────────────────────────────────────
//
// Het vliegwiel uit het concept: echte installaties leveren de leeromgeving verse
// casussen — de fouten die écht in het veld worden gemaakt. Maar alleen bevestigde
// bevindingen, en alleen gestript.
//
// ⚓ WAT HIERUIT KOMT MAG GEDEELD WORDEN, DE REST NIET. Geen adres, geen klant, geen
// foto, geen plek in de kast (die maakt een kast herkenbaar voor wie hem kent), geen
// projectnummer. Wat overblijft is wat je ook in een leerboek zou zetten: wat zag
// je, wat betekent het, wat doe je eraan. Dezelfde regel als bij `naamMagGedeeld`
// in de leerlus — wat het toestel verlaat is een afweging, geen vanzelfsprekendheid.
export function leerpuntUitBevinding(bevinding, oordeel) {
  if (!bevinding || oordeel !== "bevestigd") return null;
  if (bevinding.categorie === "privacy") return null; // privacy wordt opgeruimd, niet lesmateriaal
  if (bevinding.soort !== "constatering") return null; // een vermoeden is geen les
  return {
    categorie: bevinding.categorie,
    categorieLabel: bevinding.categorieLabel,
    waarneming: bevinding.waarneming,
    gevolgtrekking: bevinding.gevolgtrekking,
    controleactie: bevinding.controleactie,
    // Uit het veld, door een installateur bevestigd. De leeromgeving mag dat zeggen:
    // het is het verschil met een verzonnen oefenvraag.
    bron: "veld-bevestigd",
  };
}

export function leerpuntenUitBeoordeling({ bevindingen, oordelen } = {}) {
  return (bevindingen || [])
    .map((b) => leerpuntUitBevinding(b, (oordelen || {})[b.id]))
    .filter(Boolean);
}
