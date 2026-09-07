import type { Podaci } from "../data";
import { broj, datum, escapeHtml, eur, eurKratko } from "../format";
import { BOJE_VRSTA, nacrtajKartu, type KartaRuke } from "../karta";
import { brojkaHtml, zaglavljeHtml } from "../ui";
import type { Cetvrt } from "../types";

let karta: KartaRuke | null = null;

/** Prikaz se pri promjeni rute ponovno crta, pa se prethodna karta mora ukloniti. */
export function ocistiKartu(): void {
  karta?.unisti();
  karta = null;
}

export function prikaziCetvrti(cilj: HTMLElement, podaci: Podaci): void {
  const { cetvrti, ustanove, meta } = podaci;
  ocistiKartu();
  let vrsta: string = "sve";
  let poredak: "po_stanovniku" | "ukupno" = "po_stanovniku";
  let otvorena: string | null = null;

  const poStanovniku = cetvrti.cetvrti
    .map((c) => c.po_stanovniku)
    .filter((v): v is number => v !== null);

  cilj.innerHTML = `
    <div class="omotac">
      ${zaglavljeHtml("Ulaganja po četvrtima", datum(meta.zadnji_datum),
        "Koliko sredstava mjesne samouprave otpada na svaku gradsku četvrt i gdje su ustanove koje Grad plaća.")}

      <div class="filtri" id="izbor-vrste" role="group" aria-label="Vrsta ustanove">
        <div class="prekidaci">
          <button type="button" data-vrsta="sve" aria-pressed="true">Sve ustanove</button>
          ${ustanove.vrste.map((v) => `<button type="button" data-vrsta="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join("")}
        </div>
        <span class="sitno" style="margin-left:auto">
          ${escapeHtml(broj(ustanove.spojeno))} ustanova · ${escapeHtml(eurKratko(ustanove.iznos_spojenih))}
        </span>
      </div>

      <div class="karta" id="karta"></div>
      <div class="legenda">
        ${ustanove.vrste.map((v) => `<span><i style="background:${BOJE_VRSTA[v] ?? "#55606e"}"></i>${escapeHtml(v)}</span>`).join("")}
      </div>
      <p class="sitno" style="margin-bottom:30px">${escapeHtml(ustanove.napomena)}</p>

      <div class="brojke">
        ${brojkaHtml("Ukupno za sve četvrti", eur(cetvrti.ukupno), `${cetvrti.godina}. godina`)}
        ${brojkaHtml("Prosjek po stanovniku",
          cetvrti.prosjek_po_stanovniku !== null ? eur(cetvrti.prosjek_po_stanovniku) : "—",
          `${broj(cetvrti.stanovnika)} stanovnika`)}
        ${brojkaHtml("Raspon",
          poStanovniku.length ? `${eurKratko(Math.min(...poStanovniku))} – ${eurKratko(Math.max(...poStanovniku))}` : "—",
          "od najmanje do najveće po stanovniku")}
      </div>

      <p class="napomena">
        <strong>Što je ovdje prikazano.</strong> ${escapeHtml(cetvrti.napomena)}
      </p>

      <section class="odjeljak">
        <div class="odjeljak__zaglavlje">
          <h3>17 gradskih četvrti</h3>
          <div class="prekidaci" id="izbor-poretka" role="group" aria-label="Poredak">
            <button type="button" data-poredak="po_stanovniku" aria-pressed="true">Po stanovniku</button>
            <button type="button" data-poredak="ukupno" aria-pressed="false">Ukupan iznos</button>
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
      <tr class="red-klik" data-naziv="${escapeHtml(c.naziv)}">
        <td><strong>${escapeHtml(c.naziv)}</strong></td>
        <td class="broj">${escapeHtml(broj(c.stanovnika ?? 0))}</td>
        <td class="broj">${escapeHtml(eur(c.ukupno))}</td>
        <td class="broj"><strong>${escapeHtml(c.po_stanovniku !== null ? eur(c.po_stanovniku) : "—")}</strong></td>
        <td class="broj sitno">${otvoren ? "zatvori" : "namjene"}</td>
      </tr>
      ${otvoren ? `<tr><td colspan="5" style="background:#fafafa">
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

  const spremnikKarte = cilj.querySelector<HTMLElement>("#karta")!;
  karta = nacrtajKartu(spremnikKarte);

  function osvjeziKartu(): void {
    karta?.postavi(
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
    crtaj();
  });

  osvjeziKartu();
  crtaj();
}
