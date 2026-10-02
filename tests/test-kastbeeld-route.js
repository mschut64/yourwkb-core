// ─────────────────────────────────────────────────────────────────────────────
// yourwkb-core — de analyseroute: klopt hij nog als geheel?
//
// Deze module is niet te importeren zonder de Anthropic-SDK en een sleutel, dus
// wat hier gebeurt is statisch: wordt er iets aangeroepen dat nergens vandaan
// komt, en staan de grenzen nog waar ze om een gemeten reden horen te staan.
//
// Aanleiding: op 30-09-2026 werd bij het verhuizen van de prompt per ongeluk
// `sleutelProbleem()` meegeknipt. Geen test raakte die route en `next build`
// ziet een ongedefinieerde verwijzing niet — de fout kwam pas boven water toen
// productie op elke scan een lege 500 gaf. Nu de route zelf verhuisd is, moet
// die controle meeverhuizen.
//
// Voer uit met:  node tests/test-kastbeeld-route.js
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(label, voorwaarde, detail) {
  if (voorwaarde) passed++;
  else { failed++; failures.push(`❌ ${label}${detail ? " — " + detail : ""}`); }
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; failures.push(`❌ ${label}\n     verwacht: ${e}\n     kreeg:    ${a}`); }
}

const ruw = readFileSync(new URL("../kastbeeld-route.js", import.meta.url), "utf8");
// De grenzen staan in foto-client.js: client en server moeten dezelfde getallen
// aanhouden, anders weegt de browser anders dan de rand van de hosting.
const client = readFileSync(new URL("../foto-client.js", import.meta.url), "utf8");

// Commentaar en tekst eruit: Nederlandse zinnen zitten vol haakjes
// ("server-side (audit BEV-02)"), en die zijn geen aanroep.
const src = ruw
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
  .replace(/`(?:[^`\\]|\\.)*`/g, "``")
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''");

console.log("▶ CATEGORIE 1: elke aanroep heeft een herkomst");
{
  const GLOBAAL = new Set([
    "console","process","Response","Request","Headers","FormData","Blob","File","Buffer",
    "URL","URLSearchParams","AbortSignal","AbortController","fetch","JSON","Math","Date",
    "Object","Array","String","Number","Boolean","Set","Map","Promise","Error","TypeError",
    "RangeError","Symbol","BigInt","parseInt","parseFloat","isNaN","isFinite",
    "encodeURIComponent","decodeURIComponent","structuredClone","setTimeout","clearTimeout",
    "atob","btoa","if","for","while","switch","catch","return","typeof","function","await","new",
  ]);
  const eigen = new Set();
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) eigen.add(m[1]);
  for (const m of src.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)) eigen.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g))
    for (const stuk of m[1].split(",")) eigen.add(stuk.trim().split(":").pop().trim());
  for (const m of src.matchAll(/\(\s*\{([^}]*)\}\s*(?:=[^)]*)?\)/g))
    for (const stuk of m[1].split(",")) {
      const n = stuk.trim().split("=")[0].split(":").pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) eigen.add(n);
    }
  for (const m of src.matchAll(/(?:function[^(]*|=>\s*)?\(([^)]*)\)\s*(?:=>|\{)/g))
    for (const stuk of m[1].split(",")) {
      const n = stuk.trim().split("=")[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) eigen.add(n);
    }
  const geimporteerd = new Set();
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g))
    for (const stuk of m[1].split(",")) {
      const n = stuk.trim().split(/\s+as\s+/).pop().trim();
      if (n) geimporteerd.add(n);
    }
  for (const m of src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from/g)) geimporteerd.add(m[1]);

  const aangeroepen = [...src.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[2]);
  const zwevend = [...new Set(aangeroepen)]
    .filter((n) => !eigen.has(n) && !geimporteerd.has(n) && !GLOBAAL.has(n));
  ok("1.1 geen zwevende aanroepen", zwevend.length === 0, zwevend.join(", "));
}

console.log("▶ CATEGORIE 2: de bewaking komt van de app, en wordt ook echt gebruikt");
ok("2.1 origineOk wordt aangeroepen", /origineOk\(request\)/.test(src));
ok("2.2 rateLimit wordt aangeroepen", /rateLimit\(request/.test(src));
ok("2.3 de app geeft zijn eigen emmernaam mee", /naam:\s*logNaam/.test(src));
ok("2.4 fout\\(\\) komt van de app, niet van hier", !/^export function fout/m.test(src));
// Een route die de guards zelf zou importeren, zou de origin-lijst van de ene
// app op de andere toepassen. Ze horen binnen te komen als parameter.
ok("2.5 de guards komen binnen als parameter",
   /maakKastbeeldRoute\(\{\s*rateLimit,\s*origineOk,\s*fout/.test(ruw));
ok("2.6 en worden nergens geïmporteerd", !/import[^\n]*guard/.test(src));

console.log("▶ CATEGORIE 3: de prompt blijft server-side en komt uit één bron");
ok("3.1 instructie en schema komen uit prompt.js", /from\s*"\.\/prompt\.js"/.test(ruw));
ok("3.2 PROMPTVERSIE reist mee in het antwoord", /promptversie:\s*PROMPTVERSIE/.test(src));
ok("3.3 de instructie staat in `system`, niet in het bericht", /system:\s*isSchema\s*\?\s*INSTRUCTIE_SCHEMA\s*:\s*INSTRUCTIE/.test(src));
ok("3.4 het schema wordt afgedwongen", /format:\s*\{\s*type:\s*"json_schema"/.test(ruw));

console.log("▶ CATEGORIE 4: de grenzen staan waar ze om een gemeten reden staan");
{
  // 4,5 MB is de muur van de hostingrand; onze eigen grens ligt eronder zodat
  // de gebruiker onze nette melding krijgt en niet hun kale 413.
  const verzoek = Number((client.match(/MAX_VERZOEK_BYTES\s*=\s*([\d_]+)/) || [])[1]?.replace(/_/g, ""));
  const foto = Number((client.match(/MAX_FOTO_BYTES\s*=\s*([\d_]+)/) || [])[1]?.replace(/_/g, ""));
  ok("4.1 het verzoek blijft onder de 4,5 MB van de rand", verzoek > 0 && verzoek < 4_500_000, String(verzoek));
  ok("4.2 één foto blijft onder het verzoek", foto > 0 && foto < verzoek, `${foto} vs ${verzoek}`);

  // Wij breken eerder af dan de hostinglaag: anders komt er een kale 504 terug
  // waar geen JSON in zit.
  const budget = Number((ruw.match(/ANALYSE_BUDGET_MS\s*=\s*([\d_]+)/) || [])[1]?.replace(/_/g, ""));
  const duur = Number((ruw.match(/MAX_DURATION\s*=\s*(\d+)/) || [])[1]);
  ok("4.3 het eigen budget ligt onder de maxDuration", budget / 1000 < duur, `${budget / 1000}s vs ${duur}s`);
  eq(duur, 60, "4.4 zestig seconden, de grens van het hobbyplan");

  ok("4.5 de route schaalt geen enkele foto terug", !/resize|scale|compress/i.test(src));
  // De OPEN foto gaat op volle resolutie; alleen de dichte mag terug. Staat die
  // regel hier niet meer, dan is de opdruk op de modules onleesbaar geworden.
  ok("4.6 alleen de dichte foto heeft een maximum", /DICHT_MAX_PX/.test(client) && !/OPEN_MAX_PX/.test(client));
  ok("4.7 een te kleine foto wordt geweigerd", /OPEN_MIN_PX/.test(client));
  ok("4.8 HEIC wordt alleen omgezet als het moet", /hei\[cf\]/.test(client));
}

console.log("▶ CATEGORIE 5: de foutafhandeling die een avond zoeken heeft gekost");
ok("5.1 een afgebroken analyse wordt herkend aan alle drie de gedaanten",
   /APIUserAbortError/.test(ruw) && /"TimeoutError"/.test(ruw) && /"AbortError"/.test(ruw));
ok("5.2 een ontbrekende of foute sleutel wordt vooraf gemeld", /sleutelProbleem\(\)/.test(src));
ok("5.3 de melding verschilt per omgeving", /process\.env\.VERCEL/.test(src));
ok("5.4 de diagnose gaat mee in het antwoord, ook bij een fout", (ruw.match(/diagnose/g) || []).length >= 6);
ok("5.5 een weigering van het model wordt apart gemeld", /stop_reason\s*===\s*"refusal"/.test(ruw));

console.log("▶ CATEGORIE 6: de twee modi delen alles behalve de instructie");
ok("6.1 modus kast en modus schema", /modus\s*===\s*"schema"/.test(ruw));
ok("6.2 beide schema's worden doorgegeven", /SCHEMA_TEKENING\s*:\s*SCHEMA/.test(src));
ok("6.3 alleen jpeg, png en webp", /image\/jpeg/.test(client) && /image\/webp/.test(client));
ok("6.4 image\\/jpg wordt gerepareerd", /image\/jpg/.test(ruw));

console.log("▶ CATEGORIE 9: de SDK is optioneel hier, maar verplicht in de app");
{
  // De storing van 02-10-2026: YourWkb had @anthropic-ai/sdk niet in package.json,
  // Next liet de import als external staan, de build bleef groen en élke scan gaf
  // een 500 met "s is not a constructor". De route hoort dat zélf te zien en te
  // zeggen wat je moet doen.
  ok("9.1 de route controleert of de SDK er is", src.includes("function sdkProbleem("));
  ok("9.2 en geeft een 503 met uitleg in plaats van een 500 zonder",
     /sdkProbleem\(\)[\s\S]{0,260}fout\(503/.test(src));
  ok("9.3 met de oplossing erbij: zet hem in package.json",
     ruw.includes("package.json") && ruw.includes("@anthropic-ai/sdk"));
  // Te laat controleren is niet controleren: dit moet vóór `new Anthropic()`.
  ok("9.4 en die controle staat vóór `new Anthropic()`",
     src.indexOf("sdkProbleem") < src.indexOf("new Anthropic()"));
  // De controle zelf mag niets aanroepen dat er niet is.
  ok("9.5 de controle gebruikt alleen typeof, geen aanroep van de SDK",
     /typeof Anthropic !== "function"/.test(ruw));
}

console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTAAT: ${passed} geslaagd · ${failed} mislukt · ${passed + failed} totaal`);
console.log("═══════════════════════════════════════════════");
if (failures.length) {
  console.log("\n⚠️  MISLUKTE TESTS:");
  failures.forEach((f) => console.log(f));
  process.exit(1);
}
