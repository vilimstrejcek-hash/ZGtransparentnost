import type { Podaci } from "../data";
import { broj, escapeHtml, eur, eurKratko, postotak } from "../format";
import { godineOsHtml, poveziGodine } from "../ui";
import type { Primatelj } from "../types";

const KORAK = 50;

export function prikaziPrimatelje(cilj: HTMLElement, podaci: Podaci, pocetniUpit = ""): void {
  const { primatelji, summary, fizicke } = podaci;
  const godine = summary.godine;
  let odabrana = "sve";
  let upit = pocetniUpit;
  let prikazano = KORAK;

  cilj.innerHTML = `
    <div class="omotac">
      <div class="zaglavlje-stranice">
        <h1 class="naslov-stranice">Primatelji</h1>
        <p class="datum-podataka">Tvrtke, ustanove i udruge koje Grad plaća za usluge i radove</p>
      </div>
      <div class="godine-uz-naslov" style="max-width:420px;margin-bottom:14px">
        ${godineOsHtml(godine, odabrana, "Sve")}
      </div>

      <div class="filtri">
        <input type="search" class="polje" id="pretraga"
          placeholder="Pretraži po nazivu ili OIB-u" aria-label="Pretraga primatelja"
          value="${escapeHtml(upit)}" autocomplete="off" />
        <span class="sitno" id="sazetak"></span>
      </div>

      <div class="tablica-okvir">
        <table>
          <thead><tr>
            <th style="width:3.4rem">#</th><th>Primatelj</th><th>OIB</th>
            <th class="broj">Iznos</th><th class="broj">Isplata</th><th class="broj">Udio</th>
          </tr></thead>
          <tbody id="tablica"></tbody>
        </table>
      </div>
      <p style="text-align:center;margin-top:14px" id="jos-okvir"></p>

      <section class="odjeljak" id="fizicke"></section>
    </div>`;

  const tijelo = cilj.querySelector<HTMLElement>("#tablica")!;
  const sazetak = cilj.querySelector<HTMLElement>("#sazetak")!;
  const pretraga = cilj.querySelector<HTMLInputElement>("#pretraga")!;
  const josOkvir = cilj.querySelector<HTMLElement>("#jos-okvir")!;
  const spremnikFizickih = cilj.querySelector<HTMLElement>("#fizicke")!;

  const zaGodinu = (): Primatelj[] => primatelji[odabrana] ?? [];
  const filtrirani = (): Primatelj[] => {
    const q = upit.trim().toLowerCase();
    if (!q) return zaGodinu();
    return zaGodinu().filter(
      (p) => p.naziv.toLowerCase().includes(q) || p.oib.toLowerCase().includes(q)
    );
  };

  function crtajFizicke(): void {
    const f = fizicke[odabrana];
    if (!f || !f.ukupno) { spremnikFizickih.innerHTML = ""; return; }
    spremnikFizickih.innerHTML = `
      <div class="odjeljak__zaglavlje">
        <h2>Isplate fizičkim osobama</h2>
        <span class="sitno">${escapeHtml(eurKratko(f.ukupno))} · ${escapeHtml(postotak(f.udio))} svih isplata · ${escapeHtml(broj(f.broj_isplata))} isplata</span>
      </div>
      <div class="tablica-okvir">
        <table>
          <thead><tr><th>Vrsta rashoda</th><th class="broj">Iznos</th><th class="broj">Udio</th></tr></thead>
          <tbody>${f.vrste.map((v) => `<tr>
            <td><span class="oznaka-sifra">${escapeHtml(v.sifra)}</span>${escapeHtml(v.naziv)}</td>
            <td class="broj">${escapeHtml(eur(v.ukupno))}</td>
            <td class="broj">${escapeHtml(postotak(v.udio))}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>`;
  }

  function crtaj(): void {
    const svi = zaGodinu();
    const stavke = filtrirani();
    const vidljive = stavke.slice(0, prikazano);

    sazetak.textContent = upit.trim()
      ? `${broj(stavke.length)} od ${broj(svi.length)} primatelja`
      : `${broj(svi.length)} primatelja · ${odabrana === "sve" ? "sve godine" : `${odabrana}.`}`;

    tijelo.innerHTML = vidljive.length
      ? vidljive.map((p, i) => `<tr${p.ima_profil ? ` class="red-klik" data-oib="${escapeHtml(p.oib)}"` : ""}>
          <td class="broj sitno">${upit.trim() ? svi.indexOf(p) + 1 : i + 1}</td>
          <td>${p.ima_profil
            ? `<a class="veza" href="#/primatelj/${encodeURIComponent(p.oib)}">${escapeHtml(p.naziv)}</a>`
            : escapeHtml(p.naziv)}</td>
          <td class="sitno">${escapeHtml(p.oib)}</td>
          <td class="broj${p.ukupno < 0 ? " negativno" : ""}">${escapeHtml(eur(p.ukupno))}</td>
          <td class="broj">${escapeHtml(broj(p.broj_isplata))}</td>
          <td class="broj">${escapeHtml(postotak(p.udio))}</td>
        </tr>`).join("")
      : `<tr><td colspan="6" class="prazno">Nema rezultata.</td></tr>`;

    josOkvir.innerHTML = stavke.length > prikazano
      ? `<button type="button" class="gumb" id="jos">Prikaži još ${escapeHtml(broj(Math.min(KORAK, stavke.length - prikazano)))}</button>`
      : "";
    josOkvir.querySelector("#jos")?.addEventListener("click", () => {
      prikazano += KORAK;
      crtaj();
    });

    crtajFizicke();
  }

  pretraga.addEventListener("input", () => {
    upit = pretraga.value;
    prikazano = KORAK;
    crtaj();
  });

  tijelo.addEventListener("click", (e) => {
    const c = e.target as HTMLElement;
    if (c.closest("a")) return;
    const red = c.closest<HTMLTableRowElement>("tr[data-oib]");
    if (red?.dataset.oib) location.hash = `#/primatelj/${encodeURIComponent(red.dataset.oib)}`;
  });

  poveziGodine(cilj.querySelector<HTMLElement>(".godine-os")!, (g) => {
    odabrana = g;
    prikazano = KORAK;
    crtaj();
  });
  crtaj();
}
