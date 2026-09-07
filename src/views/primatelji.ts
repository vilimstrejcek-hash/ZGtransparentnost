import { boja, nacrtaj, OPCI_TOOLTIP, OS_NOVAC } from "../charts";
import type { Podaci } from "../data";
import { broj, duljinaOznake, escapeHtml, eur, postotak, skrati } from "../format";
import { napomenaHtml } from "../napomena";
import type { Primatelj } from "../types";

const BROJ_U_GRAFU = 20;

export function prikaziPrimatelje(cilj: HTMLElement, podaci: Podaci): void {
  const { top, meta, summary } = podaci;
  const godine = summary.godine;

  const pocetna = new URLSearchParams(location.hash.split("?")[1] ?? "").get("godina");
  let odabranaGodina = pocetna && (godine.includes(pocetna) || pocetna === "sve") ? pocetna : "sve";
  let upit = "";

  cilj.innerHTML = `
    <h2>Primatelji</h2>
    <p class="podnaslov">Tko je primio najviše novca iz gradskog proračuna. Klik na primatelja otvara profil.</p>
    ${napomenaHtml(meta, "Rangiranje se odnosi samo na obrađena razdoblja.")}

    <div class="kontrole">
      <div class="godine" id="izbor-godine" role="group" aria-label="Odabir godine">
        <button type="button" data-godina="sve">Sve</button>
        ${godine.map((g) => `<button type="button" data-godina="${g}">${g}.</button>`).join("")}
      </div>
      <input type="search" id="pretraga" placeholder="Pretraži po nazivu ili OIB-u…"
        aria-label="Pretraga primatelja" autocomplete="off" />
    </div>

    <section class="ploca">
      <div class="ploca__zaglavlje">
        <h3 id="naslov-grafa">Top ${BROJ_U_GRAFU} primatelja</h3>
        <span class="kartica__dodatak" id="sazetak-grafa"></span>
      </div>
      <div class="graf-okvir graf-okvir--visok"><canvas id="graf-primatelji"></canvas></div>
    </section>

    <section class="ploca">
      <div class="ploca__zaglavlje">
        <h3>Top 50 primatelja</h3>
        <span class="kartica__dodatak" id="sazetak-tablice"></span>
      </div>
      <div class="tablica-okvir">
        <table>
          <thead>
            <tr>
              <th style="width:3rem">#</th>
              <th>Primatelj</th>
              <th>OIB</th>
              <th class="broj">Ukupno</th>
              <th class="broj">Isplata</th>
              <th class="broj">Udio</th>
            </tr>
          </thead>
          <tbody id="tablica-primatelji"></tbody>
        </table>
      </div>
    </section>
  `;

  const platno = cilj.querySelector<HTMLCanvasElement>("#graf-primatelji")!;
  const tijelo = cilj.querySelector<HTMLElement>("#tablica-primatelji")!;
  const naslovGrafa = cilj.querySelector<HTMLElement>("#naslov-grafa")!;
  const sazetakGrafa = cilj.querySelector<HTMLElement>("#sazetak-grafa")!;
  const sazetakTablice = cilj.querySelector<HTMLElement>("#sazetak-tablice")!;

  const zaGodinu = (): Primatelj[] => top[odabranaGodina] ?? [];

  const filtrirani = (): Primatelj[] => {
    if (!upit) return zaGodinu();
    const q = upit.toLowerCase();
    return zaGodinu().filter(
      (p) => p.naziv.toLowerCase().includes(q) || p.oib.toLowerCase().includes(q)
    );
  };

  function oznakaGodine(): string {
    return odabranaGodina === "sve" ? "sva razdoblja" : `${odabranaGodina}.`;
  }

  function crtajGraf(): void {
    const stavke = filtrirani().slice(0, BROJ_U_GRAFU);
    naslovGrafa.textContent = upit
      ? `Najveći među rezultatima pretrage (${oznakaGodine()})`
      : `Top ${Math.min(BROJ_U_GRAFU, stavke.length)} primatelja — ${oznakaGodine()}`;

    if (!stavke.length) {
      nacrtaj(platno, { type: "bar", data: { labels: [], datasets: [] }, options: {} });
      sazetakGrafa.textContent = "Nema rezultata.";
      return;
    }
    sazetakGrafa.textContent = `${eur(stavke.reduce((z, p) => z + p.ukupno, 0))} zajedno`;

    nacrtaj(platno, {
      type: "bar",
      data: {
        labels: stavke.map((p) => skrati(p.naziv, duljinaOznake())),
        datasets: [{
          data: stavke.map((p) => p.ukupno),
          backgroundColor: stavke.map((p) => (p.oib === "GDPR" ? boja(9) : boja(0))),
          borderRadius: 3,
          maxBarThickness: 20,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        onClick: (_e: unknown, elementi: { index: number }[]) => {
          const p = stavke[elementi[0]?.index ?? -1];
          if (p?.ima_profil) location.hash = `#/primatelj/${encodeURIComponent(p.oib)}`;
        },
        onHover: (e: { native?: Event }, elementi: { index: number }[]) => {
          const meta_ = elementi[0] ? stavke[elementi[0].index] : undefined;
          const cilj_ = (e.native?.target as HTMLElement | undefined);
          if (cilj_) cilj_.style.cursor = meta_?.ima_profil ? "pointer" : "default";
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...OPCI_TOOLTIP,
            callbacks: {
              title: (s: { dataIndex: number }[]) => stavke[s[0]!.dataIndex]!.naziv,
              label: (c: { parsed: { x: number } }) => eur(c.parsed.x),
              afterLabel: (c: { dataIndex: number }) => {
                const p = stavke[c.dataIndex]!;
                const redci = [
                  `${broj(p.broj_isplata)} isplata · ${postotak(p.udio)} ukupnog`,
                  p.uredi[0] ? `Najviše: ${skrati(p.uredi[0].naziv, 46)}` : "",
                  p.ima_profil ? "Klikni za profil" : "",
                ];
                return redci.filter(Boolean).join("\n");
              },
            },
          },
        },
        scales: {
          x: { beginAtZero: true, ...OS_NOVAC },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  }

  function crtajTablicu(): void {
    const stavke = filtrirani();
    sazetakTablice.textContent = upit
      ? `${broj(stavke.length)} od ${broj(zaGodinu().length)} primatelja odgovara pretrazi`
      : `${oznakaGodine()}`;

    if (!stavke.length) {
      tijelo.innerHTML = `<tr><td colspan="6" class="prazno">Nema primatelja koji odgovaraju pretrazi.</td></tr>`;
      return;
    }

    const sviZaGodinu = zaGodinu();
    tijelo.innerHTML = stavke
      .map((p) => {
        const mjesto = sviZaGodinu.indexOf(p) + 1;
        const naziv = p.ima_profil
          ? `<a class="veza" href="#/primatelj/${encodeURIComponent(p.oib)}">${escapeHtml(p.naziv)}</a>`
          : escapeHtml(p.naziv);
        const oib = p.oib === "GDPR"
          ? `<span class="kartica__dodatak">anonimizirano</span>`
          : escapeHtml(p.oib);
        return `<tr${p.ima_profil ? ` class="red-klik" data-oib="${escapeHtml(p.oib)}"` : ""}>
          <td class="broj">${mjesto}</td>
          <td>${naziv}</td>
          <td>${oib}</td>
          <td class="broj${p.ukupno < 0 ? " negativno" : ""}">${escapeHtml(eur(p.ukupno))}</td>
          <td class="broj">${escapeHtml(broj(p.broj_isplata))}</td>
          <td class="broj">${escapeHtml(postotak(p.udio))}</td>
        </tr>`;
      })
      .join("");
  }

  function osvjezi(): void {
    for (const b of cilj.querySelectorAll<HTMLButtonElement>("#izbor-godine button")) {
      b.setAttribute("aria-pressed", String(b.dataset.godina === odabranaGodina));
    }
    crtajGraf();
    crtajTablicu();
  }

  cilj.querySelector("#izbor-godine")!.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-godina]");
    if (!gumb?.dataset.godina) return;
    odabranaGodina = gumb.dataset.godina;
    osvjezi();
  });

  const pretraga = cilj.querySelector<HTMLInputElement>("#pretraga")!;
  pretraga.addEventListener("input", () => {
    upit = pretraga.value.trim();
    osvjezi();
  });

  tijelo.addEventListener("click", (e) => {
    const cilj_ = e.target as HTMLElement;
    if (cilj_.closest("a")) return;
    const red = cilj_.closest<HTMLTableRowElement>("tr[data-oib]");
    if (red?.dataset.oib) location.hash = `#/primatelj/${encodeURIComponent(red.dataset.oib)}`;
  });

  osvjezi();
}
