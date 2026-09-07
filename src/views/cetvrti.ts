import type { Podaci } from "../data";
import { broj, escapeHtml, eur, eurKratko, iznosBezValute } from "../format";
import type { Cetvrt } from "../types";

export function prikaziCetvrti(cilj: HTMLElement, podaci: Podaci): void {
  const { cetvrti } = podaci;
  let poredak: "po_stanovniku" | "ukupno" = "po_stanovniku";
  let otvorena: string | null = null;

  cilj.innerHTML = `
    <h2>Tvoja gradska četvrt</h2>
    <p class="podnaslov">
      Koliko novca mjesne samouprave otpada na svaku gradsku četvrt — ukupno i po stanovniku.
    </p>

    <p class="napomena">
      <strong>Što je ovdje prikazano.</strong> ${escapeHtml(cetvrti.napomena)}
      Podaci za ${escapeHtml(cetvrti.godina)}. godinu.
    </p>

    <div class="kartice">
      <div class="kartica">
        <p class="kartica__oznaka">Ukupno za sve četvrti</p>
        <div class="kartica__vrijednost">${escapeHtml(eur(cetvrti.ukupno))}</div>
        <p class="kartica__dodatak">${escapeHtml(cetvrti.godina)}. godina</p>
      </div>
      <div class="kartica">
        <p class="kartica__oznaka">Prosjek po stanovniku</p>
        <div class="kartica__vrijednost">${escapeHtml(
          cetvrti.prosjek_po_stanovniku !== null ? eur(cetvrti.prosjek_po_stanovniku) : "—"
        )}</div>
        <p class="kartica__dodatak">${escapeHtml(broj(cetvrti.stanovnika))} stanovnika</p>
      </div>
      <div class="kartica">
        <p class="kartica__oznaka">Raspon</p>
        <div class="kartica__vrijednost" id="raspon">—</div>
        <p class="kartica__dodatak">od najmanje do najveće po stanovniku</p>
      </div>
    </div>

    <section class="ploca">
      <div class="ploca__zaglavlje">
        <h3>17 gradskih četvrti</h3>
        <div class="godine" id="izbor-poretka" role="group" aria-label="Poredak">
          <button type="button" data-poredak="po_stanovniku" aria-pressed="true">Po stanovniku</button>
          <button type="button" data-poredak="ukupno" aria-pressed="false">Ukupan iznos</button>
        </div>
      </div>
      <ul class="cetvrti" id="lista"></ul>
    </section>
  `;

  const lista = cilj.querySelector<HTMLElement>("#lista")!;
  const raspon = cilj.querySelector<HTMLElement>("#raspon")!;

  const poStanovniku = cetvrti.cetvrti
    .map((c) => c.po_stanovniku)
    .filter((v): v is number => v !== null);
  raspon.textContent = poStanovniku.length
    ? `${iznosBezValute(Math.min(...poStanovniku))} – ${eur(Math.max(...poStanovniku))}`
    : "—";

  function redHtml(c: Cetvrt, najveci: number): string {
    const vrijednost = poredak === "po_stanovniku" ? (c.po_stanovniku ?? 0) : c.ukupno;
    const sirina = najveci ? (vrijednost / najveci) * 100 : 0;
    const otvoren = otvorena === c.naziv;
    return `
      <li class="cetvrt">
        <button type="button" class="cetvrt__gumb" aria-expanded="${otvoren}" data-naziv="${escapeHtml(c.naziv)}">
          <span class="cetvrt__naziv">${escapeHtml(c.naziv)}</span>
          <span class="cetvrt__traka" aria-hidden="true"><span style="width:${sirina.toFixed(2)}%"></span></span>
          <span class="cetvrt__iznos">
            ${escapeHtml(poredak === "po_stanovniku"
              ? (c.po_stanovniku !== null ? eur(c.po_stanovniku) : "—")
              : eurKratko(c.ukupno))}
          </span>
        </button>
        <div class="cetvrt__razrada"${otvoren ? "" : " hidden"}>
          <p class="kartica__dodatak">
            ${escapeHtml(broj(c.stanovnika ?? 0))} stanovnika ·
            ukupno ${escapeHtml(eur(c.ukupno))} ·
            ${escapeHtml(c.po_stanovniku !== null ? eur(c.po_stanovniku) : "—")} po stanovniku
          </p>
          <table>
            <thead><tr><th>Namjena</th><th class="broj">Iznos</th></tr></thead>
            <tbody>${c.namjene.map((n) => `<tr>
              <td>${escapeHtml(n.naziv)}</td>
              <td class="broj">${escapeHtml(eur(n.iznos))}</td>
            </tr>`).join("")}</tbody>
          </table>
        </div>
      </li>`;
  }

  function crtaj(): void {
    const redci = [...cetvrti.cetvrti].sort((a, b) =>
      poredak === "po_stanovniku"
        ? (b.po_stanovniku ?? 0) - (a.po_stanovniku ?? 0)
        : b.ukupno - a.ukupno
    );
    const najveci = Math.max(
      ...redci.map((c) => (poredak === "po_stanovniku" ? (c.po_stanovniku ?? 0) : c.ukupno)),
      0
    );
    lista.innerHTML = redci.map((c) => redHtml(c, najveci)).join("");
  }

  cilj.querySelector("#izbor-poretka")!.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-poredak]");
    if (!gumb?.dataset.poredak) return;
    poredak = gumb.dataset.poredak as typeof poredak;
    for (const b of cilj.querySelectorAll<HTMLButtonElement>("#izbor-poretka button")) {
      b.setAttribute("aria-pressed", String(b.dataset.poredak === poredak));
    }
    crtaj();
  });

  lista.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>(".cetvrt__gumb");
    if (!gumb?.dataset.naziv) return;
    otvorena = otvorena === gumb.dataset.naziv ? null : gumb.dataset.naziv;
    crtaj();
  });

  crtaj();
}
