import type { Podaci } from "../data";
import { broj, datum, escapeHtml, eur, postotak } from "../format";
import { godineOsHtml, kontroleDnoHtml, poveziGodine, zaglavljeHtml } from "../ui";
import type { Primatelj } from "../types";

export function prikaziIsplate(cilj: HTMLElement, podaci: Podaci, pocetniUpit = ""): void {
  const { top, meta, summary } = podaci;
  const godine = summary.godine;
  let odabrana = "sve";
  let upit = pocetniUpit;

  cilj.innerHTML = `
    <div class="omotac">
      ${zaglavljeHtml("Isplate primateljima", datum(meta.zadnji_datum),
        "Tko je primio novac iz gradskog proračuna. Klik na primatelja otvara sve njegove isplate.")}

      <div class="filtri">
        <input type="search" class="polje" id="pretraga"
          placeholder="Pretraži po nazivu ili OIB-u" aria-label="Pretraga primatelja"
          value="${escapeHtml(upit)}" autocomplete="off" />
        <span class="sitno" id="sazetak"></span>
      </div>

      <div class="tablica-okvir">
        <table>
          <thead><tr>
            <th style="width:3rem">#</th><th>Primatelj</th><th>OIB</th>
            <th class="broj">Ukupno</th><th class="broj">Isplata</th><th class="broj">Udio</th>
          </tr></thead>
          <tbody id="tablica"></tbody>
        </table>
      </div>

      ${kontroleDnoHtml(godineOsHtml(godine, odabrana, "Sve zajedno"),
        `<p class="sitno" style="text-align:center;margin:0">
          Prikazuje se najvećih 50 primatelja u odabranom razdoblju.
        </p>`)}
    </div>`;

  const tijelo = cilj.querySelector<HTMLElement>("#tablica")!;
  const sazetak = cilj.querySelector<HTMLElement>("#sazetak")!;
  const pretraga = cilj.querySelector<HTMLInputElement>("#pretraga")!;

  const zaGodinu = (): Primatelj[] => top[odabrana] ?? [];
  const filtrirani = (): Primatelj[] => {
    if (!upit) return zaGodinu();
    const q = upit.toLowerCase();
    return zaGodinu().filter(
      (p) => p.naziv.toLowerCase().includes(q) || p.oib.toLowerCase().includes(q)
    );
  };

  function crtaj(): void {
    const svi = zaGodinu();
    const stavke = filtrirani();
    sazetak.textContent = upit
      ? `${broj(stavke.length)} od ${broj(svi.length)} primatelja odgovara pretrazi`
      : `${odabrana === "sve" ? "Sva razdoblja" : `${odabrana}. godina`}`;

    tijelo.innerHTML = stavke.length
      ? stavke.map((p) => {
          const mjesto = svi.indexOf(p) + 1;
          const naziv = p.ima_profil
            ? `<a class="veza" href="#/primatelj/${encodeURIComponent(p.oib)}">${escapeHtml(p.naziv)}</a>`
            : escapeHtml(p.naziv);
          return `<tr${p.ima_profil ? ` class="red-klik" data-oib="${escapeHtml(p.oib)}"` : ""}>
            <td class="broj">${mjesto}</td>
            <td>${naziv}</td>
            <td>${p.oib === "GDPR" ? '<span class="sitno">anonimizirano</span>' : escapeHtml(p.oib)}</td>
            <td class="broj${p.ukupno < 0 ? " negativno" : ""}">${escapeHtml(eur(p.ukupno))}</td>
            <td class="broj">${escapeHtml(broj(p.broj_isplata))}</td>
            <td class="broj">${escapeHtml(postotak(p.udio))}</td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="6" class="prazno">Nema primatelja koji odgovaraju pretrazi.</td></tr>`;
  }

  pretraga.addEventListener("input", () => {
    upit = pretraga.value.trim();
    crtaj();
  });

  tijelo.addEventListener("click", (e) => {
    const cilj_ = e.target as HTMLElement;
    if (cilj_.closest("a")) return;
    const red = cilj_.closest<HTMLTableRowElement>("tr[data-oib]");
    if (red?.dataset.oib) location.hash = `#/primatelj/${encodeURIComponent(red.dataset.oib)}`;
  });

  poveziGodine(cilj.querySelector<HTMLElement>(".godine-os")!, (g) => {
    odabrana = g;
    crtaj();
  });
  crtaj();
}
