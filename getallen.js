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
