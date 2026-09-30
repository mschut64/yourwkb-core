// ─────────────────────────────────────────────────────────────────────────────
// Wat een groep vraagt, en wanneer de gelijktijdigheidsfactor geldt
//
// Werkt op de paspoortvorm (spec v0.2 §4.4): een groep is `{ t, rol, f, fn, kw }`.
// Dat is met opzet, want het paspoort is het enige datamodel dat YourWkb én
// Kastscan allebei al opbouwen. Kastscan denkt intern in modules op een DIN-rail
// en YourWkb in aardlekgroepen met eindgroepen; die twee zijn niet te verenigen,
// maar hun paspoort wel — dat is per slot van rekening precies waarvoor de
// standaard bestaat.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";

// De vier grote verbruikers, in paspoortcodes. Kastscan kent dezelfde vier op
// hun Nederlandse functienaam (`GROTE_VERBRUIKERS`); `mkpType` vertaalt ze.
export const GROTE_VERBRUIKERS_MKP = ["lp", "wp", "kook", "bat"];

// Zonder gezamenlijke sturing rekent de belastingcheck conservatief met
// gelijktijdigheidsfactor 0,6 over de grote verbruikers (richtlijn
// NEN-EN-IEC 61439). De factor gaat dus OP die verbruikers en niet eromheen.
export const GELIJKTIJDIGHEID = 0.6;

// Terugval als het vermogen niet is ingevuld. Alleen voor de vier grote
// verbruikers: bij een lichtgroep zou een aangenomen waarde de uitkomst sturen
// zonder dat iemand het ziet, en die groepen tellen hier toch al licht.
export const GROOT_STANDAARD_KW = { lp: 7.4, wp: 6.9, kook: 7.4, bat: 5.0 };

export function isGroteVerbruikerMkp(t) {
  return GROTE_VERBRUIKERS_MKP.includes(String(t || "").trim().toLowerCase());
}

// Het vermogen van één paspoortgroep in kW, of NaN als het onbekend is.
export function groepVermogenKw(g) {
  const kw = toNum(g && g.kw);
  if (kw > 0) return kw;
  return isGroteVerbruikerMkp(g && g.t) ? GROOT_STANDAARD_KW[String(g.t).toLowerCase()] : NaN;
}
