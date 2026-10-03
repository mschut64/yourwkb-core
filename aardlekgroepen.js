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
      // De breedte op de rail, voor de strook. Uit een foto of paspoort bekend,
      // anders één module — wat een gewone automaat ook is.
      modules: toNum(p.breedteModules) > 0 ? toNum(p.breedteModules) : 1,
      // WAAR OP DE RAIL. Een kast van meer dan twintig modules heeft twee of drie
      // rails, en een blok kan over de overgang heen lopen: de aardlek onderaan
      // rail 1, de laatste groepen bovenaan rail 2. Zonder deze twee velden kan
      // een scherm de kast alleen als één lange rij tekenen, en dan klopt het
      // beeld niet met de kast waar de installateur voor staat.
      rail: toNum(p.rail) > 0 ? toNum(p.rail) : 1,
      plek: toNum(p.positie) >= 0 ? toNum(p.positie) : 0,
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
        // Een los cluster heeft zelf geen module op de rail; het begint waar zijn
        // eerste groep staat.
        rail: eindgroepen.length ? eindgroepen[0].rail : 1,
        plek: eindgroepen.length ? eindgroepen[0].plek : 0,
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
      // Zelfde redenering als bij het type: 30 mA is wat een nieuwe groep in de
      // app krijgt en wat in een woning vrijwel altijd hangt. Leeg laten zou de
      // ΔI-toets in het rapport stilletjes overslaan, en dát is erger dan een
      // voorstel dat de installateur langsloopt.
      rcdMa: toNum(a.IAn) > 0 ? String(toNum(a.IAn)) : "30",
      // `fase` is hier het AANTAL fasen ("1" of "3"), niet welke. Een meerpolige
      // aardlekschakelaar beveiligt een driefasecluster.
      fase: isMeerpolig(a) ? "3" : "1",
      // WELKE fase — komt nooit uit een kastfoto (dat staat in de prompt), wel
      // uit een eendraadschema of later uit een P1-meting.
      L: ["L1", "L2", "L3"].includes(a.fase) ? a.fase : "",
      Lbron: ["L1", "L2", "L3"].includes(a.fase) ? bron : "",
      bron,
      // Waar de aardlekschakelaar zelf op de rail staat — zie de toelichting bij
      // de eindgroepen hierboven.
      rail: toNum(a.rail) > 0 ? toNum(a.rail) : 1,
      plek: toNum(a.positie) >= 0 ? toNum(a.positie) : 0,
      hoogstId: zwaarste(eindgroepen),
      eindgroepen,
    };
  });
}

// ─── DE BRUG TERUG ───────────────────────────────────────────────────────────
//
// `aardlekgroepenUitPosities` gaat van modules op een rail naar de vorm waarin een
// opleverrapport een kast beschrijft. Dit is de weg terug, en die is er sinds
// 03-10-2026 om één reden: het labelvel, het groepenoverzicht en het
// installatieschema zijn getekend op de MODULEVORM. YourWkb kent die vorm alleen
// na een fotoscan of een gescand paspoort — maar een kast die met de hand is
// ingevuld moet net zo goed een sticker en een schema kunnen opleveren.
//
// ⚓ WAT ER NIET IS, WORDT NIET VERZONNEN. Een met de hand ingevulde kast heeft
// geen fabrikant, geen type en geen plaats op de rail. Die velden blijven leeg en
// de plaatsen worden doorlopend genummerd in de volgorde waarin de groepen staan —
// dat is geen aflezing en de documenten laten dat ook zien. Een verzonnen plaats is
// erger dan geen plaats; dezelfde regel als bij de strook.
//
// ⚓ HEEN EN TERUG MOET HETZELFDE OPLEVEREN. Een kast die uit een foto komt en weer
// terugvertaald wordt, levert dezelfde groepen met dezelfde namen, karakteristieken
// en stromen op. Vastgelegd in tests/test-aardlekgroepen.js.
export function positiesUitAardlekgroepen(aardlekgroepen, opties = {}) {
  const lijst = Array.isArray(aardlekgroepen) ? aardlekgroepen : [];
  const verdelerId = String(opties.verdelerId || "v1");
  const uit = [];
  let n = 0;
  // Een rail telt modules, geen groepen: de teller loopt per rail door zodat twee
  // blokken op dezelfde rail niet op dezelfde plek belanden.
  const plekPerRail = new Map();
  const volgendePlek = (rail, breedte) => {
    const nu = plekPerRail.get(rail) || 0;
    plekPerRail.set(rail, nu + breedte);
    return nu;
  };

  for (const ag of lijst) {
    const rail = toNum(ag && ag.rail) > 0 ? toNum(ag.rail) : 1;
    const driefasig = String((ag && ag.fase) || "") === "3";
    // Welke groepen achter wélke aardlek hangen, staat in `aardlekId` — daar kijkt
    // `blokIndeling` naar. Zonder dat veld valt elke groep in het blok "zonder
    // aardlekschakelaar" en komt de kast er aan de andere kant anders uit.
    let aardlekId = "";

    if (ag && ag.rcdType && ag.rcdType !== "geen") {
      const breedte = driefasig ? 4 : 2;
      aardlekId = `p${n + 1}`;
      uit.push({
        id: `p${++n}`, verdelerId, rail,
        positie: toNum(ag.plek) >= 0 ? toNum(ag.plek) : volgendePlek(rail, breedte),
        breedteModules: breedte,
        soort: "aardlek",
        fabrikant: "", type: "",
        karakteristiek: "", In: null,
        IAn: toNum(ag.rcdMa) > 0 ? toNum(ag.rcdMa) : null,
        aardlektype: String(ag.rcdType || "A"),
        polen: driefasig ? 4 : 2,
        fase: String(ag.L || ""),
        groepstekst: "", kabel: "", plaatnummer: null,
        functie: String(ag.naam || ""), functieEigen: Boolean(ag.naam),
        standaardnaam: "", toelichting: "",
      });
    }

    for (const e of ((ag && ag.eindgroepen) || [])) {
      const breedte = toNum(e.modules) > 0 ? toNum(e.modules) : 1;
      const kar = String(e.kar || "");
      const amp = toNum(String(e.ampere || "").replace("A", ""));
      uit.push({
        id: `p${++n}`, verdelerId, aardlekId,
        rail: toNum(e.rail) > 0 ? toNum(e.rail) : rail,
        positie: toNum(e.plek) >= 0 ? toNum(e.plek) : volgendePlek(rail, breedte),
        breedteModules: breedte,
        // gG hoort bij een smeltveiligheid; dat onderscheid bepaalt het symbool op
        // het schema én de Z_max-berekening, dus het mag hier niet verdwijnen.
        soort: kar === "gG" ? "smeltveiligheid" : "automaat",
        // ⚠️ NIET `e.type`. In een aardlekgroep is `type` het EINDGROEPTYPE (kook,
        // laad, wp) en niet de typeaanduiding van het toestel. Die hier invullen
        // zet "kook" als productcode op de sticker en in het groepenoverzicht.
        // Merk en type zijn alleen bekend als de kast uit een foto of een paspoort
        // komt — en dan zijn de posities er al en is deze brug niet nodig.
        fabrikant: "", type: "",
        karakteristiek: kar === "gG" ? "" : kar,
        In: amp > 0 ? amp : null,
        IAn: null, aardlektype: "",
        polen: breedte >= 3 ? 4 : 1,
        fase: String(e.L || ag.L || ""),
        groepstekst: "", kabel: "", plaatnummer: null,
        // De naam die de installateur zelf gaf is een keuze, geen aflezing — en
        // precies die naam hoort straks op de sticker.
        functie: String(e.naam || ""), functieEigen: Boolean(e.naam),
        standaardnaam: "", toelichting: "",
      });
    }
  }
  return uit;
}
