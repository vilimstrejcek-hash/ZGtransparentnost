import { escapeHtml } from "./format";

/** Naslov stranice s datumom podataka — isti raspored na svakom prikazu. */
export function zaglavljeHtml(naslov: string, datumPodataka: string, uvod = ""): string {
  return `
    <div class="zaglavlje-stranice">
      <h2 class="naslov-stranice">${escapeHtml(naslov)}</h2>
      <p class="datum-podataka">Podaci do ${escapeHtml(datumPodataka)}</p>
    </div>
    ${uvod ? `<p class="uvod">${escapeHtml(uvod)}</p>` : ""}`;
}

export function brojkaHtml(oznaka: string, vrijednost: string, dodatak = ""): string {
  return `<div class="brojka">
    <p class="brojka__oznaka">${escapeHtml(oznaka)}</p>
    <div class="brojka__vrijednost">${escapeHtml(vrijednost)}</div>
    ${dodatak ? `<p class="brojka__dodatak">${escapeHtml(dodatak)}</p>` : ""}
  </div>`;
}

/** Vodoravna os godina s točkama, kao donja kontrola na Madridovim prikazima. */
export function godineOsHtml(godine: string[], odabrana: string, oznakaSve = "Sve"): string {
  const stavke = [...godine, "sve"];
  return `
    <div class="godine-os">
      <span class="godine-os__crta" aria-hidden="true"></span>
      <div class="godine-os__popis" role="group" aria-label="Odabir godine">
        ${stavke.map((g) => `
          <button type="button" data-godina="${escapeHtml(g)}"
            aria-pressed="${g === odabrana}">
            <span class="godine-os__tocka" aria-hidden="true"></span>
            <span class="godine-os__oznaka">${escapeHtml(g === "sve" ? oznakaSve : `${g}.`)}</span>
          </button>`).join("")}
      </div>
    </div>`;
}

export function kontroleDnoHtml(desno: string, lijevo = ""): string {
  return `
    <div class="kontrole-dno">
      <div>
        <h4>Iznosi</h4>
        ${lijevo}
      </div>
      <div>
        <h4>Godina</h4>
        ${desno}
      </div>
    </div>`;
}

/** Poveže klik na os godina s funkcijom koja ponovno crta prikaz. */
export function poveziGodine(
  korijen: HTMLElement,
  postavi: (godina: string) => void
): void {
  korijen.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-godina]");
    if (!gumb?.dataset.godina) return;
    for (const b of korijen.querySelectorAll<HTMLButtonElement>("button[data-godina]")) {
      b.setAttribute("aria-pressed", String(b === gumb));
    }
    postavi(gumb.dataset.godina);
  });
}

export const PALETA = [
  "var(--k1)", "var(--k2)", "var(--k3)", "var(--k4)", "var(--k5)",
  "var(--k6)", "var(--k7)", "var(--k8)", "var(--k9)", "var(--k10)",
];

export const bojaPoIndeksu = (i: number): string => PALETA[i % PALETA.length] as string;


/* --- Sortiranje tablica --------------------------------------------------- */

export interface Stupac<T> {
  kljuc: string;
  naziv: string;
  /** Desno poravnat i sortiran kao broj. */
  broj?: boolean;
  /** Stupac bez sortiranja (npr. redni broj). */
  bezSortiranja?: boolean;
  sirina?: string;
  /** Vrijednost po kojoj se sortira. */
  vrijednost?: (redak: T) => number | string;
}

export interface Poredak {
  kljuc: string;
  silazno: boolean;
}

/** Zaglavlje tablice s gumbima za sortiranje. */
export function zaglavljeTabliceHtml<T>(stupci: Stupac<T>[], poredak: Poredak): string {
  return `<tr>${stupci.map((s) => {
    const aktivan = s.kljuc === poredak.kljuc;
    const smjer = aktivan ? (poredak.silazno ? "descending" : "ascending") : "none";
    const strelica = aktivan ? (poredak.silazno ? "▾" : "▴") : "";
    if (s.bezSortiranja) {
      return `<th${s.sirina ? ` style="width:${s.sirina}"` : ""}${s.broj ? ' class="broj"' : ""}>${escapeHtml(s.naziv)}</th>`;
    }
    return `<th${s.sirina ? ` style="width:${s.sirina}"` : ""}
      class="${s.broj ? "broj " : ""}sortiv${aktivan ? " sortiv--aktivan" : ""}"
      aria-sort="${smjer}">
      <button type="button" data-sort="${escapeHtml(s.kljuc)}">
        ${escapeHtml(s.naziv)}<span class="sortiv__strelica">${strelica}</span>
      </button>
    </th>`;
  }).join("")}</tr>`;
}

/** Poredaj redke prema odabranom stupcu; tekst ide hrvatskom abecedom. */
export function sortirajRedke<T>(redci: T[], stupci: Stupac<T>[], poredak: Poredak): T[] {
  const stupac = stupci.find((s) => s.kljuc === poredak.kljuc);
  if (!stupac?.vrijednost) return redci;
  const smjer = poredak.silazno ? -1 : 1;
  return [...redci].sort((a, b) => {
    const x = stupac.vrijednost!(a);
    const y = stupac.vrijednost!(b);
    if (typeof x === "number" && typeof y === "number") return (x - y) * smjer;
    return String(x).localeCompare(String(y), "hr") * smjer;
  });
}

/**
 * Klik na zaglavlje mijenja stupac ili okreće smjer. Brojčani stupci kreću
 * silazno jer se kod iznosa gotovo uvijek prvo traži najveće.
 */
export function poveziSortiranje<T>(
  zaglavlje: HTMLElement,
  stupci: Stupac<T>[],
  poredak: Poredak,
  ponovno: () => void
): void {
  zaglavlje.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-sort]");
    const kljuc = gumb?.dataset["sort"];
    if (!kljuc) return;
    if (poredak.kljuc === kljuc) {
      poredak.silazno = !poredak.silazno;
    } else {
      poredak.kljuc = kljuc;
      poredak.silazno = stupci.find((s) => s.kljuc === kljuc)?.broj ?? false;
    }
    ponovno();
  });
}
