// ─────────────────────────────────────────────────────────────────────────────
// Welke groep hangt achter welke aardlekschakelaar
//
// De blokindeling van een kast. Twee bronnen, en het verschil telt: wat er op de
// foto te ZIEN is (een kleurband, tape, een etiket) weegt zwaarder dan de
// vuistregel dat een aardlek alles rechts van zich claimt — die laatste is een
// gok, en de app hoort te zeggen welke van de twee het is.
//
// `blokIndeling` is voor YourWkb de belangrijkste: die groepeert modules tot
// precies wat daar een aardlekgroep met eindgroepen heet.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { isGroepsoort, sorteerPosities, groepsnummers } from "./toestellen.js";

export function pasVuistregelToe(posities) {
  const volgorde = sorteerPosities(posities);
  let huidig = null;
  // DE VUISTREGEL STOPT BIJ DE RAILGRENS.
  //
  // Dit deed hij niet, en dat kwam pas aan het licht toen je met de hand een
  // tweede rail kon bouwen: drie verse automaten op rail 2 kregen de
  // aardlekschakelaar van ónderaan rail 1 toegewezen. `sorteerPosities` legt de
  // rails achter elkaar, dus de regel "alles rechts van mij" liep gewoon door
  // over de railgrens heen.
  //
  // Dat is bijna altijd onjuist. Een tweede rail heeft in een woningkast zijn
  // eigen aardlekschakelaars links vooraan; een groep die écht over de railgrens
  // aan een aardlek van de rail erboven hangt, is het zeldzame geval — en
  // daarvoor bestaat de rechtstreekse koppeling (lang indrukken).
  //
  // De kosten van de twee fouten zijn niet gelijk. Géén uitspraak doen levert
  // een groep op die zichtbaar nog ingedeeld moet worden. Een VERKEERDE uitspraak
  // belandt op een sticker op de kastdeur en in de groepenverklaring waar de
  // installateur voor tekent. Vandaar: bij een nieuwe rail begint de telling
  // opnieuw. Dit raakt ook de foto-analyse van een kast met twee rails.
  let railVan = null;
  const toewijzing = new Map();
  for (const p of volgorde) {
    if (p.rail !== railVan) { railVan = p.rail; huidig = null; }
    if (p.soort === "aardlek") { huidig = p.id; continue; }
    // Een aardlekautomaat beveiligt zichzelf en valt buiten elk blok.
    if (p.soort === "aardlekautomaat") { toewijzing.set(p.id, null); continue; }
    if (isGroepsoort(p.soort)) toewijzing.set(p.id, huidig);
  }
  return posities.map((p) =>
    toewijzing.has(p.id) ? { ...p, aardlekId: toewijzing.get(p.id) } : p
  );
}

// Neemt de blokindeling over uit de dichte foto: een lijst
// [{ aardlekIndex, groepsnummers:[1,2,3,4] }] zoals de kleurband of de tape
// hem geeft. Dit is een waarneming, geen voorstel.
// Hoe zijn de blokken aan de groepen gekoppeld? Dat is geen detail voor de UI
// maar een verschil in bewijskracht.
//
// Bij NUMMERS is de koppeling gelezen: er staat een 3 onder de band, dus groep 3
// hoort in dat blok. Bij een BEREIK is alleen de band gelezen en leidt de app de
// koppeling af uit de fysieke volgorde. Dat is een goede afleiding, maar één
// module verschil verschuift een groep naar de verkeerde aardlek — en dat
// belandt op een label op de kastdeur en in de groepenverklaring. De
// installateur hoort dus te weten welke van de twee hij voor zich heeft.
export function indelingKoppeling(blokken) {
  const lijst = Array.isArray(blokken) ? blokken : [];
  let nummers = 0;
  let bereik = 0;
  for (const b of lijst) {
    if (Array.isArray(b.groepsnummers) && b.groepsnummers.length) { nummers += 1; continue; }
    if (!isNaN(toNum(b.vanPositie)) && !isNaN(toNum(b.totPositie))) bereik += 1;
  }
  if (!nummers && !bereik) return "";
  if (nummers && bereik) return "gemengd";
  return nummers ? "nummers" : "bereik";
}

export function pasFotoIndelingToe(posities, blokken) {
  if (!Array.isArray(blokken) || !blokken.length) return posities;
  const volgorde = sorteerPosities(posities);
  const aardlekken = volgorde.filter((p) => p.soort === "aardlek");
  const nrs = groepsnummers(posities);
  const idByNr = new Map();
  for (const [id, nr] of nrs) idByNr.set(nr, id);

  const toewijzing = new Map();
  const kleuren = new Map();
  blokken.forEach((b, i) => {
    const a = aardlekken[toNum(b.aardlekIndex) >= 0 ? toNum(b.aardlekIndex) : i];
    if (!a) return;

    // De kleur van de band hoort bij de AARDLEK en niet bij het blok: hij komt
    // op de tag van die aardlek en op de stickers van zijn groepen terecht.
    if (b.kleur) kleuren.set(a.id, String(b.kleur).slice(0, 20));

    // VORM 1 — groepsnummers. De betrouwbaarste: het cijfer staat op de plaat.
    const nummers = Array.isArray(b.groepsnummers) ? b.groepsnummers : [];
    for (const nr of nummers) {
      const id = idByNr.get(toNum(nr));
      if (id) toewijzing.set(id, a.id);
    }
    if (nummers.length) return;

    // VORM 2 — een fysiek bereik. Een kleurband zonder nummers eronder is in
    // het veld heel gewoon, en dan is de kleurwissel zelf de blokgrens. Zonder
    // deze vorm ging die waarneming verloren en viel de app terug op de
    // vuistregel, terwijl de band gewoon in beeld stond.
    const van = toNum(b.vanPositie);
    const tot = toNum(b.totPositie);
    if (isNaN(van) || isNaN(tot) || tot < van) return;
    const rail = toNum(b.rail) > 0 ? toNum(b.rail) : a.rail;
    for (const p of volgorde) {
      if (!isGroepsoort(p.soort)) continue;
      if (toNum(p.rail) !== rail) continue;
      if (toNum(p.positie) < van || toNum(p.positie) > tot) continue;
      toewijzing.set(p.id, a.id);
    }
  });
  return posities.map((p) => {
    const q = toewijzing.has(p.id) ? { ...p, aardlekId: toewijzing.get(p.id) } : p;
    return kleuren.has(p.id) ? { ...q, kleur: kleuren.get(p.id) } : q;
  });
}

// Groepeert de posities in blokken, in railvolgorde. Posities die buiten elk
// blok vallen krijgen een eigen neutrale band "zonder aardlek" — een geldige
// opstelling, maar niet automatisch goed (gaat door naar de normcheck).
export function blokIndeling(posities) {
  const volgorde = sorteerPosities(posities);
  const aardlekken = volgorde.filter((p) => p.soort === "aardlek");
  const blokken = aardlekken.map((a) => ({
    aardlek: a,
    posities: volgorde.filter((p) => p.aardlekId === a.id),
  }));
  const los = volgorde.filter(
    (p) => isGroepsoort(p.soort) && !p.aardlekId
  );
  if (los.length) blokken.push({ aardlek: null, posities: los });
  return blokken;
}

// ─── WANNEER DE VOLGORDE NIETS ZEGT ───────────────────────────────────────────
//
// De vuistregel — een aardlekschakelaar claimt alles rechts van zich — beschrijft
// één kastvorm: aardlek en groepen op dezelfde rail, in leesvolgorde. Er zijn er
// meer, en in die andere vormen zegt de volgorde helemaal niets:
//
//   • aardlekschakelaars op de ene rail, alle groepen op de andere. In het veld
//     heel gewoon, in beide richtingen: de aardlekken boven de groepen én de
//     aardlekken op rail 2 met de groepen op rail 1. (Martin, 12-09-2026.)
//   • een rail die pas later is bijgeplaatst en aan een bestaand blok hangt.
//
// In zulke kasten loopt de kam van de ene rail naar de andere, en dát is de
// koppeling — niet de plek in de rij. Positioneel gokken levert daar geen
// benadering op maar een verzinsel, en een verzinsel belandt op een sticker op
// de kastdeur en in de groepenverklaring waar de installateur voor tekent.
//
// Daarom is er een DERDE antwoord naast "hangt aan blok X" en "hangt aan geen
// enkel blok": NOG NIET IN TE DELEN. Die twee mochten niet langer op één hoop:
// zonder dit onderscheid zou elke kast met de aardlekken op een eigen rail zich
// vullen met rode afwijkingen die er niet zijn — dezelfde fout als destijds bij
// de aardlekautomaten.
export function indelingOnzeker(posities) {
  const lijst = posities || [];
  // Zonder aardlekschakelaar valt er niets in te delen; dan is "geen blok" de
  // hele waarheid en niet een openstaande vraag.
  if (!lijst.some((p) => p.soort === "aardlek")) return [];
  const railsMetAardlek = new Set(
    lijst.filter((p) => p.soort === "aardlek").map((p) => Math.round(toNum(p.rail) || 1))
  );
  return lijst
    .filter((p) =>
      isGroepsoort(p.soort) &&
      p.soort !== "aardlekautomaat" &&
      !p.aardlekId &&
      !railsMetAardlek.has(Math.round(toNum(p.rail) || 1))
    )
    .map((p) => p.id);
}
