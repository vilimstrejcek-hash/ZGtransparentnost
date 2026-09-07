import type { Podaci } from "../data";
import { broj, escapeHtml, eur, eurKratko, postotak } from "../format";
import type { PlanGodina } from "../types";

function karticaHtml(oznaka: string, vrijednost: string, dodatak: string): string {
  return `<div class="kartica">
    <p class="kartica__oznaka">${escapeHtml(oznaka)}</p>
    <div class="kartica__vrijednost">${escapeHtml(vrijednost)}</div>
    <p class="kartica__dodatak">${escapeHtml(dodatak)}</p>
  </div>`;
}

/** Traka koja usporedno prikazuje plan i stvarno isplaćeno. */
function usporedbaHtml(plan: number, isplaceno: number, najveci: number): string {
  const p = najveci ? (plan / najveci) * 100 : 0;
  const i = najveci ? (isplaceno / najveci) * 100 : 0;
  const preko = isplaceno > plan;
  return `<span class="usporedba" aria-hidden="true">
    <span class="usporedba__plan" style="width:${p.toFixed(2)}%"></span>
    <span class="usporedba__isplata${preko ? " usporedba__isplata--preko" : ""}"
      style="width:${i.toFixed(2)}%"></span>
  </span>`;
}

export function prikaziPlan(cilj: HTMLElement, podaci: Podaci): void {
  const { plan, meta } = podaci;
  const godine = Object.keys(plan.godine).sort();
  // Tekuća godina je nepotpuna, pa se kao zadana bira zadnja cijela.
  const potpune = new Set(meta.pokrivenost.filter((p) => !p.tekuca).map((p) => p.godina));
  let odabrana = [...godine].reverse().find((g) => potpune.has(g)) ?? godine[godine.length - 1] ?? "";

  cilj.innerHTML = `
    <h2>Plan i stvarnost</h2>
    <p class="podnaslov">
      Koliko je proračunom planirano, a koliko stvarno isplaćeno s gradskog računa —
      spojeno po programskoj i ekonomskoj klasifikaciji.
    </p>

    <p class="napomena">
      <strong>Kako čitati.</strong> Plan je konsolidirani, pa uključuje i škole, vrtiće i
      ustanove koje dio rashoda plaćaju sa svojih računa. Zato niži omjer isplaćenog
      <em>ne</em> znači da novac nije potrošen, nego da nije prošao kroz gradski račun.
      Prekoračenja se uspoređuju s objavljenim planom; izmjene proračuna tijekom godine
      mogu objasniti dio odstupanja.
    </p>

    <div class="kontrole">
      <div class="godine" id="izbor-godine" role="group" aria-label="Odabir godine">
        ${godine.map((g) => `<button type="button" data-godina="${g}">${g}.</button>`).join("")}
      </div>
    </div>

    <div class="kartice" id="kartice"></div>

    <section class="ploca">
      <div class="ploca__zaglavlje">
        <h3>Isplaćeno iznad plana</h3>
        <span class="kartica__dodatak" id="sazetak-preko"></span>
      </div>
      <div class="tablica-okvir">
        <table>
          <thead><tr>
            <th>Program i namjena</th><th class="broj">Plan</th>
            <th class="broj">Isplaćeno</th><th class="broj">Razlika</th><th class="broj">Omjer</th>
          </tr></thead>
          <tbody id="tablica-preko"></tbody>
        </table>
      </div>
    </section>

    <section class="ploca">
      <div class="ploca__zaglavlje">
        <h3>Najveće stavke: plan i isplate</h3>
        <span class="kartica__dodatak">Po ekonomskoj klasifikaciji</span>
      </div>
      <div class="legenda">
        <span><i class="legenda__plan"></i> plan</span>
        <span><i class="legenda__isplata"></i> isplaćeno s gradskog računa</span>
        <span><i class="legenda__preko"></i> iznad plana</span>
      </div>
      <ul class="usporedbe" id="lista-ekonomska"></ul>
    </section>
  `;

  const kartice = cilj.querySelector<HTMLElement>("#kartice")!;
  const tijeloPreko = cilj.querySelector<HTMLElement>("#tablica-preko")!;
  const sazetakPreko = cilj.querySelector<HTMLElement>("#sazetak-preko")!;
  const listaEk = cilj.querySelector<HTMLElement>("#lista-ekonomska")!;

  function crtaj(): void {
    const b: PlanGodina | undefined = plan.godine[odabrana];
    if (!b) return;

    kartice.innerHTML = [
      karticaHtml("Planirano", eur(b.plan_ukupno), `konsolidirani plan za ${odabrana}.`),
      karticaHtml("Isplaćeno s gradskog računa", eur(b.isplaceno_ukupno),
        b.udio_isplacenog !== null ? `${postotak(b.udio_isplacenog)} plana` : ""),
      karticaHtml("Iznad plana", eur(b.prekoracenja_iznos),
        `${broj(b.prekoracenja_broj)} stavki isplaćeno više nego planirano`),
      karticaHtml("Bez stavke u planu", eur(b.bez_plana_iznos),
        `${broj(b.bez_plana_broj)} stavki iznad 100.000 €`),
    ].join("");

    sazetakPreko.textContent = `${broj(b.prekoracenja_broj)} stavki ukupno, prikazano najvećih ${Math.min(30, b.prekoracenja.length)}`;
    tijeloPreko.innerHTML = b.prekoracenja.length
      ? b.prekoracenja.map((r) => `<tr>
          <td>
            <strong>${escapeHtml(r.program_naziv)}</strong><br>
            <span class="kartica__dodatak">
              <span class="oznaka-sifra">${escapeHtml(r.ekonomska_sifra)}</span>${escapeHtml(r.ekonomska_naziv)}
            </span>
          </td>
          <td class="broj">${escapeHtml(eurKratko(r.plan))}</td>
          <td class="broj">${escapeHtml(eurKratko(r.isplaceno))}</td>
          <td class="broj"><strong>${escapeHtml(eurKratko(r.razlika))}</strong></td>
          <td class="broj">${escapeHtml(postotak(r.omjer))}</td>
        </tr>`).join("")
      : `<tr><td colspan="5" class="prazno">Nema stavki iznad plana.</td></tr>`;

    const najveci = Math.max(...b.po_ekonomskoj.map((r) => Math.max(r.plan, r.isplaceno)), 0);
    listaEk.innerHTML = b.po_ekonomskoj.map((r) => `
      <li class="usporedba__red">
        <div class="usporedba__naziv">
          <span class="oznaka-sifra">${escapeHtml(r.sifra)}</span>${escapeHtml(r.naziv || "—")}
        </div>
        ${usporedbaHtml(r.plan, r.isplaceno, najveci)}
        <div class="usporedba__brojke">
          plan ${escapeHtml(eurKratko(r.plan))} · isplaćeno ${escapeHtml(eurKratko(r.isplaceno))}
          ${r.omjer !== null ? ` · ${escapeHtml(postotak(r.omjer))}` : ""}
        </div>
      </li>`).join("");
  }

  cilj.querySelector("#izbor-godine")!.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-godina]");
    if (!gumb?.dataset.godina) return;
    odabrana = gumb.dataset.godina;
    for (const x of cilj.querySelectorAll<HTMLButtonElement>("#izbor-godine button")) {
      x.setAttribute("aria-pressed", String(x.dataset.godina === odabrana));
    }
    crtaj();
  });

  for (const x of cilj.querySelectorAll<HTMLButtonElement>("#izbor-godine button")) {
    x.setAttribute("aria-pressed", String(x.dataset.godina === odabrana));
  }
  crtaj();
}
