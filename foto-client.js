// ─────────────────────────────────────────────────────────────────────────────
// Een kastfoto klaarmaken om te versturen — de browserkant
//
// Geen normlogica, wel een reeks lessen die in het veld zijn betaald. Ze stonden
// in Kastscan; nu YourWkb dezelfde kast op dezelfde manier leest, horen ze op één
// plek. Wat hier bewaakt wordt:
//
// 1. DE OPEN FOTO WORDT NIET TERUGGESCHAALD. Daar moet de opdruk op de modules
//    leesbaar blijven; verkleinen maakt die onleesbaar en het model leest dan
//    met evenveel stelligheid iets verkeerds. Alleen de DICHTE foto gaat terug
//    naar 1200 px, want die hoeft alleen de kleurband en het groepsnummer te
//    tonen.
// 2. EEN TE KLEINE FOTO WORDT GEWEIGERD. Een doorgestuurde kopie uit WhatsApp is
//    een thumbnail; op 700 px telt het model de kast verkeerd. Een geweigerde
//    foto is beter dan een fout antwoord.
// 3. HEIC WORDT OMGEZET, MAAR ALLEEN DAN. Een iPhone bewaart standaard in HEIC en
//    dat formaat gaat de analyse niet in. Safari kan het wél tonen, dus laat de
//    browser het decoderen en zet het via een doek om naar jpeg. Wie al jpeg
//    aanlevert houdt zijn originele bytes — opnieuw coderen kost kwaliteit, en
//    juist op de open foto is de opdruk het fijne kenmerk.
// 4. RUWE BYTES, GEEN BASE64. Een data-URI is een derde groter dan de foto zelf,
//    en de hostingrand weigert alles boven 4.500.000 bytes vóórdat de route
//    draait — een kale 413 zonder JSON. Een gewone iPhone-opname viel daardoor
//    om terwijl dezelfde foto lokaal werkte.
//
// Dit bestand raakt de DOM (Image, canvas, Blob) en hoort dus alleen in een
// browser. Het is geen React, en dat blijft zo.
// ─────────────────────────────────────────────────────────────────────────────

// De grens van de hostingrand ligt op 4.500.000 bytes. De onze ligt eronder,
// zodat onze eigen leesbare melding vóór hun kale 413 komt.
export const MAX_VERZOEK_BYTES = 4_300_000;
export const MAX_FOTO_BYTES = 4_200_000;
export const TOEGESTANE_TYPEN = ["image/jpeg", "image/png", "image/webp"];

// De dichte foto mag terug naar 1200 px; onder de 1000 px telt het model de kast
// verkeerd. De open foto heeft geen maximum — zie les 1 hierboven.
export const DICHT_MAX_PX = 1200;
export const DICHT_MIN_PX = 1000;
export const OPEN_MIN_PX = 1200;

// data-URI → Blob, zonder de omweg via een string van base64.
export function naarBlob(dataUrl) {
  const komma = dataUrl.indexOf(",");
  const type = dataUrl.slice(5, dataUrl.indexOf(";"));
  const ruw = atob(dataUrl.slice(komma + 1));
  const bytes = new Uint8Array(ruw.length);
  for (let i = 0; i < ruw.length; i++) bytes[i] = ruw.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function verkleinIndienNodig(dataUrl, maxBreedte) {
  const beeld = await new Promise((klaar, mis) => {
    const b = new Image();
    b.onload = () => klaar(b);
    b.onerror = mis;
    b.src = dataUrl;
  });
  if (beeld.naturalWidth <= maxBreedte) return dataUrl;
  const schaal = maxBreedte / beeld.naturalWidth;
  const doek = document.createElement("canvas");
  doek.width = Math.round(beeld.naturalWidth * schaal);
  doek.height = Math.round(beeld.naturalHeight * schaal);
  const c = doek.getContext("2d");
  c.imageSmoothingQuality = "high";
  c.drawImage(beeld, 0, 0, doek.width, doek.height);
  return doek.toDataURL("image/jpeg", 0.85);
}

/**
 * Leest een gekozen bestand en levert het klaar voor de analyse.
 *
 * @param bestand      het File-object uit een <input type="file">
 * @param minBreedte   ondergrens in pixels; daaronder volgt een weigering
 * @returns  { dataUrl, breedte, hoogte }
 * @throws   Error met een melding die zegt WAT de gebruiker moet doen
 */
export function bereidFotoVoor(bestand, { minBreedte = OPEN_MIN_PX } = {}) {
  return new Promise((klaar, mis) => {
    const lezer = new FileReader();
    lezer.onerror = () => mis(new Error("Het bestand kon niet worden gelezen."));
    lezer.onload = () => {
      const beeld = new Image();
      beeld.onerror = () => {
        // Vrijwel altijd HEIC op een browser die dat niet kan tonen. Zeg wat de
        // gebruiker moet doen in plaats van "kon niet lezen".
        mis(new Error(/hei[cf]/i.test(bestand.type || bestand.name || "")
          ? "Deze iPhone-foto (HEIC) kan deze browser niet openen. Zet in Instellingen › Camera › " +
            "Formaten op 'Meest compatibel', of open de app in Safari."
          : "Deze afbeelding kon niet worden geopend. Kies een gewone foto (jpg, png of heic)."));
      };
      beeld.onload = () => {
        if (beeld.naturalWidth < minBreedte) {
          mis(new Error(
            `Deze foto is ${beeld.naturalWidth} px breed. Er is minstens ${minBreedte} px nodig om de ` +
            `opdruk op de modules te kunnen lezen — stuur de originele foto, geen doorgestuurde kopie.`));
          return;
        }
        let dataUrl = String(lezer.result);
        if (!/^data:image\/(jpeg|jpg|png|webp);/i.test(dataUrl)) {
          const doek = document.createElement("canvas");
          doek.width = beeld.naturalWidth;
          doek.height = beeld.naturalHeight;
          doek.getContext("2d").drawImage(beeld, 0, 0);
          dataUrl = doek.toDataURL("image/jpeg", 0.92);
        }
        klaar({ dataUrl, breedte: beeld.naturalWidth, hoogte: beeld.naturalHeight });
      };
      beeld.src = String(lezer.result);
    };
    lezer.readAsDataURL(bestand);
  });
}

// Weegt wat er verstuurd gaat worden en zegt het als het niet past. De melding
// noemt de ondergrens erbij, want "maak hem kleiner" is hier gevaarlijk advies.
export function verzoekTeGroot(blobs) {
  const totaal = blobs.reduce((n, b) => n + ((b && b.size) || 0), 0);
  if (totaal <= MAX_VERZOEK_BYTES) return "";
  return `De foto's zijn samen ${(totaal / 1_048_576).toFixed(1)} MB en daarmee te groot om te versturen ` +
         `(de grens ligt op ${(MAX_VERZOEK_BYTES / 1_048_576).toFixed(1)} MB). Maak de foto opnieuw met een ` +
         `iets lagere resolutie-instelling — maar schaal hem niet terug tot onder de ${OPEN_MIN_PX} px, ` +
         `want dan is de opdruk op de modules niet meer leesbaar.`;
}
