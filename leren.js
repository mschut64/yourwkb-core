// ─────────────────────────────────────────────────────────────────────────────
// Het correctielog: wat de app leert van wat de installateur verbetert
//
// Elke keer dat iemand een voorstel bevestigt of corrigeert, is dat een meting van
// hoe goed het lezen ging. Twee getallen tellen:
//
//   correctiegraad  hoeveel er werd bijgesteld van alles wat werd voorgesteld
//   overtuigdFout   hoe vaak het model hoge zekerheid had én er toch naast zat
//
// Het tweede is het ernstigste: een model dat twijfelt en het mis heeft is te
// verdragen, een model dat zeker is en het mis heeft niet.
//
// De bevestigingen zijn net zo belangrijk als de correcties — zonder hen bestaat
// de noemer niet. Dat is één keer stilletjes misgegaan (zie `zekerheidVan`).
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { ZEKERHEIDSDREMPEL } from "./normaliseren.js";

export function maakCorrectie({ projectId, verdelerId, positieId, moment, promptversie, veld, voorstel, definitief, zekerheid, tijdstip }) {
  const gelijk = String(voorstel == null ? "" : voorstel) === String(definitief == null ? "" : definitief);
  let actie = "gecorrigeerd";
  if (gelijk) actie = "bevestigd";
  else if (definitief == null || definitief === "") actie = "geleegd";
  return {
    projectId: projectId || "",
    verdelerId: verdelerId || "",
    positieId: positieId || "",
    moment: moment || "kastscan",
    promptversie: promptversie || "",
    veld,
    voorstel: voorstel == null ? null : voorstel,
    definitief: definitief == null ? null : definitief,
    actie,
    zekerheid: toNum(zekerheid) >= 0 ? toNum(zekerheid) : null,
    tijdstip: tijdstip || "",
  };
}

// De metriek die telt: overtuigd fout. Hoge zekerheid én gecorrigeerd.
export function overtuigdFout(correcties) {
  return (correcties || []).filter(
    (c) => c.actie === "gecorrigeerd" && toNum(c.zekerheid) >= ZEKERHEIDSDREMPEL
  );
}

// De statistiek zoals hij ook gedeeld mag worden: tellingen, geen gevallen.
//
// Stond tot 30-09-2026 twee keer — hier en als `correctieStatistiekVoorDelen` in
// leerlus.js, met de drempel daar hardgecodeerd op 0,75 omdat dat bestand
// importvrij moest blijven. Twee bijna gelijke functies met bijna dezelfde naam,
// en twee definities van dezelfde grens. Nu één van allebei.
export function correctieStatistiek(correcties) {
  const lijst = correcties || [];
  const perVeld = {};
  for (const c of lijst) {
    const r = perVeld[c.veld] || { bevestigd: 0, gecorrigeerd: 0, geleegd: 0, overtuigdFout: 0 };
    if (r[c.actie] !== undefined) r[c.actie] += 1;
    if (c.actie === "gecorrigeerd" && toNum(c.zekerheid) >= ZEKERHEIDSDREMPEL) r.overtuigdFout += 1;
    perVeld[c.veld] = r;
  }
  const totaal = lijst.length;
  const gecorrigeerd = lijst.filter((c) => c.actie === "gecorrigeerd").length;
  return {
    totaal,
    gecorrigeerd,
    // De noemer is ALLES wat is voorgesteld, dus inclusief de bevestigingen.
    // Zonder die bevestigingen is de correctiegraad per definitie 1 en zegt hij niets.
    correctiegraad: totaal ? gecorrigeerd / totaal : 0,
    overtuigdFout: overtuigdFout(lijst).length,
    perVeld,
  };
}
