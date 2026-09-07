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
