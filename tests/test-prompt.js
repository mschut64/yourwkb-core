// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de prompt en het schema spreken elkaar niet tegen
//
// De prompt bevat een uitgeschreven JSON-voorbeeld, en de API dwingt daarnaast
// een echt JSON-schema af. Die twee stonden los van elkaar en waren uit elkaar
// gelopen: het voorbeeld toonde `zekerheid` als object terwijl het schema een
// getal eist, `"blokken"` stond er twee keer, en `"smeltveiligheid"` ontbrak in
// de opsomming van soorten.
//
// Het model kreeg dus een voorbeeld dat de API zou afkeuren. Dat is geen
// schoonheidsfoutje: een voorbeeld is het zwaarstwegende deel van een prompt.
//
// Deze tests lezen het voorbeeld uit de prompt en leggen het naast het schema.
// Ze zijn er niet om te bewijzen dat het model goed leest — dat bewijst alleen
// een run over de referentieset — maar om te voorkomen dat de twee opnieuw uit
// elkaar lopen.
//
// Voer uit met:  node tests/test-prompt.js
// ─────────────────────────────────────────────────────────────────────────────

import { INSTRUCTIE, SCHEMA, INSTRUCTIE_SCHEMA, SCHEMA_TEKENING, PROMPTVERSIE } from "../prompt.js";

let passed = 0, failed = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

// Het voorbeeld is geen geldige JSON — er staat `1|3` en `getal` in, want het is
// bedoeld voor een lezer en niet voor een parser. Het wordt dus op sleutels
// gelezen, niet geparseerd.
function voorbeeldUit(instructie) {
  const i = instructie.indexOf("{\n  \"bruikbaar\"");
  return i < 0 ? "" : instructie.slice(i);
}
// De sleutels op het eerste niveau van het voorbeeld: regels met precies twee
// spaties inspringing en een sleutel in aanhalingstekens.
function bovensteSleutels(voorbeeld) {
  return [...voorbeeld.matchAll(/^ {2}"([a-zA-Z]+)":/gm)].map((m) => m[1]);
}

const VOORBEELD = voorbeeldUit(INSTRUCTIE);

console.log("▶ CATEGORIE 1: het voorbeeld bestaat en is te lezen");
eq(VOORBEELD.length > 200, true, "1.1 er staat een JSON-voorbeeld in de instructie");
eq(bovensteSleutels(VOORBEELD).length > 5, true, "1.2 met sleutels op het eerste niveau");

console.log("▶ CATEGORIE 2: geen sleutel twee keer");
{
  const sleutels = bovensteSleutels(VOORBEELD);
  const dubbel = sleutels.filter((k, i) => sleutels.indexOf(k) !== i);
  // "blokken" stond er twee keer, met verschillende inhoud. Welke van de twee
  // het model volgt is een gok, en een gok in een voorbeeld is het ergste soort.
  eq(dubbel, [], "2.1 elke sleutel staat er precies één keer");
}

console.log("▶ CATEGORIE 3: het voorbeeld past bij het afgedwongen schema");
{
  const sleutels = bovensteSleutels(VOORBEELD);
  const bekend = Object.keys(SCHEMA.properties || {});
  eq(sleutels.filter((k) => !bekend.includes(k)), [],
     "3.1 elke sleutel in het voorbeeld bestaat in het schema");
  eq((SCHEMA.required || []).filter((k) => !sleutels.includes(k)), [],
     "3.2 elk verplicht veld van het schema staat in het voorbeeld");
  // additionalProperties:false — een sleutel die het schema niet kent, wordt
  // door de API geweigerd, hoe goed hij ook bedoeld is.
  eq(SCHEMA.additionalProperties, false, "3.3 het schema laat niets extra's toe");
}

console.log("▶ CATEGORIE 4: de opsomming van soorten is in beide gelijk");
{
  const uitSchema = SCHEMA.properties.posities.items.properties.soort.enum;
  const regel = VOORBEELD.match(/"soort": ([^\n,]+(?:,[^\n]*)?)/);
  const uitVoorbeeld = [...(regel ? regel[0] : "").matchAll(/"([a-z]+)"/g)]
    .map((m) => m[1]).filter((w) => w !== "soort");
  eq(uitSchema.filter((s) => !uitVoorbeeld.includes(s)), [],
     "4.1 elke soort uit het schema staat ook in het voorbeeld");
  eq(uitVoorbeeld.filter((s) => !uitSchema.includes(s)), [],
     "4.2 en het voorbeeld verzint er geen bij");
}

console.log("▶ CATEGORIE 5: de zekerheid is één getal per positie");
{
  // Sinds promptversie B is dit één getal. Stond het voorbeeld nog op de oude
  // objectvorm, dan leverde het model die ook — en dan wiste `normaliseerPositie`
  // bij een lage waarde in één klap zeven velden. Zie normaliseren.js.
  eq(SCHEMA.properties.posities.items.properties.zekerheid.type, "number",
     "5.1 het schema eist een getal");
  eq(/"zekerheid": \{/.test(VOORBEELD), false, "5.2 en het voorbeeld toont er geen object");
  eq(/"zekerheid": [0-9]/.test(VOORBEELD), true, "5.3 maar een getal");
}

console.log("▶ CATEGORIE 6: de tekeningprompt kent dezelfde eisen");
{
  const v = voorbeeldUit(INSTRUCTIE_SCHEMA);
  eq(SCHEMA_TEKENING.additionalProperties, false, "6.1 ook hier niets extra's");
  eq((SCHEMA_TEKENING.required || []).includes("bruikbaar"), true,
     "6.2 en ook hier mag het model zeggen dat de foto niet bruikbaar is");
  if (v) {
    const sleutels = bovensteSleutels(v);
    const dubbel = sleutels.filter((k, i) => sleutels.indexOf(k) !== i);
    eq(dubbel, [], "6.3 geen dubbele sleutel in het tekeningvoorbeeld");
  } else { passed++; }
}

console.log("▶ CATEGORIE 7: de vrijgaveregel is af te dwingen");
{
  // De promptversie reist mee in elke correctie, zodat vergelijkPromptversies
  // twee versies naast elkaar kan leggen. Zonder datum in de naam is dat niet
  // te volgen.
  eq(/^kastscan-\d{4}-\d{2}-\d{2}-[A-Z]$/.test(PROMPTVERSIE), true,
     `7.1 de promptversie draagt een datum en een letter (${PROMPTVERSIE})`);
  eq(INSTRUCTIE.length > 5000, true, "7.2 de instructie is er nog in zijn geheel");
  eq(/aardlekautomaat/.test(INSTRUCTIE), true, "7.3 inclusief de regel over de aardlekautomaat");
  eq(/fase/i.test(INSTRUCTIE), true, "7.4 en die over de fase, die nooit uit een foto komt");
}

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) {
  console.log("\n⚠️  MISLUKTE TESTS:");
  failures.forEach((f) => console.log(f));
  process.exit(1);
}
