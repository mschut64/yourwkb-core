// ─────────────────────────────────────────────────────────────────────────────
// De groepenverklaring op de kastdeur lezen
//
// Het lijstje achter het deurtje — "3 — Wasmachine" — is de beste bron voor
// groepsnamen die er is: het staat er, iemand heeft het opgeschreven, en het
// gaat over déze kast. Maar het is met de hand geschreven, soms jaren geleden,
// en de volgorde klopt niet altijd met de volgorde op de rail.
//
// Daarom drie zekerheidsniveaus: een nummer op de plaat (zeker), een regel die
// bij een module staat (vrij zeker), of de volgorde van het lijstje (een gok die
// als zodanig wordt gemarkeerd).
// ─────────────────────────────────────────────────────────────────────────────

import { toNum } from "./getallen.js";
import { isGroepsoort, groepsnummers, sorteerPosities } from "./toestellen.js";

// ─── DE GELEZEN GROEPENVERKLARING KOPPELEN ────────────────────────────────────
//
// De analyse geeft de tekst van de plaat terug als LOSSE regels ("Groep 3 —
// Wasmachine"), bewust niet aan een positie gekoppeld: de prompt mag geen
// nummering verzinnen die er niet staat. Maar de koppeling zelf is geen
// giswerk — het nummer stáát in de regel, en welke module groep 3 is, weet de
// app zelf uit de fysieke volgorde. Dat hoort de installateur dus niet met de
// hand te doen.
//
// Waarom dat veilig is: gekoppeld wordt alleen op een nummer dat we werkelijk
// hebben. Staat er op de plaat een groep 9 terwijl er acht groepen in de kast
// zitten, dan blijft die regel ongekoppeld en verschijnt hij als suggestie —
// want dan klopt de nummering niet, en een verkeerde naam belandt anders op een
// sticker op de kastdeur.
//
// Een naam die de installateur zelf heeft ingetypt wint altijd.
export function splitsVerklaring(regel) {
  const tekst = String(regel || "");
  const nr = tekst.match(/^\s*(?:groep\s*)?(\d{1,2})\b\s*[—–:.-]?\s*/i);
  const zonderNr = nr ? tekst.slice(nr[0].length) : tekst.replace(/^\s*groep\s*[—–:.-]?\s*/i, "");
  const delen = zonderNr.split(/\s*[—–]\s*|,/);
  return {
    nummer: nr ? toNum(nr[1]) : null,
    naam: (delen[0] || "").trim().slice(0, 40),
    rest: delen.slice(1).join(", ").trim(),
  };
}

// ─── NIET ALLES OP DE PLAAT IS EEN GROEPSNAAM ─────────────────────────────────
//
// Uit het veld, 02-09-2026. Een plaat leverde twintig regels, waarvan er vijf
// geen groepsnaam waren: "Hoofdschakelaar", "LET OP: PV installatie aanwezig"
// en drie regels "Aardlekschakelaar beveiligt <kleur> groepen". Die stonden
// alle vijf als kandidaat-naam in de lijst, alsof je ze op een groep zou willen
// zetten.
//
// De legendaregels zijn bovendien geen ruis maar juist de VERKLARING van de
// kleurband — de tekst die zegt welke kleur bij welke aardlek hoort. Die hoort
// bij de blokindeling thuis, niet bij de namen.
export function soortVerklaringsregel(regel) {
  const ruw = String(regel || "").trim();
  const t = ruw.toLowerCase();
  if (!t) return "leeg";
  if (/aardlek|rcd|differentieel/.test(t)) return "aardlek";
  if (/^hoofdschakelaar\b|^hoofdzekering\b|^hoofdaansluiting\b/.test(t)) return "installatie";
  if (/^let op\b|^waarschuwing\b|^pas op\b|\bpv[- ]?installatie\b|\bzonnepanelen aanwezig\b/.test(t)) return "opmerking";

  // HET TYPEPLAATJE VAN DE KAST IS GEEN GROEPSNAAM.
  //
  // Uit de ijkronde van 03-09-2026 op een echte meterkast: het model las
  // "HAFONORM HE-H44.D6-22.22-0.32.32.33" en "In 40A, Un 230/400V" van de kast
  // en zette die in de groepenverklaring. Dat is knap gelezen maar het hoort
  // niet in de namenlijst — met toekennen op volgorde was zo'n regel anders als
  // groepsnaam op een automaat beland, en daarmee op een sticker op de deur.
  if (/^\s*(in|un|ue|icn|uimp)\b\s*[=:]?\s*\d/i.test(ruw)) return "technisch";
  if (/\b\d+\s*(v|kv|a|ka|hz|mm²|mm2)\b/.test(t) && !/\b(groep|wcd|keuken|badkamer|zolder)\b/.test(t)) return "technisch";
  // Een typeaanduiding: een woord met cijfers én scheidingstekens, zoals
  // "HE-H44.D6-22.22-0.32.32.33" of "PXF-40/4/003-A". Namen die mensen op een
  // plaat schrijven zien er niet zo uit.
  if (/[A-Za-z0-9]*\d[A-Za-z0-9]*[.\-\/][A-Za-z0-9.\-\/]*\d[A-Za-z0-9.\-\/]*/.test(ruw)
      && /[.\-\/].*[.\-\/]/.test(ruw)) return "technisch";
  return "groep";
}

// De regels uitgesplitst naar wat ze zijn. `groepen` is wat je op een groep zou
// willen zetten; de rest hoort ergens anders of nergens.
export function splitsVerklaringsregels(regels) {
  const uit = { groepen: [], aardlek: [], opmerking: [], installatie: [], technisch: [] };
  for (const r of Array.isArray(regels) ? regels : []) {
    const soort = soortVerklaringsregel(r);
    if (soort === "leeg") continue;
    uit[soort === "groep" ? "groepen" : soort].push(r);
  }
  return uit;
}

// ─── KOPPELEN OP VOLGORDE ─────────────────────────────────────────────────────
//
// De laatste terugval, en bewust apart van koppelGroepenverklaring gehouden.
//
// Op een plaat staan de groepsteksten in de volgorde van de groepen. Zijn er
// evenveel leesbare namen als groepen zonder naam, dan is de toewijzing op
// volgorde geen gok maar de enige lezing die klopt. Zijn de aantallen ongelijk,
// dan is er ergens een regel weggevallen of dubbel geteld, en dan schuift ALLES
// erna één op — dus dan doen we het niet.
//
// De herkomst wordt `volgorde` en niet `foto`: bij de andere bronnen is gelezen
// wáár de naam hoort, hier is dat afgeleid. Dat verschil hoort de installateur
// te zien, want deze namen komen op een sticker op de kastdeur.
export function volgordeKandidaten(posities, regels) {
  const groepen = sorteerPosities(posities).filter((p) => isGroepsoort(p.soort) && !p.functieEigen);
  const namen = splitsVerklaringsregels(regels).groepen
    .map((r) => splitsVerklaring(r).naam)
    .filter(Boolean);
  return { groepen, namen, past: groepen.length > 0 && groepen.length === namen.length };
}

export function koppelOpVolgorde(posities, regels) {
  const { groepen, namen, past } = volgordeKandidaten(posities, regels);
  if (!groepen.length || !namen.length) return { posities, gekoppeld: 0, past };
  // OOK ALS DE AANTALLEN NIET KLOPPEN.
  //
  // Dit stond eerst achter `past`, en dat was mijn voorzichtigheid die de
  // installateur in de weg zat: hij zag vijftien gelezen namen, kon er geen
  // enkele gebruiken, en moest ze alsnog allemaal met de hand overtikken. Dat
  // is precies het werk dat deze app hoort weg te nemen.
  //
  // Hij kijkt naar de kast en wij niet. Toewijzen op volgorde en hem laten
  // corrigeren is beter dan niets doen — mits de app eerlijk is over wat er is
  // afgeleid, en dat doet `functieBron: "volgorde"` samen met de melding.
  // Kloppen de aantallen niet, dan gaat het zover als het komt en houdt de rest
  // zijn standaardnaam.
  const naamById = new Map();
  groepen.forEach((p, i) => { if (namen[i]) naamById.set(p.id, namen[i]); });
  const uit = posities.map((p) =>
    naamById.has(p.id)
      ? { ...p, functie: naamById.get(p.id), functieEigen: true, functieBron: "volgorde" }
      : p
  );
  return { posities: uit, gekoppeld: naamById.size, past, over: Math.max(0, namen.length - groepen.length) };
}

export function koppelGroepenverklaring(posities, regels) {
  const lijst = Array.isArray(regels) ? regels : [];

  // BRON 1 — de tekst die fysiek bij deze module stond.
  //
  // Dit is de directste vorm die er is: het model heeft niet alleen de tekst
  // gelezen maar ook gezien waar hij hangt. Er komt geen nummering aan te pas,
  // en dat is precies wat een kast met handgeschreven etiketten en zónder
  // groepsnummers nodig heeft — daar liep de nummerkoppeling hieronder op stuk.
  let gekoppeld = 0;
  let tussen = posities.map((p) => {
    const tekst = String(p.groepstekst || "").trim();
    if (!tekst || p.functieEigen || !isGroepsoort(p.soort)) return p;
    // Door dezelfde zeef als de losse regels. Het model zet ook op een
    // aardlekschakelaar en een hoofdschakelaar een groepstekst — dan staat er
    // letterlijk "aardlekschakelaar" of "HOOFDSCHAKELAAR" in. Zolang die
    // modules goed zijn ingedeeld valt dat buiten deze lus, maar één verkeerd
    // ingedeelde module en dat woord staat als groepsnaam op een sticker.
    // Gezien op een echte kast in Assen, 03-09-2026.
    if (soortVerklaringsregel(tekst) !== "groep") return p;
    const { naam } = splitsVerklaring(tekst);
    if (!naam) return p;
    gekoppeld += 1;
    return { ...p, functie: naam, functieEigen: true, functieBron: "foto" };
  });

  if (!lijst.length) return { posities: tussen, gekoppeld, rest: [] };
  const posities_ = tussen;

  const nrs = groepsnummers(posities_);
  const idByNr = new Map();
  for (const [id, nr] of nrs) idByNr.set(nr, id);

  // BRON 2 — losse regels met een groepsnummer erin.
  const namen = new Map();
  const rest = [];
  const bezet = new Set(posities_.filter((p) => p.functieEigen).map((p) => p.id));
  for (const regel of lijst) {
    const { nummer, naam } = splitsVerklaring(regel);
    const id = nummer ? idByNr.get(nummer) : null;
    // Zonder nummer, zonder naam, of een nummer dat we niet hebben: niet
    // koppelen. De regel blijft als suggestie beschikbaar.
    if (!id || !naam) { rest.push(regel); continue; }
    if (namen.has(id)) { rest.push(regel); continue; }   // twee regels, één groep
    // De groep draagt al een naam — van de installateur zelf, of van een tekst
    // die fysiek bij de module stond en dus directer is. Deze regel mag die
    // niet overschrijven, maar hij mag ook niet stilletjes verdwijnen: dan
    // verliest de installateur een aflezing zonder het te merken.
    if (bezet.has(id)) { rest.push(regel); continue; }
    namen.set(id, naam);
  }

  const uit = posities_.map((p) => {
    const naam = namen.get(p.id);
    if (!naam || p.functieEigen) return p;
    gekoppeld += 1;
    // functieBron legt vast dat dit van de PLAAT komt en niet van de
    // installateur. De UI kan het zo als "uit de foto" tonen, en de leerlus
    // telt een correctie hierop als een correctie op een aflezing.
    return { ...p, functie: naam, functieEigen: true, functieBron: "foto" };
  });
  return { posities: uit, gekoppeld, rest };
}
