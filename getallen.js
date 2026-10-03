// ─────────────────────────────────────────────────────────────────────────────
// Getallen lezen zoals een installateur ze intikt
// ─────────────────────────────────────────────────────────────────────────────

// Robuuste numerieke parser — accepteert zowel komma als punt als decimaalteken.
// Zonder deze fix leest parseFloat("1,9") als 1 (stopt bij de komma) — dat
// veroorzaakte foutieve "Afwijking"-meldingen bij correct ingevoerde waarden.
export const toNum = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  return parseFloat(String(v).replace(",", "."));
};

// Een getal met een komma, zoals het in Nederland hoort. Verhuisd uit Kastscan op
// 03-10-2026 met de documenten mee: een labelvel, een groepenoverzicht en een
// schema schrijven alle drie meetwaarden, en drie keer dezelfde opmaakregel is
// twee keer te veel. Een onleesbaar getal wordt een streepje en geen "NaN".
export function komma(waarde, decimalen) {
  const n = toNum(waarde);
  if (isNaN(n)) return "—";
  return n.toFixed(decimalen === undefined ? 1 : decimalen).replace(".", ",");
}
