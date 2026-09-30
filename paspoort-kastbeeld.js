// ─────────────────────────────────────────────────────────────────────────────
// Een meterkastpaspoort terug naar een kastbeeld
//
// De derde ingang, naast de foto en de installateur zelf. En de beste van de
// drie, want een paspoort draagt geen gok maar wat een vakman eerder heeft
// bevestigd — vaak met de typeaanduiding van het toestel erbij.
//
// Waarom dat kan: `mat[]` (spec v0.2 §4.5) draagt per toestel de soort, de
// plaats op de rail, het merk en het type. Uit "B16" komen een karakteristiek en
// een nominale stroom, en dat zijn precies de twee velden die `grp[]` alléén niet
// kan leveren. Kastscan schrijft die lijst sinds 19-09-2026; tot nu toe las
// niemand hem terug.
//
// ⚓ WAT HIER STAAT IS BEVESTIGD, GEEN VOORSTEL — maar het is wel OUD. De kast kan
// sinds de vorige klus veranderd zijn. Daarom komt alles binnen als een gewoon,
// aanvulbaar kastbeeld met `bron: "paspoort"`, en niet als iets dat vastligt.
//
// Wat een paspoort NIET draagt, en dus leeg blijft: de breedte in modules (die
// wordt afgeleid uit de afstand tussen twee plaatsen), de zekerheid van een
// aflezing (er is niets afgelezen), en het merk van een toestel dat destijds niet
// is ingevuld — zo'n groep staat wel in `grp[]` maar niet in `mat[]`, en heeft
// dus geen plaats op de rail.
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { parseBeveiliging, sorteerPosities, isGroepsoort } from "./toestellen.js";
import { zetStandaardnamen } from "./normaliseren.js";

// De soortcodes van het paspoort terug naar de soorten van het kastbeeld.
// `ov` is dubbelzinnig: Kastscan schrijft zowel een smeltveiligheid als "overig"
// als `ov`, dus terug is het "overig". Een stop die als zodanig herkend moet
// worden, is aan de installateur.
export const SOORT_UIT_MKP = {
  hs: "hoofdschakelaar", als: "aardlek", ala: "aardlekautomaat",
  aut: "automaat", ov: "overig",
};

// "R1-5" → { verdeler: 1, rail: 1, positie: 5 }, "V2-R1-5" → verdeler 2.
// Geeft null als de plaats ontbreekt of onleesbaar is; dat is geen fout maar een
// toestel waarvan destijds geen plaats is vastgelegd.
export function leesPlaats(pos) {
  const m = /^(?:V(\d+)-)?R(\d+)-(\d+)$/.exec(String(pos || "").trim());
  if (!m) return null;
  return { verdeler: m[1] ? Number(m[1]) : 1, rail: Number(m[2]), positie: Number(m[3]) };
}

// Hoe breed een toestel is, afgeleid uit de afstand tot het volgende toestel op
// dezelfde rail. Het paspoort legt de breedte niet vast — maar wie op plaats 3
// staat terwijl de volgende op 5 begint, is twee modules breed.
function breedtes(geplaatst) {
  const perRail = new Map();
  for (const p of geplaatst) {
    const sleutel = `${p._verdeler}/${p.rail}`;
    if (!perRail.has(sleutel)) perRail.set(sleutel, []);
    perRail.get(sleutel).push(p);
  }
  for (const lijst of perRail.values()) {
    lijst.sort((a, b) => a.positie - b.positie);
    lijst.forEach((p, i) => {
      const volgende = lijst[i + 1];
      // De laatste op een rail: de afstand is onbekend, dus één module. Liever
      // te smal dan een toestel dat plaatsen bezet die het misschien niet heeft.
      p.breedteModules = volgende ? Math.max(1, volgende.positie - p.positie) : 1;
    });
  }
}

/**
 * Bouwt een kastbeeld uit een gescand meterkastpaspoort.
 *
 * @param paspoort  het gedecodeerde paspoort (v2)
 * @returns         posities, in railvolgorde; toestellen zonder vastgelegde
 *                  plaats komen erachteraan met `plaatsOnbekend: true`
 */
export function positiesUitPaspoort(paspoort) {
  const p = paspoort || {};
  const mat = Array.isArray(p.mat) ? p.mat : [];
  const grp = Array.isArray(p.grp) ? p.grp : [];

  // 1 · Elk toestel uit de materiaallijst wordt een positie.
  const uitMat = new Map(); // i → positie
  const posities = [];
  for (const m of mat) {
    const plaats = leesPlaats(m.pos);
    const bev = parseBeveiliging(m.typ);
    const pos = {
      id: `m${m.i}`,
      soort: SOORT_UIT_MKP[m.s] || "overig",
      fabrikant: String(m.fab || ""),
      type: String(m.typ || ""),
      // Uit de typeaanduiding, en alleen daaruit. "B16" is een karakteristiek en
      // een stroom; "MKS516" is een merkaanduiding en levert niets.
      karakteristiek: bev.karakteristiek || "",
      In: bev.In,
      IAn: null, aardlektype: "", polen: null, fase: null,
      rail: plaats ? plaats.rail : 1,
      positie: plaats ? plaats.positie : 0,
      breedteModules: 1,
      functie: "", functieEigen: false, standaardnaam: "",
      aardlekId: null,
      bron: "paspoort",
      plaatsOnbekend: !plaats,
      _verdeler: plaats ? plaats.verdeler : 1,
    };
    uitMat.set(m.i, pos);
    posities.push(pos);
  }

  // 2 · De aardlekschakelaars krijgen hun code terug (A1, A2, …), in de volgorde
  //     waarin ze op de rail staan — dezelfde volgorde waarin ze zijn genummerd.
  const aardlekken = sorteerPosities(posities.filter((x) => x.soort === "aardlek"));
  const codeNaarId = new Map();
  aardlekken.forEach((a, i) => {
    if (i < 4) codeNaarId.set(`A${i + 1}`, a.id);
  });

  // 3 · Elke groep uit grp[] hangt zijn gegevens aan zijn toestel — of wordt een
  //     eigen positie als er geen toestel bij is vastgelegd.
  let los = 0;
  for (const g of grp) {
    // Een thuisbatterij staat als twee regels in het paspoort (ontladen en
    // laden). Dat is één groep in de kast, dus de tweede regel voegt niets toe.
    if (g.t === "bat" && g.rol === "af") continue;

    let pos = toNum(g.mat) > 0 ? uitMat.get(toNum(g.mat)) : null;
    if (!pos) {
      pos = {
        id: `g${++los}`,
        soort: "automaat",
        fabrikant: "", type: "", karakteristiek: "", In: null,
        IAn: null, aardlektype: "", polen: null, fase: null,
        rail: 1, positie: 0, breedteModules: 1,
        functie: "", functieEigen: false, standaardnaam: "",
        aardlekId: null, bron: "paspoort", plaatsOnbekend: true, _verdeler: 1,
      };
      posities.push(pos);
    }
    // De naam is door een mens ingevuld, niet gelezen: dat telt als bevestigd.
    if (g.n) { pos.functie = String(g.n); pos.functieEigen = true; pos.functieBron = "paspoort"; }
    // `a` is de nominale stroom van de groep. Die wint van wat uit de
    // typeaanduiding kwam — het is een eigen veld en geen afgeleide.
    if (toNum(g.a) > 0) pos.In = toNum(g.a);
    // Driefasig staat in het paspoort als f:3; welke fase in fn.
    if (toNum(g.f) === 3) pos.polen = 4;
    else if (Array.isArray(g.fn) && g.fn.length === 1) pos.fase = `L${g.fn[0]}`;
    if (codeNaarId.has(String(g.al || ""))) pos.aardlekId = codeNaarId.get(String(g.al));
  }

  // 4 · Wat de groepen verraden over hun aardlekschakelaar. Het paspoort legt
  //     van een aardlek alleen merk en type vast, maar een DRIEFASIGE groep
  //     erachter kan er alleen hangen als die aardlek meerpolig is — en een
  //     groep met één fasenummer zegt op welke fase het hele blok zit.
  for (const a of aardlekken) {
    const erachter = grp.filter((g) => codeNaarId.get(String(g.al || "")) === a.id);
    if (erachter.some((g) => toNum(g.f) === 3)) a.polen = 4;
    const fasen = new Set(
      erachter.filter((g) => Array.isArray(g.fn) && g.fn.length === 1).map((g) => `L${g.fn[0]}`)
    );
    // Alleen als de groepen het eens zijn. Spreken ze elkaar tegen, dan is de
    // indeling veranderd sinds de vorige klus en is zwijgen het eerlijkst.
    if (fasen.size === 1) a.fase = [...fasen][0];
  }

  // 5 · Breedtes uit de onderlinge afstand, en een plaats voor wie er geen had.
  breedtes(posities.filter((x) => !x.plaatsOnbekend));
  const laatsteRail = posities.reduce((n, x) => Math.max(n, x.rail || 1), 1);
  let na = posities.filter((x) => !x.plaatsOnbekend && x.rail === laatsteRail)
                   .reduce((n, x) => Math.max(n, x.positie + x.breedteModules), 1);
  for (const x of posities.filter((y) => y.plaatsOnbekend)) {
    x.rail = laatsteRail;
    x.positie = na;
    na += 1;
  }

  // De hulpvelden horen niet in het kastbeeld.
  for (const x of posities) delete x._verdeler;
  // "RCD 1", "Groep 3" — zodat elk toestel een naam heeft om naar te wijzen,
  // ook als er in het paspoort geen stond.
  return zetStandaardnamen(sorteerPosities(posities));
}

// Draagt dit paspoort genoeg om een kast mee te vullen? Zonder `mat[]` is er
// geen karakteristiek en geen plaats op de rail, en blijft er te weinig over om
// een groepenlijst op te bouwen — dan is de foto de betere weg.
export function paspoortDraagtKast(paspoort) {
  const p = paspoort || {};
  const mat = Array.isArray(p.mat) ? p.mat : [];
  const grp = Array.isArray(p.grp) ? p.grp : [];
  return mat.some((m) => SOORT_UIT_MKP[m.s] && isGroepsoort(SOORT_UIT_MKP[m.s])) || grp.length > 0;
}
