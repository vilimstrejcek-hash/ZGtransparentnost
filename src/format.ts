const EUR = new Intl.NumberFormat("hr-HR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EUR_KRATKO = new Intl.NumberFormat("hr-HR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const BROJ = new Intl.NumberFormat("hr-HR");

const POSTOTAK = new Intl.NumberFormat("hr-HR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const MJESECI = [
  "siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj",
  "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac",
];

const MJESECI_KRATKO = [
  "sij", "velj", "ožu", "tra", "svi", "lip",
  "srp", "kol", "ruj", "lis", "stu", "pro",
];

/** 1.234.567,89 € */
export const eur = (n: number): string => EUR.format(n);

/** Bez lipa — za osi grafova i velike brojke. */
export const eurKratko = (n: number): string => EUR_KRATKO.format(n);

/** Skraćeno za osi: 1,2 mil. € / 340 tis. € */
export function eurOs(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${POSTOTAK.format(n / 1_000_000)} mil. €`;
  if (a >= 1_000) return `${BROJ.format(Math.round(n / 1_000))} tis. €`;
  return EUR_KRATKO.format(n);
}

export const broj = (n: number): string => BROJ.format(n);

export const postotak = (n: number): string => `${POSTOTAK.format(n)} %`;

/** "2026-09" -> "rujan 2026." */
export function mjesecNaziv(mjesec: string): string {
  const [g, m] = mjesec.split("-");
  const ime = MJESECI[Number(m) - 1];
  return ime ? `${ime} ${g}.` : mjesec;
}

/** "2026-09" -> "ruj 2026." */
export function mjesecKratko(mjesec: string): string {
  const [g, m] = mjesec.split("-");
  const ime = MJESECI_KRATKO[Number(m) - 1];
  return ime ? `${ime} ${g}.` : mjesec;
}

/** Naziv mjeseca bez godine, za usporedbu godina na istoj osi. */
export function mjesecUGodini(brojMjeseca: number): string {
  return MJESECI_KRATKO[brojMjeseca - 1] ?? String(brojMjeseca);
}

/** "2026-09-03" -> "3. 9. 2026." */
export function datum(iso: string): string {
  if (!iso) return "—";
  const [g, m, d] = iso.split("-");
  if (!g || !m || !d) return iso;
  return `${Number(d)}. ${Number(m)}. ${g}.`;
}

/** Skraćivanje dugih naziva za oznake grafova. */
export function skrati(tekst: string, duljina = 38): string {
  return tekst.length <= duljina ? tekst : `${tekst.slice(0, duljina - 1).trimEnd()}…`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}
