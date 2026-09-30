// ─────────────────────────────────────────────────────────────────────────────
// De fasen: capaciteit, toewijzing en de optelling per fase
//
// `belastingPerFase` is de ENIGE optelling van een installatie in deze motor.
// De belastingcheck en de fasebalans leunen er allebei op. Twee optellingen van
// dezelfde kast lopen vroeg of laat uiteen — dat is letterlijk wat er tussen
// YourWkb en Kastscan gebeurd is, en de reden dat deze motor bestaat.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { GELIJKTIJDIGHEID, isGroteVerbruikerMkp, groepVermogenKw } from "./vermogen.js";

export const FASEN = ["L1", "L2", "L3"];

// De fasekleuren zoals Kastscan ze tekent, tot op de hexwaarde. Ze staan in de
// app, in het rapport en in het groepenoverzicht van het zusterproject voor
// dezelfde fase, zodat een installateur die beide gebruikt niet twee kleurtalen
// hoeft te leren.
//
// De regel bij een balk komt eveneens uit Kastscan: de fasekleur mag, want een
// balk is een grafiek en geen aanduiding op een kast. Knelt het, dan wint het
// oordeel van de kleur — oranje bij weinig ruimte, rood boven de capaciteit.
export const FASE_KLEUR = { L1: "#2196F3", L2: "#9B59B6", L3: "#14B8A6" };

// Toegankelijkheid (Kastscan-spec › Interactie 4): FASE NOOIT ALLEEN ALS KLEUR.
// Naast het label L1/L2/L3 draagt elke fase een randpatroon, zodat de aanduiding
// ook klopt voor wie kleuren niet onderscheidt — en op een geprinte pagina in
// zwart-wit. Stond in Kastscan; hier omdat beide apps dezelfde kast tekenen.
export const FASE_PATROON = { L1: "solid", L2: "dashed", L3: "dotted" };

// Reserve die per fase vrij blijft. Een kast die precies vol is, is geen kast
// waar de volgende monteur nog iets bij kan hangen.
export const FASE_RESERVE_KW = 1.0;

// De capaciteit van één fase in kW. Stond op drie plaatsen als losse formule —
// hier als functie, met de naam die Kastscan er al voor had.
export function faseCapaciteitKw(ha) {
  const ampere = toNum(ha && ha.a);
  return ampere > 0 ? (ampere * 230) / 1000 : 0;
}

// De fasenummers van een groep, volgens spec v0.2 §4.4. `fn` is leidend; zonder
// `fn` is alleen bij een driefasegroep zeker waar hij hangt — namelijk overal.
export function fasenVanGroep(g, aantalFasen) {
  if (aantalFasen === 1) return [1];
  if (Array.isArray(g && g.fn) && g.fn.length) {
    return g.fn.map(Number).filter((n) => n >= 1 && n <= 3);
  }
  if (toNum(g && g.f) === 3) return [1, 2, 3];
  return [];
}

/**
 * Telt de paspoortgroepen op per fase.
 *
 * @param grp        groepen in paspoortvorm (spec v0.2 §4.4)
 * @param ha         hoofdaansluiting { f, a }
 * @param lbAan      gezamenlijke load balancing aanwezig
 */
// ─── TERUGLEVERING TELT MEE, MAAR TELT NIET OP ───────────────────────────────
//
// Besluit Martin, 12-09-2026: *"teruglevering telt positief mee, stroom is
// stroom — let wel op dat eigengebruik binnen de meter blijft en niet de fasen
// zal raken."*
//
// Twee regels in één zin, en ze wijzen niet dezelfde kant op:
//
//   Teruglevering IS belasting. Een omvormer van 5 kW op L2 duwt die stroom door
//   de kam en door de hoofdzekering van L2. De richting doet er voor een
//   zekering niet toe — een smeltdraad kent geen plus en min.
//
//   Maar eigengebruik raakt de fasen NIET. Wat de PV levert en de wasmachine op
//   hetzelfde moment opneemt, loopt van de ene groep naar de andere over de kam
//   en passeert de hoofdzekering nooit. Afname en teruglevering bij elkaar
//   optellen zou dus stroom tellen die er niet is.
//
// Daarom per fase de ZWAARSTE van twee richtingen, niet hun som:
//
//   afname        het ongunstigste moment zonder zon en met een lege accu
//   teruglevering het ongunstigste moment met volle zon en geen verbruik
//
// Die twee kunnen per definitie niet tegelijk optreden. Precies het geval dat
// geen van de drie eerdere antwoorden toetste.
//
// Op de voedende kant gaat GEEN gelijktijdigheidsfactor. De specificatie van het
// meterkastpaspoort (§ kam) zegt: "de som van de voedende groepen, op het deel
// van de kam waar hun stromen kunnen cumuleren, mag de kamcapaciteit niet
// overschrijden" — een som, geen korting. Dat is ook fysisch te volgen: de zon
// schijnt op alle panelen tegelijk, waar vier apparaten zelden tegelijk vol
// draaien.
//
// Een thuisbatterij hoort daarom als TWEE regels in het paspoort te staan
// (spec v0.2 §4.4): ontladen als `voed`, laden als `af`. Laden is een afname van
// een grote verbruiker en krijgt dus wél de factor 0,6. Wie er één regel van
// maakt, ziet de ladende kant nooit terug; zolang laden en ontladen even zwaar
// zijn maakt het voor de zwaarste-van-twee geen verschil.
export function belastingPerFase(grp, ha, lbAan) {
  const aantalFasen = toNum(ha && ha.f) === 3 ? 3 : 1;
  const fasen = aantalFasen === 3 ? FASEN : ["L1"];

  // Mét gezamenlijke sturing vervalt de korting. Load balancing is een
  // software-instelling en geen veiligheidsmaatregel — de installatie moet ook
  // bij falende sturing kloppen, en dan is vol vermogen de veilige kant.
  const factor = lbAan === true ? 1 : GELIJKTIJDIGHEID;

  const groot = { L1: 0, L2: 0, L3: 0 };
  const gewoon = { L1: 0, L2: 0, L3: 0 };
  const voeding = { L1: 0, L2: 0, L3: 0 };
  const aantal = { L1: 0, L2: 0, L3: 0 };
  // Ook het niet-toegerekende vermogen kent twee richtingen, en ook daar geldt
  // de zwaarste en niet de som. Anders telt een thuisbatterij zonder vastgelegde
  // fase voor laden én ontladen mee, terwijl hij nooit allebei tegelijk doet.
  let onbekendAf = 0, onbekendVoed = 0, onbekendAantal = 0;

  for (const g of Array.isArray(grp) ? grp : []) {
    // Dezelfde terugvalwaarde als basisbelastingKw gebruikt, zodat dezelfde
    // groep in de totaaltoets én in de fasetoets even zwaar meeweegt.
    const kw = groepVermogenKw(g);
    if (isNaN(kw) || kw <= 0) continue;

    const nummers = fasenVanGroep(g, aantalFasen);
    if (!nummers.length) {
      if ((g.rol || "af") === "voed") onbekendVoed += kw; else onbekendAf += kw;
      onbekendAantal += 1;
      continue;
    }

    const perGroep = kw / nummers.length;
    const pot = (g.rol || "af") === "voed" ? voeding
              : isGroteVerbruikerMkp(g.t)  ? groot
              :                              gewoon;
    for (const n of nummers) {
      pot[FASEN[n - 1]] += perGroep;
      aantal[FASEN[n - 1]] += 1;
    }
  }

  const afname = { L1: 0, L2: 0, L3: 0 };
  const belasting = { L1: 0, L2: 0, L3: 0 };
  const richting = { L1: "af", L2: "af", L3: "af" };
  for (const f of FASEN) {
    afname[f] = gewoon[f] + groot[f] * factor;
    belasting[f] = Math.max(afname[f], voeding[f]);
    richting[f] = voeding[f] > afname[f] ? "voed" : "af";
  }

  return {
    fasen, belasting, afname, voeding, richting, groot, gewoon, aantal, factor,
    onbekendKw: Math.max(onbekendAf, onbekendVoed), onbekendAantal,
  };
}
