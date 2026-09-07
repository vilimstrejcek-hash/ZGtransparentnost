import { boja, nacrtaj, novacTooltip, OPCI_TOOLTIP, OS_NOVAC } from "../charts";
import { ucitajProfil, type Podaci } from "../data";
import { broj, datum, duljinaOznake, escapeHtml, eur, mjesecKratko, postotak, skrati } from "../format";
import { napomenaHtml } from "../napomena";
import type { Profil } from "../types";

const PORTAL = "https://transparentnost.zagreb.hr";

function karticaHtml(oznaka: string, vrijednost: string, dodatak: string): string {
  return `<div class="kartica">
    <p class="kartica__oznaka">${escapeHtml(oznaka)}</p>
    <div class="kartica__vrijednost">${escapeHtml(vrijednost)}</div>
    <p class="kartica__dodatak">${escapeHtml(dodatak)}</p>
  </div>`;
}

function nijePronaden(cilj: HTMLElement, oib: string): void {
  cilj.innerHTML = `
    <a class="natrag" href="#/primatelji">← Natrag na primatelje</a>
    <div class="ploca">
      <h2>Profil nije dostupan</h2>
      <p class="podnaslov">Za OIB ${escapeHtml(oib)} nema podataka.</p>
      <p>Profili se izrađuju samo za primatelje s najmanje pet isplata u obrađenim
        razdobljima. Isplate fizičkim osobama u izvoru su anonimizirane i nemaju profil.</p>
      <p><a class="gumb gumb--sporedni" href="#/primatelji">Pregledaj sve primatelje</a></p>
    </div>`;
}

export async function prikaziProfil(cilj: HTMLElement, podaci: Podaci, oib: string): Promise<void> {
  const profil = await ucitajProfil(oib);
  if (!profil) {
    nijePronaden(cilj, oib);
    return;
  }
  const { meta } = podaci;
  const p: Profil = profil;

  const prosjek = p.broj_isplata ? p.ukupno / p.broj_isplata : 0;
  const najveca = p.isplate.reduce((m, i) => (i.iznos > m ? i.iznos : m), 0);

  cilj.innerHTML = `
    <a class="natrag" href="#/primatelji">← Natrag na primatelje</a>
    <h2>${escapeHtml(p.naziv)}</h2>
    <p class="podnaslov">
      OIB ${escapeHtml(p.oib)}${p.mjesto ? ` · ${escapeHtml(p.mjesto)}` : ""}
      · isplate od ${escapeHtml(datum(p.prva_isplata))} do ${escapeHtml(datum(p.zadnja_isplata))}
    </p>
    ${napomenaHtml(meta, "Prikazane su samo isplate iz obrađenih razdoblja, ne cjelokupno poslovanje s Gradom.")}

    <div class="kartice">
      ${karticaHtml("Ukupno primljeno", eur(p.ukupno), `${broj(p.broj_isplata)} isplata`)}
      ${karticaHtml("Prosječna isplata", eur(prosjek), "po pojedinoj isplati")}
      ${karticaHtml("Najveća isplata", eur(najveca), "pojedinačno")}
      ${karticaHtml("Gradskih ureda", broj(p.po_uredu.length), "iz kojih je primao sredstva")}
    </div>

    <div class="mreza-2">
      <section class="ploca">
        <h3>Isplate kroz vrijeme</h3>
        <div class="graf-okvir graf-okvir--nizak"><canvas id="graf-vrijeme"></canvas></div>
      </section>
      <section class="ploca">
        <h3>Iz kojih ureda</h3>
        <div class="graf-okvir graf-okvir--nizak"><canvas id="graf-uredi-profil"></canvas></div>
      </section>
    </div>

    <section class="ploca">
      <div class="ploca__zaglavlje">
        <h3>Sve isplate (${escapeHtml(broj(p.broj_isplata))})</h3>
        <button type="button" class="gumb" id="gumb-portal">Provjeri na iTransparentnosti</button>
      </div>
      <p class="kartica__dodatak" id="nota-portal" style="margin:-6px 0 12px">
        Portal nema izravnu poveznicu po OIB-u — OIB se kopira u međuspremnik da ga zalijepiš u „Filteri”.
      </p>
      <div class="tablica-okvir">
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th class="broj">Iznos</th>
              <th>Gradski ured</th>
              <th>Opis</th>
              <th>Broj računa</th>
            </tr>
          </thead>
          <tbody id="tablica-isplata"></tbody>
        </table>
      </div>
    </section>
  `;

  // --- Isplate kroz vrijeme ---
  nacrtaj(cilj.querySelector<HTMLCanvasElement>("#graf-vrijeme")!, {
    type: "bar",
    data: {
      labels: p.po_mjesecu.map((m) => mjesecKratko(m.mjesec)),
      datasets: [{
        data: p.po_mjesecu.map((m) => m.ukupno),
        backgroundColor: boja(0),
        borderRadius: 3,
        maxBarThickness: 56,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: novacTooltip((i) => {
          const m = p.po_mjesecu[i]!;
          return `${mjesecKratko(m.mjesec)} — ${broj(m.broj_isplata)} isplata`;
        }),
      },
      scales: { y: { beginAtZero: true, ...OS_NOVAC }, x: { grid: { display: false } } },
    },
  });

  // --- Donut po uredu ---
  const uredi = p.po_uredu.filter((u) => u.ukupno > 0);
  const ukupnoUredi = uredi.reduce((z, u) => z + u.ukupno, 0);
  if (uredi.length) {
    nacrtaj(cilj.querySelector<HTMLCanvasElement>("#graf-uredi-profil")!, {
      type: "doughnut",
      data: {
        labels: uredi.map((u) => skrati(u.naziv, duljinaOznake(34, 22))),
        datasets: [{
          data: uredi.map((u) => u.ukupno),
          backgroundColor: uredi.map((_, i) => boja(i)),
          borderWidth: 2,
          borderColor: "#fff",
        }],
      },
      options: {
        responsive: true,
        cutout: "58%",
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 10, font: { size: 11 } } },
          tooltip: {
            ...OPCI_TOOLTIP,
            displayColors: true,
            callbacks: {
              title: (s: { dataIndex: number }[]) => uredi[s[0]!.dataIndex]!.naziv,
              label: (c: { parsed: number; dataIndex: number }) =>
                `${eur(c.parsed)} · ${postotak(ukupnoUredi ? (c.parsed / ukupnoUredi) * 100 : 0)}`,
            },
          },
        },
      },
    });
  } else {
    cilj.querySelector("#graf-uredi-profil")!.replaceWith(
      Object.assign(document.createElement("p"), {
        className: "prazno",
        textContent: "Nema podataka o uredima.",
      })
    );
  }

  // --- Tablica isplata ---
  (cilj.querySelector("#tablica-isplata") as HTMLElement).innerHTML = p.isplate.length
    ? p.isplate.map((i) => `<tr>
        <td>${escapeHtml(datum(i.datum))}</td>
        <td class="broj${i.iznos < 0 ? " negativno" : ""}">${escapeHtml(eur(i.iznos))}</td>
        <td><span class="oznaka-sifra">${escapeHtml(i.ured_sifra)}</span>${escapeHtml(skrati(i.ured_naziv, 44))}</td>
        <td>${escapeHtml(i.opis) || '<span class="kartica__dodatak">—</span>'}</td>
        <td>${escapeHtml(i.broj_racuna) || '<span class="kartica__dodatak">—</span>'}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="prazno">Nema isplata.</td></tr>`;

  // --- Gumb prema portalu ---
  const gumb = cilj.querySelector<HTMLButtonElement>("#gumb-portal")!;
  const nota = cilj.querySelector<HTMLElement>("#nota-portal")!;
  gumb.addEventListener("click", () => {
    void navigator.clipboard?.writeText(p.oib).then(
      () => { nota.textContent = `OIB ${p.oib} kopiran — zalijepi ga u „Filteri” na portalu.`; },
      () => { nota.textContent = `Zalijepi OIB ${p.oib} u „Filteri” na portalu.`; }
    );
    window.open(PORTAL, "_blank", "noopener,noreferrer");
  });
}
