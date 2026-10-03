// Kastscan — A4-documenten: groepenoverzicht en labelvel.
// ⚠️ VERHUISD UIT KASTSCAN op 03-10-2026. Twee wijzigingen, en allebei met reden:
//
//   1. De imports komen uit de motor in plaats van uit Kastscans model.js.
//   2. `signalen` en `samenvatting` zijn OPTIES geworden in plaats van imports.
//      Dat zijn oordelen over een kast, en elke app heeft zijn eigen: Kastscan
//      kijkt naar wat er uit een foto kwam, YourWkb naar de meetwaarden van een
//      oplevering. De motor hoort daar geen keuze in te maken; hij zet op papier
//      wat hij meekrijgt.
//
// BROWSER-ONLY voor het afdrukken (`printHtml` opent een venster); de
// html-functies zelf zijn zuiver en leveren een string.
//
// Beide worden als HTML met millimeter-maten opgebouwd en door de browser
// afgedrukt of als PDF bewaard. Millimeters, niet pixels: een label van 30 mm
// moet ook echt 30 mm op papier worden. @page zet het formaat vast en
// print-color-adjust houdt de vlakken zwart.
//
// WAAROM DIT DOCUMENT MOET BESTAAN (labelspec rev3.0 §8, NEN 1010 rubriek 514):
// eindgroepen en beveiligingstoestellen moeten herkenbaar aangeduid zijn, en bij
// elke verdeelinrichting hoort relevante documentatie — minimaal een
// groepenverklaring. De stroken en tags zijn een GEDISTRIBUEERDE
// groepenverklaring; losse labels vervangen dat document niet. Dit is de
// samenvattende kaart die daarnaast in de kast hoort.

import { svgInhoud } from "./render.js";
import { ontwerpSchema, schemaSvg } from "./schema.js";
import { DRAGER } from "./labels.js";
import { komma } from "./getallen.js";
import {
  groepsnummers, isGroepsoort, isMeerpolig, sorteerPosities, formatBeveiliging,
} from "./toestellen.js";
import { blokIndeling } from "./indeling.js";
import { aardlekCode, aardlekKleur, AARDLEK_KLEURNAAM } from "./vormtaal.js";
import { FASE_KLEUR } from "./fasen.js";
// Oordelen over een kast zijn van de app, niet van de motor. Wie niets meegeeft
// krijgt een document zonder die regels — leeg laten is beter dan iets beweren.
const GEEN_SIGNALEN = () => [];
const GEEN_SAMENVATTING = () => "";

// De balans mag één uitkomst zijn (één verdeler) of een lijst, of een functie die
// hem per verdeler oplevert. Een kast met twee verdelers heeft twee balansen, en
// die van de eerste onder de tweede zetten is erger dan hem weglaten.
function balansVoor(o, v, i) {
  if (typeof o.balans === "function") return o.balans(v, i);
  if (Array.isArray(o.balans)) return o.balans[i] || null;
  return i === 0 ? (o.balans || null) : null;
}

// ─── GEDEELD ──────────────────────────────────────────────────────────────────

export // ─── HET MERK OP PAPIER ───────────────────────────────────────────────────────
//
// Het teken is pure vectorgeometrie en heeft geen lettertype nodig, dus het
// drukt altijd goed. Het woordmerk ernaast is echte tekst in Syne 800.
//
// De merkspec wijst voor print naar de PNG-lockups, omdat een SVG met levende
// tekst een geladen lettertype nodig heeft. Hier is dat geen extra risico: dit
// document laadt zijn hele typografie al bij Google Fonts, dus valt dat weg,
// dan klopt het vel toch al niet. En tekst blijft scherp op elke printresolutie,
// waar een PNG op zijn pixelmaat vastzit.
//
// De maten volgen de spec: radius 25% van de vlakgrootte, teken op het
// 24-eenheden-grid.
const MERKVLAK = `<svg width="11mm" height="11mm" viewBox="0 0 32 32" aria-hidden="true"
  style="display:block;flex:0 0 11mm">
  <rect width="32" height="32" rx="8" fill="#F5C518"/>
  <g transform="translate(3 3) scale(1.0833)">
    <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="2.2" fill="none" stroke="#000" stroke-width="1.9"/>
    <line x1="3.8" y1="8.2" x2="20.2" y2="8.2" stroke="#000" stroke-width="1.9"/>
    <path d="M13.2 10 L8.6 15.6 h3.2 l-0.5 3.6 L15.8 13.4 h-3.2 l0.6-3.4 z" fill="#000"/>
  </g>
</svg>`;

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Drukwerk is zwart op wit — niet het donkere appthema. Een installateur die
// dit uitdraait wil een leesbaar vel, geen toner-slurpende zwarte pagina.
const BASIS_CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#fff;color:#000;font-family:'Barlow Condensed','IBM Plex Sans','Arial Narrow',sans-serif}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @media print{ body{margin:0} }
`;

// ─── AFDRUKKEN ───────────────────────────────────────────────────────────────
//
// Hier botsen twee lessen, en allebei zijn ze duur betaald.
//
// 1 · BEVEILIGINGSAUDIT 25-08-2026: een popup met document.write is een
//     injectiepad — wat erin staat draait in ONZE oorsprong. Daarom stond hier
//     een verborgen, sandboxed iframe.
// 2 · MELDING MAURITS 20-09-2026: printen vanuit een verborgen frame van 0×0
//     gaat op iPhone en iPad mis. WebKit print vanuit een frame het
//     BOVENLIGGENDE document, en van een frame zonder afmetingen komt hooguit
//     één gerenderde pagina mee — zijn pdf had het app-scherm op pagina 1.
//
// YourWkb heeft die twee in september al verzoend en dat doen we hier net zo: een
// ECHT tabblad, en het document gaat er ONTSMET in. Dat is dezelfde oplossing als
// in components/wkb/rapport-print.js — script, on*-attributen en javascript:-urls
// eruit vóór het schrijven. Zonder die ontsmetting zou les 1 terugkomen.
//
// ⚓ NIET PRINTEN VANUIT EEN VERBORGEN FRAME. Deze functie deed dat tot
// 03-10-2026, en dat is precies de fout die YourWkb op 20-09-2026 al had
// opgelost (melding Maurits): WebKit print vanuit een frame het BOVENLIGGENDE
// document, en van een frame zonder afmetingen komt hooguit één gerenderde
// pagina mee. Op een iPad leverde dat een pdf op met het app-scherm op pagina 1
// en een half document op pagina 2.
//
// Dus: een ECHT tabblad, met een printknop erin voor als de printdialoog niet
// vanzelf opent. Lukt het tabblad niet (pop-upblokkering), dan alsnog via een
// frame — op de desktop werkt dat wél, en een document met een omweg is beter
// dan geen document. De titel bepaalt op iOS de bestandsnaam van de pdf.
const PRINTBALK = `<style>@media print{.ywkb-printbalk{display:none!important}}</style>
<div class="ywkb-printbalk" style="position:sticky;top:0;z-index:999;display:flex;gap:8px;justify-content:flex-end;padding:10px;background:#111318">
<button onclick="window.print()" style="background:#F5C518;color:#000;border:none;padding:12px 20px;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer">🖨️ Printen of opslaan als pdf</button>
</div>`;

// Ontsmetten vóór het in een tabblad van onze eigen oorsprong belandt. De
// documenten worden hier gebouwd en alles gaat door esc(), maar deze laag is de
// vangrail: één vergeten esc() mag geen script opleveren dat als ons draait.
export function ontsmet(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function printHtml(html, titel) {
  if (typeof document === "undefined") return;
  const doc = ontsmet(html);
  const metBalk = /<body[^>]*>/i.test(doc)
    ? doc.replace(/<body[^>]*>/i, (m) => m + PRINTBALK)
    : PRINTBALK + doc;

  const tab = typeof window !== "undefined" ? window.open("", "_blank") : null;
  if (tab && tab.document) {
    tab.document.write(metBalk);
    tab.document.close();
    try {
      if (titel) tab.document.title = String(titel).slice(0, 80);
      tab.focus();
      // Eén poging om de dialoog zelf te openen. Lukt het niet, dan staat de knop
      // er — en dat is het verschil tussen "werkt niet" en "nog één tik".
      setTimeout(() => { try { tab.print(); } catch { /* de knop blijft */ } }, 300);
    } catch { /* de knop in het document blijft werken */ }
    return () => { try { tab.close(); } catch { /* al dicht */ } };
  }

  // Terugval: het tabblad werd geblokkeerd. Dan een frame MET afmetingen, zodat
  // er tenminste een heel document gerenderd wordt.
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;border:0;background:#fff;z-index:99999";
  document.body.appendChild(frame);
  const opruimen = () => { try { document.body.removeChild(frame); } catch { /* al weg */ } };
  frame.onload = () => {
    try {
      const w = frame.contentWindow;
      if (titel) w.document.title = String(titel).slice(0, 80);
      w.focus(); w.print();
    } catch { /* browser blokkeerde het afdrukken */ }
    setTimeout(opruimen, 60000);
  };
  frame.srcdoc = metBalk;
  return opruimen;
}

// ─── DOCUMENT · INSTALLATIESCHEMA (A4 LIGGEND) ────────────────────────────────
//
// Het eendraadschema op papier. LIGGEND, omdat een groepslijn van links naar
// rechts loopt en een staand vel de functieomschrijving zou afkappen.
//
// De tekening zelf komt uit schema.js als SVG in millimeters. Die schaalt zich
// met behoud van verhouding in het vel, dus een kast met acht groepen en een
// kast met achtentwintig leveren allebei een gevuld A4 op zonder dat hier iets
// aan maatvoering wordt herhaald.
//
// WAAROM DIT NAAST HET GROEPENOVERZICHT BESTAAT. Het overzicht is de
// groepenverklaring: wat doet groep 7, welke aardlek, welke fase — een tabel om
// op de kastdeur te plakken. Het schema is de SAMENHANG: waar komt de voeding
// vandaan, wat hangt waaraan, hoe is geaard. Bij een storing of een uitbreiding
// is dat het eerste wat iemand zoekt, en het is doorgaans het enige document
// dat er niet ligt.
export function schemaHtml(kast, opties) {
  const o = opties || {};
  const ontwerp = ontwerpSchema(kast, o);
  const svg = schemaSvg(ontwerp, {
    kleur: "#000",
    attributen: `width="100%" style="display:block;height:auto"`,
  });

  return `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<title>Installatieschema</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&display=swap">
<style>
  ${BASIS_CSS}
  /* LIGGEND. Een eendraadschema is breed van nature; staand afdrukken levert
     een onleesbaar vel op waar de helft van de functieomschrijvingen afvalt. */
  @page{size:A4 landscape;margin:8mm}
  html,body{font-family:'IBM Plex Sans',sans-serif}
  .vel{width:281mm}
  svg text{font-family:'IBM Plex Sans',sans-serif}
</style></head><body>
<div class="vel">${svg}</div>
</body></html>`;
}

// ─── DOCUMENT 1 · GROEPENOVERZICHT (A4) ───────────────────────────────────────

// LET OP DE PLEK VAN DE QR. Die hoort in de gegevenskaart van de hoofdverdeler,
// op pagina 1 — niet in een eigen blok en niet achterin.
//
// Dat is geen opmaakkeuze: dit overzicht wordt op de meterkastdeur geplakt, en
// dan leest niemand ooit de achterkant. De code hoort bovendien bij de
// aansluitgegevens: aansluiting, stelsel, kamrail, omvang en paspoort zijn
// samen het visitekaartje van de kast.
//
// De uitknipbare sticker houdt wél een eigen pagina achteraan: die wordt
// weggeknipt, en dat mag het overzicht zelf niet beschadigen.
export function groepenoverzichtHtml(kast, opties) {
  const o = opties || {};
  const verdelers = (kast && kast.verdelers) || [];
  const datum = o.datum || "";
  const adres = (kast && kast.adres) || {};
  const adresRegel = [
    [adres.postcode, adres.huisnummer].filter(Boolean).join(" "),
    adres.toevoeging,
  ].filter(Boolean).join("") || "—";

  const secties = verdelers
    .map((v, i) => verdelerSectie(v, i === 0 ? o.qrDataUrl : "", { ...o, balans: balansVoor(o, v, i) }))
    .join("");

  return `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<title>Groepenoverzicht${adresRegel !== "—" ? " " + esc(adresRegel) : ""}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Syne:wght@800&display=swap">
<style>
${BASIS_CSS}
/* 12 mm en niet 14. Gemeten 13-09-2026: een kast van tien groepen kwam op
   277 mm uit bij 269 mm bedrukbaar — acht millimeter te veel, en daarvoor
   verhuisde de voet in zijn eentje naar een tweede vel. Die acht millimeter
   zaten in de marge en in witruimte die niets droeg, niet in de inhoud. */
@page{size:A4;margin:12mm}
/* Het woordmerk. Syne 800 met de spatiëring uit de merkspec; de terugval is
   Barlow Condensed, want die is hier hoe dan ook geladen en staat dichter bij
   het merk dan een systeemletter. */
.merknaam{font-family:'Syne','Barlow Condensed',sans-serif;font-weight:800;
  letter-spacing:-0.02em;font-size:15pt;line-height:1;color:#111318}
body{font-size:10pt;line-height:1.35}
.kop{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.2mm solid #000;padding-bottom:3mm;margin-bottom:5mm;position:relative}
.kop::after{content:"";position:absolute;left:0;bottom:-1.2mm;width:28mm;height:1.2mm;background:#F5C518}
.kop h1{font-size:20pt;font-weight:700;letter-spacing:-0.01em;line-height:1.05}
.kop .sub{font-size:10pt;font-weight:500;margin-top:1mm}
.kop .rechts{text-align:right;font-size:9pt;font-weight:500}
/* PAGINERING — waarom .blok NIET break-inside:avoid krijgt.
   Gemeten 13-09-2026 op een kast met veertien groepen: de hele
   verdelersectie — kop, gegevenskaart, twee tabellen, fasebalans en
   aandachtspunten — is samen 266 mm hoog. Op een A4 met 14 mm marge is
   269 mm bedrukbaar, en na de documentkop blijft daar 234 mm van over.
   Met break-inside:avoid weigert de browser dat blok te breken, schuift
   het in zijn geheel naar de volgende pagina, en blijft pagina 1 achter
   met alleen de kop. De voet belandt daarna op een derde, ook bijna lege
   pagina, en de uitknipsticker maakt er vier.

   Een verdelersectie is dus per definitie te hoog om heel te houden, en
   dat te willen kost twee lege vellen. Wat WEL bij elkaar moet blijven is
   klein: een tabelrij, een aandachtspunt, een gegevenskaart, een kop met
   wat eronder komt. Dat staat hieronder, per element. */
.blok{margin-bottom:6mm}
/* De onderste verdeler heeft geen buurman meer; die zes millimeter duwden
   alleen de voet van het vel af. De voet brengt zijn eigen ruimte mee. */
.blok:last-of-type{margin-bottom:0}
/* Een kop die als laatste op een pagina achterblijft, hoort bij niets meer. */
h2,h3{break-after:avoid;page-break-after:avoid}
/* Breekt een tabel over twee pagina's, dan gaat de kolomkop mee. Zonder dit
   staat de tweede helft van de eindgroepen zonder kolomnamen op het blad. */
thead{display:table-header-group}
tr{break-inside:avoid;page-break-inside:avoid}
.kaart{break-inside:avoid;page-break-inside:avoid}
.voet{break-inside:avoid;page-break-inside:avoid}
/* DE AANDACHTSPUNTEN ZIJN DE KNIP. Moet er ergens gebroken worden, dan liefst
   hier en niet middenin de lijst: een bevinding die over twee vellen valt lees
   je twee keer half, en de kop "Aandachtspunten" onderaan pagina 1 met de
   punten op pagina 2 is erger dan een schone overgang.

   break-inside:avoid doet hier precies "breek alleen als het nodig is". Past
   het hele blok nog onder de fasebalans, dan blijft het staan; past het niet,
   dan gaat het in zijn geheel naar het volgende vel en eindigt pagina 1 netjes
   na de fasebalans.

   Dit is niet dezelfde regel die het document eerder op vier pagina's bracht.
   Daar stond de HELE verdelersectie — inclusief beide tabellen — als één
   onbreekbaar blok van 266 mm bovenaan het vel, zodat pagina 1 leeg achterbleef.
   Dit blok begint pas onderaan, dus wat ervóór staat vult die pagina al. */
.punten{break-inside:avoid;page-break-inside:avoid}
h2{font-size:13pt;font-weight:700;margin-bottom:2mm;padding-bottom:1mm;border-bottom:0.4mm solid #000;
   position:relative}
h2::after{content:"";position:absolute;left:0;bottom:-0.4mm;width:18mm;height:0.8mm;background:#F5C518}
h3{font-size:10pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin:4mm 0 1.5mm}
table{width:100%;border-collapse:collapse;font-size:9.5pt}
th{text-align:left;font-weight:700;font-size:8pt;letter-spacing:0.06em;text-transform:uppercase;
   border-bottom:0.4mm solid #000;padding:1.2mm 1.5mm}
td{padding:1.2mm 1.5mm;border-bottom:0.2mm solid #999;font-variant-numeric:tabular-nums}
td.naam{font-weight:600}
.leeg{color:#666;font-style:italic}
/* KLEUR IS NOOIT DE ENIGE DRAGER (zie model.js › KLEUR OP PAPIER). Elke
   gekleurde aanduiding staat er ook in tekst of als vorm bij, zodat een
   zwart-witafdruk niets mist. */
.chip{display:inline-flex;align-items:center;gap:1.2mm;font-weight:700;white-space:nowrap}
.stip{display:inline-block;width:2.4mm;height:2.4mm;border-radius:50%;border:0.2mm solid #000}
.stippen{display:inline-flex;gap:0.6mm}
.fase{display:inline-flex;align-items:center;gap:1.2mm;font-weight:700}
.faseblok{display:inline-block;width:2.2mm;height:2.2mm;border:0.2mm solid #000}
li.ok{border-left-color:#2E7D32}
li.let-op{border-left-color:#E8710A}
li.afwijking{border-left-color:#C62828}
li.ok::before{color:#2E7D32}
li.let-op::before{color:#E8710A}
li.afwijking::before{color:#C62828}
.kaart{border:0.4mm solid #000;padding:3mm;margin-bottom:3mm}
/* De fasebalans is drie kaarten naast elkaar; die horen samen op één pagina
   gelezen te worden, anders staat L3 los van L1 en L2. */
.kaart .rij{break-inside:avoid;page-break-inside:avoid}
.rij{display:flex;gap:4mm;flex-wrap:wrap}
.rij>div{flex:1 1 34mm}
.klein{font-size:8pt;font-weight:600;letter-spacing:0.06em;text-transform:uppercase}
.groot{font-size:14pt;font-weight:700;font-variant-numeric:tabular-nums}
.balk{height:3mm;border:0.3mm solid #000;margin-top:1mm;position:relative;overflow:hidden}
.balk i{display:block;height:100%;background:#000}
ul{list-style:none}
li{padding:1mm 0 1mm 8mm;position:relative;font-size:9pt;break-inside:avoid;page-break-inside:avoid;
   border-left:1mm solid #ccc;margin-bottom:0.8mm}
li::before{position:absolute;left:2.5mm;font-weight:700}
li.ok::before{content:"OK"}
li.let-op::before{content:"!"}
li.afwijking::before{content:"X"}
.kaart-qr{display:flex;gap:4mm;align-items:stretch}
.kaart-qr>.rij{flex:1 1 auto;align-content:center}
/* De drie korte waarden krijgen krap wat ze nodig hebben; Omvang is de enige
   die een hele zin draagt en houdt daarom de dubbele breedte. Anders breekt
   juist die regel af zodra de QR ernaast komt te staan. */
.kaart-qr>.rij>div{flex:1 1 22mm}
.kaart-qr>.rij>div:last-child{flex:2 1 46mm}
.paspoort{flex:0 0 27mm;text-align:center;border-left:0.4mm solid #000;padding-left:4mm}
.paspoort img{width:26mm;height:26mm;display:block;margin:0 auto 1mm}
.micro{font-size:7pt;color:#444;margin-top:0.4mm}
.voet{margin-top:6mm;padding-top:2mm;border-top:0.4mm solid #000;font-size:8pt;line-height:1.4}
.stickerpagina{page-break-before:always;padding-top:6mm}
.sticker{border:0.6mm dashed #777;border-radius:3mm;width:72mm;padding:0 0 4mm;
  text-align:center;margin:6mm auto 0;overflow:hidden}
.sticker .band{background:#F5C518;height:3mm}
.sticker .binnen{padding:3mm 4mm 0}
.sticker img{width:52mm;height:52mm;display:block;margin:2mm auto}
.sticker .merk{font-weight:700;font-size:11pt;letter-spacing:0.04em}
.sticker .adres{font-size:9pt;font-weight:600;margin-top:0.8mm}
.sticker .klein{font-size:7.5pt;color:#444;margin-top:1mm;line-height:1.35}
.stickerpagina .uitleg{max-width:120mm;font-size:9pt;line-height:1.45}
.stickerpagina .reserve{max-width:120mm;margin:8mm auto 0;padding:3mm;
  border:0.4mm solid #000;font-size:8.5pt;line-height:1.45}
</style></head><body>

<div class="kop">
  <div style="display:flex;gap:4mm;align-items:flex-start">
    <div>
      <div style="display:flex;align-items:center;gap:3mm;margin-bottom:2mm">
        ${MERKVLAK}
        <span class="merknaam">Kastscan</span>
      </div>
      <h1>Groepenoverzicht</h1>
      <div class="sub">${esc(adresRegel)}</div>
    </div>
  </div>
  <div class="rechts">
    ${o.bedrijf ? `<div><strong>${esc(o.bedrijf)}</strong></div>` : ""}
    <div>${esc(datum)}</div>
    <div>Kastscan${o.versie ? " " + esc(o.versie) : ""}</div>
  </div>
</div>

${secties}

<div class="voet">
  Dit overzicht is opgesteld met Kastscan. De indeling en de waarden zijn door de installateur bevestigd;
  hij blijft verantwoordelijk voor de juistheid. Waarden die uit een foto zijn voorgesteld en niet leesbaar
  waren, staan leeg — die zijn niet geraden.
  <br>Vermogens per fase zijn een <strong>indicatie</strong> op basis van de groepsfunctie, geen meetwaarde.
  Laadpaal, warmtepomp, kookgroep en thuisbatterij tellen op aansluitwaarde, met de
  gelijktijdigheidsfactor 0,6 uit NEN-EN-IEC 61439 erover zolang er geen gezamenlijke sturing is
  vastgelegd; de overige groepen tellen op gebruikswaarde. Waar die factor is toegepast staat de
  som eronder uitgeschreven.
  <br>Dit document is de samenvattende groepenverklaring bij deze verdeelinrichting (NEN 1010, rubriek 514).
  De labels op de kast zijn daarvan de gedistribueerde weergave en vervangen dit document niet.
</div>

${mkpStickerHtml(o.qrDataUrl, adresRegel, datum)}

</body></html>`;
}

// ─── DE UITKNIPBARE PASPOORTSTICKER ───────────────────────────────────────────
//
// Eigen pagina, gelijk aan hoe het opleverrapport van YourWkb dit doet. Bewust
// dezelfde vorm: een installateur die beide documenten kent, moet niet twee
// verschillende paspoortpagina's hoeven herkennen.
//
// De alinea over de RESERVEKOPIE is uit YourWkb overgenomen en is meer dan een
// geruststelling. Het paspoort draagt zijn gegevens ín de QR en niet op een
// server; dat is de privacykeuze, maar het betekent ook dat een verloren sticker
// een verloren paspoort is. Elk overzicht dat ooit is uitgedraaid bevat de stand
// van dat moment, en daarmee is het document zelf de back-up. Dat hoort erbij te
// staan, anders weet niemand het als het nodig is.
function mkpStickerHtml(qrDataUrl, adresRegel, datum) {
  if (!qrDataUrl) return "";
  const adres = adresRegel && adresRegel !== "—" ? adresRegel : "";
  return `
<div class="stickerpagina">
  <h2>Meterkastpaspoort — sticker voor op de kastdeur</h2>
  <p class="uitleg">
    Knip de sticker uit langs de stippellijn en plak hem aan de
    <strong>binnenzijde van de meterkastdeur</strong>. Elke volgende installateur scant de code met
    de telefooncamera en ziet direct wat er op deze kast hangt: de indeling, de faseverdeling en
    het logboek.
    <br><br>
    De gegevens zitten <strong>in de code zelf</strong> — er is geen centrale opslag. De sticker
    werkt daarom ook in een kelder zonder bereik, en er is nergens een database met adressen.
    Open standaard: meterkastpaspoort.nl.
  </p>

  <div class="sticker">
    <div class="band"></div>
    <div class="binnen">
      <div class="merk">⚡ METERKASTPASPOORT</div>
      ${adres ? `<div class="adres">${esc(adres)}</div>` : ""}
      <img src="${esc(qrDataUrl)}" alt="QR-code meterkastpaspoort">
      <div class="klein">Scan met je telefooncamera · bijgewerkt ${esc(datum)}</div>
      <div class="klein">meterkastpaspoort.nl — open standaard · gemaakt met Kastscan</div>
    </div>
  </div>

  <div class="reserve">
    <strong>Dit overzicht is tevens de reservekopie van het paspoort.</strong>
    Sticker kwijt, beschadigd of verloren gegaan — bijvoorbeeld door brand? Scan de code hierboven
    uit dit document en print hem opnieuw. Elk uitgedraaid overzicht bevat de paspoortstand van dat
    moment, dus de historie is zo vaak bewaard als er overzichten zijn.
  </div>

  <p class="uitleg" style="margin:6mm auto 0;text-align:center">
    Geen printer bij de hand? De code staat ook in de app — laat de bewoner hem fotograferen, of
    print hem op een labelprinter.
  </p>
</div>`;
}

// Een aardlekaanduiding: kleurstip + code, en desgewenst het aantal stippen dat
// ook op het label staat. De CODE is de drager; de kleur is de snelkoppeling.
function aardlekChip(code, metStippen, gelezenKleur) {
  if (!code) return '<span class="leeg">—</span>';
  // De kleur die in de kast hangt wint van onze vaste ladder: het label moet de
  // kast niet tegenspreken.
  const kleur = aardlekKleur(code, gelezenKleur);
  const m = String(code).match(/^A(\d)$/);
  const n = m ? Number(m[1]) : 0;
  const stippen = metStippen && n
    ? `<span class="stippen">${'<span class="stip" style="background:#000;width:1.4mm;height:1.4mm"></span>'.repeat(n)}</span>`
    : "";
  return `<span class="chip"><span class="stip" style="background:${kleur}"></span>${esc(code)}${stippen}</span>`;
}

// De fase krijgt een blokje in de fasekleur, maar het LABEL blijft de drager.
function faseChip(fase) {
  if (!fase) return '<span class="leeg">invullen</span>';
  if (fase === "L1+L2+L3") return `<span class="fase">${esc(fase)}</span>`;
  const kleur = FASE_KLEUR[fase];
  return `<span class="fase"><span class="faseblok" style="background:${kleur || "#fff"}"></span>${esc(fase)}</span>`;
}

// `opties` loopt door tot hier: de balans, de signalen en de samenvatting komen
// van de app en worden niet in dit bestand uitgerekend.
function verdelerSectie(v, qrDataUrl, opties = {}) {
  const posities = v.posities || [];
  const nrs = groepsnummers(posities);
  const h = v.hoofd || {};
  // DE FASEBALANS KOMT VAN DE APP. Kastscan rekent hem uit een kastbeeld, YourWkb
  // uit de groepen van een oplevering — en in beide gevallen is dat al gebeurd
  // vóór dit document gemaakt wordt. Hem hier nog eens uitrekenen zou een tweede
  // optelling van dezelfde kast zijn, en precies daarmee zijn de twee apps ooit
  // uit elkaar gelopen. Geen balans meegekregen? Dan geen fasekaarten.
  const bal = opties.balans || null;
  const sig = (opties.signalen || GEEN_SIGNALEN)(v) || [];

  const blokken = blokIndeling(posities);
  let alN = 0;
  const codeById = new Map();
  const kleurById = new Map();
  for (const b of blokken) {
    if (!b.aardlek) continue;
    codeById.set(b.aardlek.id, aardlekCode(++alN));
    if (b.aardlek.kleur) kleurById.set(b.aardlek.id, b.aardlek.kleur);
  }

  const rijen = sorteerPosities(posities)
    .filter((p) => isGroepsoort(p.soort))
    .map((p) => {
      const bev = formatBeveiliging(p.karakteristiek, p.In);
      const fase = isMeerpolig(p) ? "L1+L2+L3" : (p.fase || "");
      return `<tr>
        <td style="width:8mm;font-weight:700">${nrs.get(p.id)}</td>
        <td class="naam">${p.functieEigen ? esc(p.functie) : `<span class="leeg">${esc(p.functie)}</span>`}</td>
        <td style="width:16mm">${bev ? esc(bev) : '<span class="leeg">invullen</span>'}</td>
        <td style="width:20mm">${faseChip(fase)}</td>
        <td style="width:18mm">${aardlekChip(codeById.get(p.aardlekId), false, kleurById.get(p.aardlekId))}</td>
        <td style="width:14mm">${p.breedteModules}M</td>
        <td>${p.type ? esc((p.fabrikant ? p.fabrikant + " " : "") + p.type) : ""}</td>
      </tr>`;
    }).join("");

  const aardlekRijen = blokken.filter((b) => b.aardlek).map((b) => {
    const a = b.aardlek;
    const groepen = b.posities.filter((p) => isGroepsoort(p.soort));
    return `<tr>
      <td style="width:22mm">${aardlekChip(codeById.get(a.id), true, a.kleur)}</td>
      <td class="naam">${esc(a.functieEigen ? a.functie : a.standaardnaam)}</td>
      <td style="width:20mm">${a.IAn ? a.IAn + " mA" : '<span class="leeg">invullen</span>'}</td>
      <td style="width:18mm">${a.aardlektype ? "type " + esc(a.aardlektype) : '<span class="leeg">invullen</span>'}</td>
      <td style="width:16mm">${a.polen || "—"}-polig</td>
      <td>${groepen.length ? "groep " + groepen.map((p) => nrs.get(p.id)).join(", ") : "—"}</td>
    </tr>`;
  }).join("");

  const los = blokken.find((b) => !b.aardlek);

  const faseKaarten = (bal && bal.rijen ? bal.rijen : []).map((r) => {
    const pct = Math.max(0, Math.min(100, Math.round(r.bezet * 100)));
    // De balk is een grafiek, geen aanduiding op een kast: daar mag de
    // fasekleur zonder verwarring. Boven de capaciteit wordt hij rood, en dat
    // staat er ook in woorden bij.
    const kleur = r.niveau === "afwijking" ? "#C62828" : (FASE_KLEUR[r.fase] || "#000");
    return `<div>
      <div class="klein">${r.fase} · ${r.aantal} groep${r.aantal === 1 ? "" : "en"}</div>
      <div class="groot">${komma(r.belastingKw)} <span style="font-size:9pt;font-weight:500">van ${komma(r.capaciteitKw)} kW</span></div>
      <div class="balk"><i style="width:${pct}%;background:${kleur}"></i></div>
      <div style="font-size:8pt;margin-top:0.6mm">${pct}% bezet · indicatie${r.niveau === "afwijking" ? " · boven de capaciteit" : ""}</div>
      ${r.groot > 0 ? `<div style="font-size:7.5pt;color:#444;margin-top:0.4mm">
        ${komma(r.gewoon)} + ${komma(r.groot)} × ${komma(r.factor, 1)} kW</div>` : ""}
    </div>`;
  }).join("");

  return `
<div class="blok">
  <h2>${esc(v.naam || "Verdeelinrichting")}</h2>
  <div class="kaart${qrDataUrl ? " kaart-qr" : ""}">
    <div class="rij">
      <div>
        <div class="klein">Aansluiting</div>
        <div class="groot">${h.fasen === 3 ? "3" : "1"} × ${h.hoofdzekering || "—"} A</div>
      </div>
      <div>
        <div class="klein">Stelsel</div>
        <div class="groot">${esc(h.stelsel || "—")}</div>
      </div>
      <div>
        <div class="klein">Kamrail</div>
        <div class="groot">${h.kamMm2 ? h.kamMm2 + " mm²" : "—"}</div>
      </div>
      <div>
        <div class="klein">Omvang</div>
        <div class="groot" style="font-size:10pt">${esc((opties.samenvatting || GEEN_SAMENVATTING)(v))}</div>
      </div>
    </div>
    ${qrDataUrl ? `<div class="paspoort">
      <img src="${esc(qrDataUrl)}" alt="QR-code meterkastpaspoort">
      <div class="klein">Meterkastpaspoort</div>
      <div class="micro">scan met de camera</div>
    </div>` : ""}
  </div>

  <h3>Eindgroepen</h3>
  <table>
    <thead><tr><th>Nr</th><th>Naam</th><th>Beveiliging</th><th>Fase</th><th>Aardlek</th><th>Breedte</th><th>Type</th></tr></thead>
    <tbody>${rijen || '<tr><td colspan="7" class="leeg">Nog geen groepen.</td></tr>'}</tbody>
  </table>

  <h3>Aardlekschakelaars</h3>
  <table>
    <thead><tr><th>Code</th><th>Naam</th><th>IΔn</th><th>Type</th><th>Polen</th><th>Beveiligt</th></tr></thead>
    <tbody>${aardlekRijen || '<tr><td colspan="6" class="leeg">Nog geen aardlekschakelaars.</td></tr>'}</tbody>
  </table>
  ${(() => {
    // Aardlekautomaten hangen aan geen enkel blok omdat ze zichzelf beveiligen.
    // Ze hier onder "zonder aardlekschakelaar" zetten leest als een gebrek,
    // terwijl het de juiste uitkomst is — en dit vel is de groepenverklaring.
    const rcbo = (los ? los.posities : []).filter((p) => p.soort === "aardlekautomaat");
    const zonder = (los ? los.posities : []).filter((p) => p.soort !== "aardlekautomaat" && isGroepsoort(p.soort));
    const nrsVan = (lijst) => lijst.map((p) => nrs.get(p.id)).join(", ");
    return `${rcbo.length ? `<div style="margin-top:2mm;font-size:9pt"><strong>Eigen aardlekbeveiliging:</strong>
       groep ${nrsVan(rcbo)} — aardlekautomaten, elk met een eigen aanspreekstroom.</div>` : ""}
     ${zonder.length ? `<div style="margin-top:2mm;font-size:9pt"><strong>Zonder aardlekschakelaar:</strong>
       groep ${nrsVan(zonder)}.</div>` : ""}`;
  })()}

  <h3>Verdeling over de fasen — indicatie</h3>
  <div class="kaart"><div class="rij">${faseKaarten}</div></div>

  <div class="punten">
    <h3>Aandachtspunten</h3>
    <ul>${sig.map((s) => `<li class="${esc(s.niveau)}">${esc(s.tekst)}</li>`).join("")}</ul>
  </div>
</div>`;
}

// ─── DOCUMENT 2 · LABELVEL (A4, met schaarlijnen) ─────────────────────────────
//
// Labels van 30 × 50 mm op ware grootte, in een raster met doorlopende
// schaarlijnen tot in de paginamarge — zodat de schaar vanaf de papierrand kan
// beginnen en de snede recht blijft.
//
// Een label van 15 mm vult een halve cel; twee smalle labels delen dan één cel
// van 30 mm met een kniplijn ertussen op 15 mm.

export const VEL = {
  paginaBreedte: 210,
  paginaHoogte: 297,
  kolommen: 6,
  rijen: 5,
};

export function velIndeling() {
  const b = DRAGER.breedVolMm;
  const h = DRAGER.hoogteMm;
  const rasterB = VEL.kolommen * b;   // 180 mm
  const rasterH = VEL.rijen * h;      // 250 mm
  return {
    labelBreedte: b,
    labelHoogte: h,
    marginLinks: (VEL.paginaBreedte - rasterB) / 2,   // 15 mm
    marginBoven: (VEL.paginaHoogte - rasterH) / 2,    // 23,5 mm
    rasterB, rasterH,
    perVel: VEL.kolommen * VEL.rijen,                 // 30
  };
}

// Zet de labels in cellen van 30 mm. Twee opeenvolgende smalle labels delen een
// cel; een smal label dat geen partner heeft krijgt de linkerhelft.
export function verdeelInCellen(labels) {
  const cellen = [];
  let i = 0;
  const lijst = labels || [];
  while (i < lijst.length) {
    const l = lijst[i];
    if (l.breedteMm <= DRAGER.breedSmalMm) {
      const partner = lijst[i + 1] && lijst[i + 1].breedteMm <= DRAGER.breedSmalMm ? lijst[i + 1] : null;
      cellen.push({ links: l, rechts: partner, gedeeld: true });
      i += partner ? 2 : 1;
    } else {
      cellen.push({ vol: l, gedeeld: false });
      i += 1;
    }
  }
  return cellen;
}

export function labelvelHtml(labels, opties) {
  const o = opties || {};
  const g = velIndeling();
  const cellen = verdeelInCellen(labels);
  const paginas = [];
  for (let i = 0; i < cellen.length; i += g.perVel) {
    paginas.push(cellen.slice(i, i + g.perVel));
  }
  if (!paginas.length) paginas.push([]);

  const paginaHtml = paginas.map((cellenOpVel) => {
    const inhoud = cellenOpVel.map((cel, i) => {
      const kol = i % VEL.kolommen;
      const rij = Math.floor(i / VEL.kolommen);
      const x = g.marginLinks + kol * g.labelBreedte;
      const y = g.marginBoven + rij * g.labelHoogte;
      return `<g transform="translate(${x} ${y})">${celInhoud(cel, g)}</g>`;
    }).join("");

    // Schaarlijnen: doorlopend over het hele vel, tot in de marge.
    const lijnen = [];
    for (let k = 0; k <= VEL.kolommen; k++) {
      const x = g.marginLinks + k * g.labelBreedte;
      lijnen.push(`<line x1="${x}" y1="${Math.max(0, g.marginBoven - 6)}" x2="${x}" y2="${Math.min(VEL.paginaHoogte, g.marginBoven + g.rasterH + 6)}"/>`);
    }
    for (let k = 0; k <= VEL.rijen; k++) {
      const y = g.marginBoven + k * g.labelHoogte;
      lijnen.push(`<line x1="${Math.max(0, g.marginLinks - 6)}" y1="${y}" x2="${Math.min(VEL.paginaBreedte, g.marginLinks + g.rasterB + 6)}" y2="${y}"/>`);
    }

    return `<section class="vel">
      <svg xmlns="http://www.w3.org/2000/svg" width="${VEL.paginaBreedte}mm" height="${VEL.paginaHoogte}mm"
           viewBox="0 0 ${VEL.paginaBreedte} ${VEL.paginaHoogte}">
        <rect width="${VEL.paginaBreedte}" height="${VEL.paginaHoogte}" fill="#fff"/>
        <g class="schaar" stroke="#000" stroke-width="0.12" stroke-dasharray="2 1.6" opacity="0.55">${lijnen.join("")}</g>
        ${inhoud}
      </svg>
    </section>`;
  }).join("");

  return `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<title>Labelvel Kastscan</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&display=swap">
<style>
${BASIS_CSS}
@page{size:A4;margin:0}
.vel{width:${VEL.paginaBreedte}mm;height:${VEL.paginaHoogte}mm;page-break-after:always;overflow:hidden}
.vel:last-child{page-break-after:auto}
svg{display:block}
@media screen{
  body{background:#333;padding:8mm}
  .vel{background:#fff;margin:0 auto 8mm;box-shadow:0 2mm 8mm rgba(0,0,0,.5)}
}
</style></head><body>${paginaHtml}</body></html>`;
}

function celInhoud(cel, g) {
  if (!cel) return "";
  if (!cel.gedeeld) {
    return svgInhoud(cel.vol, { breedteMm: DRAGER.breedVolMm, hoogteMm: g.labelHoogte });
  }
  const helften = [];
  helften.push(`<g>${svgInhoud(cel.links, { breedteMm: DRAGER.breedSmalMm, hoogteMm: g.labelHoogte })}</g>`);
  if (cel.rechts) {
    helften.push(`<g transform="translate(${DRAGER.breedSmalMm} 0)">${svgInhoud(cel.rechts, { breedteMm: DRAGER.breedSmalMm, hoogteMm: g.labelHoogte })}</g>`);
  }
  // Kniplijn tussen twee smalle labels, met driehoekige aanzet boven en onder
  // zodat de schaar zichzelf uitlijnt (labelspec §6, deelvel).
  const x = DRAGER.breedSmalMm;
  const h = g.labelHoogte;
  helften.push(
    `<path d="M ${x} 0 L ${x} ${h}" stroke="#000" stroke-width="0.2" stroke-dasharray="1.2 1.2"/>` +
    `<path d="M ${x - 1.2} 0 L ${x + 1.2} 0 L ${x} 1.7 Z" fill="#000"/>` +
    `<path d="M ${x - 1.2} ${h} L ${x + 1.2} ${h} L ${x} ${h - 1.7} Z" fill="#000"/>`
  );
  return helften.join("");
}
