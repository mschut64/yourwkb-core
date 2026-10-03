// Kastscan — renderers voor het labelontwerp.
// ⚠️ VERHUISD UIT KASTSCAN op 03-10-2026, ongewijzigd. BROWSER-ONLY: hij rastert
// op een canvas. Daarom staat hij niet in de index van de motor maar wordt hij
// apart geïmporteerd (`yourwkb-core/render.js`), net als foto-client.js.
// Implementeert §2 en §9 van "Labelset YourWkb — revisie 3.0".
//
// Twee uitvoerpaden, één bron. Beide krijgen dezelfde tekenopdrachten in
// millimeters uit labels.js en rasteren die ZELF op hun eigen resolutie:
//
//   rasterLabel()  → bitmap op exact de dot-afstand van de labelprinter
//                    (30 × 50 mm bij 203 dpi = 240 × 400 px)
//   svgLabel()     → SVG met een viewBox in millimeters, voor het A4-vel,
//                    de PDF en de schermvoorbeelden
//
// §2 — DIT WAS DE OORZAAK VAN DE WEGGEVALLEN SYMBOLEN. Het probleem zat niet in
// de printer maar in de rasterisatie ervoor: als de printerapp een groter
// plaatje bilineair verkleint, worden zwarte lijnen grijs en gooit de
// zwart-witdrempel ze daarna weg. Tekst van 3,5 mm overleeft dat, een lijn van
// 0,55 mm niet. Daarom: zelf rasteren op de doelmaat, zelf naar 1-bit met een
// harde drempel, geen antialiasing en geen dithering.

import {
  DRAGER, FONT, BEELDMERKEN, TYPE, KAP_FACTOR, ontwerp, controleerPassend,
} from "./labels.js";

// ─── DOELMAAT ─────────────────────────────────────────────────────────────────

export const NIIMBOT_B1_DPI = 203;

export function dotsPerMmVanDpi(dpi) {
  return dpi / 25.4;
}

// 30 × 50 mm bij 203 dpi → 240 × 400 px. Deze functie is de enige plek waar die
// omrekening staat; de printerdrivers vragen hem op, ze rekenen niet zelf.
export function doelmaatPx(breedteMm, hoogteMm, dpi) {
  const dpmm = dotsPerMmVanDpi(dpi || NIIMBOT_B1_DPI);
  return {
    breedte: Math.round((breedteMm || DRAGER.breedVolMm) * dpmm),
    hoogte: Math.round((hoogteMm || DRAGER.hoogteMm) * dpmm),
    dotsPerMm: dpmm,
  };
}

// ─── LETTERTYPE ───────────────────────────────────────────────────────────────
//
// §9 — Barlow Condensed inbedden. Zonder deze wachtstap tekent de browser met
// een fallback en komt het label smaller of breder uit de printer dan op het
// scherm; dat is precies het soort verschil waar dit ontwerp vanaf wil.
export async function wachtOpLettertype() {
  if (typeof document === "undefined" || !document.fonts) return false;
  const varianten = ["500 12px", "600 12px", "700 12px"];
  await Promise.all(
    varianten.map((v) => document.fonts.load(`${v} ${FONT}`).catch(() => {}))
  ).catch(() => {});
  await document.fonts.ready.catch(() => {});
  try {
    return document.fonts.check(`700 12px ${FONT}`);
  } catch {
    return false;
  }
}

// ─── CANVASRENDERER ───────────────────────────────────────────────────────────

export function rasterLabel(label, opties) {
  const o = opties || {};
  const breedteMm = label.breedteMm || o.breedteMm || DRAGER.breedVolMm;
  const hoogteMm = o.hoogteMm || DRAGER.hoogteMm;
  const maat = doelmaatPx(breedteMm, hoogteMm, o.dpi || NIIMBOT_B1_DPI);
  const dpmm = maat.dotsPerMm;

  const canvas = o.canvas || document.createElement("canvas");
  canvas.width = maat.breedte;
  canvas.height = maat.hoogte;
  const c = canvas.getContext("2d", { willReadFrequently: true });
  c.imageSmoothingEnabled = false;

  // Wit blad, zwarte inkt. §1 — grijs bestaat niet; alles is 100% zwart.
  c.fillStyle = "#fff";
  c.fillRect(0, 0, maat.breedte, maat.hoogte);
  c.fillStyle = "#000";
  c.strokeStyle = "#000";
  c.lineCap = "butt";
  c.textBaseline = "alphabetic";

  const mm = (v) => v * dpmm;
  const meet = (t, korps) => {
    c.font = `600 ${mm(korps)}px ${FONT}`;
    return c.measureText(String(t)).width / dpmm;
  };

  // §3/§9 — geen auto-fit. Wat niet past is een invoerfout en wordt gemeld,
  // niet stilletjes gekrompen.
  const overloop = controleerPassend(label, meet);

  for (const op of ontwerp(label)) tekenOpCanvas(c, op, mm, dpmm);

  return { canvas, breedte: maat.breedte, hoogte: maat.hoogte, dotsPerMm: dpmm, overloop };
}

function tekenOpCanvas(c, op, mm, dpmm) {
  if (op.t === "lijn") {
    // §2 — lijnen op hele pixels. De halve-pixelverschuiving zorgt dat een lijn
    // van een oneven aantal dots op één rij blijft in plaats van over twee
    // rijen te worden uitgesmeerd (en dus half grijs te worden).
    c.lineWidth = Math.max(1, Math.round(mm(op.dikte)));
    const half = c.lineWidth % 2 === 1 ? 0.5 : 0;
    c.beginPath();
    c.moveTo(Math.round(mm(op.x1)), Math.round(mm(op.y1)) + half);
    c.lineTo(Math.round(mm(op.x2)), Math.round(mm(op.y2)) + half);
    c.stroke();
    return;
  }

  if (op.t === "vlak") {
    // Afronden op de RANDEN, niet op oorsprong-plus-breedte. Dat is het
    // verschil tussen round(x) + round(b) en round(x + b): bij het eerste kan
    // tussen twee aansluitende vlakken een dot wit overblijven of er juist een
    // dubbel geschreven worden. Bij tekst valt dat niet op, in een QR-raster
    // is het precies de naad die de code onleesbaar maakt.
    const x0 = Math.round(mm(op.x)), y0 = Math.round(mm(op.y));
    const x1 = Math.round(mm(op.x + op.b)), y1 = Math.round(mm(op.y + op.h));
    c.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    return;
  }

  if (op.t === "stip") {
    c.beginPath();
    c.arc(mm(op.x), mm(op.y), mm(op.straal), 0, Math.PI * 2);
    c.fill();
    return;
  }

  if (op.t === "hartteken") {
    // §6 — verticaal hartteken op 15 mm, met een driehoekige aanzet bovenaan
    // zodat het oog de naad tussen twee automaten meteen vindt.
    const x = Math.round(mm(op.x)) + 0.5;
    c.lineWidth = Math.max(1, Math.round(mm(0.35)));
    c.beginPath();
    c.moveTo(x, mm(op.y1));
    c.lineTo(x, mm(op.y2));
    c.stroke();
    const b = mm(1.1);
    c.beginPath();
    c.moveTo(x - b, mm(op.y1));
    c.lineTo(x + b, mm(op.y1));
    c.lineTo(x, mm(op.y1) + b * 1.3);
    c.closePath();
    c.fill();
    return;
  }

  if (op.t === "kniplijn") {
    // §6 — kniplijn met driehoekige aanzet boven en onder, zodat de schaar
    // zichzelf uitlijnt.
    const x = Math.round(mm(op.x)) + 0.5;
    c.lineWidth = Math.max(1, Math.round(mm(0.25)));
    c.setLineDash([mm(1.2), mm(1.2)]);
    c.beginPath();
    c.moveTo(x, mm(op.y1));
    c.lineTo(x, mm(op.y2));
    c.stroke();
    c.setLineDash([]);
    const b = mm(1.4);
    for (const [y, richting] of [[mm(op.y1), 1], [mm(op.y2), -1]]) {
      c.beginPath();
      c.moveTo(x - b, y);
      c.lineTo(x + b, y);
      c.lineTo(x, y + richting * b * 1.4);
      c.closePath();
      c.fill();
    }
    return;
  }

  if (op.t === "merk") {
    tekenBeeldmerk(c, op, mm);
    return;
  }

  if (op.t === "tekst") {
    const t = String(op.tekst == null ? "" : op.tekst);
    if (!t) return;
    // Geen auto-fit: de korpsgrootte staat vast (§3).
    const variant = op.tnum ? ' "tnum"' : "";
    c.font = `${op.gewicht} ${mm(op.korps)}px ${FONT}`;
    if (op.tnum && c.fontVariantCaps !== undefined) {
      // fontVariantNumeric wordt niet overal ondersteund; waar wel, zetten we
      // tabelcijfers aan voor de datakolommen (§3).
      try { c.fontVariantNumeric = "tabular-nums"; } catch { /* genegeerd */ }
    } else {
      try { c.fontVariantNumeric = "normal"; } catch { /* genegeerd */ }
    }
    // Letterruimte kent canvas niet als eigenschap, dus zetten we teken voor
    // teken. Dat is nodig omdat de inkt op thermisch papier uitvloeit en
    // letters anders in elkaar overlopen.
    if (op.spatiering) {
      const spatie = mm(op.spatiering);
      const tekens = [...t];
      let breed = 0;
      for (const teken of tekens) breed += c.measureText(teken).width + spatie;
      breed -= spatie;
      let x = mm(op.x);
      if (op.uitlijn === "midden") x -= breed / 2;
      else if (op.uitlijn === "rechts") x -= breed;
      for (const teken of tekens) {
        c.fillText(teken, x, mm(op.y));
        x += c.measureText(teken).width + spatie;
      }
      return;
    }

    c.textAlign = op.uitlijn === "midden" ? "center" : op.uitlijn === "rechts" ? "right" : "left";
    c.fillText(t, mm(op.x), mm(op.y));
    c.textAlign = "left";
    return;
  }
}

// §7 — massieve silhouetten, geen lijntekeningen. De uitsparingen worden met
// fill-rule "evenodd" uit het silhouet gesneden; op het smalle label vervallen
// ze (`massief`), want daar lopen ze dicht.
function tekenBeeldmerk(c, op, mm) {
  const merk = BEELDMERKEN[op.naam];
  if (!merk || typeof Path2D === "undefined") return;
  const s = mm(op.maat) / 100;
  c.save();
  c.translate(mm(op.x), mm(op.y));
  c.scale(s, s);
  // Op het smalle label een APART getekend silhouet, niet het brede silhouet
  // met de uitsparingen eruit — dat laatste levert een zwarte vlek op (§7).
  const d = op.massief
    ? (merk.smal || merk.buiten)
    : merk.buiten + (merk.uitsparingen || "");
  c.fill(new Path2D(d), "evenodd");
  if (!op.massief && merk.binnen) c.fill(new Path2D(merk.binnen));
  c.restore();
}

// ─── §2 · 1-BIT CONVERSIE MET HARDE DREMPEL ───────────────────────────────────
//
// Thermisch printen kent geen grijs. We nemen de luminantie en leggen er één
// drempel op. Bewust GEEN dithering (geen fotomodus): op tekst van 3,5 mm maakt
// een raster de letters vlekkerig in plaats van grijzer, en de thermokop maakt
// er alsnog zwart van.
export function naarMonochroom(canvas, drempel) {
  const c = canvas.getContext("2d", { willReadFrequently: true });
  const { width: b, height: h } = canvas;
  const beeld = c.getImageData(0, 0, b, h);
  const px = beeld.data;
  const grens = typeof drempel === "number" ? drempel : 176;

  // Eén bit per dot, per rij op hele bytes afgerond — het formaat dat vrijwel
  // elke labelprinter verwacht. Bit 1 = zwart.
  const bytesPerRij = Math.ceil(b / 8);
  const bits = new Uint8Array(bytesPerRij * h);
  let zwart = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < b; x++) {
      const i = (y * b + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (lum < grens) {
        bits[y * bytesPerRij + (x >> 3)] |= 0x80 >> (x & 7);
        zwart += 1;
      }
    }
  }
  return { bits, bytesPerRij, breedte: b, hoogte: h, zwart, dekking: zwart / (b * h) };
}

// ─── DRAAIEN ──────────────────────────────────────────────────────────────────
//
// De Niimbot B1 heeft zijn printkop over de 50 mm-zijde van de rol liggen: hij
// verwacht een bitmap van 400 dots breed en 240 hoog, terwijl ons ontwerp
// staand is (240 × 400). Het label moet dus een kwartslag gedraaid de deur uit.
//
// DIT IS GEEN SCHALING EN MAG DUS. Een draaiing over 90° is een EXACTE
// verwisseling van dots: elke dot uit de bron komt precies één keer terug in de
// uitvoer, op een andere plek. Er wordt niets geïnterpoleerd, niets gemiddeld
// en niets weggegooid.
//
// Daarom draaien we op BITNIVEAU en niet met een canvas-transformatie. Canvas
// zou de tekst opnieuw rasteren, en dan zijn we terug bij het probleem dat
// labelspec §2 beschrijft: grijs geworden lijnen die de drempel weggooit.
//
// kwartslagen: 1 = 90° met de klok mee, 2 = 180°, 3 = 90° tegen de klok in.
export function roteerMonochroom(mono, kwartslagen) {
  const n = ((Math.round(kwartslagen) % 4) + 4) % 4;
  if (n === 0) return mono;

  const { bits, bytesPerRij, breedte: W, hoogte: H } = mono;
  const gedraaid = n === 2;
  const nieuwB = gedraaid ? W : H;
  const nieuwH = gedraaid ? H : W;
  const nieuwBytes = Math.ceil(nieuwB / 8);
  const uit = new Uint8Array(nieuwBytes * nieuwH);
  let zwart = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!(bits[y * bytesPerRij + (x >> 3)] & (0x80 >> (x & 7)))) continue;
      let nx;
      let ny;
      if (n === 1) { nx = H - 1 - y; ny = x; }
      else if (n === 2) { nx = W - 1 - x; ny = H - 1 - y; }
      else { nx = y; ny = W - 1 - x; }
      uit[ny * nieuwBytes + (nx >> 3)] |= 0x80 >> (nx & 7);
      zwart += 1;
    }
  }

  return {
    bits: uit, bytesPerRij: nieuwBytes, breedte: nieuwB, hoogte: nieuwH,
    zwart, dekking: zwart / (nieuwB * nieuwH),
  };
}

// §1 — zwartdekking onder 15%. Boven die grens belast een label de thermokop,
// vlekt het uit bij snelheid en wordt het grauw. Dit is een controle achteraf op
// de echte bitmap, niet een schatting vooraf.
export const MAX_DEKKING = 0.15;

export function controleerDekking(mono) {
  if (!mono) return { ok: true, dekking: 0 };
  return {
    ok: mono.dekking <= MAX_DEKKING,
    dekking: mono.dekking,
    melding: mono.dekking > MAX_DEKKING
      ? `Zwartdekking ${Math.round(mono.dekking * 100)}% ligt boven de grens van ${Math.round(MAX_DEKKING * 100)}%.`
      : "",
  };
}

// ─── KALIBRATIELABEL ──────────────────────────────────────────────────────────
//
// Eén label dat de vier open vragen over een onbekende printer tegelijk
// beantwoordt. Bedoeld om NIET te hoeven gokken op andermans labelrol.
//
// Wat je eraan afleest:
//
//   1. HOEVEEL DOTS IS DE KOP BREED. Langs de bovenrand staat om de 5 mm een
//      streep met een getal. Het laatste getal dat nog op het label staat, is de
//      werkelijke breedte. Onze aanname staat er als een kader omheen: valt dat
//      kader half weg, dan is de kop smaller dan we denken.
//
//   2. KLOPT HET AANTAL BYTES PER REGEL. De diagonaal van hoek tot hoek is het
//      scherpste signaal dat er is. Leest de printer een andere regellengte dan
//      wij sturen, dan schuift elke regel een beetje op en wordt de diagonaal
//      een trap of een boog. Een rechte diagonaal betekent dat de uitlijning
//      klopt — en dan pas is de rest te vertrouwen.
//
//   3. HOEVEEL REGELS PAST ER OP EEN LABEL. Langs de linkerrand dezelfde
//      schaalverdeling, maar dan in de looprichting van het papier.
//
//   4. WELKE KANT IS BOVEN. Linksboven staat een massief blok; die hoort
//      linksboven op het label te liggen als je de tekst kunt lezen.
export function kalibratieBitmap(opties) {
  const o = opties || {};
  const breedte = o.breedte || 400;
  const hoogte = o.hoogte || 240;
  const dpmm = dotsPerMmVanDpi(o.dpi || NIIMBOT_B1_DPI);

  const canvas = o.canvas || document.createElement("canvas");
  canvas.width = breedte;
  canvas.height = hoogte;
  const c = canvas.getContext("2d", { willReadFrequently: true });
  c.imageSmoothingEnabled = false;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, breedte, hoogte);
  c.fillStyle = "#000";
  c.strokeStyle = "#000";

  // Kader op de uiterste dots. Valt een zijde weg, dan is het label of de kop
  // kleiner dan we aannemen.
  c.lineWidth = 2;
  c.strokeRect(1, 1, breedte - 2, hoogte - 2);

  // MASSIEVE BALK OVER DE VOLLE BREEDTE. Dit is de duidelijkste meting die er
  // is: waar de balk ophoudt, houdt de printer op. Geen getallen nodig, geen
  // interpretatie — je ziet in één oogopslag hoeveel van de verstuurde breedte
  // werkelijk op het label komt. Idem de balk langs de linkerrand voor de
  // looprichting.
  c.fillRect(0, 0, breedte, 8);
  c.fillRect(0, 0, 8, hoogte);
  c.fillRect(0, hoogte - 8, breedte, 8);
  c.fillRect(breedte - 8, 0, 8, hoogte);

  // Hoekblokken, elk een eigen maat zodat je ze uit elkaar houdt en dus weet
  // welke hoek je voor je hebt: linksboven het grootst, met de klok mee kleiner.
  c.fillRect(12, 12, 30, 30);
  c.fillRect(breedte - 34, 12, 22, 22);
  c.fillRect(breedte - 26, hoogte - 26, 14, 14);
  c.fillRect(12, hoogte - 22, 10, 10);

  // Diagonaal — het scherpste signaal voor een verkeerde regellengte.
  //
  // MAAR: hij maakt élke regel uniek en zet daarmee de regelcompressie volledig
  // buiten werking. Dat maakt dit label het zwaarste geval dat er bestaat, veel
  // zwaarder dan een echt label met tekst en witruimte. Staat de doorvoer ter
  // discussie, zet hem dan uit: komt het label dán wél vol, dan is het de
  // snelheid en niet de aansturing.
  if (!o.eenvoudig) {
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(breedte, hoogte);
    c.stroke();
  } else {
    // Vervanger die wél comprimeert: drie massieve banden op vaste hoogtes.
    // Ontbreekt de onderste band, dan is de afdruk halverwege gestopt.
    c.fillRect(40, Math.round(hoogte * 0.45), breedte - 80, 10);
    c.fillRect(40, Math.round(hoogte * 0.65), breedte - 80, 10);
    c.fillRect(40, Math.round(hoogte * 0.85), breedte - 80, 10);
  }

  c.font = `bold 15px ${FONT}`;
  c.textBaseline = "top";

  // Schaal langs de bovenrand, in dots én millimeters.
  for (let x = 0; x < breedte; x += Math.round(5 * dpmm)) {
    const lang = x % Math.round(10 * dpmm) === 0;
    c.fillRect(x, 8, 2, lang ? 18 : 10);
    if (lang && x > 0) c.fillText(String(x), x + 4, 28);
  }
  // Schaal langs de linkerrand, in de looprichting van het papier.
  for (let y = 0; y < hoogte; y += Math.round(5 * dpmm)) {
    const lang = y % Math.round(10 * dpmm) === 0;
    c.fillRect(8, y, lang ? 18 : 10, 2);
    if (lang && y > 0) c.fillText(String(y), 30, y + 3);
  }

  c.font = `bold 22px ${FONT}`;
  c.fillText(`${breedte} x ${hoogte}`, 52, 52);
  c.font = `bold 15px ${FONT}`;
  c.fillText("KASTSCAN KALIBRATIE", 52, 80);
  c.fillText("balk stopt = kop stopt", 52, 100);
  c.fillText(o.eenvoudig ? "3 banden zichtbaar = volledig" : "diagonaal recht = uitlijning ok", 52, 120);

  return { canvas, breedte, hoogte };
}

// ─── SVG-RENDERER (A4-vel, PDF, schermvoorbeeld) ──────────────────────────────
//
// viewBox in millimeters, dus de PDF- en printuitvoer is vectorieel en op ware
// grootte. Een browser die dit afdrukt zet 30 mm ook echt op 30 mm papier.

export function svgLabel(label, opties) {
  const o = opties || {};
  const breedteMm = label.breedteMm || o.breedteMm || DRAGER.breedVolMm;
  const hoogteMm = o.hoogteMm || DRAGER.hoogteMm;
  const maat = o.zonderMaat ? "" : ` width="${breedteMm}mm" height="${hoogteMm}mm"`;
  return `<svg xmlns="http://www.w3.org/2000/svg"${maat} viewBox="0 0 ${breedteMm} ${hoogteMm}">${svgInhoud(label, o)}</svg>`;
}

// De binnenkant zonder <svg>-omhulsel, zodat het A4-vel er meerdere naast
// elkaar kan zetten binnen één document.
// De aardlekkleur op het A4-vel. Alleen hier: het thermische pad blijft strikt
// 1-bit zwart, want de printkop kan niet anders en labelspec §1 is daar streng
// over. Op een gewone kleurenprinter is die beperking er niet, en dan helpt een
// kleurband: met vijftien stickers op tafel zie je in één blik welke bij welke
// aardlekschakelaar horen.
//
// KLEUR IS HIER NOOIT DE ENIGE DRAGER. De code en de stippen staan er gewoon op;
// wie zwart-wit afdrukt mist niets. En de risicoregel blijft zwart — een
// gekleurd kader zou een veiligheidsteken suggereren, en dat is deze set
// nadrukkelijk niet (§8).
// Dezelfde tinten als de kleurband die de fabrikant al op de afdekplaat zet:
// lichtblauw, lichtgroen, lichtoranje. Zo kleurt de sticker van A1 hetzelfde als
// de band waar A1 al op staat. Spiegelt AARDLEK_KLEUR in model.js; een test
// bewaakt dat ze gelijk blijven.
// Spiegelt KLEURNAMEN in model.js; de test bewaakt dat ze gelijk blijven.
const KLEURNAMEN_SVG = {
  blauw: "#8FC4E8", lichtblauw: "#8FC4E8",
  groen: "#A3D39C", lichtgroen: "#A3D39C",
  oranje: "#F3BE8A", lichtoranje: "#F3BE8A",
  geel: "#F0DC8C", lichtgeel: "#F0DC8C",
  paars: "#C3A9D8", lila: "#C3A9D8",
  rood: "#E9A0A0", roze: "#F0BCD0", bruin: "#C9A98A",
  grijs: "#CFD4D8", wit: "#F2F2F2", zwart: "#9AA0A6",
};

const AARDLEK_KLEUR_SVG = {
  A1: "#8FC4E8", A2: "#A3D39C", A3: "#F3BE8A", A4: "#F0DC8C", EIGEN: "#C3A9D8",
};
export const KLEURBAND_MM = 2.4;

export function svgInhoud(label, opties) {
  const o = opties || {};
  const breedteMm = label.breedteMm || o.breedteMm || DRAGER.breedVolMm;
  const hoogteMm = o.hoogteMm || DRAGER.hoogteMm;
  // Elk label knipt zijn eigen inhoud af. Zonder deze clip loopt een te lange
  // naam op het A4-vel dwars over het buurlabel heen — en dan is de OVERLOOP
  // niet meer te zien als fout, maar ziet het vel er alleen rommelig uit.
  // De overloopmelding blijft de eigenlijke oplossing; dit is de vangrail.
  const id = `k${Math.abs(hashTekst(JSON.stringify(label.sleutel || label.titel || "") + breedteMm)).toString(36)}`;
  const uit = [
    `<defs><clipPath id="${id}"><rect x="0" y="0" width="${breedteMm}" height="${hoogteMm}"/></clipPath></defs>`,
    `<rect x="0" y="0" width="${breedteMm}" height="${hoogteMm}" fill="#fff"/>`,
  ];

  // Kleurband langs de onderrand, onder de voetlijn: daar staat niets, dus hij
  // duwt geen tekst weg en de vaste maatvoering blijft ongemoeid.
  // De gelezen bandkleur wint van de vaste ladder — anders krijgt een kast met
  // de band in een andere volgorde stickers die de kast tegenspreken. Alleen op
  // A4: de thermische printer drukt zwart-wit, daar bestaat deze band niet.
  const bandKleur = o.kleur === false
    ? null
    : (KLEURNAMEN_SVG[String(label.bandKleur || "").trim().toLowerCase()]
       || AARDLEK_KLEUR_SVG[String(label.aardlek || "").toUpperCase()]);
  if (bandKleur) {
    uit.push(`<rect x="0" y="${hoogteMm - KLEURBAND_MM}" width="${breedteMm}" height="${KLEURBAND_MM}" fill="${bandKleur}"/>`);
  }

  uit.push(`<g clip-path="url(#${id})">`);
  for (const op of ontwerp(label)) uit.push(svgOpdracht(op));
  uit.push("</g>");
  return uit.join("");
}

// Korte, stabiele hash voor een unieke clipPath-id per label. Math.random() zou
// bij elke render een andere id geven en de SVG onnodig laten verschillen.
function hashTekst(t) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return h;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function svgOpdracht(op) {
  if (op.t === "lijn") {
    return `<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}" stroke="#000" stroke-width="${op.dikte}"/>`;
  }
  if (op.t === "vlak") {
    return `<rect x="${op.x}" y="${op.y}" width="${op.b}" height="${op.h}" fill="#000"/>`;
  }
  if (op.t === "stip") {
    return `<circle cx="${op.x}" cy="${op.y}" r="${op.straal}" fill="#000"/>`;
  }
  if (op.t === "hartteken") {
    const b = 1.1;
    return `<path d="M ${op.x} ${op.y1} L ${op.x} ${op.y2}" stroke="#000" stroke-width="0.35"/>` +
           `<path d="M ${op.x - b} ${op.y1} L ${op.x + b} ${op.y1} L ${op.x} ${op.y1 + b * 1.3} Z" fill="#000"/>`;
  }
  if (op.t === "kniplijn") {
    const b = 1.4;
    return `<path d="M ${op.x} ${op.y1} L ${op.x} ${op.y2}" stroke="#000" stroke-width="0.25" stroke-dasharray="1.2 1.2"/>` +
           `<path d="M ${op.x - b} ${op.y1} L ${op.x + b} ${op.y1} L ${op.x} ${op.y1 + b * 1.4} Z" fill="#000"/>` +
           `<path d="M ${op.x - b} ${op.y2} L ${op.x + b} ${op.y2} L ${op.x} ${op.y2 - b * 1.4} Z" fill="#000"/>`;
  }
  if (op.t === "merk") {
    const merk = BEELDMERKEN[op.naam];
    if (!merk) return "";
    const s = op.maat / 100;
    const d = op.massief ? (merk.smal || merk.buiten) : merk.buiten + (merk.uitsparingen || "");
    const binnen = !op.massief && merk.binnen ? `<path d="${merk.binnen}" fill="#000"/>` : "";
    return `<g transform="translate(${op.x} ${op.y}) scale(${s})"><path d="${d}" fill="#000" fill-rule="evenodd"/>${binnen}</g>`;
  }
  if (op.t === "tekst") {
    const t = String(op.tekst == null ? "" : op.tekst);
    if (!t) return "";
    const anker = op.uitlijn === "midden" ? "middle" : op.uitlijn === "rechts" ? "end" : "start";
    const num = op.tnum ? ` font-variant-numeric="tabular-nums"` : "";
    return `<text x="${op.x}" y="${op.y}" font-family="${esc(FONT)}" font-size="${op.korps}" font-weight="${op.gewicht}" fill="#000" text-anchor="${anker}"${num}>${esc(t)}</text>`;
  }
  return "";
}
