// ─────────────────────────────────────────────────────────────────────────────
// Van modules op een rail naar aardlekgroepen met eindgroepen
//
// De laatste schakel van het kastbeeld. Een foto levert POSITIES — losse modules
// op een DIN-rail, want dat is wat er te zien is. Een opleverrapport denkt in
// AARDLEKGROEPEN met eindgroepen: een aardlekschakelaar met de groepen die hij
// beveiligt, want dat is wat er gemeten wordt (één ΔT en ΔI per aardlek, één
// isolatiemeting per groep).
//
// Beide zijn dezelfde kast. `blokIndeling` doet het zware werk al — die groepeert
// de modules precies zoals ze achter hun aardlek hangen — en wat hier gebeurt is
// het omzetten van de veldnamen.
//
// ⚓ DE FOTO VULT IN, DE INSTALLATEUR BEVESTIGT, EN VULT AAN. Daarom staat hier
// nergens een aanname die eruitziet als een meting:
//
//   • wat niet gelezen is, blijft LEEG — geen "16A" omdat dat meestal klopt;
//   • een smeltveiligheid krijgt `kar: "gG"` en niet stilletjes "B", want dat
//     scheelt een factor in Z_max;
//   • de fase (L1/L2/L3) komt nooit uit een kastfoto en blijft dus leeg;
//   • elke groep draagt `bron`, zodat een scherm kan tonen wat nog een voorstel is.
//
// Een leeg veld is hier dus geen tekortkoming maar een uitnodiging. Liever een
// vraag aan de installateur dan een getal waar niemand meer naar kijkt.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { isMeerpolig, mkpType } from "./toestellen.js";
import { blokIndeling } from "./indeling.js";

// Paspoorttype → het eindgroeptype dat een opleverrapport kent.
//
// `wp` ontbrak hier tot 30-09-2026, omdat er geen warmtepomp-eindgroep bestond:
// zo'n groep belandde als `alg` in het paspoort en raakte daarmee zijn
// gelijktijdigheidsfactor en terugvalvermogen kwijt. Besluit Martin, 30-09-2026:
// de warmtepomp is als zesde eindgroeptype toegevoegd, dus de lijst is compleet.
export const EINDGROEP_UIT_MKP = {
  kook: "kook", pv: "pv", lp: "laad", bat: "batterij", ov: "kracht", wp: "wp",
};

// De paspoorttypen die een eindgroep niet kent. Leeg sinds de warmtepomp erbij
// kwam; `alg` staat er bewust niet in, want dat ís "geen bijzonder type".
export const EINDGROEP_ONBEKEND = [];

export function eindgroepTypeUitFunctie(functie) {
  return EINDGROEP_UIT_MKP[mkpType(functie)] || null;
}

// De naam van een positie zoals een mens hem zou noemen.
function naamVan(p) {
  const eigen = String((p && p.functie) || "").trim();
  return eigen || String((p && p.standaardnaam) || "").trim();
}

// De karakteristiek van een eindgroep. Een smeltveiligheid heeft er geen in de
// zin van B/C/D — het is een trage gG-patroon, en dat maakt uit: Z_max komt bij
// gG uit een tijd-stroomkromme en niet uit een vaste factor × In.
function karVan(p) {
  if (p.soort === "smeltveiligheid") return "gG";
  return String(p.karakteristiek || "");
}

// "16A" — de vorm die het groepenscherm gebruikt. Leeg als er niets gelezen is:
// een aangenomen 16 A is precies het soort getal dat later voor een meting wordt
// aangezien.
function ampereVan(p) {
  const a = toNum(p && p.In);
  return a > 0 ? `${a}A` : "";
}

// De zwaarst belaste eindgroep van een cluster, op nominale stroom. Dezelfde
// regel die het groepenscherm zelf hanteert wanneer niemand er een aanwijst.
function zwaarste(eindgroepen) {
  if (!eindgroepen.length) return null;
  return eindgroepen.reduce(
    (best, e) => (toNum((e.ampere || "").replace("A", "")) || 0) > (toNum((best.ampere || "").replace("A", "")) || 0) ? e : best,
    eindgroepen[0]
  ).id;
}

/**
 * Zet een kastbeeld om in aardlekgroepen met eindgroepen.
 *
 * @param posities  de modules, zoals normaliseerAnalyse of een paspoort ze levert
 * @param opties    { bron }  waar het kastbeeld vandaan komt: "foto", "paspoort"
 *                            of "" — komt op elke groep te staan, zodat een scherm
 *                            kan tonen wat nog bevestigd moet worden
 * @returns         aardlekgroepen, in railvolgorde
 */
export function aardlekgroepenUitPosities(posities, opties = {}) {
  const bron = String(opties.bron || "");
  // Deterministische identifiers. Bewust geen Date.now(): dezelfde kast moet
  // twee keer dezelfde uitkomst geven, anders is er niets over te testen en
  // verandert een tweede scan stilletjes elke verwijzing.
  let n = 0;

  return blokIndeling(posities).map((blok) => {
    const id = `a${++n}`;
    const a = blok.aardlek;
    const eindgroepen = (blok.posities || []).map((p, i) => ({
      id: `${id}e${i + 1}`,
      naam: naamVan(p),
      kar: karVan(p),
      ampere: ampereVan(p),
      type: eindgroepTypeUitFunctie(p.functie),
      bron,
      // De herkomst van de naam reist mee: uit de groepenverklaring op de deur
      // weegt zwaarder dan uit de volgorde van het lijstje, en een scherm hoort
      // dat verschil te kunnen tonen.
      naamBron: p.functieBron || "",
      positieId: p.id || "",
    }));

    // Groepen zonder aardlekschakelaar vormen samen één cluster. Dat is geen
    // verzinsel: in het rapport moeten ze ergens staan, en "geen" is een geldige
    // waarde die de cross-checks kennen — die slaan ΔT en ΔI dan over.
    if (!a) {
      return {
        id, naam: "Zonder aardlekschakelaar", rcdType: "geen", rcdMa: "",
        fase: "1", L: "", Lbron: "", bron,
        hoogstId: zwaarste(eindgroepen), eindgroepen,
      };
    }

    return {
      id,
      naam: naamVan(a),
      // Is het type niet van de module te lezen, dan blijft het op de
      // app-standaard staan — dat is wat een nieuwe groep sowieso krijgt, en
      // "A" is in Nederland de gangbare uitvoering. Het blijft een voorstel:
      // `bron` zegt dat het uit een foto of paspoort komt.
      rcdType: String(a.aardlektype || "A"),
      rcdMa: toNum(a.IAn) > 0 ? String(toNum(a.IAn)) : "",
      // `fase` is hier het AANTAL fasen ("1" of "3"), niet welke. Een meerpolige
      // aardlekschakelaar beveiligt een driefasecluster.
      fase: isMeerpolig(a) ? "3" : "1",
      // WELKE fase — komt nooit uit een kastfoto (dat staat in de prompt), wel
      // uit een eendraadschema of later uit een P1-meting.
      L: ["L1", "L2", "L3"].includes(a.fase) ? a.fase : "",
      Lbron: ["L1", "L2", "L3"].includes(a.fase) ? bron : "",
      bron,
      hoogstId: zwaarste(eindgroepen),
      eindgroepen,
    };
  });
}
