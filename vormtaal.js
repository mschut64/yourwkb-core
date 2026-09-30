// ─────────────────────────────────────────────────────────────────────────────
// De vormtaal van een groepenkast: kleuren en maten die beide apps delen
//
// Kastscan tekent de kast als een strook modules op ware breedte, met onder elke
// aardlekgroep een kleurband. Sinds 30-09-2026 doet YourWkb dat ook, want een
// installateur die beide gebruikt hoort naar dezelfde kast te kijken.
//
// Wat hier staat is de MAATVOERING en de KLEUR. De tekening zelf — de JSX — staat
// per app, en dat is met opzet: de motor mag geen React kennen, en de twee apps
// stellen een andere vraag aan dezelfde kast. In Kastscan tik je een tegel aan om
// hem te benoemen; in YourWkb hangen er meetwaarden aan. Dezelfde vorm, ander doel.
//
// Zo werkt het ook al bij de fasebalken: gedeelde kleuren, gedeelde drempels, en
// vijftien regels JSX in elke app.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";

// Eén module op een DIN-rail is 18 mm breed. Op het scherm is dat 26 px: smal
// genoeg om een kast van twaalf modules op een telefoon te laten zien, breed
// genoeg om er een naam in te lezen.
export const MODULE_PX = 26;

// De kleurband onder een aardlekgroep. Lichte tinten, want er staat zwarte tekst
// overheen en ze moeten ook op een gewone kleurenprinter leesbaar blijven.
// Bewust géén groen/oranje/rood: dat zijn statuskleuren en die mogen nooit een
// blok aanduiden.
export const AARDLEK_KLEUR = {
  A1: "#8FC4E8",   // lichtblauw
  A2: "#A3D39C",   // lichtgroen
  A3: "#F3BE8A",   // lichtoranje
  A4: "#F0DC8C",   // lichtgeel
  EIGEN: "#C3A9D8" // lichtpaars
};

export const AARDLEK_KLEURNAAM = {
  A1: "lichtblauw", A2: "lichtgroen", A3: "lichtoranje",
  A4: "lichtgeel", EIGEN: "lichtpaars",
};

// De code van de zoveelste aardlekschakelaar. Vanaf de vijfde is er geen kleur
// meer over, en dan is "EIGEN" eerlijker dan een kleur die twee keer voorkomt.
// Dezelfde code gaat als `al` het meterkastpaspoort in (spec v0.2 §4.4).
export function aardlekCode(ordinal) {
  return ordinal >= 1 && ordinal <= 4 ? `A${ordinal}` : "EIGEN";
}

/**
 * De strook: per aardlekgroep een rij tegels, klaar om te tekenen.
 *
 * Eén rij per aardlekgroep, niet één lange rail zoals in Kastscan. Dat is een
 * bewuste afwijking: op een telefoon van 375 px moet een rail van twintig
 * modules horizontaal geschoven worden, en in YourWkb wordt er per aardlekgroep
 * gemeten — dus is de aardlekgroep de eenheid waarin je kijkt. Dezelfde tegels,
 * dezelfde kleurbanden, een andere indeling van het scherm.
 *
 * @param aardlekgroepen  zoals aardlekgroepenUitPosities ze oplevert
 * @returns  [{ code, kleur, kleurnaam, naam, fase, L, bron, breedte, tegels }]
 */
export function strookUitAardlekgroepen(aardlekgroepen) {
  return (Array.isArray(aardlekgroepen) ? aardlekgroepen : []).map((ag, i) => {
    const code = ag.rcdType === "geen" ? "EIGEN" : aardlekCode(i + 1);
    const tegels = (ag.eindgroepen || []).map((e) => {
      const modules = toNum(e.modules) > 0 ? toNum(e.modules) : 1;
      return {
        id: e.id,
        naam: e.naam || "",
        // "B16" leest als één ding; los van elkaar moet je het weer samenvoegen.
        beveiliging: [e.kar || "", (e.ampere || "").replace("A", "")].join("") || "",
        type: e.type || null,
        modules,
        breedtePx: modules * MODULE_PX,
        // Onvolledig is geen fout maar een vraag: hier hoort de installateur naar
        // te kijken. Het scherm mag dat laten zien zonder het af te keuren.
        onvolledig: !e.kar || !e.ampere,
        bron: e.bron || "",
      };
    });
    return {
      code,
      kleur: AARDLEK_KLEUR[code],
      kleurnaam: AARDLEK_KLEURNAAM[code],
      naam: ag.naam || "",
      rcd: ag.rcdType === "geen" ? "geen RCD" : `${ag.rcdMa || "?"} mA · type ${ag.rcdType || "?"}`,
      fase: ag.fase === "3" ? "3F" : (ag.L || ""),
      bron: ag.bron || "",
      // De breedte van de aardlekschakelaar zelf telt mee: die staat ook op de
      // rail, en zonder hem klopt het beeld van hoe vol de kast is niet.
      breedte: tegels.reduce((n, t) => n + t.modules, 0) + (ag.rcdType === "geen" ? 0 : 2),
      tegels,
    };
  });
}
