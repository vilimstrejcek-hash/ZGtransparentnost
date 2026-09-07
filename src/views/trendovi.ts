import { boja, nacrtaj, novacTooltip, OPCI_TOOLTIP, OS_NOVAC } from "../charts";
import type { Podaci } from "../data";
import { broj, datum, escapeHtml, eur, eurKratko, mjesecKratko, postotak } from "../format";
import { brojkaHtml, zaglavljeHtml } from "../ui";

const MJESECI = [
  "siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj",
  "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac",
];

export function prikaziTrendove(cilj: HTMLElement, podaci: Podaci): void {
  const { summary, top, meta } = podaci;
  const mjeseci = summary.po_mjesecu;
  const godine = summary.godine;

  // Prosjek po kalendarskom mjesecu — pokazuje ponavlja li se obrazac kroz godine.
  const poMjesecuGodine = MJESECI.map((_, i) => {
    const isti = mjeseci.filter((m) => m.mjesec_broj === i + 1 && m.broj_dana >= 15);
    const zbroj = isti.reduce((a, b) => a + b.ukupno, 0);
    return { mjesec: i + 1, prosjek: isti.length ? zbroj / isti.length : 0, godina: isti.length };
  });
  const prosjekSvih = poMjesecuGodine.filter((m) => m.godina > 0);
  const prosjekMjeseca = prosjekSvih.reduce((a, b) => a + b.prosjek, 0) / (prosjekSvih.length || 1);
  const prosinac = poMjesecuGodine[11]?.prosjek ?? 0;
  const odstupanjeProsinca = prosjekMjeseca ? (prosinac / prosjekMjeseca - 1) * 100 : 0;

  const najveciMjesec = [...mjeseci].sort((a, b) => b.ukupno - a.ukupno)[0];
  const sviPrimatelji = top["sve"] ?? [];
  const udioTop50 = sviPrimatelji.reduce((a, b) => a + b.udio, 0);

  cilj.innerHTML = `
    <div class="omotac">
      ${zaglavljeHtml("Trendovi", datum(meta.zadnji_datum),
        "Kako se trošenje mijenja kroz vrijeme i koliko je koncentrirano na malom broju primatelja.")}

      <div class="brojke">
        ${brojkaHtml("Prosječan mjesec", eur(prosjekMjeseca), "puni mjeseci u razdoblju")}
        ${brojkaHtml("Prosinac", eur(prosinac),
          `${odstupanjeProsinca >= 0 ? "+" : ""}${postotak(odstupanjeProsinca)} od prosjeka`)}
        ${brojkaHtml("Najveći mjesec", najveciMjesec ? eur(najveciMjesec.ukupno) : "—",
          najveciMjesec ? mjesecKratko(najveciMjesec.mjesec) : "")}
        ${brojkaHtml("Udio 50 najvećih", postotak(udioTop50), "od ukupno isplaćenog")}
      </div>

      <section class="odjeljak">
        <div class="odjeljak__zaglavlje">
          <h3>Isplate po mjesecu</h3>
          <span class="sitno">Stupac je mjesec; svijetliji stupci su nepotpuni mjeseci</span>
        </div>
        <div class="graf-okvir"><canvas id="graf-mjeseci"></canvas></div>
      </section>

      <section class="odjeljak">
        <div class="odjeljak__zaglavlje">
          <h3>Ponavlja li se obrazac kroz godinu</h3>
          <span class="sitno">Prosjek po kalendarskom mjesecu, samo puni mjeseci</span>
        </div>
        <div class="graf-okvir graf-okvir--nizak"><canvas id="graf-sezona"></canvas></div>
        <p class="sitno" id="nota-sezona"></p>
      </section>

      <section class="odjeljak">
        <div class="odjeljak__zaglavlje">
          <h3>Koncentracija primatelja</h3>
          <span class="sitno">Koliki udio ukupnog iznosa otpada na prvih N primatelja</span>
        </div>
        <div class="graf-okvir graf-okvir--nizak"><canvas id="graf-koncentracija"></canvas></div>
        <p class="sitno" id="nota-koncentracija"></p>
      </section>

      <section class="odjeljak">
        <h3>Godina za godinom</h3>
        <div class="tablica-okvir">
          <table>
            <thead><tr>
              <th>Godina</th><th class="broj">Isplaćeno</th><th class="broj">Isplata</th>
              <th class="broj">Primatelja</th><th class="broj">Udio top 10</th>
              <th class="broj">Promjena</th>
            </tr></thead>
            <tbody id="tablica-godine"></tbody>
          </table>
        </div>
        <p class="sitno">
          Tekuća godina je nepotpuna, pa promjena za nju nije usporediva s cijelim godinama.
        </p>
      </section>
    </div>`;

  // --- Mjesečni tijek ---
  nacrtaj(cilj.querySelector<HTMLCanvasElement>("#graf-mjeseci")!, {
    type: "bar",
    data: {
      labels: mjeseci.map((m) => mjesecKratko(m.mjesec)),
      datasets: [{
        data: mjeseci.map((m) => m.ukupno),
        backgroundColor: mjeseci.map((m) => (m.broj_dana >= 15 ? boja(0) : "#a9cbe6")),
        borderRadius: 2,
        maxBarThickness: 34,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: novacTooltip((i) => {
          const m = mjeseci[i]!;
          return `${mjesecKratko(m.mjesec)} — ${broj(m.broj_isplata)} isplata, ${broj(m.broj_dana)} dana`;
        }),
      },
      scales: { y: { beginAtZero: true, ...OS_NOVAC }, x: { grid: { display: false } } },
    },
  });

  // --- Sezonalnost ---
  nacrtaj(cilj.querySelector<HTMLCanvasElement>("#graf-sezona")!, {
    type: "bar",
    data: {
      labels: MJESECI.map((m) => m.slice(0, 3) + "."),
      datasets: [{
        data: poMjesecuGodine.map((m) => m.prosjek),
        backgroundColor: poMjesecuGodine.map((m) =>
          m.prosjek > prosjekMjeseca * 1.25 ? "#c8102e" : boja(1)),
        borderRadius: 2,
        maxBarThickness: 46,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...OPCI_TOOLTIP,
          callbacks: {
            title: (s: { dataIndex: number }[]) => MJESECI[s[0]!.dataIndex] ?? "",
            label: (c: { parsed: { y: number } }) => eur(c.parsed.y),
            afterLabel: (c: { dataIndex: number }) => {
              const m = poMjesecuGodine[c.dataIndex]!;
              if (!m.godina) return "nema punih mjeseci u podacima";
              const odn = prosjekMjeseca ? (m.prosjek / prosjekMjeseca - 1) * 100 : 0;
              return `${odn >= 0 ? "+" : ""}${postotak(odn)} od prosjeka · ${m.godina} god.`;
            },
          },
        },
      },
      scales: { y: { beginAtZero: true, ...OS_NOVAC }, x: { grid: { display: false } } },
    },
  });

  const nadProsjekom = poMjesecuGodine
    .filter((m) => m.godina > 0 && m.prosjek > prosjekMjeseca * 1.25)
    .map((m) => MJESECI[m.mjesec - 1]);
  cilj.querySelector<HTMLElement>("#nota-sezona")!.textContent = nadProsjekom.length
    ? `Iznad prosjeka za više od četvrtine: ${nadProsjekom.join(", ")}. `
      + `Koncentracija plaćanja pred kraj godine uobičajena je pojava u javnim financijama, `
      + `a ovdje se može izmjeriti iz stvarnih podataka.`
    : "Nijedan mjesec ne odskače više od četvrtine od prosjeka.";

  // --- Koncentracija ---
  const pragovi = [1, 5, 10, 20, 30, 50];
  const kumulativ = pragovi.map((n) =>
    sviPrimatelji.slice(0, n).reduce((a, b) => a + b.udio, 0));
  nacrtaj(cilj.querySelector<HTMLCanvasElement>("#graf-koncentracija")!, {
    type: "line",
    data: {
      labels: pragovi.map((n) => `${n}`),
      datasets: [{
        data: kumulativ,
        borderColor: boja(0),
        backgroundColor: "rgba(0,114,188,0.10)",
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...OPCI_TOOLTIP,
          callbacks: {
            title: (s: { label: string }[]) => `Prvih ${s[0]!.label} primatelja`,
            label: (c: { parsed: { y: number } }) => `${postotak(c.parsed.y)} ukupnog iznosa`,
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v: string | number) => `${v} %` },
             grid: { color: "#ececec" }, border: { display: false } },
        x: { grid: { display: false }, title: { display: true, text: "broj primatelja" } },
      },
    },
  });

  const prvi = sviPrimatelji[0];
  cilj.querySelector<HTMLElement>("#nota-koncentracija")!.textContent = prvi
    ? `Najveći pojedinačni primatelj je ${prvi.naziv} s ${postotak(prvi.udio)} ukupnog iznosa `
      + `(${eurKratko(prvi.ukupno)}). Prvih deset primatelja čini ${postotak(kumulativ[2] ?? 0)}, `
      + `a prvih pedeset ${postotak(kumulativ[5] ?? 0)} svih isplata.`
    : "";

  // --- Godišnja tablica ---
  const redci = godine.map((g, i) => {
    const b = summary.po_godini[g];
    const prije = i > 0 ? summary.po_godini[godine[i - 1] as string] : undefined;
    const tekuca = meta.pokrivenost.find((p) => p.godina === g)?.tekuca ?? false;
    const promjena = prije && !tekuca ? (b!.ukupno / prije.ukupno - 1) * 100 : null;
    return `<tr>
      <td><strong>${escapeHtml(g)}.</strong>${tekuca ? ' <span class="sitno">(u tijeku)</span>' : ""}</td>
      <td class="broj">${escapeHtml(eur(b!.ukupno))}</td>
      <td class="broj">${escapeHtml(broj(b!.broj_isplata))}</td>
      <td class="broj">${escapeHtml(broj(b!.broj_primatelja))}</td>
      <td class="broj">${escapeHtml(postotak(b!.udio_top10))}</td>
      <td class="broj">${promjena === null ? "—"
        : `<span class="${promjena >= 0 ? "" : "negativno"}">${promjena >= 0 ? "+" : ""}${escapeHtml(postotak(promjena))}</span>`}</td>
    </tr>`;
  });
  cilj.querySelector<HTMLElement>("#tablica-godine")!.innerHTML = redci.join("");
}
