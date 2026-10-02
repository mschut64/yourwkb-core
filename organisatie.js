// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — organisaties, rollen en de scheiding tussen oefenen en opleveren
//
// De ZZP-app heeft geen accounts: de data zit in de QR en er staat niets
// centraal. De bedrijfs- en de onderwijsapp hebben ze wél nodig — meerdere
// mensen kijken naar hetzelfde werk, en iemand moet een cijfer kunnen geven.
// Dat is geen schermwerk maar een afspraak over wie wat mag, en afspraken horen
// in de motor: anders beslist elke app het opnieuw en beslist de tweede het
// anders.
//
// ⚓ TWEE SOORTEN ORGANISATIE, ÉÉN MOTOR. Bij een installatiebedrijf is de
// uitkomst een oplevering aan een klant; bij een opleider een beoordeelde
// leerling. Dezelfde keten, ander doel — dus hetzelfde rollenmodel met een ander
// doel erboven, en niet twee stelsels naast elkaar.
//
// ⚓ OEFENDATA EN ECHTE OPLEVERDATA LOPEN NOOIT DOOR ELKAAR. Een oefenkast is
// geen installatie en mag dus nooit in een Wkb-archief belanden: er hangt geen
// woning aan, er is geen klant, en het bewijs dat een aannemer onder de Wkb moet
// kunnen leveren wordt waardeloos als er oefenwerk tussen staat. Andersom ook:
// een echte oplevering is geen leerobject waarmee je mag spelen. De vlag is
// daarom verplicht en expliciet — `oefen: true` of `oefen: false`, nooit
// afwezig, want een ontbrekende vlag zou als "echt" gelezen worden door de ene
// app en als "oefening" door de andere.
// ─────────────────────────────────────────────────────────────────────────────

export const ORG_TYPES = ["bedrijf", "opleider"];

// De rollen. Bewust één lijst voor beide soorten organisatie, met per rol waar
// hij voorkomt: "monteur" en "leerling" doen hetzelfde werk in de app, en
// "projectleider" en "docent" kijken op dezelfde manier mee. Door ze niet te
// hernoemen per organisatie blijft de beoordelingsketen één keten.
export const ROLLEN = {
  // Beheert de organisatie: leden, instellingen, facturen.
  beheerder:     { label: "Beheerder",     bij: ["bedrijf", "opleider"] },
  // Kijkt mee en beoordeelt per checkpoint. Bij een bedrijf de projectleider of
  // planner, bij een opleider de docent.
  projectleider: { label: "Projectleider", bij: ["bedrijf"] },
  docent:        { label: "Docent",        bij: ["opleider"] },
  // Geeft het eindoordeel met cijfer. Bij een bedrijf is dat de baas zelf, bij
  // een opleider de examinator. Eén rol, want het is dezelfde bevoegdheid.
  meester:       { label: "Meester",       bij: ["bedrijf", "opleider"] },
  // Doet het werk. De monteur levert een echte klus op, de leerling een oefening.
  monteur:       { label: "Monteur",       bij: ["bedrijf"] },
  leerling:      { label: "Leerling",      bij: ["bedrijf", "opleider"] },
};

// Wat iemand mag. Eén tabel, zodat een scherm nooit zelf iets hoeft te
// bedenken en een vergeten controle in de ene app niet stil iets toestaat wat
// de andere verbiedt.
//
// De lastigste regel staat onderaan: wie beoordeelt, beoordeelt niet zijn eigen
// werk. Een meester die ook monteur is (klein bedrijf, de baas werkt mee) mag
// zijn eigen oplevering niet afvinken — dan is het vier-ogenprincipe weg, en
// dat is precies het verkoopargument van de bedrijfsvariant.
export const RECHTEN = {
  beheerder:     ["leden.beheren", "organisatie.instellen", "project.inzien.alle",
                  "fasecheck.beheren", "leerlijn.instellen"],
  projectleider: ["project.inzien.alle", "project.beoordelen", "project.terugsturen",
                  "fasecheck.beheren", "fasecheck.inzien"],
  docent:        ["project.inzien.alle", "project.beoordelen", "project.terugsturen",
                  "leerlijn.instellen", "casus.beheren"],
  meester:       ["project.inzien.alle", "project.beoordelen", "project.terugsturen",
                  "cijfer.geven", "project.vrijgeven", "fasecheck.inzien"],
  monteur:       ["project.eigen", "project.inleveren", "fasecheck.koppelen"],
  leerling:      ["project.eigen", "project.inleveren", "leerlijn.volgen"],
};

/** Mag deze rol (of dit stel rollen) deze handeling doen? */
export function mag(rollen, actie) {
  const lijst = Array.isArray(rollen) ? rollen : [rollen];
  return lijst.some((r) => (RECHTEN[r] || []).includes(actie));
}

/** De rollen die bij dit soort organisatie bestaan. */
export function rollenVoor(orgType) {
  return Object.entries(ROLLEN)
    .filter(([, r]) => r.bij.includes(orgType))
    .map(([id, r]) => ({ id, label: r.label }));
}

/**
 * Mag iemand dít project beoordelen? Naast het recht geldt één harde regel: niet
 * je eigen werk. Zonder die regel is het vier-ogenprincipe een vinkje.
 */
export function magBeoordelen({ rollen, gebruikerId }, project) {
  if (!project) return { mag: false, reden: "Geen project" };
  if (!mag(rollen, "project.beoordelen")) return { mag: false, reden: "Geen beoordelaarsrol" };
  if (project.gebruikerId && gebruikerId && String(project.gebruikerId) === String(gebruikerId))
    return { mag: false, reden: "Je kunt je eigen werk niet beoordelen" };
  return { mag: true, reden: "" };
}

// ─── DE SCHEIDING OEFENEN / OPLEVEREN ────────────────────────────────────────

/** Een oefenproject is er één met de vlag expliciet aan. Niets anders. */
export function isOefen(project) {
  return project ? project.oefen === true : false;
}

/**
 * De vlag die een project MOET dragen, afgeleid uit het soort organisatie.
 * Een opleider levert nooit op aan een klant, dus alles daar is oefening. Een
 * bedrijf doet echt werk, maar mag binnen de in-house begeleidingsmodus ook
 * oefenen — vandaar dat daar beide kanten voorkomen en de vlag per project wordt
 * meegegeven.
 */
export function oefenVlagVoor(orgType, gevraagd) {
  if (orgType === "opleider") return true;
  return gevraagd === true;
}

/**
 * De wacht aan de poort van het archief. Roep dit aan vóór je een project
 * wegschrijft of in een lijst opneemt; `ok:false` betekent: niet opbergen, en
 * de reden is geen technische fout maar een uitspraak die je aan de gebruiker
 * kunt laten zien.
 */
export function bewaakScheiding(project, { orgType, doel } = {}) {
  if (!project || typeof project.oefen !== "boolean")
    return { ok: false, reden: "Project zonder oefenvlag — onbekend of dit echt werk of een oefening is" };
  const oefen = project.oefen === true;
  if (doel === "wkb-archief" && oefen)
    return { ok: false, reden: "Een oefenproject hoort niet in het Wkb-archief" };
  if (doel === "leerdossier" && !oefen && orgType === "opleider")
    return { ok: false, reden: "Een opleider levert niet op aan een klant — dit project mist de oefenvlag" };
  if (orgType === "opleider" && !oefen)
    return { ok: false, reden: "Binnen een opleiding is elk project een oefening" };
  return { ok: true, reden: "" };
}

/** Splitst een lijst in echt werk en oefenwerk, zodat een scherm nooit telt wat het niet mag tellen. */
export function scheidOefen(projecten) {
  const lijst = Array.isArray(projecten) ? projecten : [];
  return {
    echt: lijst.filter((p) => p && p.oefen === false),
    oefen: lijst.filter((p) => p && p.oefen === true),
    // Projecten zonder vlag horen nergens: ze worden apart gezet en niet
    // stilzwijgend bij het echte werk gerekend.
    zonderVlag: lijst.filter((p) => !p || typeof p.oefen !== "boolean"),
  };
}
