import type { Podaci } from "../data";
import { broj, escapeHtml, eur, eurKratko } from "../format";
import { BOJE_VRSTA, nacrtajKartu, STUPNJEVI_BOJA, type KartaRuke } from "../karta";

import {
  poveziSortiranje, pretraziRedke, sortirajRedke, zaglavljeTabliceHtml,
  type Poredak, type Stupac,
} from "../ui";
import type { Cetvrt } from "../types";

let karta: KartaRuke | null = null;

/** Prikaz se pri promjeni rute ponovno crta, pa se prethodna karta mora ukloniti. */
export function ocistiKartu(): void {
  karta?.unisti();
  karta = null;
}

export function prikaziCetvrti(cilj: HTMLElement, podaci: Podaci): void {
  const { cetvrti, ustanove, granice } = podaci;
  ocistiKartu();
  let vrsta = "sve";
  const poredak: Poredak = { kljuc: "po_stanovniku", silazno: true };

  const stupci: Stupac<Cetvrt>[] = [
    { kljuc: "naziv", naziv: "Gradska četvrt", vrijednost: (c) => c.naziv },
    { kljuc: "stanovnika", naziv: "Stanovnika", broj: true, vrijednost: (c) => c.stanovnika ?? 0 },
    { kljuc: "ukupno", naziv: "Ukupno", broj: true, vrijednost: (c) => c.ukupno },
    { kljuc: "po_stanovniku", naziv: "Po stanovniku", broj: true, vrijednost: (c) => c.po_stanovniku ?? 0 },
    { kljuc: "namjene", naziv: "", bezSortiranja: true },
  ];
  let otvorena: string | null = null;
  let upit = "";

  const poStanovniku = cetvrti.cetvrti
    .map((c) => c.po_stanovniku)
    .filter((v): v is number => v !== null);
  const najmanja = Math.min(...poStanovniku);
  const najveca = Math.max(...poStanovniku);

  cilj.innerHTML = `
    <div class="omotac">
      <div class="zaglavlje-stranice">
        <h1 class="naslov-stranice">Gdje Grad ulaže</h1>
        <p class="datum-podataka">Ustanove koje Grad financira i sredstva mjesne samouprave, ${escapeHtml(cetvrti.godina)}.</p>
      </div>

      <div class="filtri">
        <div class="prekidaci" id="izbor-vrste" role="group" aria-label="Vrsta ustanove">
          <button type="button" data-vrsta="sve" aria-pressed="true">Sve</button>
          ${ustanove.vrste.map((v) => `<button type="button" data-vrsta="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join("")}
        </div>
        <label class="prekidac-kvadratic">
          <input type="checkbox" id="prikaz-cetvrti" checked /> Četvrti
        </label>
        <span class="ljestvica" style="margin-left:auto">
          <span class="sitno">${escapeHtml(eurKratko(najmanja))}</span>
          <span class="ljestvica__trake">
            ${STUPNJEVI_BOJA.map((b) => `<i style="background:${b}"></i>`).join("")}
          </span>
          <span class="sitno">${escapeHtml(eurKratko(najveca))} po stanovniku</span>
        </span>
      </div>

      <div class="karta" id="karta"></div>

      <div class="legenda">
        ${ustanove.vrste.map((v) => `<span><i style="background:${BOJE_VRSTA[v] ?? "#55606e"}"></i>${escapeHtml(v)}</span>`).join("")}
      </div>

      <section class="odjeljak">
        <div class="odjeljak__zaglavlje">
          <h2>Ulaganja po četvrtima</h2>
          <input type="search" class="polje" id="pretraga-cetvrti"
            placeholder="Pretraži četvrti" aria-label="Pretraga gradskih četvrti"
            style="max-width:220px" autocomplete="off" />
        </div>
        <div class="tablica-okvir">
          <table>
            <thead id="zaglavlje-cetvrti"></thead>
            <tbody id="tablica-cetvrti"></tbody>
          </table>
        </div>
      </section>
    </div>`;

  const tijelo = cilj.querySelector<HTMLElement>("#tablica-cetvrti")!;
  const zaglavljeCetvrti = cilj.querySelector<HTMLElement>("#zaglavlje-cetvrti")!;
  poveziSortiranje(zaglavljeCetvrti, stupci, poredak, () => crtaj());

  function redHtml(c: Cetvrt): string {
    const otvoren = otvorena === c.naziv;
    return `
      <tr class="red-klik${otvoren ? " red-otvoren" : ""}" data-naziv="${escapeHtml(c.naziv)}">
        <td><strong>${escapeHtml(c.naziv)}</strong></td>
        <td class="broj">${escapeHtml(broj(c.stanovnika ?? 0))}</td>
        <td class="broj">${escapeHtml(eur(c.ukupno))}</td>
        <td class="broj"><strong>${escapeHtml(c.po_stanovniku !== null ? eur(c.po_stanovniku) : "—")}</strong></td>
        <td class="broj sitno">${otvoren ? "zatvori" : "namjene"}</td>
      </tr>
      ${otvoren ? `<tr><td colspan="5" class="razrada">
        <table style="max-width:640px">
          <thead><tr><th>Namjena</th><th class="broj">Iznos</th></tr></thead>
          <tbody>${c.namjene.map((n) => `<tr>
            <td>${escapeHtml(n.naziv)}</td><td class="broj">${escapeHtml(eur(n.iznos))}</td>
          </tr>`).join("")}</tbody>
        </table>
      </td></tr>` : ""}`;
  }

  function crtaj(): void {
    zaglavljeCetvrti.innerHTML = zaglavljeTabliceHtml(stupci, poredak);
    const nadene = pretraziRedke(cetvrti.cetvrti, stupci, upit);
    tijelo.innerHTML = nadene.length
      ? sortirajRedke(nadene, stupci, poredak).map(redHtml).join("")
      : `<tr><td colspan="5" class="prazno">Nema četvrti koje odgovaraju pretrazi.</td></tr>`;
  }

  karta = nacrtajKartu(cilj.querySelector<HTMLElement>("#karta")!, {
    granice,
    cetvrti: cetvrti.cetvrti,
    naOdabirCetvrti: (naziv) => {
      otvorena = otvorena === naziv ? null : naziv;
      karta?.istakni(otvorena);
      crtaj();
      cilj.querySelector<HTMLElement>(`tr[data-naziv="${CSS.escape(naziv)}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    },
  });

  function osvjeziKartu(): void {
    karta?.postaviUstanove(
      vrsta === "sve" ? ustanove.ustanove : ustanove.ustanove.filter((u) => u.vrsta === vrsta)
    );
  }

  cilj.querySelector("#izbor-vrste")!.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-vrsta]");
    if (!gumb?.dataset.vrsta) return;
    vrsta = gumb.dataset.vrsta;
    for (const b of cilj.querySelectorAll<HTMLButtonElement>("#izbor-vrste button")) {
      b.setAttribute("aria-pressed", String(b.dataset.vrsta === vrsta));
    }
    osvjeziKartu();
  });

  cilj.querySelector<HTMLInputElement>("#prikaz-cetvrti")!.addEventListener("change", (e) => {
    karta?.prikaziCetvrti((e.target as HTMLInputElement).checked);
  });

  tijelo.addEventListener("click", (e) => {
    const red = (e.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-naziv]");
    if (!red?.dataset.naziv) return;
    otvorena = otvorena === red.dataset.naziv ? null : red.dataset.naziv;
    karta?.istakni(otvorena);
    crtaj();
  });

  cilj.querySelector<HTMLInputElement>("#pretraga-cetvrti")!.addEventListener("input", (e) => {
    upit = (e.target as HTMLInputElement).value;
    crtaj();
  });

  osvjeziKartu();
  crtaj();
}
