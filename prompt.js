// ─────────────────────────────────────────────────────────────────────────────
// De prompt — wat het beeldmodel te horen krijgt over een groepenkast
//
// Dit is de minst vanzelfsprekende bewoner van de motor, dus de reden erbij.
// Hij stond in een API-route, want daar wordt hij gebruikt en daar hoort hij
// server-side te blijven (audit BEV-02: de client stuurt alleen foto's). Maar hij
// is geen infrastructuur: hij is de GEKALIBREERDE NORM. Hierin staat dat een
// aardlekautomaat zichzelf beveiligt, dat een fase nooit uit een kastfoto komt,
// en hoe zeker een aflezing moet zijn voordat zij een veld in mag. Twee apps met
// elk een eigen kopie daarvan lopen binnen een maand uiteen — precies zoals
// `faseBalans` dat deed.
//
// Hij gaat dus als DATA mee: geen netwerk, geen sleutel, geen route. Elke app
// houdt zijn eigen dunne route eromheen, met eigen rate limit en eigen sleutel.
//
// ⚠️ DE VRIJGAVEREGEL GELDT HIER. Geen promptwijziging live zonder een verse run
// over de referentieset, en `PROMPTVERSIE` mee omhoog. De correctiedata bepaalt
// WAT je verandert; de testrun bepaalt OF het mag. Zie leerlus.js ›
// `vergelijkPromptversies` en `oordeelOverWijziging`.
// ─────────────────────────────────────────────────────────────────────────────


export const PROMPTVERSIE = "kastscan-2026-09-30-A";


// Structured outputs: het model KAN geen ongeldige JSON meer teruggeven, want de
// API dwingt dit schema af. Dat vervangt "antwoord met uitsluitend JSON" plus
// een parser die een codeblok moest afpellen — daar kon een half geparste kast
// uit komen, en dat is erger dan geen kast.
export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  // De API begrenst het AANTAL OPTIONELE velden in een schema op 24; met 28
  // werd de aanvraag geweigerd. Twee manieren om eronder te komen: velden
  // schrappen die de code toch niet uitleest, en velden verplicht maken die
  // altijd een waarde kunnen hebben. Beide toegepast — `reden` en
  // `blokkenBron` zijn nu verplicht met een lege string als "niets te melden".
  required: ["bruikbaar", "posities", "reden", "redenSoort", "blokkenBron"],
  properties: {
    bruikbaar: { type: "boolean" },
    reden: { type: "string" },
    // WAAROM onbruikbaar bepaalt wat de gebruiker moet doen, en dat verschilt
    // volledig. "Ga dichterbij staan" is nutteloos advies bij een foto van de
    // watermeter, en "fotografeer de groepenkast" is nutteloos bij een goede
    // foto die alleen te ver weg genomen is. Zonder dit veld gaf de app één
    // standaardzin voor alle gevallen.
    redenSoort: {
      type: "string",
      enum: ["", "geen-groepenkast", "te-ver", "onscherp", "afgedekt", "te-donker", "anders"],
    },
    hoofd: {
      type: "object",
      additionalProperties: false,
      properties: {
        fasen: { type: "integer", enum: [1, 3] },
        hoofdzekering: { type: "number" },
        stelsel: { type: "string", enum: ["TN", "TT"] },
      },
    },
    posities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        // `zekerheid` staat er BEWUST bij: zolang het veld optioneel was, mocht
        // het model het weglaten, en dan had de app geen enkele uitspraak om op
        // te varen. Verplicht kost het geen enkele vrijheid — het model mag
        // gerust een laag getal geven — en het haalt een heel stil faalgeval weg.
        required: ["rail", "positie", "breedteModules", "soort", "zekerheid"],
        properties: {
          rail: { type: "integer" },
          positie: { type: "integer" },
          breedteModules: { type: "integer" },
          soort: { type: "string", enum: ["aardlek", "automaat", "aardlekautomaat", "smeltveiligheid", "hoofdschakelaar", "overig"] },
          fabrikant: { type: "string" },
          type: { type: "string" },
          karakteristiek: { type: "string", enum: ["B", "C", "D"] },
          In: { type: "number" },
          IAn: { type: "number" },
          polen: { type: "integer", enum: [1, 2, 3, 4] },
          aardlektype: { type: "string", enum: ["AC", "A", "F", "B"] },
          stift: { type: "string" },
          // De groepstekst die FYSIEK bij deze module staat. Zonder dit veld kon
          // een handgeschreven verklaring zonder groepsnummers nergens heen: hij
          // werd wel gelezen, maar belandde als losse regel in
          // "groepenverklaring" en moest met de hand op de goede groep gezet
          // worden. Dat is precies het handwerk dat deze app hoort weg te nemen.
          groepstekst: { type: "string" },
          // Structured outputs eist GESLOTEN objecten: additionalProperties moet
          // false zijn, dus een vrije map van veldnaam naar zekerheid mag niet.
          // De velden staan hier daarom uitgeschreven. Dat is bovendien
          // strenger, want nu kan het model geen zekerheid melden over een veld
          // dat niet bestaat.
          // ÉÉN zekerheid voor de hele positie, geen object per veld.
          //
          // Een geneste zekerheidsmap werd door de API geweigerd met "Schema is
          // too complex" — structured outputs stelt grenzen aan nesting, aan het
          // aantal optionele velden (24) en aan de totale omvang.
          //
          // Dat is geen verlies. De regel uit de spec is dat het model een veld
          // WEGLAAT als het het niet kan lezen; die regel doet het eigenlijke
          // werk, en de zekerheid is er voor de leerlus — om te meten hoe vaak
          // het model overtuigd fout zat. Daarvoor volstaat één getal per
          // positie: als een aflezing wordt gecorrigeerd, was het díé aflezing.
          zekerheid: { type: "number" },        },
      },
    },
    // Een blok kan op TWEE manieren worden opgegeven, en dat is geen luxe.
    //
    // Een kleurband zonder groepsnummers eronder is in het veld heel gewoon —
    // en die kwam eerst helemaal niet binnen, want het schema kende alleen een
    // lijst nummers. Het model zag de band, kon de waarneming niet kwijt, en de
    // app viel terug op de vuistregel. De informatie zat er wél: een kleurwissel
    // is een blokgrens op een fysieke plek, ook zonder dat er een cijfer onder
    // staat. Daarom mag een blok nu ook een BEREIK van moduleposities zijn.
    blokken: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["aardlekIndex"],
        properties: {
          aardlekIndex: { type: "integer" },
          groepsnummers: { type: "array", items: { type: "integer" } },
          rail: { type: "integer" },
          vanPositie: { type: "integer" },
          totPositie: { type: "integer" },
          kleur: { type: "string" },
        },
      },
    },
    blokkenBron: { type: "string", enum: ["kleurband", "tape", "etiket", ""] },
    groepenverklaring: { type: "array", items: { type: "string" } },
    verschillen: { type: "array", items: { type: "string" } },
  },
};

// Een sleutel die niet met sk-ant- begint of veel te kort is, is geen sleutel.
// Dat vooraf zeggen scheelt een rondje naar de API en een foutmelding waar
// niets aan af te lezen is — in het veld stond er een keer letterlijk de
// voorbeeldwaarde "sk-ant-..." in .env.local, en dat leverde alleen een
// generieke 502 op.
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


// De twee opnames hebben een tegengestelde sterkte en zijn niet inwisselbaar:
// bij een OPEN kast is de opdruk leesbaar maar zit de kamrail achter de
// modules, dus blijft de blokindeling gissen. Bij een DICHTE kast staat de
// blokindeling letterlijk op de afdekplaat — kleurband of handgeschreven tape —
// maar zit de opdruk eronder.
export const INSTRUCTIE = `Je leest een Nederlandse elektrische verdeelinrichting (groepenkast) van foto's. Je vult een formulier voor een installateur voor; je keurt niets en je beoordeelt niets.

Je krijgt maximaal twee foto's van dezelfde kast:
- DICHT (met afdekplaat): hieruit komen het aantal groepen, de nummering, welke groep bij welke aardlekschakelaar hoort, waar de krachtgroep en de hoofdschakelaar zitten, en de bestaande groepsaanduiding.
- OPEN (zonder afdekplaat): hieruit komen fabrikant, type, karakteristiek, In, IAn en het poolaantal per module.

HARDE REGELS
1. Vul een veld ALLEEN in als je het echt kunt lezen. Kun je het niet lezen, laat het veld weg en geef een lage zekerheid. Een verkeerd voorgevulde waarde die overtuigend oogt, wordt weggeklikt zonder lezen en belandt in het rapport van de installateur. Een leeg veld dwingt tot kijken. NUL foutieve waarden met hoge zekerheid is het criterium, niet een vulpercentage.
2. Verzin nooit een type of merk. Bij een oude kast met smeltveiligheden of stoppen: tel de groepen, de reserveposities en de hoofdschakelaar, en vul geen enkel automaattype in.
3. Positie, volgorde en modulebreedte zijn betrouwbaarder dan de opdruk. Geef ze altijd, van links naar rechts en per rail.
4. De FUNCTIE van een groep (keuken, badkamer) komt NOOIT uit de modules zelf — niet uit het merk, niet uit de stroomsterkte, niet uit de plek in de kast. Je mag hem alleen overnemen als hij ergens LEESBAAR STAAT: een groepenverklaring, een handgeschreven of geprint etiket, beschreven tape.
   Staat die tekst fysiek bij één module — erboven, eronder, of op de afdekplaat op die plek — geef hem dan in "groepstekst" van díé positie. Dat is een aflezing, geen gok: je leest waar hij staat.
   Kun je de tekst wél lezen maar niet zien bij welke module hij hoort, geef hem dan als losse regel in "groepenverklaring". Staat er een groepsnummer bij, neem dat nummer dan mee in de regel ("Groep 3 — Wasmachine") — de app koppelt hem dan zelf.
   Kun je een tekst niet lezen, laat hem weg. Een half geraden naam komt op een sticker op de kastdeur terecht.
5. Fase is uit een foto niet af te lezen. Laat "fase" altijd weg.
6. Beoordeel de installatie niet. Meld geen gebreken, geen ontbrekende afdekplaat, geen aanraakveiligheid, geen staat van het pand. Dat is een andere taak met een andere prompt.
7. Is een foto onbruikbaar, zet dan "bruikbaar" op false, geef een korte "reden" én zet "redenSoort" op de juiste waarde — dat bepaalt welk advies de gebruiker krijgt:
   - "geen-groepenkast": er staat iets anders op de foto (een bouwkast van de netbeheerder, een watermeter, alleen de kWh-meter, een gesloten kastluik zonder zicht op groepen).
   - "te-ver": het is een groepenkast, maar hij staat te klein in beeld om modules te onderscheiden.
   - "onscherp" / "te-donker": het is een groepenkast van dichtbij, maar de opname is niet scherp of te donker.
   - "afgedekt": de modules zitten achter een deur of luik dat dicht is.
   Is de foto wél bruikbaar, geef dan een lege "reden" en een lege "redenSoort".

8. HOOFDSCHAKELAAR OF AARDLEKSCHAKELAAR — kijk naar de TESTKNOP. Beide zijn breed en meerpolig en lijken op elkaar, en dat gaat mis. Het onderscheid:
   - AARDLEKSCHAKELAAR: heeft een TESTKNOP (vaak "T" of "TEST", los knopje naast de hendel) én een aanduiding van de aanspreekstroom — "30 mA", "0,03 A", of in een typenummer als "40/4/003". Zie je een testknop of een IΔn-waarde, dan is het een aardlekschakelaar.
   - HOOFDSCHAKELAAR: meerpolig, maar GEEN testknop en GEEN IΔn. Draagt alleen een stroomsterkte (40 A, 63 A) en staat meestal links vooraan op de rail, direct na de meter. Vaak zwarte of afwijkend gekleurde hendels.
   - Een AARDLEKAUTOMAAT is smal (1 of 2 modules) en heeft zowel een testknop als een karakteristiek met stroom (B16). Dit is de meest gemiste categorie: gezien op een echte kast (03-09-2026) een rij ABB DS951-A met TEST-knop en "IΔn 0,03 A" op elke module. Zo'n rij is GEEN rij automaten en ook geen aardlekschakelaar met groepen erachter — het zijn losse aardlekautomaten, elk met eigen aardlekbeveiliging. Een moderne kast bestaat vaak volledig uit dit type en heeft dan helemaal geen aardlekschakelaar.
   - Vuistregel: een testknop op ELKE module betekent aardlekautomaten. Eén brede module met een testknop, met smalle modules zonder testknop ernaast, betekent één aardlekschakelaar met groepen erachter.
   Een meerpolig TOESTEL ZONDER testknop en ZONDER IAn is dus een hoofdschakelaar, ook als er geen tekst "hoofdschakelaar" bij staat. Noem hem dan ook zo — "overig" is bedoeld voor wat geen van deze vier is (een beltransformator, een schemerschakelaar, een overspanningsafleider), niet voor twijfel tussen twee van deze vier.
   De gevolgen zijn niet symmetrisch: uit de aardlekschakelaars leidt de app de hele blokindeling af, dus een hoofdschakelaar die je per ongeluk aardlek noemt richt schade aan. Andersom niet: als je iets ten onrechte hoofdschakelaar noemt, ziet de installateur dat meteen en zet hij het recht.

9. OUDE KASTEN MET STOPPEN TELLEN MEE. Een kast met smeltveiligheden (stoppen, patroonhouders, bakelieten groepjes met een draaischakelaar) is een volwaardige verdeelinrichting en geen onbruikbare foto. Zet zulke posities op soort "smeltveiligheid" — NIET op "overig", want dan telt de app ze niet als groep en levert de scan niets op. Een smeltveiligheid heeft geen karakteristiek: laat "karakteristiek" dan weg. De waarde van het smeltpatroon in ampère hoort in "In", maar alleen als je hem echt kunt lezen; gok hem niet.

BLOKINDELING (alleen uit de DICHTE foto)
Zoek op de afdekplaat, in deze volgorde van betrouwbaarheid:
1. Een kleurband onder de groepsnummers die per aardlek van kleur wisselt. Een kleurwissel is een blokgrens.
2. Handgeschreven tape, bijvoorbeeld "RCD1 | 1 2 3 4 | RCD2 | 5 6 7 8".
3. Gedrukte etiketten: "AARDLEK | 1 2 3 4", "KRACHT-1", "HOOFDSCHAKELAAR".
Geef dit terug in "blokken". Kon je geen van drieën lezen, laat "blokken" leeg en geef een lege "blokkenBron" — de app valt dan terug op een vuistregel en zegt er in de UI bij dat het een voorstel is.

GEEF ALTIJD DE KLEUR. Zie je een kleurband, noem dan per blok de kleur in "kleur" ("oranje", "blauw", "groen", ...). Dat is geen versiering: de app drukt die kleur op de stickers, en zonder jouw waarneming valt hij terug op een vaste volgorde die in deze kast misschien niet klopt — dan spreekt de sticker de kast tegen. Staat er ook een legenda op de plaat ("Aardlekschakelaar beveiligt oranje groepen"), geef die regels dan letterlijk terug in "groepenverklaring", in de volgorde waarin ze staan.

EEN BAND ZONDER NUMMERS IS OOK EEN WAARNEMING. Staan er geen groepsnummers onder de kleurband of de tape, geef het blok dan als BEREIK: "rail", "vanPositie" en "totPositie" met dezelfde positienummering die je in "posities" gebruikt, plus de "kleur" als je die kunt benoemen. Laat "groepsnummers" dan weg. Je hoeft dus nooit een nummering te verzinnen om een band te kunnen melden — een kleurwissel is een blokgrens, ook zonder cijfers eronder. Staan de nummers er wél, geef dan "groepsnummers"; dat is de betrouwbaarste vorm.

ZEKERHEID
Geef per positie één getal "zekerheid" tussen 0 en 1: hoe zeker ben je van wat je van deze module hebt gelezen. Wees streng: 0,9 betekent dat je de tekens echt hebt gelezen, niet dat het waarschijnlijk is gezien het merk.

Belangrijker dan het getal is regel 1: een veld dat je niet kunt lezen, LAAT JE WEG. Vul het niet met een gok en zet er geen lage zekerheid bij — weglaten is het signaal.

Antwoord met UITSLUITEND geldige JSON volgens dit schema, zonder toelichting en zonder codeblok:
{
  "bruikbaar": true,
  "reden": "",
  "redenSoort": "",
  "hoofd": { "fasen": 1|3, "hoofdzekering": getal, "stelsel": "TN"|"TT" },
  "posities": [
    {
      "rail": 1, "positie": 0, "breedteModules": 1,
      "soort": "aardlek"|"automaat"|"aardlekautomaat"|"smeltveiligheid"|"hoofdschakelaar"|"overig",
      "fabrikant": "", "type": "", "karakteristiek": "B"|"C"|"D",
      "In": getal, "IAn": getal, "polen": 1|2|3|4,
      "aardlektype": "AC"|"A"|"F"|"B",
      "stift": "",
      "zekerheid": 0.0
    }
  ],
  "blokken": [ { "aardlekIndex": 0, "groepsnummers": [1,2,3,4] },
               { "aardlekIndex": 1, "rail": 1, "vanPositie": 6, "totPositie": 9, "kleur": "blauw" } ],
  "blokkenBron": "kleurband"|"tape"|"etiket"|"",
  "groepenverklaring": [ "Groep 1 — Kookplaat" ],
  "verschillen": [ "negen genummerde posities op de plaat, acht modules in de kast" ]
}`;


// ─── HET INSTALLATIESCHEMA ────────────────────────────────────────────────────
//
// Een tweede manier om een kast in te lezen, en in één opzicht de betere: een
// eendraadschema is GEDRUKT. Waar een kastfoto het model dwingt om opdruk op een
// module te ontcijferen en de functie van een groep helemaal niet kan geven,
// staat op een schema alles uitgeschreven — groepsnummer, fase, karakteristiek,
// kabeldoorsnede, wat de groep voedt, en welke aardlekschakelaar erboven hangt.
//
// Wie een schema heeft, heeft dus in één scan een vollediger kast dan welke foto
// ook kan opleveren. Dat maakt dit geen bijzaak: het is de route voor elke
// woning waar bij oplevering een tekening is gemaakt, en voor elke installateur
// die zijn eigen archief wil ontsluiten zonder alles over te typen.
//
// Het antwoord krijgt bewust DEZELFDE positievorm als een kastanalyse. Daardoor
// draaien de strook, de labels, het paspoort en het groepenoverzicht er
// ongewijzigd op.
export const SCHEMA_TEKENING = {
  type: "object",
  additionalProperties: false,
  required: ["bruikbaar", "posities", "reden", "redenSoort"],
  properties: {
    bruikbaar: { type: "boolean" },
    reden: { type: "string" },
    redenSoort: {
      type: "string",
      enum: ["", "geen-schema", "onscherp", "te-ver", "onvolledig", "anders"],
    },
    hoofd: {
      type: "object",
      additionalProperties: false,
      properties: {
        fasen: { type: "integer", enum: [1, 3] },
        hoofdzekering: { type: "number" },
        stelsel: { type: "string", enum: ["TN", "TT"] },
        kamA: { type: "number" },
      },
    },
    posities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["soort", "zekerheid"],
        properties: {
          soort: { type: "string", enum: ["aardlek", "automaat", "aardlekautomaat", "smeltveiligheid", "hoofdschakelaar", "overig"] },
          // Het nummer dat op de tekening bij de groep staat. Leidend boven onze
          // eigen telling — precies zoals het plaatnummer op een kastfoto dat is.
          nummer: { type: "integer" },
          fase: { type: "string", enum: ["L1", "L2", "L3"] },
          karakteristiek: { type: "string", enum: ["B", "C", "D"] },
          In: { type: "number" },
          IAn: { type: "number" },
          polen: { type: "integer", enum: [1, 2, 3, 4] },
          aardlektype: { type: "string", enum: ["AC", "A", "F", "B"] },
          // Waar de groep voor is, letterlijk zoals het er staat.
          functie: { type: "string" },
          // De kabelaanduiding onder de lijn: "VD 3 x 2,5 mm2".
          kabel: { type: "string" },
          // Welke aardlekschakelaar erboven hangt: de hoeveelste `aardlek` in
          // deze lijst, van boven naar beneden geteld, te beginnen bij 0.
          aardlekIndex: { type: "integer" },
          verdeler: { type: "string" },
          zekerheid: { type: "number" },
        },
      },
    },
    verdelers: { type: "array", items: { type: "string" } },
    opmerkingen: { type: "array", items: { type: "string" } },
  },
};


export const INSTRUCTIE_SCHEMA = `Je leest een Nederlands INSTALLATIESCHEMA (eendraadschema) van een woninginstallatie, van een foto of scan van de tekening. Je vult een formulier voor een installateur voor; je keurt niets en je beoordeelt niets.

WAT JE VOOR JE HEBT
Een eendraadschema loopt van links naar rechts: de netaansluiting, de kWh-meter, een hoofdschakelaar, een verticale verzamelrail, en daaraan de aardlekschakelaars met daarachter de eindgroepen. Elke eindgroep is één horizontale lijn.

DE TEKENS
- Schuine streep door de lijn = een schakelend toestel.
- Schuine streep met een klein haakje ernaast = installatieautomaat. De aanduiding erbij is B16, C16, 16A of alleen 16.
- Schuine streep met "delta I", "dI", "30mA", "300mA" of "I dn" erbij = aardlekschakelaar.
- Beide tekens bij elkaar, of een toestel met zowel een stroomwaarde als een mA-waarde = aardlekautomaat. Die beveiligt zichzelf en hoort NIET achter een aardlekschakelaar.
- Rechthoekje in de lijn zonder schakelteken = smeltveiligheid (stop).
- Rechthoek met "kWh" = de meter. Geef die niet als positie.
- Streepjeslijn om een deel van de tekening = de begrenzing van een verdeelkast. De naam staat erbij ("Centrale meterkast", "Schakelkast garage").

WAT JE UIT ELKE GROEPSLIJN HAALT
- nummer: het groepsnummer dat links bij de lijn staat. Neem het over zoals het er staat; tel niet zelf door.
- fase: staat er L1, L2 of L3 bij, neem die over. Staat er niets, laat het veld weg.
- karakteristiek en In: uit de aanduiding bij het teken.
- functie: de tekst BOVEN de lijn — waar de groep voor is. Letterlijk overnemen, ook als het een lange opsomming is ("Keuken, eetkamer + 1e etage kamer 16 +18"). Niet inkorten, niet herschrijven, niet vertalen.
- kabel: de tekst ONDER de lijn — de kabelaanduiding ("VD - 3 x 2,5 mm2", "YMvK - 5 x 2,5 mm2"). Letterlijk overnemen.
- aardlekIndex: welke aardlekschakelaar deze groep voedt. De beugel of de verticale lijn die de groepen bij elkaar houdt, wijst hem aan. Tel de aardlekschakelaars in de volgorde waarin je ze in "posities" zet, te beginnen bij 0.

HARDE REGELS
1. De VOLGORDE van "posities" is de volgorde op de tekening, van boven naar beneden. Zet elke aardlekschakelaar VOOR de groepen die erachter hangen. Dan klopt aardlekIndex vanzelf.
2. Neem alleen over wat er staat. Een leeg veld is goed; een geraden waarde belandt op een sticker op de kastdeur. Kun je de tekening op een plek niet lezen, laat die velden weg en zet de zekerheid laag.
3. Reken niets uit en vul niets aan. Staat er geen fase bij een groep, dan verdeel je ze niet zelf over L1/L2/L3. Staat er geen karakteristiek, dan maak je er geen B van.
4. Handgeschreven bijschriften, doorhalingen en latere aanvullingen tellen mee — dat is vaak de actuele stand. Is een regel doorgestreept, neem hem dan niet over maar noem hem in "opmerkingen".
5. Staan er meerdere verdelers op de tekening, zet de naam van de kast waarin een groep hangt in "verdeler" en de namen in volgorde in "verdelers". Hoort alles bij één kast, laat "verdeler" weg.
6. Beoordeel de installatie niet. Meld geen gebreken en geen afwijkingen van de norm. Wat je opvalt en de installateur moet weten (onleesbaar deel, tegenstrijdige aanduiding, doorgestreepte regel) gaat in "opmerkingen", feitelijk gesteld.
7. Is dit geen installatieschema maar iets anders — een plattegrond, een foto van een kast, een factuur — zet "bruikbaar" op false met redenSoort "geen-schema". Is het wel een schema maar onleesbaar of maar half in beeld, gebruik "onscherp", "te-ver" of "onvolledig".

VOORBEELD van één groepslijn en wat eruit komt:
  op de tekening:  7 L1 --[/ 16A]-- Koelkast+Vaatwasser
                                    VD - 3 x 2,5 mm2
  eruit:  { "soort":"automaat", "nummer":7, "fase":"L1", "In":16,
            "functie":"Koelkast+Vaatwasser", "kabel":"VD - 3 x 2,5 mm2",
            "aardlekIndex":1, "zekerheid":0.95 }`;
