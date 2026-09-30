// ─────────────────────────────────────────────────────────────────────────────
// De belastingcheck: past dit op deze aansluiting?
//
// Levert het woord dat als `p.chk` het meterkastpaspoort in gaat: groen, oranje
// of rood. Dat veld is onderdeel van een open standaard — de vorm van de
// uitkomst verandert hier dus nooit zonder spec-wijziging.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { GELIJKTIJDIGHEID, isGroteVerbruikerMkp, groepVermogenKw } from "./vermogen.js";
import { FASEN, faseCapaciteitKw, belastingPerFase } from "./fasen.js";

export function periodeLabel(van, tot) {
  const dd = (sec) => {
    // Let op: Number(null) is 0 en epoch 0 is een geldige datum (01-01-1970).
    // Zonder deze grens wordt "geen periode" stilzwijgend een periode in het
    // rapport. Een meetperiode ligt altijd ruim na 1970.
    const n = Number(sec);
    if (!Number.isFinite(n) || n <= 0) return null;
    const d = new Date(n * 1000);
    if (isNaN(d.getTime())) return null;
    return String(d.getDate()).padStart(2, "0") + "-" + String(d.getMonth() + 1).padStart(2, "0");
  };
  const a = dd(van), b = dd(tot);
  return a && b ? `${a} t/m ${b}` : null;
}

// ── Herkomst van de basisbelasting (fasecheck v1, stap 1) ───────────────────
// De basisbelasting komt uit een van twee bronnen, en dat verschil verandert de
// rekenregel — niet alleen het etiket.
//
//   'geschat'  De som van de paspoortgroepen, met de gelijktijdigheidsfactor
//              0,6 over de grote verbruikers. Zo rekent de app het nu.
//
//   'gemeten'  De gemeten piek uit een P1-meting IS de basisbelasting. Hier
//              gaat de factor er NIET overheen: wat de meter zag, is wat er
//              werkelijk tegelijk liep — de gelijktijdigheid zit er al in. Hem
//              er nogmaals overheen leggen zou 40% van een echte meting
//              wegstrepen en de installatie kunstmatig licht rekenen. Dat is
//              precies de verkeerde kant op voor een toets die conservatief
//              hoort te zijn. De factor blijft wél gelden voor een apparaat dat
//              er nog bij komt en dus niet in de meting zat.
//
// Zonder bruikbare meting valt hij terug op de schatting: beoordeelMeetkwaliteit
// levert bij te weinig dekking of te korte looptijd geen piek, en een half
// gemeten week mag niet als "gemeten" door het leven gaan.
export function basisbelastingKw(groepen, lbAan, meting) {
  const piek = toNum(meting && meting.piekKw);
  const dagen = toNum(meting && meting.dagen);
  if (piek > 0) {
    const periode = periodeLabel(meting.van, meting.tot);
    const dagdeel = dagen > 0 ? `over ${dagen} ${dagen === 1 ? "dag" : "dagen"}` : null;
    return {
      kw: piek,
      bron: "gemeten",
      label: ["gemeten", dagdeel, periode ? `(${periode})` : null].filter(Boolean).join(" "),
    };
  }

  const lijst = Array.isArray(groepen) ? groepen : [];
  let groot = 0, gewoon = 0, voeding = 0, bekend = 0;
  for (const g of lijst) {
    const kw = groepVermogenKw(g);
    if (isNaN(kw) || kw <= 0) continue;
    bekend += 1;
    if ((g && g.rol) === "voed") voeding += kw;
    else if (isGroteVerbruikerMkp(g.t)) groot += kw;
    else gewoon += kw;
  }
  if (!bekend) return null;

  // Mét gezamenlijke sturing vervalt de korting. Load balancing is een
  // software-instelling en geen veiligheidsmaatregel — de installatie moet ook
  // bij falende sturing kloppen, en dan is vol vermogen de veilige kant.
  const factor = lbAan === true ? 1 : GELIJKTIJDIGHEID;
  const afname = gewoon + groot * factor;
  return {
    kw: Math.max(afname, voeding),
    bron: "geschat",
    label: "indicatie o.b.v. schatting",
    richting: voeding > afname ? "voed" : "af",
  };
}

// De uitkomst voor `p.chk`. Woorden en vorm volgen wat de app zelf uitleest
// in chkKleur: "groen", "oranje" of "rood".
//
// `meting` is optioneel en verandert de vorm van de uitkomst NIET: p.chk gaat
// rechtstreeks het meterkastpaspoort in, en dat is een open standaard. Een veld
// toevoegen is een spec-wijziging (v0.2) en geen bijvangst van deze functie.
// Wie de herkomst wil tonen, roept basisbelastingKw apart aan.
export function belastingcheck(grp, ha, lbAan, datum, meting) {
  const fasen = toNum(ha && ha.f) === 3 ? 3 : 1;
  const ampere = toNum(ha && ha.a);
  if (!(ampere > 0)) return null;

  // Alleen AFNEMENDE groepen tellen mee in de geschatte basis; dat zit in
  // basisbelastingKw. Een PV-omvormer of een ontladende batterij verlaagt de
  // piek door de hoofdzekering niet: het slechtste geval is geen zon en een
  // lege accu. Teruglevering per fase hoort bij belastingPerFase, waar het over
  // de zwaarste van twee richtingen gaat en niet over deze totaaltoets.
  //
  // Geen enkele bekende belasting: dan valt er niets te toetsen, en "groen"
  // zou hier een uitspraak zijn die nergens op steunt.
  const basis = basisbelastingKw(grp, lbAan, meting);
  if (!basis) return null;

  const capFase = faseCapaciteitKw(ha);
  const capTotaal = fasen * capFase;
  let bezet = capTotaal > 0 ? basis.kw / capTotaal : 0;

  // PER FASE TOETSEN, net als Kastscan (besluit Martin, 11-09-2026).
  //
  // Fasecompensatie is boekhouding, stroom is fysiek: de slimme meter saldeert
  // over drie fasen, de hoofdzekering niet. Drie zware groepen die toevallig
  // allemaal op L2 zitten passen ruim binnen 3 x 25 A en laten toch de zekering
  // van L2 komen. Een toets op het totaal ziet dat niet.
  //
  // De totaaltoets hierboven blijft staan en dat is geen halfheid. Is elke groep
  // aan een fase toegewezen, dan is de zwaarst belaste fase per definitie al
  // minstens zo streng als het totaal — de totaaltoets voegt dan niets toe. Is
  // een deel NIET toegewezen, dan is zij het enige wat dat vermogen nog ziet.
  // De strengste van de twee wint, zodat een half ingevulde kast niet groen
  // wordt door wat er ontbreekt.
  //
  // Alleen bij een geschatte basis: een gemeten piek is nu nog één totaalgetal
  // zonder faseverdeling (basisbelastingKw › meting.piekKw). Zodra de P1-meting
  // per fase binnenkomt, hoort die hier op dezelfde manier per fase getoetst.
  if (fasen === 3 && basis.bron === "geschat") {
    const pf = belastingPerFase(grp, ha, lbAan);
    for (const f of FASEN) bezet = Math.max(bezet, capFase > 0 ? pf.belasting[f] / capFase : 0);
  }

  const r = bezet > 1 ? "rood" : bezet > 0.7 ? "oranje" : "groen";
  return { r, d: String(datum || "") };
}
