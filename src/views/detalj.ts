import type { Podaci } from "../data";
import { datum, escapeHtml, eur, eurKratko, postotak, skrati } from "../format";
import { rasporedi, type Plocica } from "../treemap";
import { bojaPoIndeksu, godineOsHtml, kontroleDnoHtml, poveziGodine, zaglavljeHtml } from "../ui";

type Pogled = "namjena" | "vrsta" | "ured";

const POGLEDI: [Pogled, string][] = [
  ["namjena", "Za što se troši"],
  ["vrsta", "Kako se troši"],
  ["ured", "Tko troši"],
];

const SIRINA = 1100;
const VISINA = 420;

interface Stavka { sifra: string; naziv: string; iznos: number; }

function trakaUdjelaHtml(stavke: Stavka[], ukupno: number): string {
  if (!ukupno) return "";
  return `<div class="udjeli">
    ${stavke.slice(0, 6).map((s, i) => {
      const udio = (s.iznos / ukupno) * 100;
      if (udio < 3) return "";
      return `<div class="udjeli__dio" style="width:${udio}%;background:${bojaPoIndeksu(i)}"
        title="${escapeHtml(`${s.naziv}: ${postotak(udio)}`)}">
        ${escapeHtml(skrati(s.naziv, 26))} ${escapeHtml(postotak(udio))}
      </div>`;
    }).join("")}
  </div>`;
}

function treemapHtml(stavke: Stavka[]): string {
  const plocice: Plocica[] = stavke.map((s, i) => ({
    naziv: s.naziv, vrijednost: s.iznos, boja: bojaPoIndeksu(i), sifra: s.sifra,
  }));
  const polja = rasporedi(plocice, SIRINA, VISINA);
  if (!polja.length) return `<p class="prazno">Nema podataka za odabrano razdoblje.</p>`;

  return `<svg class="treemap" viewBox="0 0 ${SIRINA} ${VISINA}" role="img"
      aria-label="Raspodjela isplata po kategorijama">
    ${polja.map((p) => {
      const staneNatpis = p.w > 74 && p.h > 34;
      const staneIznos = p.w > 96 && p.h > 56;
      const velicina = Math.max(11, Math.min(21, Math.sqrt(p.w * p.h) / 8));
      return `<g class="treemap__plocica">
        <title>${escapeHtml(`${p.naziv}: ${eur(p.vrijednost)}`)}</title>
        <rect x="${p.x + 1}" y="${p.y + 1}" width="${Math.max(0, p.w - 2)}"
          height="${Math.max(0, p.h - 2)}" fill="${p.boja}"/>
        ${staneNatpis ? `<text class="treemap__natpis" x="${p.x + 10}" y="${p.y + velicina + 8}"
          font-size="${velicina}">${escapeHtml(skrati(p.naziv, Math.floor(p.w / (velicina * 0.52))))}</text>` : ""}
        ${staneIznos ? `<text class="treemap__iznos" x="${p.x + 10}" y="${p.y + velicina * 2 + 12}"
          font-size="${Math.max(10, velicina * 0.68)}">${escapeHtml(eurKratko(p.vrijednost))}</text>` : ""}
      </g>`;
    }).join("")}
  </svg>`;
}

export function prikaziDetalj(cilj: HTMLElement, podaci: Podaci): void {
  const { poNamjeni, poEkonomskoj, poUredu, summary, meta, plan } = podaci;
  const godine = summary.godine;
  const zadnjaPotpuna = meta.pokrivenost.filter((p) => !p.tekuca).at(-1)?.godina;
  let odabrana = zadnjaPotpuna ?? godine[godine.length - 1] ?? "sve";
  let pogled: Pogled = "namjena";

  cilj.innerHTML = `
    <div class="omotac">
      ${zaglavljeHtml("Detalj proračuna", datum(meta.zadnji_datum))}

      <div class="tabovi" id="tabovi" role="tablist">
        ${POGLEDI.map(([k, naziv]) => `
          <button type="button" role="tab" data-pogled="${k}"
            aria-selected="${k === pogled}">${escapeHtml(naziv)}</button>`).join("")}
      </div>

      <div id="udjeli"></div>
      <div id="treemap"></div>
      <p class="sitno" id="nota" style="margin-top:10px"></p>

      ${kontroleDnoHtml(godineOsHtml(godine, odabrana, "Sve zajedno"),
        `<p class="sitno" style="text-align:center;margin:0">Stvarne isplate s gradskog računa.</p>`)}

      <section class="odjeljak" style="margin-top:26px">
        <h3>Plan i izvršenje</h3>
        <div class="tablica-okvir">
          <table>
            <thead><tr>
              <th>Razdoblje</th><th class="broj">Planirano</th>
              <th class="broj">Isplaćeno s gradskog računa</th><th class="broj">Udio</th>
            </tr></thead>
            <tbody id="tablica-plan"></tbody>
          </table>
        </div>
        <p class="sitno" style="margin-top:8px">
          Plan je konsolidirani plan rashoda koji Grad objavljuje na data.zagreb.hr i uključuje
          proračunske korisnike koji dio rashoda plaćaju sa svojih računa — zato udio nije stopa izvršenja.
        </p>
      </section>
    </div>`;

  const spremnikUdjela = cilj.querySelector<HTMLElement>("#udjeli")!;
  const spremnikTreemapa = cilj.querySelector<HTMLElement>("#treemap")!;
  const nota = cilj.querySelector<HTMLElement>("#nota")!;
  const tablicaPlan = cilj.querySelector<HTMLElement>("#tablica-plan")!;

  function stavke(): Stavka[] {
    if (pogled === "namjena") {
      const blok = poNamjeni.godine[odabrana];
      return (blok?.odjeljci ?? []).map((o) => ({ sifra: o.sifra, naziv: o.naziv, iznos: o.ukupno }));
    }
    const izvor = pogled === "vrsta" ? poEkonomskoj : poUredu;
    return (izvor[odabrana] ?? [])
      .filter((r) => r.ukupno > 0)
      .slice(0, 26)
      .map((r) => ({ sifra: r.sifra, naziv: r.naziv, iznos: r.ukupno }));
  }

  function crtaj(): void {
    const s = stavke();
    const ukupno = s.reduce((a, b) => a + b.iznos, 0);
    spremnikUdjela.innerHTML = trakaUdjelaHtml(s, ukupno);
    spremnikTreemapa.innerHTML = treemapHtml(s);

    const opis = pogled === "namjena"
      ? "Funkcijska klasifikacija (COFOG) — međunarodni standard, usporediv s drugim europskim gradovima."
      : pogled === "vrsta"
        ? "Ekonomska klasifikacija — vrsta rashoda: plaće, usluge, materijal, ulaganja."
        : "Organizacijska klasifikacija — gradski ured odnosno razdjel koji je isplatu izvršio.";
    nota.textContent = `${opis} Prikazano ${s.length} kategorija, ukupno ${eur(ukupno)}.`;

    const p = plan.godine[odabrana];
    tablicaPlan.innerHTML = p
      ? `<tr>
          <td>${escapeHtml(odabrana === "sve" ? "Sve godine" : `${odabrana}.`)}</td>
          <td class="broj">${escapeHtml(eur(p.plan_ukupno))}</td>
          <td class="broj">${escapeHtml(eur(p.isplaceno_ukupno))}</td>
          <td class="broj">${escapeHtml(p.udio_isplacenog !== null ? postotak(p.udio_isplacenog) : "—")}</td>
        </tr>
        <tr>
          <td colspan="4" class="sitno">
            Iznad plana: ${escapeHtml(eur(p.prekoracenja_iznos))} na ${escapeHtml(String(p.prekoracenja_broj))} stavki ·
            bez stavke u planu: ${escapeHtml(eur(p.bez_plana_iznos))} na ${escapeHtml(String(p.bez_plana_broj))} stavki ·
            <a class="veza" href="#/plan">pogledaj popis</a>
          </td>
        </tr>`
      : `<tr><td colspan="4" class="prazno">Za ${escapeHtml(odabrana)}. nema objavljenog plana u strojno čitljivom obliku.</td></tr>`;
  }

  cilj.querySelector("#tabovi")!.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-pogled]");
    if (!gumb?.dataset.pogled) return;
    pogled = gumb.dataset.pogled as Pogled;
    for (const b of cilj.querySelectorAll<HTMLButtonElement>("#tabovi button")) {
      b.setAttribute("aria-selected", String(b.dataset.pogled === pogled));
    }
    crtaj();
  });

  poveziGodine(cilj.querySelector<HTMLElement>(".godine-os")!, (g) => {
    odabrana = g;
    crtaj();
  });
  crtaj();
}
