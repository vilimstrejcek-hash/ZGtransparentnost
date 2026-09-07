import { boja, nacrtaj, novacTooltip, OPCI_TOOLTIP, OS_NOVAC } from "../charts";
import { ucitajProfil, type Podaci } from "../data";
import { broj, datum, duljinaOznake, escapeHtml, eur, mjesecKratko, postotak, skrati } from "../format";
import { brojkaHtml } from "../ui";
import type { Profil } from "../types";

const PORTAL = "https://transparentnost.zagreb.hr";

function nijePronaden(cilj: HTMLElement, oib: string): void {
  cilj.innerHTML = `
    <div class="omotac">
    <a class="natrag" href="#/isplate">← Natrag na isplate</a>
    <div class="odjeljak">
      <h2>Profil nije dostupan</h2>
      <p class="datum-podataka">Za OIB ${escapeHtml(oib)} nema podataka.</p>
      <p>Profili se izrađuju samo za primatelje s najmanje pet isplata u obrađenim
        razdobljima. Isplate fizičkim osobama u izvoru su anonimizirane i nemaju profil.</p>
      <p><a class="gumb" href="#/isplate">Pregledaj sve primatelje</a></p>
    </div></div>`;
}

export async function prikaziProfil(cilj: HTMLElement, podaci: Podaci, oib: string): Promise<void> {
  const profil = await ucitajProfil(oib);
  if (!profil) {
    nijePronaden(cilj, oib);
    return;
  }
  const { meta } = podaci;
  const p: Profil = profil;

  const { sifarnici } = podaci;
  const prosjek = p.broj_isplata ? p.ukupno / p.broj_isplata : 0;
  const najveca = p.isplate.reduce((m, i) => (i.i > m ? i.i : m), 0);
  const naziv = (mapa: Record<string, string>, sifra: string): string =>
    sifra ? (mapa[sifra] ?? sifra) : "";

  cilj.innerHTML = `
    <div class="omotac">
    <a class="natrag" href="#/isplate">← Natrag na isplate</a>
    <div class="zaglavlje-stranice">
      <h2 class="naslov-stranice">${escapeHtml(p.naziv)}</h2>
      <p class="datum-podataka">${escapeHtml(datum(meta.zadnji_datum))}</p>
    </div>
    <p class="uvod sitno">
      OIB ${escapeHtml(p.oib)}${p.mjesto ? ` · ${escapeHtml(p.mjesto)}` : ""}
      · isplate od ${escapeHtml(datum(p.prva_isplata))} do ${escapeHtml(datum(p.zadnja_isplata))}
    </p>
    
    <div class="brojke">
      ${brojkaHtml("Ukupno primljeno", eur(p.ukupno), `${broj(p.broj_isplata)} isplata`)}
      ${brojkaHtml("Prosječna isplata", eur(prosjek), "po pojedinoj isplati")}
      ${brojkaHtml("Najveća isplata", eur(najveca), "pojedinačno")}
      ${brojkaHtml("Gradskih ureda", broj(p.po_uredu.length), "iz kojih je primao sredstva")}
    </div>

    <div class="mreza-2">
      <section class="odjeljak">
        <h3>Isplate kroz vrijeme</h3>
        <div class="graf-okvir graf-okvir--nizak"><canvas id="graf-vrijeme"></canvas></div>
      </section>
      <section class="odjeljak">
        <h3>Iz kojih ureda</h3>
        <div class="graf-okvir graf-okvir--nizak"><canvas id="graf-uredi-profil"></canvas></div>
      </section>
    </div>

    <section class="odjeljak">
      <div class="odjeljak__zaglavlje">
        <h3>${p.popis_potpun
          ? `Sve isplate (${escapeHtml(broj(p.broj_isplata))})`
          : `Najvećih ${escapeHtml(broj(p.prikazano_isplata))} isplata`}</h3>
        <button type="button" class="gumb" id="gumb-portal">Provjeri na iTransparentnosti</button>
      </div>
      <p class="sitno" id="nota-portal" style="margin:-6px 0 12px">
        ${p.popis_potpun
          ? ""
          : `Prikazano je ${escapeHtml(broj(p.prikazano_isplata))} najvećih od ukupno
             ${escapeHtml(broj(p.broj_isplata))} isplata; zbrojevi i grafovi iznad računaju se iz svih.
             Cijeli popis dostupan je na izvornom portalu. `}
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
              <th>Broj ugovora</th>
            </tr>
          </thead>
          <tbody id="tablica-isplata"></tbody>
        </table>
      </div>
    </section>
    </div>
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
  const svi = p.po_uredu.filter((u) => u.ukupno > 0);
  const NAJVISE_UREDA = 8;
  const uredi = svi.length > NAJVISE_UREDA
    ? [
        ...svi.slice(0, NAJVISE_UREDA),
        {
          sifra: "",
          naziv: `Ostali uredi (${svi.length - NAJVISE_UREDA})`,
          ukupno: svi.slice(NAJVISE_UREDA).reduce((a, b) => a + b.ukupno, 0),
          broj_isplata: svi.slice(NAJVISE_UREDA).reduce((a, b) => a + b.broj_isplata, 0),
        },
      ]
    : svi;
  const ukupnoUredi = uredi.reduce((z, u) => z + u.ukupno, 0);
  if (uredi.length) {
    nacrtaj(cilj.querySelector<HTMLCanvasElement>("#graf-uredi-profil")!, {
      type: "doughnut",
      data: {
        labels: uredi.map((u) => skrati(u.naziv, duljinaOznake(30, 20))),
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
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 8, font: { size: 10 } } },
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
        <td>${escapeHtml(datum(i.d))}</td>
        <td class="broj${i.i < 0 ? " negativno" : ""}">${escapeHtml(eur(i.i))}</td>
        <td><span class="oznaka-sifra">${escapeHtml(i.u)}</span>${escapeHtml(skrati(naziv(sifarnici.ured, i.u), 40))}</td>
        <td>${escapeHtml(i.o) || '<span class="sitno">—</span>'}</td>
        <td>${escapeHtml(i.br) || '<span class="sitno">—</span>'}</td>
        <td>${escapeHtml(i.ug) || '<span class="sitno">—</span>'}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" class="prazno">Nema isplata.</td></tr>`;

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
