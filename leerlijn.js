// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de leerlijn: skills, punten, levels, streaks en badges
//
// Het Duolingo-model uit het concept, maar met één regel die het van een spelletje
// onderscheidt:
//
// ⚓ HET SPEL ÍS DE VAKINHOUD. Punten komen niet van aantikken maar van werk dat
// beoordeeld is: een skill is gehaald als een mens hem heeft afgetekend of als
// een oefenklus met die skill erin is goedgekeurd. Daarom kent dit bestand geen
// enkele manier om punten te krijgen zonder beoordeling — `verwerkBeoordeling`
// is de enige ingang. Zou dat anders zijn, dan is een level een getal dat niets
// zegt, en daarmee is de hele erkenning aan het eind waardeloos.
//
// ⚓ WAT HIER STAAT IS DE MECHANIEK, NIET DE LEERSTOF. De skills zijn afgeleid van
// wat de app al meet en toetst; de uitleg, de oefenvragen en de casussen zijn
// vakinhoud en horen bij de opleider (en bij Martin). Elke skill heeft daarom een
// veld `norm` met de grens die in deze apps al vastligt, en géén verzonnen
// lesmateriaal.
// ─────────────────────────────────────────────────────────────────────────────

// Drie niveaus per discipline. De namen komen uit het concept ("beginner naar
// gevorderd"); het derde niveau is wat een eerste monteur zelfstandig doet.
export const NIVEAUS = [
  { niveau: 1, label: "Beginner" },
  { niveau: 2, label: "Gevorderd" },
  { niveau: 3, label: "Zelfstandig" },
];

// `eis` zegt waarmee een skill te halen is:
//   kennis   — een vraag of een fotoherkenning (het "fout van de dag"-type)
//   meting   — een meetwaarde juist beoordelen in een oefenklus
//   klus     — pas af als een hele oefenklus met dit onderdeel is goedgekeurd
// Een skill met `eis: "klus"` kan dus nooit zonder beoordelaar gehaald worden.
export const SKILLS = {
  groepenkast: [
    { id: "gk-aarding",    niveau: 1, label: "Aarding en potentiaalvereffening", eis: "kennis", punten: 10 },
    { id: "gk-indeling",   niveau: 1, label: "Groepenindeling lezen",            eis: "kennis", punten: 10 },
    { id: "gk-isolatie",   niveau: 1, label: "Isolatiemeting naar aarde",        eis: "meting", punten: 15,
      norm: "≥ 0,23 MΩ naar aarde, ongeacht spanning of faseconfiguratie" },
    { id: "gk-rcd",        niveau: 2, label: "Aardlekschakelaar testen",         eis: "meting", punten: 15,
      norm: "ΔT ≤ 300 ms bij 1× IΔn (EN 61008); ΔI binnen het type", voorwaarden: ["gk-aarding"] },
    { id: "gk-impedantie", niveau: 2, label: "Lusimpedantie en Z_max",           eis: "meting", punten: 20,
      norm: "Z_max = U0 / Ia, van de beveiliging van het gemeten circuit", voorwaarden: ["gk-isolatie"] },
    { id: "gk-belasting",  niveau: 2, label: "Belasting per fase",               eis: "kennis", punten: 15,
      norm: "per fase A × 230 V; gelijktijdigheid 0,6 over de grote verbruikers" },
    { id: "gk-fouten",     niveau: 2, label: "Fouten zien op een kastfoto",      eis: "kennis", punten: 15 },
    { id: "gk-kast",       niveau: 3, label: "Een kast opleveren",               eis: "klus",   punten: 40,
      voorwaarden: ["gk-rcd", "gk-impedantie", "gk-indeling"] },
    { id: "gk-rapport",    niveau: 3, label: "Rapport en paspoort kloppend maken", eis: "klus", punten: 25,
      voorwaarden: ["gk-kast"] },
  ],
  pv: [
    { id: "pv-dc",       niveau: 1, label: "DC-zijde en stringspanning", eis: "meting", punten: 15 },
    { id: "pv-aarding",  niveau: 1, label: "Aarding draagconstructie",   eis: "kennis", punten: 10 },
    { id: "pv-isolatie", niveau: 2, label: "Isolatiemeting per string",  eis: "meting", punten: 15 },
    { id: "pv-ratio",    niveau: 2, label: "DC/AC-verhouding beoordelen", eis: "kennis", punten: 10 },
    { id: "pv-klus",     niveau: 3, label: "Een PV-installatie opleveren", eis: "klus", punten: 40,
      voorwaarden: ["pv-dc", "pv-isolatie"] },
  ],
  laadpaal: [
    { id: "lp-eindgroep", niveau: 1, label: "Eindgroep en beveiliging",   eis: "kennis", punten: 10,
      norm: "NEN 1010 rubriek 722.314.101" },
    { id: "lp-rcd",       niveau: 2, label: "RCD type B of A/F + RDC-DD", eis: "kennis", punten: 15,
      norm: "RCD type B óf type A/F met RDC-DD; de RDC-DD hoeft niet in het laadpunt te zitten" },
    { id: "lp-fase",      niveau: 2, label: "Fasekeuze en lastbeheer",    eis: "kennis", punten: 15 },
    { id: "lp-klus",      niveau: 3, label: "Een laadpunt opleveren",     eis: "klus",   punten: 40,
      voorwaarden: ["lp-eindgroep", "lp-rcd"] },
  ],
  wp: [
    { id: "wp-elektrisch", niveau: 1, label: "Elektrische aansluiting",  eis: "kennis", punten: 10 },
    { id: "wp-vermogen",   niveau: 2, label: "Vermogen en gelijktijdigheid", eis: "kennis", punten: 15 },
    { id: "wp-klus",       niveau: 3, label: "Een warmtepomp opleveren",  eis: "klus",   punten: 40,
      voorwaarden: ["wp-elektrisch"] },
  ],
  cv: [
    { id: "cv-rookgas", niveau: 1, label: "Rookgasafvoer en luchttoevoer", eis: "kennis", punten: 10 },
    { id: "cv-gas",     niveau: 2, label: "Gaszijdige aansluiting",        eis: "kennis", punten: 15 },
    { id: "cv-klus",    niveau: 3, label: "Een ketel opleveren",           eis: "klus",   punten: 40,
      voorwaarden: ["cv-rookgas", "cv-gas"] },
  ],
  batterij: [
    { id: "bat-opstelling", niveau: 1, label: "Opstelling en ventilatie", eis: "kennis", punten: 10 },
    { id: "bat-sturing",    niveau: 2, label: "Laden, ontladen en sturing", eis: "kennis", punten: 15,
      norm: "laden is afname (factor 0,6), ontladen levert aan de kam" },
    { id: "bat-klus",       niveau: 3, label: "Een thuisbatterij opleveren", eis: "klus", punten: 40,
      voorwaarden: ["bat-opstelling", "bat-sturing"] },
  ],
};

/** Alle skills van een discipline, of alles als er geen discipline gegeven is. */
export function skillsVoor(discipline) {
  if (!discipline) return Object.values(SKILLS).flat();
  return SKILLS[discipline] || [];
}

/** De punten die een discipline in totaal te geven heeft. */
export function maxPunten(discipline) {
  return skillsVoor(discipline).reduce((s, k) => s + (k.punten || 0), 0);
}

/**
 * Is deze skill open? Een skill met voorwaarden gaat pas open als die gehaald
 * zijn — dat is de leerlijn. Zonder die regel is "vandaag aarding, morgen
 * isolatiemeting" een lijstje in willekeurige volgorde.
 */
export function skillOpen(skill, gehaald) {
  const klaar = new Set(Array.isArray(gehaald) ? gehaald.map(String) : []);
  return (skill.voorwaarden || []).every((v) => klaar.has(String(v)));
}

/** De voortgang in één discipline: punten, level en wat er nu open staat. */
export function voortgang(discipline, gehaald) {
  const alle = skillsVoor(discipline);
  const klaar = new Set(Array.isArray(gehaald) ? gehaald.map(String) : []);
  const af = alle.filter((s) => klaar.has(s.id));
  const punten = af.reduce((s, k) => s + (k.punten || 0), 0);
  const max = maxPunten(discipline);
  // Het level is het hoogste niveau waarvan alle skills af zijn, plus één zolang
  // je daaraan werkt. Bewust niet uit punten afgeleid: dan kun je level 3 halen
  // met alleen de makkelijke onderdelen van elk niveau.
  let level = 1;
  for (const n of NIVEAUS) {
    const vanNiveau = alle.filter((s) => s.niveau === n.niveau);
    // Stoppen bij het eerste niveau dat niet af is: een level van 3 met niveau 1
    // nog open zou betekenen dat iemand de makkelijke onderdelen van elk niveau
    // kan pakken en daarmee "zelfstandig" heet.
    if (!vanNiveau.length || !vanNiveau.every((s) => klaar.has(s.id))) break;
    level = Math.min(3, n.niveau + 1);
  }
  const open = alle.filter((s) => !klaar.has(s.id) && skillOpen(s, gehaald));
  // Eén volgende stap, en wel de laagste die open staat. Een kopie sorteren, want
  // `open` wordt hieronder ook als lijst teruggegeven en die moet in de volgorde
  // van de leerlijn blijven staan.
  const volgende = [...open].sort((a, b) => a.niveau - b.niveau)[0] || null;
  return {
    discipline,
    punten, maxPunten: max,
    deel: max > 0 ? punten / max : 0,
    level,
    levelLabel: (NIVEAUS.find((n) => n.niveau === level) || NIVEAUS[0]).label,
    gehaald: af.map((s) => s.id),
    open: open.map((s) => s.id),
    volgende,
    af: max > 0 && punten >= max,
  };
}

// ─── STREAK ──────────────────────────────────────────────────────────────────
//
// Dagen op rij waarop er iets gedaan is. Twee keuzes die eruit volgen:
// vandaag nog niets gedaan hoeft de streak niet te breken (de dag is nog niet
// voorbij), maar een dag overslaan wel. En: de dagen worden in de lokale
// tijdzone geteld, want "gisteren" is een menselijk begrip, geen UTC-grens.
export function streak(dagen, nu = new Date()) {
  const dagSleutel = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };
  const set = new Set((Array.isArray(dagen) ? dagen : []).map(dagSleutel).filter(Boolean));
  if (!set.size) return { dagen: 0, actiefVandaag: false, langste: 0 };
  const vandaag = new Date(nu);
  const vandaagSleutel = dagSleutel(vandaag);
  let lengte = 0;
  const loop = new Date(vandaag);
  // Vandaag niet meegedaan? Dan begint het tellen bij gisteren: de dag is nog
  // niet om, en iemand om 09:00 zijn streak afpakken is onzin.
  if (!set.has(vandaagSleutel)) loop.setDate(loop.getDate() - 1);
  while (set.has(dagSleutel(loop))) {
    lengte++;
    loop.setDate(loop.getDate() - 1);
  }
  // De langste reeks ooit, voor de badge.
  const gesorteerd = [...set].sort();
  let langste = 0, rij = 0, vorige = null;
  for (const s of gesorteerd) {
    const d = new Date(s + "T12:00:00");
    if (vorige && (d - vorige) / 86400000 === 1) rij++;
    else rij = 1;
    langste = Math.max(langste, rij);
    vorige = d;
  }
  return { dagen: lengte, actiefVandaag: set.has(vandaagSleutel), langste };
}

// ─── BADGES ──────────────────────────────────────────────────────────────────
//
// Mijlpalen uit het concept. Elke badge hangt aan iets wat beoordeeld is of aan
// volgehouden werk; geen enkele is te halen door de app vaker te openen.
export const BADGES = [
  { id: "eerste-klus",   label: "Eerste klus goedgekeurd",
    uitleg: "Een oefenklus die een beoordelaar heeft goedgekeurd." },
  { id: "foutloze-kast", label: "Foutloze groepenkast",
    uitleg: "Een goedgekeurde groepenkast zonder normafwijking in de meetset." },
  { id: "meetstaat",     label: "Perfecte meetstaat",
    uitleg: "Alle meetwaarden binnen de norm én alle onderdelen akkoord." },
  { id: "week",          label: "Zeven dagen op rij", uitleg: "Een week lang elke dag geoefend." },
  { id: "maand",         label: "Dertig dagen op rij", uitleg: "Een maand lang elke dag geoefend." },
  { id: "niveau-2",      label: "Gevorderd", uitleg: "Alle skills van niveau 1 van een discipline gehaald." },
  { id: "zelfstandig",   label: "Zelfstandig", uitleg: "Alle skills van een discipline gehaald." },
];

/**
 * Welke badges deze stand oplevert.
 * @param stand { gehaald, disciplines:[id], klussen:[{goedgekeurd, afwijkingen, onderdelenAkkoord, onderdelenTotaal}], streakDagen }
 */
export function badges(stand) {
  const s = stand || {};
  const klussen = Array.isArray(s.klussen) ? s.klussen : [];
  const goed = klussen.filter((k) => k && k.goedgekeurd);
  const uit = [];
  if (goed.length) uit.push("eerste-klus");
  if (goed.some((k) => k.discipline === "groepenkast" && (k.afwijkingen || 0) === 0)) uit.push("foutloze-kast");
  if (goed.some((k) => (k.afwijkingen || 0) === 0 && k.onderdelenTotaal > 0 &&
                        k.onderdelenAkkoord === k.onderdelenTotaal)) uit.push("meetstaat");
  const dagen = Number(s.streakDagen || 0);
  if (dagen >= 7) uit.push("week");
  if (dagen >= 30) uit.push("maand");
  for (const d of (s.disciplines || Object.keys(SKILLS))) {
    const v = voortgang(d, s.gehaald);
    if (v.level >= 2 && !uit.includes("niveau-2")) uit.push("niveau-2");
    if (v.af && !uit.includes("zelfstandig")) uit.push("zelfstandig");
  }
  return BADGES.filter((b) => uit.includes(b.id));
}

// ─── PUNTEN KRIJGEN: DE ENIGE INGANG ─────────────────────────────────────────
//
// Een beoordeling komt binnen, en daaruit volgt wat er gehaald is. Niet andersom.
// `skillsUitKlus` zegt welke skills een goedgekeurde klus aftekent: de `klus`-
// skills van die discipline waarvan de voorwaarden al af zijn.
export function skillsUitKlus({ discipline, gehaald, onderdelenAkkoord, onderdelenTotaal } = {}) {
  if (!(onderdelenTotaal > 0) || onderdelenAkkoord !== onderdelenTotaal) return [];
  return skillsVoor(discipline)
    .filter((s) => s.eis === "klus" && skillOpen(s, gehaald))
    .map((s) => s.id);
}

/**
 * De tweede — en laatste — ingang: een kennisvraag die goed beantwoord is.
 *
 * ⚓ ALLEEN KENNIS-SKILLS, EN ALLEEN BIJ EEN JUIST ANTWOORD. Een vraag met een
 * antwoordsleutel is objectief na te kijken, dus daar hoeft geen mens bij. Maar
 * een skill die om een METING of een hele KLUS vraagt, kan hier nooit uit komen:
 * wie "aardlekschakelaar testen" op papier goed beantwoordt, heeft er nog geen een
 * getest. Zou dat wel mogen, dan is een level een getal dat niets zegt.
 *
 * @param vraag  { skill, goed }  — `goed` is de index van het juiste antwoord
 * @param keuze  de index die de leerling aankruiste
 */
export function verwerkKennisantwoord(stand, vraag, keuze) {
  const s = stand || {};
  const gehaald = new Set(Array.isArray(s.gehaald) ? s.gehaald.map(String) : []);
  const uit = { gehaald: [...gehaald], erbij: [], juist: false };
  if (!vraag || typeof vraag.goed !== "number") return uit;
  uit.juist = Number(keuze) === Number(vraag.goed);
  if (!uit.juist || !vraag.skill) return uit;
  const skill = skillsVoor().find((k) => k.id === String(vraag.skill));
  // Geen bestaande skill, een skill die geen kennisskill is, of eentje waarvan de
  // voorwaarden nog niet af zijn: dan levert een goed antwoord wel een compliment
  // op, maar geen punten.
  if (!skill || skill.eis !== "kennis" || !skillOpen(skill, uit.gehaald)) return uit;
  if (gehaald.has(skill.id)) return uit;
  gehaald.add(skill.id);
  return { gehaald: [...gehaald], erbij: [skill.id], juist: true };
}

/**
 * Verwerkt één beoordeling tot een nieuwe stand. Pure functie: geeft de nieuwe
 * lijst gehaalde skills terug en wat erbij kwam, zodat een scherm kan zeggen
 * "skill X gehaald" zonder zelf te rekenen.
 */
export function verwerkBeoordeling(stand, beoordeling) {
  const s = stand || {};
  const gehaald = new Set(Array.isArray(s.gehaald) ? s.gehaald.map(String) : []);
  const b = beoordeling || {};
  const erbij = [];
  if (b.goedgekeurd) {
    // Skills die de beoordelaar expliciet heeft afgetekend.
    for (const id of (Array.isArray(b.skills) ? b.skills : [])) {
      if (!gehaald.has(String(id))) { gehaald.add(String(id)); erbij.push(String(id)); }
    }
    // En de klus-skills die hier vanzelf uit volgen.
    for (const id of skillsUitKlus({ ...b, gehaald: [...gehaald] })) {
      if (!gehaald.has(id)) { gehaald.add(id); erbij.push(id); }
    }
  }
  return { gehaald: [...gehaald], erbij };
}

// ─── DE POORT NAAR DE ECHTE APP ──────────────────────────────────────────────
//
// Uit het concept: "pas na afronding (beoordeeld) krijg je toegang tot de echte
// app". Dat is een besluit van Martin en staat daarom als één regel hier, niet
// verspreid over schermen. Twee eisen, en ze zijn beide menselijk: alle skills
// van de discipline gehaald, en minstens één goedgekeurde klus met een cijfer.
export const POORT_CIJFER = 5.5;

export function toegangTotHoofdapp(stand, discipline) {
  const v = voortgang(discipline, (stand || {}).gehaald);
  const klussen = Array.isArray((stand || {}).klussen) ? stand.klussen : [];
  const beoordeeld = klussen.filter((k) => k && k.discipline === discipline &&
    k.goedgekeurd && Number(k.cijfer) >= POORT_CIJFER);
  const ontbreekt = [];
  if (!v.af) ontbreekt.push(`${v.maxPunten - v.punten} punten aan skills`);
  if (!beoordeeld.length) ontbreekt.push(`een goedgekeurde klus met minstens een ${String(POORT_CIJFER).replace(".", ",")}`);
  return { open: ontbreekt.length === 0, ontbreekt, voortgang: v };
}
