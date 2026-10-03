// Kastscan — Niimbot-driver (B1 / B21 / D11-familie) over Web Bluetooth.
// ⚠️ VERHUISD UIT KASTSCAN op 03-10-2026, ongewijzigd — inclusief de status
// hieronder. Die status is geen voetnoot: wie dit in een app zet zonder hem te
// lezen, belooft een gebruiker iets wat niet werkt.
//
// ─────────────────────────────────────────────────────────────────────────────
// STATUS — LEES DIT VOOR JE HIEROP VERTROUWT
//
// Niimbot publiceert geen protocolspecificatie. De opbouw hieronder volgt de
// openbaar gereverse-engineerde beschrijving (NiimBlue / niimprint) en is op
// deze machine NIET tegen een echte B1 aangelegd — er stond geen printer aan
// deze kant van de lijn. Alles wat met het protocol te maken heeft is dus
// "volgens de documentatie", niet "gemeten".
//
// Wat WEL vaststaat en getest is: de bitmap die deze driver verstuurt is exact
// 240 × 400 dots voor een label van 30 × 50 mm bij 203 dpi, 1-bit, harde
// drempel, zonder dithering en zonder enige herschaling (labelspec §2). Dat is
// het deel dat in v2.0 de symbolen liet wegvallen, en dat deel is hier dicht.
//
// ─────────────────────────────────────────────────────────────────────────────
// STAND VAN ZAKEN — ONAF. LEES DIT VOOR JE HIER TIJD IN STEEKT.
//
// Verbinden werkt. Aansturen werkt. Wat NIET werkt: de afdruk stopt na ongeveer
// 80 regels, dus na zo'n 10 mm van een label van 30 mm.
//
// In de veldtest van 01-09-2026 is dat systematisch nagelopen. Het stopt op
// exact dezelfde plek bij:
//   • een label met veel data en een label met weinig data
//   • drie verschillende verzendwijzen (klein met pauze, groot zonder pauze,
//     groot met bevestiging per pakket)
//   • met en zonder samenvoegen van gelijke regels
//   • de oorspronkelijke pakketvolgorde en die uit de gepubliceerde beschrijving
//
// Alles wat via deze driver de deur uit gaat is daarmee uitgesloten. Wat
// overblijft is de printer zelf: 80 regels is 10 mm, en dat wijst op de
// labeldetectie — de printer denkt dat het label op is. Dat is geen
// protocolkwestie maar een kalibratie van de printer op deze labelrol, en die
// zet je niet met bytes.
//
// EERSTE STAP VOOR WIE HIER VERDER GAAT, en niet in deze code:
//   1. Kalibreer de printer één keer op deze rol met de officiële Niimbot-app.
//      Daarmee leert hij de labellengte. Werkt het daarna wel, dan is deze
//      driver af en hoeft er niets aan te veranderen.
//   2. Werkt het dan nog niet, kijk dan naar SetLabelType. Er gaat nu een 1 uit
//      (gestanste labels met tussenruimte); 2 is zwartmerk, 3 doorlopend.
//      Dat is één byte en vier mogelijkheden.
//
// Wat WEL aantoonbaar goed is en niet meer onderzocht hoeft te worden:
//   • de rasterisatie: 240 × 400 dots, 1-bit, harde drempel, geen herschaling
//   • de regellengte: 48 bytes bij 384 dots — de diagonaal op het
//     kalibratielabel kwam kaarsrecht uit
//   • de kwartslag: de tekst staat goed ten opzichte van het label
//   • de breedte: de kop wordt over zijn volle breedte aangestuurd
//
// De volledige gang van zaken staat in docs/OPENSTAAND.md.
//
// De gepubliceerde beschrijving staat op https://printers.niim.blue/interfacing/
// en is nuttig als naslag, maar beschrijft niet exact deze firmware.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

import { NIIMBOT_B1_DPI } from "../render.js";

// ─── KENMERKEN ────────────────────────────────────────────────────────────────

// Niimbot-printers adverteren doorgaans deze service. De B1 en B21 gebruiken
// een schrijf- en een notificatiekenmerk binnen dezelfde service.
const SERVICE = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
// Fallbacks die in het veld zijn waargenomen bij andere modellen uit dezelfde
// familie. We proberen ze op volgorde.
const SERVICE_FALLBACKS = [
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];
const NAAM_PREFIXEN = ["B1", "B21", "B3", "D11", "D110", "Niimbot"];

// ─── PROTOCOL ─────────────────────────────────────────────────────────────────
//
// Pakket:  55 55 <type> <len> <data…> <checksum> AA AA
// checksum = XOR van type, len en alle databytes.

const OPCODE = {
  SET_LABEL_TYPE: 0x23,
  SET_DENSITY: 0x21,
  START_PRINT: 0x01,
  START_PAGE: 0x03,
  SET_DIMENSIONS: 0x13,
  SET_QUANTITY: 0x15,
  IMAGE_LINE: 0x85,
  IMAGE_LEEG: 0x84,
  END_PAGE: 0xe3,
  END_PRINT: 0xf3,
  PRINT_STATUS: 0xa3,
  HEARTBEAT: 0xdc,
};

export function maakPakket(opcode, data) {
  const d = data instanceof Uint8Array ? data : Uint8Array.from(data || []);
  const uit = new Uint8Array(7 + d.length);
  uit[0] = 0x55; uit[1] = 0x55;
  uit[2] = opcode;
  uit[3] = d.length;
  uit.set(d, 4);
  let checksum = opcode ^ d.length;
  for (const b of d) checksum ^= b;
  uit[4 + d.length] = checksum;
  uit[5 + d.length] = 0xaa;
  uit[6 + d.length] = 0xaa;
  return uit;
}

const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];

// Telt de zwarte bits in drie gelijke stukken van een rij. De printer gebruikt
// die telling om te bepalen hoeveel warmte de kop per zone nodig heeft; een
// verkeerde telling geeft lichte of vlekkerige afdrukken.
export function telZwartPerDerde(rij, breedteBits) {
  const tellingen = [0, 0, 0];
  for (let x = 0; x < breedteBits; x++) {
    if (rij[x >> 3] & (0x80 >> (x & 7))) {
      const derde = Math.min(2, Math.floor((x * 3) / breedteBits));
      tellingen[derde] += 1;
    }
  }
  return tellingen;
}

// Zet een monochrome bitmap (uit render.js › naarMonochroom) om in de reeks
// regelpakketten. Identieke opeenvolgende regels worden samengevoegd met de
// herhaalteller — dat scheelt bij een label dat grotendeels wit is fors aan
// bluetooth-verkeer, en de printer verwacht die vorm ook.
// `compressie` voegt identieke opeenvolgende regels samen tot één pakket met een
// herhaalteller, en stuurt witregels als een kort IMAGE_LEEG-pakket.
//
// DAT VELD IS DE HUIDIGE VERDACHTE. De afdruk stopt altijd op dezelfde plek,
// ongeacht hoeveel data er gaat, hoe snel we sturen of in welke volgorde. Dat
// is geen wedloop met de printkop maar iets dat structureel wordt weggelaten.
// Honoreert de printer de herhaalteller niet, dan wordt elke samengevoegde
// reeks één enkele regel en klapt het beeld in de hoogte in elkaar — op een
// vaste plek, ongeacht de snelheid.
//
// Zonder compressie gaat elke regel als eigen pakket met herhaal = 1. Er valt
// dan niets te collaberen. Trager, maar niets kan stilletjes verdwijnen.
export function bitmapNaarPakketten(mono, opties) {
  const o = opties || {};
  const { bits, bytesPerRij, breedte, hoogte } = mono;
  const pakketten = [];

  if (!o.compressie) {
    for (let y = 0; y < hoogte; y++) {
      const rij = bits.subarray(y * bytesPerRij, (y + 1) * bytesPerRij);
      const [a, b, c] = telZwartPerDerde(rij, breedte);
      const data = new Uint8Array(6 + bytesPerRij);
      data.set([...u16(y), a, b, c, 1], 0);
      data.set(rij, 6);
      pakketten.push(maakPakket(OPCODE.IMAGE_LINE, data));
    }
    return pakketten;
  }

  let y = 0;
  while (y < hoogte) {
    const rij = bits.subarray(y * bytesPerRij, (y + 1) * bytesPerRij);
    let leeg = true;
    for (const b of rij) if (b) { leeg = false; break; }

    // Hoeveel identieke regels volgen hierop?
    let herhaal = 1;
    while (y + herhaal < hoogte && herhaal < 255) {
      const volgende = bits.subarray((y + herhaal) * bytesPerRij, (y + herhaal + 1) * bytesPerRij);
      let gelijk = true;
      for (let i = 0; i < bytesPerRij; i++) if (rij[i] !== volgende[i]) { gelijk = false; break; }
      if (!gelijk) break;
      herhaal += 1;
    }

    if (leeg) {
      pakketten.push(maakPakket(OPCODE.IMAGE_LEEG, [...u16(y), herhaal]));
    } else {
      const [a, b, c] = telZwartPerDerde(rij, breedte);
      const data = new Uint8Array(6 + bytesPerRij);
      data.set([...u16(y), a, b, c, herhaal], 0);
      data.set(rij, 6);
      pakketten.push(maakPakket(OPCODE.IMAGE_LINE, data));
    }
    y += herhaal;
  }
  return pakketten;
}

// ─── DRIVER ───────────────────────────────────────────────────────────────────

let apparaat = null;
let schrijfKenmerk = null;
let notificatieKenmerk = null;

// ─── TERUGKOPPELING VAN DE PRINTER ────────────────────────────────────────────
//
// Alle eerdere pogingen waren OPEN LUS: sturen en hopen. Dat verklaart waarom
// geen enkele timing hielp — bij een handdruk helpt geen vaste vertraging.
//
// De protocolbeschrijving zegt dat de voortgang wordt opgehaald door PrintStatus
// te blijven sturen. De printer heeft dus iets te melden, en daar moet naar
// geluisterd worden.

// Binnengekomen antwoorden, op type. Elk antwoord overschrijft het vorige van
// hetzelfde type: we willen de laatste stand, geen geschiedenis.
const antwoorden = new Map();

function ontleedMelding(dv) {
  // 55 55 <type> <len> <data…> <crc> AA AA
  const b = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  if (b.length < 7 || b[0] !== 0x55 || b[1] !== 0x55) return null;
  const type = b[2];
  const len = b[3];
  if (b.length < 4 + len + 3) return null;
  return { type, data: b.slice(4, 4 + len) };
}

function opMelding(event) {
  const m = ontleedMelding(event.target.value);
  if (!m) return;
  antwoorden.set(m.type, m.data);
}

// Wacht tot er een antwoord van dit type binnenkomt, of tot de tijd om is.
async function wachtOpAntwoord(type, msMax) {
  const eind = Date.now() + (msMax || 1500);
  while (Date.now() < eind) {
    if (antwoorden.has(type)) return antwoorden.get(type);
    await wacht(15);
  }
  return null;
}

// Het antwoord op PrintStatus: page (u16 GROOT-eindig), print%, feed%, state…
//
// LET OP DE EERSTE TWEE BYTES. Ik heb hier byte 0 gelezen als "de pagina", maar
// dat is de HOGE helft van een 16-bits getal. Bij pagina 1 staat daar een nul,
// dus de voltooiing werd nooit herkend en liep elke afdruk de tijdslimiet uit —
// het label was al klaar en bleef dan hangen tot de wachttijd om was.
export function ontleedStatus(data) {
  if (!data || data.length < 2) return null;
  return {
    pagina: (data[0] << 8) | data[1],
    printPct: data.length > 2 ? data[2] : null,
    voerPct: data.length > 3 ? data[3] : null,
  };
}

// Vraagt de printer hoe ver hij is. Geeft null als hij niets terugzegt — dan
// valt de driver terug op open lus, want doorgaan is beter dan vastlopen.
async function vraagStatus(msMax) {
  if (!notificatieKenmerk) return null;
  antwoorden.delete(0xb3);
  try {
    await schrijf(maakPakket(OPCODE.PRINT_STATUS, [0x01]));
  } catch { return null; }
  const data = await wachtOpAntwoord(0xb3, msMax || 800);
  return data ? ontleedStatus(data) : null;
}

// BLE-pakketten moeten klein blijven: de standaard MTU laat ~20 bytes toe, en
// veel Niimbot-firmware raakt in de war van grotere schrijfacties. We knippen
// dus in stukken en wachten kort tussen de pakketten — zonder die pauze slaat
// de printer regels over bij een vol label.
// ─── DOORVOER IS DE BEPERKING ─────────────────────────────────────────────────
//
// De printkop begint te lopen zodra hij data heeft en wacht niet op de rest.
// Kun je hem niet bijhouden, dan schuift het label er blanco onderdoor.
//
// Dat verklaart ook waarom de labels er tijdens het op hol slaan wél compleet
// uitkwamen: de printer had de hele pagina toen al binnen en drukte diezelfde
// buffer telkens opnieuw af. Zodra er nog maar één label komt, wint de kop.
//
// Drie combinaties, waarvan twee geprobeerd en mislukt:
//
//   klein (20 B) + pauze 6 ms + zonder terugkoppeling  → te traag, stopt bij regel 80
//   heel pakket  + geen pauze  + zonder terugkoppeling → buffer loopt over, niets
//   heel pakket  + geen pauze  + MET terugkoppeling    → dit
//
// De derde is de enige met echte stroomregeling: writeValue lost pas op als het
// apparaat het pakket heeft bevestigd. Daarmee gaat het zo snel als de
// verbinding toelaat, zónder dat er iets overboord valt — precies wat hier
// nodig is. writeValueWithoutResponse lost al op zodra Chrome het in de rij
// heeft gezet, en dat zegt niets over wat de printer aankan.
const BROK = 20;
const PAUZE_MS = 6;

// Grootte waarboven een pakket alsnog in stukken gaat. Chrome onderhandelt op
// BLE doorgaans een MTU van 185 tot 512 bytes; een regelpakket is 61 bytes.
const MAX_PAKKET = 180;

// "bevestigd" = writeValue, met terugkoppeling van het apparaat (standaard).
// "snel"      = writeValueWithoutResponse in stukken, de oude stand.
let verzendwijze = "bevestigd";

// Harde bovengrens op het aantal exemplaren. Niet omdat iemand er meer zou
// willen, maar omdat een verkeerd gelezen veld anders de hele rol opmaakt.
const MAX_EXEMPLAREN = 5;

// Zodra dit op true staat, stopt de lopende opdracht bij het eerstvolgende
// label. Een BLE-schrijfactie is niet halverwege af te breken, dus dit is de
// enige plek waar een noodstop kan grijpen.
let afbreken = false;

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function schrijf(bytes) {
  if (!schrijfKenmerk) throw new Error("Geen verbinding met de labelprinter.");

  if (verzendwijze === "bevestigd" && bytes.length <= MAX_PAKKET) {
    try {
      // Eén pakket, één schrijfactie, en wachten op de bevestiging van het
      // apparaat. Geen kunstmatige pauze: de terugkoppeling ís de rem.
      await schrijfKenmerk.writeValue(bytes);
      return;
    } catch (err) {
      console.warn("[niimbot] bevestigde schrijfactie geweigerd, terug naar stukjes:",
        err && err.message);
      verzendwijze = "snel";
    }
  }

  for (let i = 0; i < bytes.length; i += BROK) {
    const stuk = bytes.slice(i, i + BROK);
    if (schrijfKenmerk.writeValueWithoutResponse) {
      await schrijfKenmerk.writeValueWithoutResponse(stuk);
    } else {
      await schrijfKenmerk.writeValue(stuk);
    }
    await wacht(PAUZE_MS);
  }
}

async function zoekKenmerken(server) {
  for (const uuid of [SERVICE, ...SERVICE_FALLBACKS]) {
    let service;
    try { service = await server.getPrimaryService(uuid); } catch { continue; }
    const kenmerken = await service.getCharacteristics();
    const schrijf = kenmerken.find((k) => k.properties.writeWithoutResponse) ||
                    kenmerken.find((k) => k.properties.write);
    const melden = kenmerken.find((k) => k.properties.notify);
    if (schrijf) return { schrijf, melden, serviceUuid: uuid };
  }
  return null;
}

export const niimbotB1 = {
  id: "niimbot-b1",
  naam: "Niimbot B1",
  dpi: NIIMBOT_B1_DPI,

  ondersteund() {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  },

  verbonden() {
    return !!(apparaat && apparaat.gatt && apparaat.gatt.connected && schrijfKenmerk);
  },

  // MOET vanuit een gebruikersgebaar worden aangeroepen — Web Bluetooth eist
  // dat, en een aanroep vanuit bijvoorbeeld een useEffect wordt geweigerd.
  //
  // `alleApparaten` toont ELK bluetooth-apparaat in plaats van alleen de namen
  // die wij verwachten. Dat is geen luiheid maar een uitweg: het protocol is
  // gereverse-engineerd en we weten niet zeker onder welke naam elke B1 zich
  // meldt. Zonder deze optie krijgt de gebruiker een lege lijst en kan hij geen
  // kant op — en dan lijkt het alsof de app stuk is terwijl alleen het filter
  // te streng stond.
  async verbind(opties) {
    const o = opties || {};
    if (!this.ondersteund()) throw new Error("Deze browser ondersteunt Web Bluetooth niet.");
    apparaat = await navigator.bluetooth.requestDevice(
      o.alleApparaten
        ? { acceptAllDevices: true, optionalServices: [SERVICE, ...SERVICE_FALLBACKS] }
        : {
            filters: NAAM_PREFIXEN.map((p) => ({ namePrefix: p })),
            optionalServices: [SERVICE, ...SERVICE_FALLBACKS],
          }
    );
    const server = await apparaat.gatt.connect();
    const kenmerken = await zoekKenmerken(server);
    if (!kenmerken) {
      // Welke services het apparaat WEL heeft, is precies wat we nodig hebben
      // om de UUID-lijst bovenin dit bestand aan te vullen. Naar de console,
      // niet naar de gebruiker.
      try {
        const gevonden = await server.getPrimaryServices();
        console.warn("[niimbot] geen bruikbaar schrijfkenmerk. Gevonden services:",
          gevonden.map((s) => s.uuid));
      } catch (err) {
        console.warn("[niimbot] services niet opvraagbaar:", err && err.message);
      }
      try { apparaat.gatt.disconnect(); } catch { /* al los */ }
      throw new Error(
        `"${apparaat.name || "Het apparaat"}" reageerde, maar gaf geen bruikbaar schrijfkenmerk. ` +
        `Zet de printer uit en weer aan. Blijft dit staan, kijk dan in de browserconsole: ` +
        `daar staat welke services hij wél heeft.`
      );
    }
    // De werkelijk geadverteerde naam is waardevol: daarmee kan het naamfilter
    // scherper of juist ruimer worden gezet.
    console.info("[niimbot] verbonden met:", apparaat.name, "via service:", kenmerken.serviceUuid);
    schrijfKenmerk = kenmerken.schrijf;
    notificatieKenmerk = kenmerken.melden || null;
    if (notificatieKenmerk) {
      try {
        notificatieKenmerk.addEventListener("characteristicvaluechanged", opMelding);
        await notificatieKenmerk.startNotifications();
      } catch (err) {
        console.warn("[niimbot] geen notificaties beschikbaar:", err && err.message);
        notificatieKenmerk = null;
      }
    }
    return { naam: apparaat.name || this.naam, service: kenmerken.serviceUuid };
  },

  async verbreek() {
    try {
      if (notificatieKenmerk) {
        notificatieKenmerk.removeEventListener("characteristicvaluechanged", opMelding);
      }
    } catch { /* al weg */ }
    antwoorden.clear();
    try { if (apparaat && apparaat.gatt && apparaat.gatt.connected) apparaat.gatt.disconnect(); }
    catch { /* al los */ }
    apparaat = null;
    schrijfKenmerk = null;
    notificatieKenmerk = null;
  },

  // `bitmaps` is een lijst uitkomsten van render.js › naarMonochroom, dus al op
  // exact de dot-afstand van deze printer gerasterd. Deze functie SCHAALT NIETS
  // en mag dat ook nooit gaan doen: dan is de hele keten voor niets.
  // Noodstop. Stuurt de afsluitpakketten en verbreekt de verbinding — dat
  // laatste is wat een op hol geslagen printer werkelijk stilzet, want zonder
  // verbinding krijgt hij geen regels meer.
  async stop() {
    afbreken = true;
    try {
      if (schrijfKenmerk) {
        await schrijf(maakPakket(OPCODE.END_PAGE, [0x01]));
        await schrijf(maakPakket(OPCODE.END_PRINT, [0x01]));
      }
    } catch { /* de printer luistert misschien al niet meer */ }
    await this.verbreek();
    return true;
  },

  async printBitmaps(bitmaps, opties) {
    const o = opties || {};
    afbreken = false;
    verzendwijze = o.verzendwijze === "snel" ? "snel" : "bevestigd";
    const begonnen = Date.now();
    const dichtheid = Math.min(5, Math.max(1, o.dichtheid || 3));
    // Labeltype 1 = gestanste labels met een gat/zwartmerk tussen de labels,
    // wat de rol van 50 × 30 mm is.
    const labelType = o.labelType || 1;
    if (!this.verbonden()) throw new Error("Geen verbinding met de labelprinter.");

    await schrijf(maakPakket(OPCODE.SET_DENSITY, [dichtheid]));
    await schrijf(maakPakket(OPCODE.SET_LABEL_TYPE, [labelType]));
    // De firmware heeft een moment nodig tussen het instellen en de eerste
    // opdracht. Zonder deze pauze kwam het eerste label blanco uit de printer
    // terwijl het tweede wel begon te drukken — de instelpakketten en het eerste
    // START_PRINT liepen dan door elkaar heen.
    await wacht(o.aanloopMs || 400);

    for (const [i, mono] of bitmaps.entries()) {
      if (afbreken) break;
      if (o.opVoortgang) o.opVoortgang({ nu: i + 1, totaal: bitmaps.length });

      await schrijf(maakPakket(OPCODE.START_PRINT, [0x01]));
      await schrijf(maakPakket(OPCODE.START_PAGE, [0x01]));
      // Hoogte eerst, dan breedte — in die volgorde verwacht de firmware ze.
      //
      // DE ENIGE WIJZIGING TEN OPZICHTE VAN DE BEVESTIGDE VOLGORDE: er staan nu
      // twee bytes achter met de OPLAGE. De eerste vier bytes zijn identiek aan
      // wat aantoonbaar goed printte; de gepubliceerde beschrijving noemt voor
      // de B1 zes bytes, waarvan de laatste twee het aantal exemplaren zijn.
      //
      // Dat is precies wat er ontbrak: de labels kwamen goed uit de printer,
      // maar hij bleef doorgaan omdat niemand hem had verteld hoeveel het er
      // moesten worden.
      const aantal = Math.min(Math.max(1, Math.round(o.aantal || 1)), MAX_EXEMPLAREN);
      await schrijf(maakPakket(OPCODE.SET_DIMENSIONS, [
        ...u16(mono.hoogte), ...u16(mono.breedte), ...u16(aantal),
      ]));
      await schrijf(maakPakket(OPCODE.SET_QUANTITY, [...u16(aantal)]));

      let verstuurd = 0;
      let sindsVraag = 0;
      let stilteNaVraag = 0;
      const compressie = o.compressie === undefined ? true : !!o.compressie;
      const pakketten = bitmapNaarPakketten(mono, { compressie });

      // Een dicht label — een foto, een diagonaal, veel fijne lijnen — levert
      // vrijwel geen samen te voegen regels op en stuurt dus veel meer data.
      // Daar moet vaker gepeild worden, anders loopt de buffer vol tussen twee
      // vragen door. Dat is wat het kalibratielabel mét diagonaal liet stranden
      // terwijl het eenvoudige patroon wel doorkwam.
      const perVraag = o.perRegels || (pakketten.length > 120 ? 8 : 16);

      for (const pakket of pakketten) {
        if (afbreken) break;
        await schrijf(pakket);
        verstuurd += pakket.length;
        sindsVraag += 1;

        // Om de zoveel regels vragen hoe ver de printer is. Dat is geen
        // beleefdheid maar STROOMREGELING: zolang hij antwoordt, verwerkt hij
        // ook. Zwijgt hij, dan is zijn buffer vol en geven we hem lucht in
        // plaats van door te blijven duwen.
        if (notificatieKenmerk && sindsVraag >= perVraag) {
          sindsVraag = 0;
          const st = await vraagStatus(o.statusMs || 400);
          if (st) {
            stilteNaVraag = 0;
          } else {
            // Zwijgen betekent doorgaans: buffer vol, even geen aandacht. Dan
            // is geduld het antwoord, niet opgeven — bij een dicht label is dit
            // precies het moment waarop de afdruk eerder afbrak. Wachttijd
            // verdubbelt per keer, tot een halve seconde.
            stilteNaVraag += 1;
            await wacht(Math.min(500, 80 * Math.pow(2, stilteNaVraag - 1)));
          }
          // Pas na tien keer zwijgen concluderen dat er geen meldkanaal is.
          // Eerder opgeven kostte precies de dichte labels.
          if (stilteNaVraag >= 10) {
            console.warn("[niimbot] printer antwoordt niet meer op statusvragen, verder zonder");
            notificatieKenmerk = null;
          }
        }
      }
      const sec = (Date.now() - begonnen) / 1000;
      console.info(`[niimbot] label ${i + 1}: ${verstuurd} bytes in ${sec.toFixed(2)} s`,
        `= ${Math.round(verstuurd / Math.max(sec, 0.001))} bytes/s (${verzendwijze})`);

      await schrijf(maakPakket(OPCODE.END_PAGE, [0x01]));

      // Wachten tot de pagina er WERKELIJK uit is voor we PrintEnd sturen.
      // De beschrijving noemt dit met zoveel woorden kritiek: komt PrintEnd
      // midden in de afdruk binnen, dan levert dat een half label op.
      //
      // Klaar is: het paginanummer staat op 1 of hoger. Voor de B1 gebeurt dat
      // op 100%.
      if (notificatieKenmerk) {
        const eind = Date.now() + (o.paginaMaxMs || 25000);
        while (Date.now() < eind && !afbreken) {
          const st = await vraagStatus(500);
          if (!st) break;
          if (o.opVoortgang && st.printPct !== null) {
            o.opVoortgang({ nu: i + 1, totaal: bitmaps.length, pct: st.printPct });
          }
          if (st.pagina >= 1) break;
          await wacht(80);
        }
      } else {
        await wacht(o.pauzeTussenLabels || 900);
      }
    }

    await schrijf(maakPakket(OPCODE.END_PRINT, [0x01]));
    return { gedrukt: bitmaps.length, afgebroken: afbreken };
  },
};
