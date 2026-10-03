// Kastscan — printerlaag.
// ⚠️ VERHUISD UIT KASTSCAN op 03-10-2026, ongewijzigd. De driverlaag hoort in de
// motor omdat beide apps dezelfde labels maken en dus dezelfde printer aansturen.
// BROWSER-ONLY: Web Bluetooth.
//
// Bewust een DRIVERLAAG en geen directe Niimbot-koppeling (roadmap R5+):
// een generieke printinterface met merk-drivers erachter. Een tweede merk
// (Supvan, Brother, Phomemo) is dan een nieuw bestand in deze map en niet een
// ingreep in de app.
//
// De interface is met opzet smal. Een driver hoeft maar vier dingen te kunnen:
//
//   naam                 — merk en model, voor de knop en de foutmelding
//   ondersteund()        — kan deze browser dit überhaupt?
//   verbind()            — koppelen; MOET vanuit een gebruikersgebaar komen
//   printBitmaps(lijst)  — een reeks 1-bits bitmaps afdrukken
//   verbreek()
//
// De app levert BITMAPS aan, geen labelobjecten. De rasterisatie gebeurt in
// render.js op exact de dot-afstand van de printer; een driver mag nooit zelf
// schalen. Zie de kopregel van labels.js voor het waarom.

import { niimbotB1 } from "./niimbot.js";

// Ook los doorgeven: de app spreekt één driver direct aan zolang er één merk is.
export { niimbotB1 };

export const DRIVERS = [niimbotB1];

// RECHTSTREEKS PRINTEN WERKT — sinds 03-10-2026 bevestigd door Martin op een
// Niimbot B1 met labels van 30 × 50 mm: er komen hele labels uit.
//
// Dit stond hier maandenlang op `false` omdat de afdruk na ongeveer 10 mm stopte.
// De diagnose van 01-09-2026 bleek precies goed: het lag niet aan de driver maar
// aan de LABELDETECTIE van de printer, en de eerste stap die in de kop van
// niimbot.js stond — de printer één keer met de Niimbot-app op deze labelrol
// kalibreren — was de oplossing.
//
// ⚓ KALIBREREN IS EEN VOORWAARDE, GEEN TIP. Een printer die deze rol nog niet
// kent, stopt halverwege het label. Een app die dit aanbiedt hoort dat te zeggen
// vóór iemand een halve sticker op een kastdeur plakt.
export const BLE_WERKT = true;

export function beschikbareDrivers() {
  return DRIVERS.filter((d) => d.ondersteund());
}

// Web Bluetooth is niet overal beschikbaar. Dat is geen bug maar een feit van
// het platform, en de app hoort het als zodanig te melden in plaats van een
// knop te tonen die niets doet.
export function webBluetoothStatus() {
  // ⚠️ `navigator` BESTAAT TEGENWOORDIG OOK OP DE SERVER. Node 18+ heeft een
  // globale `navigator` met een userAgent, dus de oude controle hierop viel door
  // naar de browser-tak en leverde op een server het advies "gebruik Chrome of
  // Edge" op. `window` is wat een browser onderscheidt.
  if (typeof navigator === "undefined" || typeof window === "undefined")
    return { ok: false, reden: "server" };
  if (!navigator.bluetooth) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
    return {
      ok: false,
      reden: ios ? "ios" : "browser",
      // ⚠️ TWEE DINGEN DIE HIER ALLEBEI WAAR ZIJN, EN DIE ELKAAR LIJKEN TEGEN TE
      // SPREKEN. (1) Het ligt aan de BROWSER en niet aan het merk — op een Mac
      // doen Chrome en Edge dit gewoon, en op een iPhone bestaan browser-apps die
      // Web Bluetooth zélf meebrengen. (2) Chrome OP iOS kan het niet, en dat is
      // geen instelling die we aan kunnen zetten: Apple schrijft voor dat elke
      // browser op iPhone en iPad op WebKit draait, dus Chrome en Edge zijn daar
      // Safari met een ander jasje. Een service worker of een geïnstalleerde PWA
      // verandert daar niets aan — die levert geen motor, hij bewaart alleen
      // bestanden. De DMA staat andere motoren inmiddels toe, maar uitgerold is
      // er niets. (Nagezocht 03-10-2026.)
      //
      // ⚓ DAAROM NOEMT DEZE MELDING DE ECHTE WEG. "Een browser die het wel
      // ondersteunt" is op een iPhone een lege verwijzing — iemand installeert
      // dan Chrome en staat met dezelfde lege handen in de meterkast. Bluefy en
      // WebBLE zijn browser-apps die Web Bluetooth bovenop CoreBluetooth zelf
      // implementeren; daar werkt deze knop wél, en de app ziet dat vanzelf
      // omdat hij hierboven naar `navigator.bluetooth` kijkt en niet naar het
      // toestel.
      melding: ios
        ? "Op een iPhone of iPad draait élke browser op WebKit — ook Chrome en Edge — en die kent geen Web Bluetooth. Het kan wél met een browser-app die het zelf meebrengt (Bluefy, WebBLE), of vanaf een Mac of laptop in Chrome of Edge. Anders: print het A4-labelvel."
        : "Deze browser ondersteunt Web Bluetooth niet. Gebruik Chrome of Edge, of print het A4-labelvel.",
    };
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return { ok: false, reden: "onveilig", melding: "Bluetooth werkt alleen op een https-verbinding." };
  }
  return { ok: true };
}
