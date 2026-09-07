import { nacrtaj, novacTooltip, OPCI_TOOLTIP, OS_NOVAC, boja } from "../charts";
import type { Podaci } from "../data";
import { broj, duljinaOznake, escapeHtml, eur, eurOs, mjesecKratko, mjesecUGodini, postotak, skrati } from "../format";
import { napomenaHtml } from "../napomena";
import type { Blok } from "../types";

function karticaHtml(oznaka: string, vrijednost: string, dodatak: string): string {
  return `<div class="kartica">
    <p class="kartica__oznaka">${escapeHtml(oznaka)}</p>
    <div class="kartica__vrijednost">${escapeHtml(vrijednost)}</div>
    <p class="kartica__dodatak">${escapeHtml(dodatak)}</p>
  </div>`;
}

export function prikaziPregled(cilj: HTMLElement, podaci: Podaci): void {
  const { summary, meta, poUredu, poEkonomskoj } = podaci;
  const godine = summary.godine;

  cilj.innerHTML = `
    <h2>Pregled isplata</h2>
    <p class="podnaslov">Sve isplate Grada Zagreba u obrađenim razdobljima, po mjesecu i po namjeni.</p>
    ${napomenaHtml(meta)}
    <div class="kartice" id="kartice"></div>

    <section class="ploca">
      <div class="ploca__zaglavlje">
        <h3>Isplaćeno po mjesecu</h3>
        <div class="godine" id="izbor-nacina" role="group" aria-label="Način prikaza">
          <button type="button" data-nacin="slijed" aria-pressed="true">Kronološki</button>
          <button type="button" data-nacin="usporedba" aria-pressed="false">Usporedba godina</button>
        </div>
      </div>
      <div class="graf-okvir"><canvas id="graf-mjeseci"></canvas></div>
      <p class="kartica__dodatak" id="nota-mjeseci"></p>
    </section>

    <div class="mreza-2">
      <section class="ploca">
        <h3>Po gradskom uredu</h3>
        <div class="graf-okvir graf-okvir--visok"><canvas id="graf-uredi"></canvas></div>
      </section>
      <section class="ploca">
        <h3>Najveće namjene</h3>
        <p class="kartica__dodatak" style="margin:-6px 0 12px">Po ekonomskoj klasifikaciji</p>
        <div class="tablica-okvir">
          <table>
            <thead>
              <tr><th>Šifra i naziv</th><th class="broj">Iznos</th><th class="broj">Udio</th></tr>
            </thead>
            <tbody id="tablica-ekonomska"></tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  // --- Kartice ---
  const u: Blok = summary.ukupno;
  const godine_ = meta.pokrivenost.map((p) => p.godina).join("–");
  (cilj.querySelector("#kartice") as HTMLElement).innerHTML = [
    karticaHtml("Ukupno isplaćeno", eur(u.ukupno), `${godine_}. · ${broj(meta.broj_dana)} dana isplata`),
    karticaHtml("Broj isplata", broj(u.broj_isplata),
      `na ${broj(u.broj_stavki)} proračunskih pozicija`),
    karticaHtml("Broj primatelja", broj(u.broj_primatelja), "jedinstvenih OIB-ova"),
    karticaHtml("Udio top 10", postotak(u.udio_top10), "deset najvećih primatelja"),
  ].join("");

  // --- Graf po mjesecu ---
  const platno = cilj.querySelector<HTMLCanvasElement>("#graf-mjeseci")!;
  const nota = cilj.querySelector<HTMLElement>("#nota-mjeseci")!;
  // Sa samo nekoliko točaka linija izgleda varljivo; tada crtamo stupce.
  const malo = summary.po_mjesecu.length <= Math.max(6, godine.length);

  function crtajSlijed(): void {
    const zapisi = summary.po_mjesecu;
    nacrtaj(platno, {
      type: malo ? "bar" : "line",
      data: {
        labels: zapisi.map((z) => mjesecKratko(z.mjesec)),
        datasets: [{
          label: "Isplaćeno",
          data: zapisi.map((z) => z.ukupno),
          borderColor: boja(0),
          backgroundColor: malo ? boja(0) : "rgba(31,78,140,0.08)",
          borderWidth: 2,
          fill: !malo,
          tension: 0.25,
          pointRadius: summary.po_mjesecu.length > 24 ? 2 : 3,
          pointHoverRadius: 5,
          maxBarThickness: 90,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: novacTooltip((i) => {
            const z = zapisi[i]!;
            const dani = z.broj_dana === 1 ? "1 dan" : `${broj(z.broj_dana)} dana`;
            return `${mjesecKratko(z.mjesec)} — ${broj(z.broj_isplata)} isplata, ${dani} isplate`;
          }),
        },
        scales: { y: { beginAtZero: true, ...OS_NOVAC }, x: { grid: { display: false } } },
      },
    });
    // Zadnji mjesec je gotovo uvijek u tijeku; ostale označavamo samo ako
    // stvarno imaju premalo dana isplate.
    const zadnji = zapisi[zapisi.length - 1];
    const krnji = zapisi.slice(0, -1).filter((z) => z.broj_dana < 12);
    const dijelovi: string[] = [];
    if (zadnji && zadnji.broj_dana < 15) {
      dijelovi.push(`${mjesecKratko(zadnji.mjesec)} je u tijeku (${broj(zadnji.broj_dana)} dana isplate)`);
    }
    if (krnji.length) {
      dijelovi.push(`nepotpuni mjeseci: ${krnji.map((z) => mjesecKratko(z.mjesec)).join(", ")}`);
    }
    nota.textContent = dijelovi.length ? `${dijelovi.join("; ")}.` : "";
  }

  function crtajUsporedbu(): void {
    const mjeseci = Array.from({ length: 12 }, (_, i) => i + 1);
    nacrtaj(platno, {
      type: "line",
      data: {
        labels: mjeseci.map(mjesecUGodini),
        datasets: godine.map((g, i) => ({
          label: `${g}.`,
          data: mjeseci.map((m) =>
            summary.po_mjesecu.find((z) => String(z.godina) === g && z.mjesec_broj === m)?.ukupno ?? null
          ),
          borderColor: boja(i),
          backgroundColor: boja(i),
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          spanGaps: false,
        })),
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
          tooltip: {
            ...OPCI_TOOLTIP,
            displayColors: true,
            callbacks: { label: (c: { dataset: { label?: string }; parsed: { y: number } }) =>
              `${c.dataset.label ?? ""} ${eur(c.parsed.y)}` },
          },
        },
        scales: { y: { beginAtZero: true, ...OS_NOVAC }, x: { grid: { display: false } } },
      },
    });
    nota.textContent = "Mjeseci bez podataka ostaju prazni — nisu prikazani kao nula.";
  }

  crtajSlijed();
  cilj.querySelector("#izbor-nacina")!.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-nacin]");
    if (!gumb) return;
    for (const b of cilj.querySelectorAll<HTMLButtonElement>("#izbor-nacina button")) {
      b.setAttribute("aria-pressed", String(b === gumb));
    }
    if (gumb.dataset.nacin === "slijed") crtajSlijed();
    else crtajUsporedbu();
  });

  // --- Graf po uredu ---
  const uredi = (poUredu["sve"] ?? []).filter((r) => r.ukupno > 0);
  nacrtaj(cilj.querySelector<HTMLCanvasElement>("#graf-uredi")!, {
    type: "bar",
    data: {
      labels: uredi.map((r) => skrati(r.naziv, duljinaOznake(44, 20))),
      datasets: [{
        data: uredi.map((r) => r.ukupno),
        backgroundColor: boja(1),
        borderRadius: 3,
        maxBarThickness: 22,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...OPCI_TOOLTIP,
          callbacks: {
            title: (s: { dataIndex: number }[]) => {
              const r = uredi[s[0]!.dataIndex]!;
              return `${r.sifra} ${r.naziv}`;
            },
            label: (c: { parsed: { x: number } }) => eur(c.parsed.x),
            afterLabel: (c: { dataIndex: number }) => {
              const r = uredi[c.dataIndex]!;
              return `${postotak(r.udio)} ukupnog · ${broj(r.broj_isplata)} isplata`;
            },
          },
        },
      },
      scales: {
        x: { beginAtZero: true, ...OS_NOVAC, ticks: { callback: (v: string | number) => eurOs(Number(v)) } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  });

  // --- Tablica ekonomske klasifikacije ---
  const ekonomske = (poEkonomskoj["sve"] ?? []).slice(0, 12);
  (cilj.querySelector("#tablica-ekonomska") as HTMLElement).innerHTML = ekonomske.length
    ? ekonomske.map((r) => `<tr>
        <td><span class="oznaka-sifra">${escapeHtml(r.sifra)}</span>${escapeHtml(r.naziv)}</td>
        <td class="broj${r.ukupno < 0 ? " negativno" : ""}">${escapeHtml(eur(r.ukupno))}</td>
        <td class="broj">${escapeHtml(postotak(r.udio))}</td>
      </tr>`).join("")
    : `<tr><td colspan="3" class="prazno">Nema podataka.</td></tr>`;
}
