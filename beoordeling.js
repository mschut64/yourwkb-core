// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de beoordelingsketen
//
// Drie lagen, uit het concept: (1) de leerling of monteur levert een project op,
// (2) de projectleider of docent beoordeelt per onderdeel, (3) de meester geeft
// het eindoordeel met een cijfer. Dezelfde keten bij een bedrijf en bij een
// opleider; alleen wie de rollen vult verschilt.
//
// ⚓ DE APP GEEFT GEEN CIJFER. Dat is geen vergeten functie maar de zuiverheids-
// regel van dit project: wij verifiëren niets, wij maken controleerbaar. Een
// berekend cijfer zou een uitspraak over een persoon zijn, gedaan door software
// die de klus niet gezien heeft. Wat de app wél doet is de feiten op een rij
// zetten waarop de meester zijn cijfer baseert — hoeveel onderdelen afgevinkt
// zijn, hoeveel normafwijkingen er in de meetset staan, en wat er nog ontbreekt.
// Zie `cijferKader`: dat levert feiten, geen getal.
//
// ⚓ EEN AFGEVINKT ONDERDEEL IS EEN OORDEEL VAN EEN MENS. De normcheck kan zeggen
// dat een meting binnen de grens valt; of de aarding goed is uitgevoerd ziet
// alleen iemand die ernaar kijkt. Daarom staan de twee naast elkaar in de
// uitkomst en wordt de ene nooit uit de andere afgeleid.
// ─────────────────────────────────────────────────────────────────────────────

// De toestanden van een project in de keten. Bewust kort: elke extra toestand is
// een extra pad dat in twee apps moet kloppen.
export const STATUSSEN = ["concept", "ingeleverd", "retour", "goedgekeurd"];

export const STATUS_LABEL = {
  concept:     "Loopt nog",
  ingeleverd:  "Wacht op beoordeling",
  retour:      "Terug naar leerling",
  goedgekeurd: "Goedgekeurd",
};

// De onderdelen waarop beoordeeld wordt — de rubriek, niet de norm. De norm komt
// uit `meting.js` en staat ernaast; dit is waar een mens naar kijkt.
//
// Een organisatie mag hier onderdelen bij zetten (eigen accenten, zie het
// docentendashboard). Daarom is dit een vertrekpunt en geen slot: `onderdelenVoor`
// voegt de eigen onderdelen van de organisatie toe.
export const ONDERDELEN = {
  groepenkast: [
    { id: "indeling",     label: "Groepenindeling" },
    { id: "aarding",      label: "Aarding" },
    { id: "aardlek",      label: "Aardlekschakelaars" },
    { id: "metingen",     label: "Metingen" },
    { id: "documentatie", label: "Foto's en documentatie" },
    { id: "afwerking",    label: "Netheid en afwerking" },
  ],
  pv: [
    { id: "dak",          label: "Montage en dakdoorvoer" },
    { id: "dc",           label: "DC-zijde en stringaansluiting" },
    { id: "ac",           label: "AC-zijde en eindgroep" },
    { id: "aarding",      label: "Aarding draagconstructie" },
    { id: "metingen",     label: "Metingen" },
    { id: "documentatie", label: "Foto's en documentatie" },
  ],
  cv: [
    { id: "opstelling",   label: "Opstelling en bevestiging" },
    { id: "rookgas",      label: "Rookgasafvoer en luchttoevoer" },
    { id: "gas",          label: "Gaszijdige aansluiting" },
    { id: "water",        label: "Waterzijdige aansluiting" },
    { id: "metingen",     label: "Metingen en instellingen" },
    { id: "documentatie", label: "Foto's en documentatie" },
  ],
  wp: [
    { id: "opstelling",   label: "Opstelling binnen- en buitendeel" },
    { id: "koudemiddel",  label: "Koudemiddelcircuit" },
    { id: "elektrisch",   label: "Elektrische aansluiting en eindgroep" },
    { id: "hydraulisch",  label: "Hydraulische inregeling" },
    { id: "metingen",     label: "Metingen" },
    { id: "documentatie", label: "Foto's en documentatie" },
  ],
  laadpaal: [
    { id: "montage",      label: "Montage en kabelweg" },
    { id: "eindgroep",    label: "Eindgroep en beveiliging" },
    { id: "rcd",          label: "RCD-type en exclusiviteit" },
    { id: "lastbeheer",   label: "Lastbeheer en fasekeuze" },
    { id: "metingen",     label: "Metingen" },
    { id: "documentatie", label: "Foto's en documentatie" },
  ],
  batterij: [
    { id: "opstelling",   label: "Opstelling en ventilatie" },
    { id: "dc",           label: "DC-zijde en accuaansluiting" },
    { id: "ac",           label: "AC-zijde en eindgroep" },
    { id: "sturing",      label: "Sturing en lastbeheer" },
    { id: "metingen",     label: "Metingen" },
    { id: "documentatie", label: "Foto's en documentatie" },
  ],
};

/** De rubriek voor deze discipline, met de eigen onderdelen van de organisatie erachter. */
export function onderdelenVoor(discipline, eigen) {
  const basis = ONDERDELEN[discipline] || ONDERDELEN.groepenkast;
  const extra = (Array.isArray(eigen) ? eigen : [])
    .filter((o) => o && o.id && !basis.some((b) => b.id === o.id))
    .map((o) => ({ id: String(o.id), label: String(o.label || o.id), eigen: true }));
  return [...basis, ...extra];
}

/**
 * De toestand van een project, uit wat er gebeurd is — niet uit een veld dat
 * iemand vergeten kan bij te werken.
 *
 * @param project { ingeleverdOp, retourOp, goedgekeurdOp, cijfer }
 */
export function beoordelingStatus(project) {
  const p = project || {};
  if (p.goedgekeurdOp) return "goedgekeurd";
  // Teruggestuurd ná de laatste inlevering: de leerling is weer aan zet.
  if (p.retourOp && (!p.ingeleverdOp || new Date(p.retourOp) >= new Date(p.ingeleverdOp))) return "retour";
  if (p.ingeleverdOp) return "ingeleverd";
  return "concept";
}

/**
 * Wat er van de beoordeling af is. `onderdelen` is de rubriek, `oordelen` de
 * vinkjes en opmerkingen van de beoordelaar: { [id]: { ok, opmerking } }.
 */
export function beoordelingVoortgang(onderdelen, oordelen) {
  const lijst = Array.isArray(onderdelen) ? onderdelen : [];
  const o = oordelen || {};
  const beoordeeld = lijst.filter((d) => o[d.id] && typeof o[d.id].ok === "boolean");
  const akkoord = beoordeeld.filter((d) => o[d.id].ok === true);
  const afgekeurd = beoordeeld.filter((d) => o[d.id].ok === false);
  return {
    totaal: lijst.length,
    beoordeeld: beoordeeld.length,
    akkoord: akkoord.length,
    afgekeurd: afgekeurd.length,
    // Een afgekeurd onderdeel zonder opmerking is een dood spoor: de leerling
    // weet dan niet wát er mis was. Dat is geen normfout maar wel iets wat de
    // keten stuk maakt, dus het hoort hier gemeld te worden.
    zonderUitleg: afgekeurd.filter((d) => !String((o[d.id] && o[d.id].opmerking) || "").trim())
                           .map((d) => d.id),
    volledig: lijst.length > 0 && beoordeeld.length === lijst.length,
  };
}

/**
 * Mag deze beoordeling afgerond worden, en als "goedgekeurd" of "retour"?
 * Het cijfer komt van de meester en is daarom een invoerwaarde, geen uitkomst.
 */
export function beoordelingCompleet({ onderdelen, oordelen, cijfer, samenvatting } = {}) {
  const v = beoordelingVoortgang(onderdelen, oordelen);
  const ontbreekt = [];
  if (!v.volledig) ontbreekt.push(`${v.totaal - v.beoordeeld} onderdeel(en) nog niet beoordeeld`);
  if (v.zonderUitleg.length) ontbreekt.push("een afgekeurd onderdeel zonder opmerking");
  const cijferGetal = Number(String(cijfer == null ? "" : cijfer).replace(",", "."));
  const heeftCijfer = Number.isFinite(cijferGetal) && cijferGetal >= 1 && cijferGetal <= 10;
  if (!heeftCijfer) ontbreekt.push("een eindcijfer van 1 tot 10");
  if (!String(samenvatting || "").trim()) ontbreekt.push("een samenvatting voor de leerling");
  return {
    kan: ontbreekt.length === 0,
    ontbreekt,
    // Alle onderdelen akkoord → goedkeuren kan. Eén afgekeurd onderdeel betekent
    // terug, en dat is geen oordeel van de app maar de rekensom van de vinkjes
    // die de beoordelaar zelf gezet heeft.
    advies: v.afgekeurd > 0 ? "retour" : "goedgekeurd",
    voortgang: v,
    cijfer: heeftCijfer ? cijferGetal : null,
  };
}

/**
 * De feiten waarop de meester zijn cijfer baseert. GEEN cijfer — zie de kop.
 *
 * @param normcheck uitkomst van de cross-checks: [{ level, msg }]
 */
export function cijferKader({ onderdelen, oordelen, normcheck } = {}) {
  const v = beoordelingVoortgang(onderdelen, oordelen);
  const meldingen = Array.isArray(normcheck) ? normcheck : [];
  const afwijkingen = meldingen.filter((m) => m && m.level === "red");
  const letop = meldingen.filter((m) => m && m.level === "orange");
  return {
    onderdelenAkkoord: v.akkoord,
    onderdelenTotaal: v.totaal,
    onderdelenAfgekeurd: v.afgekeurd,
    normAfwijkingen: afwijkingen.length,
    normLetOp: letop.length,
    // De regel die onder het cijfervak hoort te staan. Expliciet in woorden,
    // zodat niemand hem leest als een rekenuitkomst.
    toelichting: `${v.akkoord} van ${v.totaal} onderdelen akkoord · ` +
      (afwijkingen.length
        ? `${afwijkingen.length} normafwijking${afwijkingen.length === 1 ? "" : "en"} in de meetset`
        : "geen normafwijkingen in de meetset") +
      (letop.length ? ` · ${letop.length} aandachtspunt${letop.length === 1 ? "" : "en"}` : ""),
    cijfer: null,
  };
}

/** Wat deze gebruiker nu met dit project kan: het label van de knop in de lijst. */
export function volgendeActie(project, { rollen, gebruikerId } = {}) {
  const status = beoordelingStatus(project);
  const eigen = project && project.gebruikerId && gebruikerId &&
                String(project.gebruikerId) === String(gebruikerId);
  if (eigen) return status === "goedgekeurd" ? "Bekijken" : "Verder werken";
  const beoordelaar = (Array.isArray(rollen) ? rollen : [rollen])
    .some((r) => ["projectleider", "docent", "meester"].includes(r));
  if (!beoordelaar) return "Bekijken";
  if (status === "ingeleverd") return "Beoordelen";
  if (status === "concept") return "Meekijken";
  return "Bekijken";
}

/** De vier tellers boven het dashboard, uit één lijst projecten. */
export function tellers(projecten, { gebruikerId } = {}) {
  const lijst = Array.isArray(projecten) ? projecten : [];
  const status = (p) => beoordelingStatus(p);
  return {
    wachtOpJou: lijst.filter((p) => status(p) === "ingeleverd" &&
      !(gebruikerId && p.gebruikerId && String(p.gebruikerId) === String(gebruikerId))).length,
    looptNog: lijst.filter((p) => status(p) === "concept" || status(p) === "retour").length,
    goedgekeurd: lijst.filter((p) => status(p) === "goedgekeurd").length,
    // Mensen, niet projecten: wie één project heeft lopen telt één keer.
    mensenActief: new Set(lijst.filter((p) => status(p) !== "goedgekeurd")
      .map((p) => String(p.gebruikerId || ""))).size,
  };
}
