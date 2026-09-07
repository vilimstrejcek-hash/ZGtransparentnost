import type { Podaci } from "../data";
import { datum, escapeHtml, eur } from "../format";
import { bojaPoIndeksu } from "../ui";

/** Male sličice iznad kartica — nagovještaj prikaza koji se otvara. */
function sličica(vrsta: "tok" | "treemap" | "karta" | "tablica" | "knjiga"): string {
  const b = (i: number) => bojaPoIndeksu(i);
  if (vrsta === "tok") {
    return `<svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
      ${[0, 1, 2, 3].map((i) => `<path d="M0 ${18 + i * 20} C70 ${18 + i * 20} 130 ${10 + i * 26} 200 ${10 + i * 26}"
        stroke="${b(i)}" stroke-width="${13 - i * 2}" fill="none" opacity="0.55"/>`).join("")}
      <rect x="0" y="6" width="7" height="88" fill="#55606e"/>
      <rect x="193" y="6" width="7" height="88" fill="#2f7d6f"/>
    </svg>`;
  }
  if (vrsta === "treemap") {
    const p = [[0, 0, 96, 58], [96, 0, 64, 30], [160, 0, 40, 30], [96, 30, 104, 28],
               [0, 58, 58, 42], [58, 58, 60, 42], [118, 58, 82, 42]];
    return `<svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
      ${p.map((r, i) => `<rect x="${r[0]}" y="${r[1]}" width="${r[2] as number - 1}" height="${r[3] as number - 1}" fill="${b(i)}"/>`).join("")}
    </svg>`;
  }
  if (vrsta === "karta") {
    return `<svg viewBox="0 0 200 100" aria-hidden="true">
      <rect width="200" height="100" fill="#eef1f4"/>
      <path d="M20 70 L60 30 L110 44 L150 22 L185 50" stroke="#cfd6dd" stroke-width="3" fill="none"/>
      ${[[54, 42, 7], [86, 58, 11], [120, 36, 6], [138, 62, 9], [160, 44, 5], [70, 72, 4]]
        .map((c, i) => `<circle cx="${c[0]}" cy="${c[1]}" r="${c[2]}" fill="${b(i)}" opacity="0.75"/>`).join("")}
    </svg>`;
  }
  if (vrsta === "knjiga") {
    return `<svg viewBox="0 0 200 100" aria-hidden="true">
      <rect width="200" height="100" fill="#f2f4f7"/>
      ${[22, 40, 58, 76].map((y, i) => `<rect x="26" y="${y}" width="${140 - i * 22}" height="7" fill="${b(i + 2)}" opacity="0.8"/>`).join("")}
    </svg>`;
  }
  return `<svg viewBox="0 0 200 100" aria-hidden="true">
    <rect width="200" height="100" fill="#fff"/>
    ${[16, 32, 48, 64, 80].map((y, i) => `
      <rect x="14" y="${y}" width="96" height="6" fill="#d8dde3"/>
      <rect x="${186 - (40 - i * 6)}" y="${y}" width="${40 - i * 6}" height="6" fill="${b(i)}"/>`).join("")}
  </svg>`;
}

function ulazHtml(
  slika: string, naslov: string, opis: string, veza: string
): string {
  return `<article class="ulaz">
    <div class="ulaz__slika">${slika}</div>
    <div class="ulaz__tijelo">
      <h3>${escapeHtml(naslov)}</h3>
      <p>${escapeHtml(opis)}</p>
      <p><a class="gumb" href="${veza}">${escapeHtml(naslov)}</a></p>
    </div>
  </article>`;
}

export function prikaziNaslovnicu(cilj: HTMLElement, podaci: Podaci): void {
  const { poNamjeni, meta, summary } = podaci;
  const zadnjaPotpuna = meta.pokrivenost.filter((p) => !p.tekuca).at(-1)?.godina;
  const godina = zadnjaPotpuna ?? summary.godine[summary.godine.length - 1] ?? "sve";
  const blok = poNamjeni.godine[godina];
  const primjeri = (blok?.odjeljci ?? []).slice(0, 4);

  cilj.innerHTML = `
    <section class="hero">
      <div class="omotac hero__unutra">
        <div>
          <h2>Odakle novac dolazi?<br>Kamo odlazi?</h2>
          <p>
            Jasan prikaz kako se troši proračun Grada Zagreba — od izvora prihoda,
            preko namjene i gradskih četvrti, do svake isplate pojedinom primatelju.
          </p>
        </div>
        <div class="hero__primjeri">
          <h3>Nekoliko primjera (${escapeHtml(godina)}.)</h3>
          ${primjeri.map((o) => `
            <a href="#/detalj">
              <span>${escapeHtml(o.naziv)}</span>
              <b>${escapeHtml(eur(o.ukupno))}</b>
            </a>`).join("")}
        </div>
      </div>
    </section>

    <div class="omotac">
      <div class="kartice-ulaz">
        ${ulazHtml(sličica("tok"), "Pregled",
          "Da dobiješ opću sliku o tome odakle novac Grada dolazi i na što se troši.", "#/pregled")}
        ${ulazHtml(sličica("treemap"), "Detalj proračuna",
          "Obrazovanje, socijalna skrb, kultura… Što tebe zanima?", "#/detalj")}
        ${ulazHtml(sličica("karta"), "Ulaganja po četvrtima",
          "Pogledaj svaku gradsku četvrt i ustanove koje Grad plaća.", "#/cetvrti")}
        ${ulazHtml(sličica("tablica"), "Isplate primateljima",
          "Detaljno prikazujemo sve isplate koje je Grad izvršio.", "#/isplate")}
        ${ulazHtml(sličica("knjiga"), "Pojmovnik",
          "Što znače klasifikacije, izvori financiranja i ostali pojmovi.", "#/pojmovnik")}
      </div>

      <p class="datum-podataka" style="margin-top:28px">
        Podaci do ${escapeHtml(datum(meta.zadnji_datum))} ·
        ${escapeHtml(String(meta.broj_isplata.toLocaleString("hr-HR")))} isplata
      </p>
    </div>`;
}
