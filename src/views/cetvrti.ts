import type { Podaci } from "../data";
import { broj, escapeHtml, eur, eurKratko } from "../format";
import { BOJE_VRSTA, nacrtajKartu, STUPNJEVI_BOJA, type KartaRuke } from "../karta";

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
  let poredak: "po_stanovniku" | "ukupno" = "po_stanovniku";
  let otvorena: string | null = null;

  const poStanovniku = cetvrti.cetvrti
    .map((c) => c.po_stanovniku)
    .filter((v): v is number => v !== null);
  const najmanja = Math.min(...poStanovniku);
  const najveca = Math.max(...poStanovniku);

  cilj.innerHTML = `
    <div class="omotac">
      <div class="zaglavlje-stranice">
        <h1 class="naslov-stranice">Karta</h1>
        <p class="datum-podataka">Ustanove koje Grad plaća i sredstva po četvrtima, ${escapeHtml(cetvrti.godina)}.</p>
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
          <h2>Gradske četvrti</h2>
          <div class="prekidaci" id="izbor-poretka" role="group" aria-label="Poredak">
            <button type="button" data-poredak="po_stanovniku" aria-pressed="true">Po stanovniku</button>
            <button type="button" data-poredak="ukupno" aria-pressed="false">Ukupno</button>
          </div>
        </div>
        <div class="tablica-okvir">
          <table>
            <thead><tr>
              <th>Gradska četvrt</th><th class="broj">Stanovnika</th>
              <th class="broj">Ukupno</th><th class="broj">Po stanovniku</th><th></th>
            </tr></thead>
            <tbody id="tablica-cetvrti"></tbody>
          </table>
        </div>
      </section>
    </div>`;

  const tijelo = cilj.querySelector<HTMLElement>("#tablica-cetvrti")!;

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
    const redci = [...cetvrti.cetvrti].sort((a, b) =>
      poredak === "po_stanovniku"
        ? (b.po_stanovniku ?? 0) - (a.po_stanovniku ?? 0)
        : b.ukupno - a.ukupno
    );
    tijelo.innerHTML = redci.map(redHtml).join("");
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

  cilj.querySelector("#izbor-poretka")!.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-poredak]");
    if (!gumb?.dataset.poredak) return;
    poredak = gumb.dataset.poredak as typeof poredak;
    for (const b of cilj.querySelectorAll<HTMLButtonElement>("#izbor-poretka button")) {
      b.setAttribute("aria-pressed", String(b.dataset.poredak === poredak));
    }
    crtaj();
  });

  tijelo.addEventListener("click", (e) => {
    const red = (e.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-naziv]");
    if (!red?.dataset.naziv) return;
    otvorena = otvorena === red.dataset.naziv ? null : red.dataset.naziv;
    karta?.istakni(otvorena);
    crtaj();
  });

  osvjeziKartu();
  crtaj();
}
