// ─────────────────────────────────────────────────────────────────────────────
// De vormtaal van een groepenkast: kleuren en maten die beide apps delen
//
// Kastscan tekent de kast als een strook modules op ware breedte, met onder de
// strook een kleurband per blok. Sinds 30-09-2026 doet YourWkb dat ook, want een
// installateur die beide gebruikt hoort naar dezelfde kast te kijken.
//
// Wat hier staat is de MAATVOERING, de KLEUR en de INDELING van de strook. De
// tekening zelf — de JSX — staat per app, en dat is met opzet: de motor mag geen
// React kennen, en de twee apps stellen een andere vraag aan dezelfde kast. In
// Kastscan tik je een tegel aan om hem te benoemen; in YourWkb hangen er
// meetwaarden aan. Dezelfde vorm, ander doel.
//
// Zo werkt het ook al bij de fasebalken: gedeelde kleuren, gedeelde drempels, en
// vijftien regels JSX in elke app.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { formatBeveiliging } from "./toestellen.js";

// Eén module op een DIN-rail is 18 mm breed. Op het scherm is dat 52 px: de
// tapmaat uit design-spec §1.3, zodat de smalste tegel nog met een werkhandschoen
// te raken is.
//
// Waarom niet smaller: bij 26 px past een kast van twaalf modules wél in één keer
// op een telefoon, maar dan is elke tegel onaanraakbaar en onleesbaar. Een
// meterkast is nu eenmaal breder dan een telefoon — horizontaal schuiven is het
// eerlijke antwoord, en dat doet Kastscan sinds het begin.
export const MODULE_PX = 52;

// De kleurband van het LABEL op de kastdeur, en van het groepenoverzicht dat
// meegaat met het rapport. Lichte tinten, want er staat zwarte tekst overheen en
// ze moeten ook op een gewone kleurenprinter leesbaar blijven.
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

// De kleurband op het SCHERM. Een andere ladder dan die van het label, en dat is
// geen slordigheid: een pastelband van 7 px op een donkere achtergrond is niet te
// onderscheiden, terwijl dezelfde tint op wit stickerpapier juist moet wijken
// voor de zwarte tekst erboven. Twee dragers, twee ladders.
//
// Dit is de ladder die Kastscan op het scherm al gebruikte. Hij staat hier zodat
// beide apps dezelfde kast tekenen en niet stil uit elkaar lopen — precies de
// reden dat deze motor bestaat.
export const AARDLEK_BAND = {
  A1: "#F5C518", A2: "#27AE60", A3: "#F97316", A4: "#9B59B6", EIGEN: "#64748B",
};

// De band van de zoveelste aardlekschakelaar, op het scherm. Een code zonder
// cijfer (EIGEN) valt op de laatste trede: grijs, want dat is geen blok meer maar
// "de rest".
export function aardlekBandKleur(code) {
  const m = String(code || "").match(/\d/);
  return AARDLEK_BAND[m ? `A${m[0]}` : "EIGEN"] || AARDLEK_BAND.EIGEN;
}

// De code van de zoveelste aardlekschakelaar. Vanaf de vijfde is er geen kleur
// meer over, en dan is "EIGEN" eerlijker dan een kleur die twee keer voorkomt.
// Dezelfde code gaat als `al` het meterkastpaspoort in (spec v0.2 §4.4).
export function aardlekCode(ordinal) {
  return ordinal >= 1 && ordinal <= 4 ? `A${ordinal}` : "EIGEN";
}

/**
 * De strook: ÉÉN rail met alle modules erop, in de volgorde waarin ze in de kast
 * hangen — aardlekschakelaar, de groepen die erachter hangen, de volgende
 * aardlekschakelaar. Klaar om te tekenen.
 *
 * Eén rail en niet één rij per aardlekgroep (zoals YourWkb het tot 30-09-2026
 * deed): een kast is één rail, en wie hem in stukken knipt kan niet meer zien dat
 * de tweede aardlek nog vier modules ruimte heeft. Bij een uitbreiding is dát de
 * vraag. Kastscan tekent hem daarom sinds het begin zo, en het is dezelfde kast.
 *
 * De aardlekschakelaar staat als gewone module op de rail, niet als kopje boven
 * een rij: hij bezet twee modules en dat hoort in het beeld te zitten.
 *
 * @param aardlekgroepen  zoals aardlekgroepenUitPosities ze oplevert
 * @returns  { modules, breedte, breedtePx }
 */
export function strookUitAardlekgroepen(aardlekgroepen) {
  const lijst = Array.isArray(aardlekgroepen) ? aardlekgroepen : [];
  const modules = [];
  let nr = 0;

  lijst.forEach((ag, i) => {
    const code = ag.rcdType === "geen" ? "EIGEN" : aardlekCode(i + 1);
    const blok = {
      agId: ag.id,
      code,
      kleur: AARDLEK_KLEUR[code],
      kleurnaam: AARDLEK_KLEURNAAM[code],
      band: aardlekBandKleur(code),
      // Het aantal fasen, niet welke: "3F" als het blok driefasig is, anders de
      // fase zelf als die bekend is. Leeg is leeg — een gegokte fase is
      // schadelijker dan een lege, want het faseadvies bouwt erop voort.
      fase: ag.fase === "3" ? "3F" : (ag.L || ""),
      bron: ag.bron || "",
    };

    if (ag.rcdType !== "geen") {
      modules.push({
        ...blok,
        id: `rcd-${ag.id}`,
        soort: "rcd",
        eindId: null,
        naam: ag.naam || "",
        // Wat er onderaan de tegel staat. Bij een aardlek is dat zijn
        // aanspreekstroom; een vraagteken is eerlijker dan een leeg vlak.
        regel: `${ag.rcdMa || "?"}mA`,
        rcdType: ag.rcdType || "",
        type: null,
        // Een aardlekschakelaar is twee modules breed. Dat is geen aanname maar
        // de standaardmaat; wie er een van vier heeft, ziet één module verschil.
        modules: 2,
        breedtePx: 2 * MODULE_PX,
        onvolledig: !ag.rcdType || !ag.rcdMa,
        laatsteVanBlok: false,
      });
    }

    const eindgroepen = Array.isArray(ag.eindgroepen) ? ag.eindgroepen : [];
    eindgroepen.forEach((e, j) => {
      const breedte = toNum(e.modules) > 0 ? toNum(e.modules) : 1;
      modules.push({
        ...blok,
        id: e.id,
        soort: "eind",
        eindId: e.id,
        // Het groepsnummer, doorlopend over de hele rail — dezelfde nummering als
        // op de labels en in het groepenschema.
        nr: ++nr,
        naam: e.naam || "",
        // "B16" leest als één ding; los van elkaar moet je het weer samenvoegen.
        beveiliging: formatBeveiliging(e.kar, (e.ampere || "").replace("A", "")),
        // Onvolledig is geen fout maar een vraag: hier hoort de installateur naar
        // te kijken. Het scherm mag dat laten zien zonder het af te keuren.
        onvolledig: !e.kar || !e.ampere,
        regel: !e.kar || !e.ampere
          ? "invullen"
          : formatBeveiliging(e.kar, (e.ampere || "").replace("A", "")),
        type: e.type || null,
        modules: breedte,
        breedtePx: breedte * MODULE_PX,
        laatsteVanBlok: j === eindgroepen.length - 1,
      });
    });

    // Een blok zonder groepen erachter: de aardlekschakelaar is dan zelf de
    // laatste module, zodat de app weet waar de eerste groep komt te hangen.
    if (!eindgroepen.length && modules.length) modules[modules.length - 1].laatsteVanBlok = true;
  });

  const breedte = modules.reduce((n, m) => n + m.modules, 0);
  return { modules, breedte, breedtePx: breedte * MODULE_PX };
}
