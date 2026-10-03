// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de printerlaag en het Niimbot-protocol
//
// Overgenomen uit Kastscan bij de verhuizing op 03-10-2026. De tests gaan over de
// BYTES: het omhulsel, de regelkop, de compressie en het statusantwoord. Die zijn
// zonder printer te toetsen en ze zijn met een echt label gemeten — het commentaar
// bij de driver zegt waar de meting het van de documentatie won.
//
// ⚠️ WAT DEZE TESTS NIET BEWIJZEN: dat er een heel label uit komt. De afdruk stopt
// na ongeveer 80 regels (10 mm van 30 mm), en dat is sinds 01-09-2026 uitgezocht:
// alles aan deze kant van de lijn is uitgesloten. Zie de kop van printers/niimbot.js.
//
// Voer uit met:  node tests/test-printers.js
// ─────────────────────────────────────────────────────────────────────────────

import { maakPakket, telZwartPerDerde, bitmapNaarPakketten, ontleedStatus } from "../printers/niimbot.js";
import { BLE_WERKT, webBluetoothStatus, beschikbareDrivers, niimbotB1 } from "../printers/index.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

function maakProefBitmap(W, H, punten) {
  const bytesPerRij = Math.ceil(W / 8);
  const bits = new Uint8Array(bytesPerRij * H);
  for (const [x, y] of punten) bits[y * bytesPerRij + (x >> 3)] |= 0x80 >> (x & 7);
  return { bits, bytesPerRij, breedte: W, hoogte: H, zwart: punten.length, dekking: punten.length / (W * H) };
}

console.log("▶ CATEGORIE 1: het omhulsel van een pakket");
const pakket = maakPakket(0x21, [3]);
eq([pakket[0], pakket[1]], [0x55, 0x55], "1.1 een pakket begint met 55 55");
eq([pakket[pakket.length - 2], pakket[pakket.length - 1]], [0xaa, 0xaa], "1.2 en eindigt op AA AA");
eq(pakket[3], 1, "1.3 de lengte staat erin");
eq(pakket[5], 0x21 ^ 1 ^ 3, "1.4 de controlesom is de XOR van type, lengte en data");

console.log("▶ CATEGORIE 2: de regelkop, zoals hij goed printte");
eq(telZwartPerDerde(Uint8Array.from([0xff, 0x00, 0xf0]), 24), [8, 0, 4],
   "2.1 zwart wordt per derde deel van de regel geteld");
{
  const [pak] = bitmapNaarPakketten(maakProefBitmap(24, 1, [[0, 0], [1, 0], [2, 0]]));
  eq(pak[2], 0x85, "2.2 het is een regelpakket");
  eq([pak[4], pak[5]], [0, 0], "2.3 de rij-index is groot-eindig");
  eq([pak[6], pak[7], pak[8]], [3, 0, 0], "2.4 daarna de drie zwarttellingen");
  eq(pak[9], 1, "2.5 dan de herhaalteller");
  eq(pak[10], 0b11100000, "2.6 en dan pas de regelbytes");
}

console.log("▶ CATEGORIE 3: het statusantwoord");
// Deze tests bestaan omdat byte 0 ooit als "de pagina" werd gelezen, terwijl dat
// de hoge helft van een 16-bits getal is. Bij pagina 1 staat daar een nul, dus
// werd de voltooiing nooit herkend en bleef elk label hangen tot de tijdslimiet.
eq(ontleedStatus(Uint8Array.from([0, 1, 100, 100])).pagina, 1, "3.1 pagina 1 wordt herkend");
eq(ontleedStatus(Uint8Array.from([0, 1, 42, 7])).printPct, 42, "3.2 het printpercentage komt erachter");
eq(ontleedStatus(Uint8Array.from([0, 1, 42, 7])).voerPct, 7, "3.3 en het voerpercentage daarna");
eq(ontleedStatus(Uint8Array.from([1, 2, 0, 0])).pagina, 258, "3.4 een pagina boven 255 telt door");
eq(ontleedStatus(Uint8Array.from([0])), null, "3.5 een te kort antwoord levert niets op");

console.log("▶ CATEGORIE 4: compressie van witregels");
{
  const blad = maakProefBitmap(400, 240, [[10, 10], [20, 20]]);
  const zonder = bitmapNaarPakketten(blad, { compressie: false });
  eq(zonder.length, 240, "4.1 zonder compressie krijgt elke regel een eigen pakket");
  eq(zonder.every((p) => p[2] === 0x85), true, "4.2 en er zit geen witregel-pakket bij");
  eq(zonder.every((p) => p[9] === 1), true, "4.3 elke herhaalteller staat op 1");
  const met = bitmapNaarPakketten(blad, { compressie: true });
  eq(met.length < 40, true, `4.4 met compressie zijn het er veel minder (${met.length})`);
  eq(met.some((p) => p[2] === 0x84), true, "4.5 en verschijnen de korte witregel-pakketten");
}

console.log("▶ CATEGORIE 5: de laag is eerlijk over wat hij kan");
eq(BLE_WERKT, false,
   "5.1 ⚓ rechtstreeks printen staat op ONAF — de afdruk stopt na ±10 mm (veldtest 01-09-2026)");
eq(typeof niimbotB1.verbind, "function", "5.2 de driver kan verbinden");
eq(typeof niimbotB1.printBitmaps, "function", "5.3 en bitmaps versturen");
eq(typeof niimbotB1.ondersteund, "function", "5.4 en zeggen of de browser hem aankan");
{
  // Zonder navigator (Node) hoort dat een nette "nee" te zijn en geen fout: een
  // app die dit op de server rendert mag er niet op omvallen.
  const st = webBluetoothStatus();
  eq(st.ok, false, "5.5 op een server is er geen bluetooth");
  eq(st.reden, "server", "5.6 en dat zegt hij ook");
  eq(beschikbareDrivers().length, 0, "5.7 dus er is daar geen enkele driver beschikbaar");
}

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) { console.log("\n⚠️  MISLUKTE TESTS:"); failures.forEach((f) => console.log(f)); process.exit(1); }
