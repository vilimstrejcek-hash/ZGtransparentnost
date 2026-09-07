import type { Podaci } from "../data";
import { broj, escapeHtml, eur, eurKratko, iznosBezValute, postotak } from "../format";
import { napomenaHtml } from "../napomena";
import type { Odjeljak } from "../types";

/** Prigušene boje po odjeljku — ista namjena uvijek ista boja. */
const BOJE: Record<string, string> = {
  "09": "#1f4e8c", // obrazovanje
  "04": "#3d76c4", // ekonomski poslovi
  "06": "#2b6a63", // stanovanje i komunalno
  "08": "#7a6a9c", // rekreacija i kultura
  "01": "#4a5a72", // opće javne usluge
  "10": "#a08a5b", // socijalna zaštita
  "05": "#5a8f88", // okoliš
  "07": "#8a5b5b", // zdravstvo
  "03": "#6f9ad4", // javni red
  "02": "#96a4b8", // obrana
  "99": "#b3bcc9", // nije razvrstano
};

const boja = (sifra: string): string => BOJE[sifra] ?? "#96a4b8";

function redHtml(o: Odjeljak, najveci: number): string {
  const sirina = najveci ? (o.ukupno / najveci) * 100 : 0;
  return `
    <li class="namjena__red">
      <button type="button" class="namjena__gumb" aria-expanded="false" data-sifra="${escapeHtml(o.sifra)}">
        <span class="namjena__euro" style="color:${boja(o.sifra)}">
          ${escapeHtml(iznosBezValute(o.eura_od_sto))}<span class="namjena__euro-znak"> €</span>
        </span>
        <span class="namjena__tijelo">
          <span class="namjena__naziv">${escapeHtml(o.naziv)}</span>
          <span class="namjena__traka" aria-hidden="true">
            <span style="width:${sirina.toFixed(2)}%;background:${boja(o.sifra)}"></span>
          </span>
          <span class="namjena__brojke">
            ${escapeHtml(eurKratko(o.ukupno))} ukupno · ${escapeHtml(eur(o.po_stanovniku))} po stanovniku
          </span>
        </span>
        <span class="namjena__strelica" aria-hidden="true">▸</span>
      </button>
      <div class="namjena__razrada" hidden>
        ${o.skupine.length
          ? `<table>
              <thead><tr><th>Na što točno</th><th class="broj">Iznos</th><th class="broj">Udio</th></tr></thead>
              <tbody>${o.skupine.map((s) => `<tr>
                <td><span class="oznaka-sifra">${escapeHtml(s.sifra)}</span>${escapeHtml(s.naziv)}</td>
                <td class="broj">${escapeHtml(eur(s.ukupno))}</td>
                <td class="broj">${escapeHtml(postotak(s.udio))}</td>
              </tr>`).join("")}</tbody>
            </table>`
          : `<p class="prazno">Nema razrade.</p>`}
      </div>
    </li>`;
}

export function prikaziNamjenu(cilj: HTMLElement, podaci: Podaci): void {
  const { poNamjeni, meta, summary } = podaci;
  const godine = summary.godine;
  // Tekuća godina je nepotpuna, pa se kao zadana bira zadnja cijela.
  const zadnjaPotpuna = meta.pokrivenost.filter((p) => !p.tekuca).at(-1)?.godina;
  let odabrana = zadnjaPotpuna ?? godine[godine.length - 1] ?? "sve";

  cilj.innerHTML = `
    <h2>Kamo ide tvoj euro</h2>
    <p class="podnaslov">
      Sve isplate Grada Zagreba razvrstane po namjeni, prema funkcijskoj klasifikaciji (COFOG) —
      istoj koju koriste i drugi europski gradovi.
    </p>
    ${napomenaHtml(meta)}

    <div class="kontrole">
      <div class="godine" id="izbor-godine" role="group" aria-label="Odabir godine">
        ${godine.map((g) => `<button type="button" data-godina="${g}">${g}.</button>`).join("")}
        <button type="button" data-godina="sve">Sve zajedno</button>
      </div>
    </div>

    <section class="ploca ploca--istaknuta" id="sazetak"></section>

    <section class="ploca">
      <div class="ploca__zaglavlje">
        <h3 id="naslov-liste"></h3>
        <span class="kartica__dodatak">Klikni kategoriju za razradu</span>
      </div>
      <ul class="namjena" id="lista"></ul>
      <p class="kartica__dodatak" id="nota-namjena"></p>
    </section>
  `;

  const sazetak = cilj.querySelector<HTMLElement>("#sazetak")!;
  const lista = cilj.querySelector<HTMLElement>("#lista")!;
  const naslov = cilj.querySelector<HTMLElement>("#naslov-liste")!;
  const nota = cilj.querySelector<HTMLElement>("#nota-namjena")!;

  function crtaj(): void {
    const blok = poNamjeni.godine[odabrana];
    if (!blok) {
      lista.innerHTML = `<li class="prazno">Nema podataka za odabrano razdoblje.</li>`;
      return;
    }

    const oznaka = odabrana === "sve"
      ? `${godine[0]}.–${godine[godine.length - 1]}.`
      : `${odabrana}. godini`;

    sazetak.innerHTML = `
      <p class="istaknuto__uvod">Grad Zagreb je u ${escapeHtml(oznaka)} isplatio</p>
      <p class="istaknuto__iznos">${escapeHtml(eur(blok.ukupno))}</p>
      <p class="istaknuto__dodatak">
        To je <strong>${escapeHtml(eur(blok.po_stanovniku))}</strong> po stanovniku
        (${escapeHtml(broj(poNamjeni.stanovnika))} stanovnika,
        ${escapeHtml(poNamjeni.izvorStanovnistva)}).
      </p>`;

    naslov.textContent = `Od svakih 100 € otišlo je…`;
    const najveci = Math.max(...blok.odjeljci.map((o) => o.ukupno), 0);
    lista.innerHTML = blok.odjeljci.map((o) => redHtml(o, najveci)).join("");

    const nerazvrstano = blok.odjeljci.find((o) => o.sifra === "99");
    nota.textContent = nerazvrstano
      ? `${iznosBezValute(nerazvrstano.eura_od_sto)} € od svakih 100 € nosi funkcijsku oznaku „nije definirano” ili „račun prethodne godine” i ne može se razvrstati po namjeni. To je oznaka iz izvora, ne procjena.`
      : "";
  }

  cilj.querySelector("#izbor-godine")!.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-godina]");
    if (!gumb?.dataset.godina) return;
    odabrana = gumb.dataset.godina;
    for (const b of cilj.querySelectorAll<HTMLButtonElement>("#izbor-godine button")) {
      b.setAttribute("aria-pressed", String(b.dataset.godina === odabrana));
    }
    crtaj();
  });

  lista.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>(".namjena__gumb");
    if (!gumb) return;
    const otvoren = gumb.getAttribute("aria-expanded") === "true";
    gumb.setAttribute("aria-expanded", String(!otvoren));
    const razrada = gumb.nextElementSibling as HTMLElement | null;
    if (razrada) razrada.hidden = otvoren;
  });

  for (const b of cilj.querySelectorAll<HTMLButtonElement>("#izbor-godine button")) {
    b.setAttribute("aria-pressed", String(b.dataset.godina === odabrana));
  }
  crtaj();
}
