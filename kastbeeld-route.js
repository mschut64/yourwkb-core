// ─────────────────────────────────────────────────────────────────────────────
// De kast lezen uit een foto — de serverkant
//
// Dit is de route die Kastscan sinds de eerste versie draait, met alle lessen die
// er in het veld in zijn gaan zitten: de 4,5 MB-muur van de hostingrand, de
// zestig seconden die een functie op het hobbyplan krijgt, een afbreking die als
// `APIUserAbortError` binnenkomt in plaats van als timeout, en foutmeldingen die
// zeggen wát je moet doen in plaats van dát het niet lukte.
//
// Hij staat hier omdat YourWkb dezelfde kast op dezelfde manier moet lezen
// (besluit Martin): één instructie, één model, één set foutmeldingen. Een tweede
// kopie zou al die lessen verdubbelen en daarna uit elkaar laten lopen — precies
// wat deze motor moet voorkomen.
//
// ⚠️ APART IMPORTEREN, net als `prompt.js`: dit bestand hoort nooit in een
// browserbundel (audit BEV-02, de prompt blijft server-side) en het trekt de
// Anthropic-SDK mee. Gebruik:
//
//   import { maakKastbeeldRoute, MAX_VERZOEK_BYTES } from "yourwkb-core/kastbeeld-route.js";
//   import { rateLimit, origineOk, fout } from "../_lib/guard";
//   export const POST = maakKastbeeldRoute({ rateLimit, origineOk, fout, logNaam: "kastbeeld" });
//   export const maxDuration = 60;
//
// De bewaking blijft van de app: elke app heeft zijn eigen origin-lijst en zijn
// eigen emmers. Alleen de analyse is gedeeld.
//
// PROMPTVERSIE — spec › Versiebeheer en de vrijgaveregel: het versienummer gaat
// mee in elke `correctie`-regel, zodat achteraf zichtbaar is of een wijziging
// heeft geholpen. GEEN PROMPTWIJZIGING LIVE ZONDER EEN VERSE RUN OVER DE
// REFERENTIESET. Loopt het aantal correcties per foto op na een wijziging, dan
// is de wijziging fout, hoe aannemelijk de redenering ook was.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import {
  PROMPTVERSIE, SCHEMA, INSTRUCTIE, SCHEMA_TEKENING, INSTRUCTIE_SCHEMA,
} from "./prompt.js";
// De grenzen staan in foto-client.js, want de BROWSER moet dezelfde getallen
// aanhouden: weegt de client anders dan de server, dan krijgt de gebruiker een
// kale 413 van de hostingrand in plaats van onze eigen melding.
import { MAX_VERZOEK_BYTES, MAX_FOTO_BYTES, TOEGESTANE_TYPEN as TYPENLIJST } from "./foto-client.js";

export { MAX_VERZOEK_BYTES };

export { PROMPTVERSIE };

// Claude Opus 5. Het vorige nummer (claude-sonnet-4-6) kwam uit YourWkb mee en
// is inmiddels een generatie oud.
//
// KOSTEN — dit is de duurste stap in de flow, dus het hoort in de businesscase.
// Opus 5 rekent $5 per miljoen invoertokens en $25 per miljoen uitvoertokens;
// twee foto's plus deze instructie komen op ruwweg een dubbeltje per scan.
// Sonnet 5 ($2/$10) doet dezelfde taak voor ongeveer 40% daarvan.
//
// Die afweging hoort bij Martin en niet bij mij: één veld dat verkeerd wordt
// gelezen kost meer aan vertrouwen dan een paar cent aan tokens, en het
// acceptatiecriterium is "nul foutieve waarden met hoge zekerheid". Omzetten is
// hieronder één regel — en dan de referentieset opnieuw draaien, want een
// modelwissel valt onder dezelfde vrijgaveregel als een promptwijziging.
const MODEL = "claude-opus-5";

// Hoeveel moeite het model in het lezen steekt.
//
// Stond op "high" en is 02-09-2026 op "medium" gezet — niet omdat dat beter
// leest, maar omdat "high" op twee foto's langer duurt dan de zestig seconden
// die een functie op het hobbyplan krijgt. Dat is een gedwongen ruil, geen
// verbetering: zet dit terug op "high" zodra er een plan is dat 300 seconden
// toestaat. Terugzetten kan zonder codewijziging met KASTSCAN_EFFORT=high.
//
// LET OP: dit valt onder dezelfde vrijgaveregel als een promptwijziging — het
// verandert wat het model leest, dus het vraagt een verse run over de
// referentieset voordat je erop vertrouwt.
const EFFORT = process.env.KASTSCAN_EFFORT || "medium";

// Iets onder de maxDuration hieronder, zodat wij afbreken en niet de
// hostinglaag: onze afbreking levert een leesbare melding op, die van hen een
// kale 504 zonder JSON.
const ANALYSE_BUDGET_MS = 55_000;

// ─── DE FOTO'S KOMEN BINNEN ALS RUWE BYTES ────────────────────────────────────
//
// Niet als base64 in JSON, en dat is geen stijlkeuze maar de oplossing van een
// gemeten muur. Vercel weigert elk verzoek boven 4.500.000 bytes aan de rand,
// vóór deze functie draait: de client kreeg een kale 413 terug waar geen JSON
// in zat, en zag dus "de analyse lukte niet" zonder enige aanwijzing. Lokaal
// bestaat die grens niet, en daarom werkte precies dezelfde foto op de laptop
// wél. (Gemeten 02-09-2026: 4,0 MiB komt door, 4,3 MiB niet.)
//
// Base64 maakt een foto een derde groter. Een iPhone-opname van 3,5 MB wordt zo
// 4,7 MB en valt om, terwijl dezelfde foto als ruwe bytes ruim binnen de grens
// blijft. Multipart kost dus niets aan kwaliteit en levert een derde ruimte op
// — en dat is precies wat de spec beschermt: de open foto mag NIET worden
// teruggeschaald, want dan is de opdruk op de modules niet meer leesbaar.
//
// De grens hieronder ligt bewust onder die van Vercel, zodat onze eigen nette
// melding vóór hun kale 413 komt.
const TOEGESTANE_TYPEN = new Set(TYPENLIJST);

// Een sleutel die niet met sk-ant- begint of veel te kort is, is geen sleutel.
// Dat vooraf zeggen scheelt een rondje naar de API en een foutmelding waar
// niets aan af te lezen is — in het veld stond er een keer letterlijk de
// voorbeeldwaarde "sk-ant-..." in .env.local, en dat leverde alleen een
// generieke 502 op.
// En een tweede vraag die vóór de analyse hoort: IS DE SDK ER WEL? Hij staat hier
// als optionele peerDependency — terecht, want een app die alleen rekent heeft hem
// niet nodig. Maar een app die deze route gebruikt moet hem zelf in package.json
// zetten, en als dat vergeten wordt laat Next.js de import als "external" staan:
// de build blijft groen en `new Anthropic()` wordt `new undefined()`. Dat gaf op
// 02-10-2026 in YourWkb een 500 op élke scan, met `TypeError: s is not a
// constructor` als enige aanwijzing. Eén regel hier maakt daar een melding van die
// zegt wat je moet doen.
function sdkProbleem() {
  if (typeof Anthropic !== "function") {
    return "het pakket @anthropic-ai/sdk ontbreekt in deze app. Het is een optionele " +
           "peerDependency van yourwkb-core, dus npm installeert het niet mee: zet " +
           '"@anthropic-ai/sdk" in package.json en installeer opnieuw';
  }
  return "";
}

function sleutelProbleem() {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) return "de sleutel ANTHROPIC_API_KEY ontbreekt";
  if (!k.startsWith("sk-ant-") || k.length < 40) {
    return `de sleutel ANTHROPIC_API_KEY klopt niet — hij is ${k.length} tekens lang, terwijl ` +
           "een echte Anthropic-sleutel met sk-ant- begint en ruim honderd tekens telt. " +
           "Mogelijk staat er nog een voorbeeldwaarde in";
  }
  return "";
}

async function leesFoto(bestand, naam, diagnose) {
  if (!bestand || typeof bestand.arrayBuffer !== "function") return null;
  const type = bestand.type === "image/jpg" ? "image/jpeg" : bestand.type;
  if (!TOEGESTANE_TYPEN.has(type)) throw new Error(`${naam}: alleen jpeg, png of webp`);
  if (bestand.size > MAX_FOTO_BYTES) throw new Error(`${naam}: te groot`);
  const bytes = Buffer.from(await bestand.arrayBuffer());
  if (diagnose) diagnose.push({ naam, type, kb: Math.round(bytes.length / 1024) });
  return { type: "image", source: { type: "base64", media_type: type, data: bytes.toString("base64") } };
}

// Een vision-analyse van twee foto's duurt tientallen seconden. Zonder deze
// waarde geldt de standaard van het hobbyplan (10 s) en breekt de aanvraag af
// halverwege het denken — met een timeout die aan de clientkant net zo
// nietszeggend is als de 413 hierboven. De route van de app moet hem zelf
// exporteren; Next.js leest `maxDuration` alleen uit het routebestand zelf.
export const MAX_DURATION = 60;

/**
 * Bouwt de POST-handler. De bewaking komt van de app, de analyse van hier.
 *
 * @param rateLimit  guard van de app
 * @param origineOk  guard van de app
 * @param fout       guard van de app — (status, publiek, detail) → Response
 * @param logNaam    komt in de log en in de rate-limit-emmer te staan
 */
export function maakKastbeeldRoute({ rateLimit, origineOk, fout, logNaam = "kastbeeld" }) {
  // `fout()` stuurt bewust alleen een publieke melding terug en schrijft de
  // details naar de log (beveiligingsaudit 25-08-2026). Die regel blijft staan —
  // wat hier extra meegaat is uitsluitend onze eigen bedrijfsdiagnose: hoe lang
  // het duurde, welke modus, welk model. Geen foutmelding van de SDK, niets over
  // de foto en niets over de woning.
  function foutMetDiagnose(status, publiek, diagnose) {
    return Response.json({ error: publiek, diagnose }, { status });
  }
  return async function POST(request) {
    if (!origineOk(request)) return fout(403, "Niet toegestaan");
    // Een analyse is duur; 20 per uur is ruim voor een werkdag met meerdere
    // kasten en smal genoeg om bulkmisbruik te remmen.
    if (!rateLimit(request, { max: 20, perMs: 60 * 60 * 1000, naam: logNaam }))
      return fout(429, "Te veel scans — probeer het over een uur opnieuw");

    // Vóór alles: kan deze installatie überhaupt analyseren, en klopt de sleutel?
    // Een foutmelding hoort te zeggen wat je moet doen, niet alleen dat het niet
    // lukte.
    const ontbreekt = sdkProbleem();
    if (ontbreekt) return fout(503, `De foto-analyse kan op deze installatie niet starten: ${ontbreekt}.`);
    const probleem = sleutelProbleem();
    if (probleem) {
      // De WEG naar de oplossing verschilt per omgeving, en de vorige melding
      // noemde alleen de lokale. Live kreeg je dus het advies om .env.local te
      // bewerken en "de server te herstarten" — twee dingen die daar niet
      // bestaan. Op Vercel is de valkuil bovendien een andere: een variabele die
      // je toevoegt geldt pas voor een NIEUWE deploy, dus de sleutel kan er
      // helemaal goed in staan terwijl de draaiende versie hem niet kent.
      const weg = process.env.VERCEL
        ? "Zet ANTHROPIC_API_KEY in de projectinstellingen van Vercel en deploy daarna opnieuw — " +
          "een nieuwe variabele geldt pas vanaf de volgende deploy."
        : "Zet een geldige sleutel in .env.local en herstart de server.";
      return fout(503,
        `De foto-analyse is op deze installatie niet ingesteld: ${probleem}. ` +
        `Vul de kast handmatig in, of los het op: ${weg}`);
    }

    // TWEE MODI, ÉÉN ROUTE. "kast" leest foto's van de verdeelinrichting zelf,
    // "schema" leest een getekend eendraadschema. Ze delen de sleutelcontrole, de
    // rate limit, de tijdmuur en de foutafhandeling — alleen de instructie en de
    // vorm van het antwoord verschillen. Een tweede route zou die hele
    // infrastructuur verdubbelen, inclusief elke les die erin zit.
    let fotoDicht, fotoOpen, fotoSchema, modus;
    try {
      const form = await request.formData();
      modus = form.get("modus") === "schema" ? "schema" : "kast";
      fotoDicht = form.get("dicht");
      fotoOpen = form.get("open");
      fotoSchema = form.get("schema");
    } catch { return fout(400, "Onleesbare aanvraag"); }

    const isSchema = modus === "schema";
    if (isSchema ? !fotoSchema : (!fotoDicht && !fotoOpen))
      return fout(400, isSchema ? "Geen tekening meegestuurd" : "Geen foto meegestuurd");

    const diagnose = [];
    let blokken;
    try {
      blokken = isSchema
        ? [
            { tekst: "De tekening — een installatieschema (eendraadschema)." },
            await leesFoto(fotoSchema, "schema", diagnose),
          ].filter(Boolean)
        : [
            fotoDicht ? { tekst: "Foto 1 — DICHTE kast (met afdekplaat)." } : null,
            fotoDicht ? await leesFoto(fotoDicht, "dicht", diagnose) : null,
            fotoOpen ? { tekst: "Foto 2 — OPEN kast (zonder afdekplaat)." } : null,
            fotoOpen ? await leesFoto(fotoOpen, "open", diagnose) : null,
          ].filter(Boolean);
    } catch (err) {
      return fout(400, err.message || "Ongeldige foto");
    }

    const inhoud = blokken.map((b) => (b.tekst ? { type: "text", text: b.tekst } : b));
    inhoud.push({
      type: "text",
      text: isSchema
        ? "Lees dit schema volgens de instructie."
        : "Lees deze kast volgens de instructie.",
    });

    const client = new Anthropic();
    const begin = Date.now();

    try {
      // STREAMEN, ook al gebruiken we alleen het eindantwoord. Een aanvraag die
      // een minuut open staat zonder een byte te versturen wordt onderweg
      // afgekapt; een lopende stroom niet.
      const stroom = client.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        system: isSchema ? INSTRUCTIE_SCHEMA : INSTRUCTIE,
        // Een kast lezen is nauwkeurig werk: posities tellen, opdruk ontcijferen,
        // en per veld bepalen of je het écht kunt lezen. Daar hoort denken bij.
        thinking: { type: "adaptive" },
        output_config: {
          effort: EFFORT,
          format: { type: "json_schema", schema: isSchema ? SCHEMA_TEKENING : SCHEMA },
        },
        messages: [{ role: "user", content: inhoud }],
      }, { signal: AbortSignal.timeout(ANALYSE_BUDGET_MS) });

      const antwoord = await stroom.finalMessage();
      console.log(`[${logNaam}] analyse (${modus}) klaar in ${Math.round((Date.now() - begin) / 1000)} s ` +
                  `(effort ${EFFORT}, ${blokken.filter((b) => b.type === "image").length} foto's)`);

      if (antwoord.stop_reason === "refusal") {
        return fout(502, "De analyse is geweigerd door het model", antwoord.stop_details);
      }

      const tekst = (antwoord.content || [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
      if (!tekst) return fout(502, "De analyse leverde geen resultaat");

      // Met een afgedwongen schema kan dit niet meer stukgaan op een codeblok of
      // half geparste JSON.
      // DIAGNOSE IN HET ANTWOORD.
      //
      // De runtimelogs van de hostingomgeving zijn hier niet op te vragen, en een
      // hele avond is er blind gezocht naar verschillen tussen lokaal en live die
      // met één regel zichtbaar waren geweest: hoeveel foto's kwamen er aan, hoe
      // groot waren ze, welk model, welke effort, hoe lang duurde het. Dat hoort
      // niet in een logbestand dat niemand kan lezen maar gewoon in het antwoord.
      return Response.json({
        ...JSON.parse(tekst),
        promptversie: PROMPTVERSIE,
        diagnose: {
          fotos: diagnose,
          model: MODEL,
          effort: EFFORT,
          modus,
          duurMs: Date.now() - begin,
          omgeving: process.env.VERCEL ? "vercel" : "lokaal",
        },
      });
    } catch (err) {
      const duur = Math.round((Date.now() - begin) / 1000);
      // De diagnose hoort óók bij een MISLUKTE analyse in het antwoord te zitten.
      // Bij succes zit hij er al in, en om precies dezelfde reden: de runtimelogs
      // van de hostingomgeving zijn hier niet op te vragen. Zonder deze regels
      // staat er straks weer een melding op het scherm waar niets aan af te lezen
      // is — geen duur, geen modus, geen soort fout. Het zijn onze eigen
      // bedrijfsgegevens; er staat niets in over de foto of de woning.
      const diag = { modus, duurMs: Date.now() - begin, effort: EFFORT, model: MODEL,
                     omgeving: process.env.VERCEL ? "vercel" : "lokaal" };

      // DE TIJDMUUR. Deze functie mag op het hobbyplan zestig seconden draaien;
      // daarboven kapt de hostinglaag hem af met een kale 504 waar geen JSON in
      // zit — voor de gebruiker niet te onderscheiden van "er is niets gelezen".
      // Daarom breken we zélf net eerder af, zodat er een leesbare melding
      // overblijft en de duur in de log komt te staan.
      //
      // EN DAT WERKTE NIET. Een afgebroken aanvraag komt niet als TimeoutError
      // binnen: de SDK vangt het afbreeksignaal op en gooit zijn eigen
      // `APIUserAbortError`, met `status: undefined` en zonder de naam waarop hier
      // werd gekeken. De hele tijdmuur-melding is daardoor nooit één keer
      // getoond — elke afgebroken analyse viel door naar de generieke regel
      // onderaan en kwam op het scherm als "Analyse tijdelijk niet beschikbaar
      // (fout undefined)". Precies de melding waar niets aan af te lezen is.
      //
      // Vandaar alle drie de gedaanten, en het signaal zelf als vangnet.
      const afgebroken =
        err instanceof Anthropic.APIUserAbortError ||
        (err && (err.name === "TimeoutError" || err.name === "AbortError"));
      if (afgebroken) {
        console.error(`[${logNaam}] analyse (${modus}) afgebroken na ${duur} s (budget ${ANALYSE_BUDGET_MS / 1000} s, effort ${EFFORT})`);
        return foutMetDiagnose(504,
          `De analyse duurde langer dan ${ANALYSE_BUDGET_MS / 1000} seconden en is afgebroken ` +
          `(hij liep ${duur} s). ` +
          (isSchema
            ? "Een tekening met veel groepen kost meer tijd dan er is. Probeer een uitsnede van de tekening — de verdeler waar het u om gaat — in plaats van het hele blad."
            : "Probeer het met één foto in plaats van twee, of vul de kast handmatig in."),
          diag);
      }

      // Een netwerkstoring richting Anthropic heeft óók geen status, en kwam dus
      // uit op diezelfde nietszeggende melding. Het is een heel ander geval: hier
      // helpt gewoon opnieuw proberen.
      if (err instanceof Anthropic.APIConnectionError) {
        console.error(`[${logNaam}] geen verbinding met Anthropic na ${duur} s:`, err.message);
        return foutMetDiagnose(502,
          "De verbinding met de analyse viel weg. Probeer het opnieuw; er is niets mis met uw foto.",
          diag);
      }
      // GETYPEERDE FOUTEN. Een generieke 502 kostte hier eerder een avond zoeken:
      // "Analyse tijdelijk niet beschikbaar" zei niets over een sleutel die door
      // Anthropic werd geweigerd.
      if (err instanceof Anthropic.AuthenticationError) {
        return fout(503,
          "De sleutel ANTHROPIC_API_KEY wordt door Anthropic geweigerd. Controleer of hij nog geldig is " +
          "en bij een account met tegoed hoort.", err.message);
      }
      if (err instanceof Anthropic.RateLimitError) {
        return fout(429, "Anthropic remt de aanvragen af. Probeer het over een minuut opnieuw.", err.message);
      }
      if (err instanceof Anthropic.BadRequestError) {
        // Twee heel verschillende oorzaken, en ze verwarren kostte een ronde: een
        // foto die niet deugt is iets voor de gebruiker, een afgewezen schema of
        // parameter is een instelfout in deze route. De melding moet niet naar de
        // foto wijzen als het aan ons ligt.
        const instelfout = /output_config|schema|thinking|max_tokens|model/i.test(err.message || "");
        return fout(502, instelfout
          ? "De aanvraag klopt niet. Dit is een instelfout in de app, geen probleem met uw foto — de reden staat in de serverlog."
          : "De foto werd geweigerd — mogelijk te groot of beschadigd. Maak een nieuwe opname.",
          err.message);
      }
      if (err instanceof Anthropic.APIError) {
        // `err.status` mag hier niet meer undefined zijn — de twee soorten die
        // dat opleverden zijn hierboven afgevangen. Blijft er tóch iets zonder
        // status over, dan noemen we de soort in plaats van het woord undefined.
        const aanduiding = err.status || err.name || "onbekend";
        console.error(`[${logNaam}] API-fout ${aanduiding} na ${duur} s:`, err.message);
        return foutMetDiagnose(502, `Analyse tijdelijk niet beschikbaar (fout ${aanduiding}).`, diag);
      }
      console.error(`[${logNaam}] onverwachte fout na ${duur} s:`, err && err.stack ? err.stack : err);
      return foutMetDiagnose(502, "Analyse tijdelijk niet beschikbaar", diag);
    }
  }
}
