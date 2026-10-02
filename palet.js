// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — het palet van de dashboards (bedrijf en leren)
//
// De veldapp heeft een eigen palet: donker, geel, één kolom, bedacht voor een
// telefoon in een meterkast. De bedrijfs- en de onderwijsapp zijn iets anders —
// een bureau, een breed scherm, iemand die zit. Het ontwerp daarvoor is de
// mock-up die Martin op 28-09-2026 heeft goedgekeurd: licht, zandkleurig, met
// blauw als accent. Die kleuren staan hier, en niet in één van de twee apps,
// omdat ze in béíde voorkomen — en twee kopieën van een palet lopen uiteen zodra
// er één kleur verandert.
//
// WAAROM OOK EEN DONKER THEMA: de monteur die 's avonds in de bus zijn werk
// inlevert zit in dezelfde app als de planner achter zijn bureau. De veldapp
// heeft dezelfde keuze sinds 02-10-2026; het zou vreemd zijn als de ene helft van
// hetzelfde product hem wel heeft en de andere niet. Donker is hier wél de
// tweede keus (de mock-up is licht) — precies omgekeerd aan de veldapp.
//
// ⚓ EEN VARIABELE IS GEEN HEX. Deze kleuren worden in de apps CSS-variabelen, dus
// `var(--d-accent)33` is onzin. Elke doorzichtige tint heeft daarom een eigen
// token met per thema een eigen waarde — dezelfde les als in de veldapp.
// ─────────────────────────────────────────────────────────────────────────────

export const PALET = {
  licht: {
    bg: "#F4F2EE",              // het zand van de mock-up
    surface: "#FFFFFF",
    surfaceSoft: "#FAF9F6",     // kop van een tabel
    border: "#DEDAD2",
    borderSoft: "#ECEBE6",      // scheiding tussen rijen
    borderStrong: "#C9C4BA",    // rand van invoervelden en knoppen
    text: "#1C1B19",
    textSoft: "#4A4843",
    muted: "#6B665C",
    accent: "#1F4E79",          // het blauw; 7,4:1 op wit
    accentZacht: "#DFE8F2",
    accentTekst: "#1F4E79",
    accentOp: "#FFFFFF",        // tekst óp het accentvlak
    chip: "#ECEFF3",
    chipTekst: "#3D4C5C",
    avatar: "#E4E9EE",
    groen: "#2E6B3A",  groenZacht: "#DCEFE0",  groenTekst: "#2E6B3A",
    oranje: "#B45309", oranjeZacht: "#FBE9D6", oranjeTekst: "#8A3F06",
    rood: "#B3261E",   roodZacht: "#F9DEDB",   roodTekst: "#8A1C14",
    schaduw: "0 1px 2px rgba(0,0,0,0.08)",
    // De drie fasen. Dezelfde rol als FASE_KLEUR in fasen.js, maar dit zijn de
    // lijnkleuren van de grafiek op een licht vlak. Ze verschillen ook in
    // lichtheid, niet alleen in tint — anders zijn ze voor wie kleuren slecht
    // onderscheidt drie keer hetzelfde.
    l1: "#B3261E", l2: "#1F4E79", l3: "#2E6B3A",
  },
  donker: {
    bg: "#111318",              // gelijk aan de veldapp, zodat het één product blijft
    surface: "#1A1D25",
    surfaceSoft: "#20242F",
    border: "#2E3347",
    borderSoft: "#262B3B",
    borderStrong: "#3E4459",
    text: "#ECEEF5",
    textSoft: "#C2C8D8",
    muted: "#9BA3B8",
    accent: "#5FA8E8",          // het blauw opgetrokken: #1F4E79 op donker haalt niets
    accentZacht: "#13263A",
    accentTekst: "#9CC9F0",
    accentOp: "#0A1626",
    chip: "#232838",
    chipTekst: "#C2C8D8",
    avatar: "#2A3040",
    groen: "#4CC77B",  groenZacht: "#0C2418",  groenTekst: "#7FE0A3",
    oranje: "#F0A83C", oranjeZacht: "#2A1E08", oranjeTekst: "#F5C27A",
    rood: "#FF6B61",   roodZacht: "#2A0C0C",   roodTekst: "#FF9A93",
    schaduw: "0 1px 2px rgba(0,0,0,0.5)",
    l1: "#FF6B61", l2: "#5FA8E8", l3: "#4CC77B",
  },
};

export const THEMAS = Object.keys(PALET);

/** camelCase → kebab, zodat `accentZacht` de variabele `--d-accent-zacht` wordt. */
function varNaam(k, prefix) {
  return `--${prefix}-${k.replace(/[A-Z0-9]+/g, (m) => "-" + m.toLowerCase())}`;
}

/**
 * De variabelen van beide thema's als één stuk CSS. Het lichte thema is de
 * standaard (ook zonder attribuut); `data-thema="donker"` op <html> zet het om.
 */
export function themaCss(prefix = "d") {
  const regels = (naam) => Object.entries(PALET[naam])
    .map(([k, v]) => `${varNaam(k, prefix)}:${v}`).join(";");
  return `:root{${regels("licht")}}` +
         `:root[data-thema="donker"]{${regels("donker")}}` +
         `html,body{background:var(--${prefix}-bg);margin:0}`;
}

/** Dezelfde sleutels, maar als verwijzing naar de variabele. Dit is wat een app gebruikt. */
export function kleuren(prefix = "d") {
  const uit = {};
  for (const k of Object.keys(PALET.licht)) uit[k] = `var(${varNaam(k, prefix)})`;
  return uit;
}

// De lettertypen van de mock-up. Fraunces alleen voor koppen, Source Sans 3 voor
// alles wat gelezen moet worden. Let op de regelhoogte: op de landing kapte een
// display-letter bij 1,08 de onderstok van g, j en p af — vandaar 1,15 hier.
export const LETTERS = {
  kop: "'Fraunces', Georgia, serif",
  tekst: "'Source Sans 3', system-ui, sans-serif",
  kopRegelhoogte: 1.15,
  googleFonts: "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap",
};
