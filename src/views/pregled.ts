import type { Podaci } from "../data";
import { broj, escapeHtml, eur, eurKratko, iznosBezValute, postotak, skrati } from "../format";
import { rasporedi, type Plocica } from "../treemap";
import { bojaPoIndeksu, godineOsHtml, poveziGodine } from "../ui";
const SIRINA = 1100;
const VISINA = 400;

function treemapHtml(stavke: { sifra: string; naziv: string; iznos: number }[]): string {
  const plocice: Plocica[] = stavke.map((s, i) => ({
    naziv: s.naziv, vrijednost: s.iznos, boja: bojaPoIndeksu(i), sifra: s.sifra,
  }));
  const polja = rasporedi(plocice, SIRINA, VISINA);
  if (!polja.length) return `<p class="prazno">Nema podataka.</p>`;

  return `<svg class="treemap" viewBox="0 0 ${SIRINA} ${VISINA}" role="img"
      aria-label="Raspodjela isplata po namjeni">
    ${polja.map((p) => {
      const staneNatpis = p.w > 78 && p.h > 36;
      const staneIznos = p.w > 100 && p.h > 58;
      const velicina = Math.max(12, Math.min(22, Math.sqrt(p.w * p.h) / 8));
      return `<g class="treemap__plocica" data-sifra="${escapeHtml(p.sifra ?? "")}">
        <title>${escapeHtml(`${p.naziv}: ${eur(p.vrijednost)}`)}</title>
        <rect x="${p.x + 1}" y="${p.y + 1}" width="${Math.max(0, p.w - 2)}"
          height="${Math.max(0, p.h - 2)}" fill="${p.boja}"/>
        ${staneNatpis ? `<text class="treemap__natpis" x="${p.x + 11}" y="${p.y + velicina + 9}"
          font-size="${velicina}">${escapeHtml(skrati(p.naziv, Math.floor(p.w / (velicina * 0.52))))}</text>` : ""}
        ${staneIznos ? `<text class="treemap__iznos" x="${p.x + 11}" y="${p.y + velicina * 2 + 13}"
          font-size="${Math.max(11, velicina * 0.68)}">${escapeHtml(eurKratko(p.vrijednost))}</text>` : ""}
      </g>`;
    }).join("")}
  </svg>`;
}

interface Istaknuto {
  oznaka: string;
  vrijednost: string;
  opis: string;
  veza: string;
}

function istaknutoHtml(i: Istaknuto): string {
  return `<a class="istaknuto" href="${escapeHtml(i.veza)}">
    <span class="istaknuto__oznaka">${escapeHtml(i.oznaka)}</span>
    <span class="istaknuto__vrijednost">${escapeHtml(i.vrijednost)}</span>
    <span class="istaknuto__opis">${escapeHtml(i.opis)}</span>
  </a>`;
}

export function prikaziPregled(cilj: HTMLElement, podaci: Podaci): void {
  const { poNamjeni, summary, top, ustanove, meta } = podaci;
  const godine = summary.godine;
  const zadnjaPotpuna = meta.pokrivenost.filter((p) => !p.tekuca).at(-1)?.godina;
  let odabrana = zadnjaPotpuna ?? godine[godine.length - 1] ?? "sve";

  cilj.innerHTML = `
    <section class="glava">
      <div class="omotac">
        <div class="glava__unutra">
          <div>
            <p class="glava__oznaka">Grad Zagreb je u <span id="oznaka-godine"></span> u gradske usluge uložio</p>
            <p class="glava__iznos" id="glava-iznos"></p>
            <p class="glava__pod" id="glava-pod"></p>
          </div>
          <div class="glava__godine">${godineOsHtml(godine, odabrana, "Sve")}</div>
        </div>
      </div>
    </section>

    <div class="omotac">
      <div class="istaknuta" id="istaknuta"></div>

      <section class="odjeljak">
        <div class="odjeljak__zaglavlje">
          <h2>Što Zagreb financira</h2>
          <a class="veza" href="#/isplate">Sve isplate →</a>
        </div>
        <div id="treemap"></div>
        <div id="razrada"></div>
      </section>

      <div class="stupci-2">
        <section class="odjeljak">
          <div class="odjeljak__zaglavlje">
            <h2>Najveći primatelji</h2>
            <a class="veza" href="#/primatelji">Svi primatelji →</a>
          </div>
          <div class="tablica-okvir">
            <table>
              <thead><tr><th>Primatelj</th><th class="broj">Iznos</th><th class="broj">Udio</th></tr></thead>
              <tbody id="tablica-top"></tbody>
            </table>
          </div>
        </section>

        <section class="odjeljak">
          <div class="odjeljak__zaglavlje">
            <h2>Uloženo po stanovniku</h2>
            <a class="veza" href="#/karta">Karta četvrti →</a>
          </div>
          <ul class="udio-popis" id="udio"></ul>
        </section>
      </div>
    </div>`;

  const iznos = cilj.querySelector<HTMLElement>("#glava-iznos")!;
  const pod = cilj.querySelector<HTMLElement>("#glava-pod")!;
  const oznaka = cilj.querySelector<HTMLElement>("#oznaka-godine")!;
  const spremnikTreemapa = cilj.querySelector<HTMLElement>("#treemap")!;
  const tijeloTop = cilj.querySelector<HTMLElement>("#tablica-top")!;
  const udio = cilj.querySelector<HTMLElement>("#udio")!;
  const razrada = cilj.querySelector<HTMLElement>("#razrada")!;
  const istaknuta = cilj.querySelector<HTMLElement>("#istaknuta")!;

  /** Četiri broja koja odgovaraju na "što je ovdje najveće" za odabrano razdoblje. */
  function istaknutoZa(): Istaknuto[] {
    const blok = poNamjeni.godine[odabrana];
    const s = odabrana === "sve" ? summary.ukupno : summary.po_godini[odabrana];
    const najvecaNamjena = blok?.odjeljci.find((o) => !["98", "99"].includes(o.sifra));

    const stavke: Istaknuto[] = [];
    if (najvecaNamjena) {
      stavke.push({
        oznaka: "Najviše se ulaže u",
        vrijednost: najvecaNamjena.naziv,
        opis: `${eurKratko(najvecaNamjena.ukupno)} · ${postotak(najvecaNamjena.udio)} proračuna`,
        veza: "#/",
      });
    }
    if (blok) {
      stavke.push({
        oznaka: "Po stanovniku",
        vrijednost: eur(blok.po_stanovniku),
        opis: `${broj(poNamjeni.stanovnika)} stanovnika Zagreba`,
        veza: "#/karta",
      });
    }
    stavke.push({
      oznaka: "Ustanova na karti",
      vrijednost: broj(ustanove.spojeno),
      opis: "škola, vrtića, kazališta i domova",
      veza: "#/karta",
    });
    if (s) {
      stavke.push({
        oznaka: "Primatelja",
        vrijednost: broj(s.broj_primatelja),
        opis: "tvrtki, ustanova i udruga",
        veza: "#/primatelji",
      });
    }
    return stavke;
  }

  function prikaziRazradu(sifra: string): void {
    const blok = poNamjeni.godine[odabrana];
    const o = blok?.odjeljci.find((x) => x.sifra === sifra);
    if (!o || !o.skupine.length) {
      razrada.innerHTML = "";
      return;
    }
    razrada.innerHTML = `
      <div class="razrada-kat">
        <div class="razrada-kat__vrh">
          <h3>${escapeHtml(o.naziv)} — ${escapeHtml(eur(o.ukupno))}</h3>
          <span>
            <a class="veza" href="#/isplate?f=${escapeHtml(o.sifra)}">Pogledaj isplate →</a>
            <button type="button" class="razrada-kat__zatvori" id="zatvori-razradu">Zatvori</button>
          </span>
        </div>
        <div class="tablica-okvir">
          <table>
            <thead><tr><th>Na što točno</th><th class="broj">Iznos</th><th class="broj">Udio</th></tr></thead>
            <tbody>${o.skupine.map((sk) => `<tr>
              <td><span class="oznaka-sifra">${escapeHtml(sk.sifra)}</span>${escapeHtml(sk.naziv)}</td>
              <td class="broj">${escapeHtml(eur(sk.ukupno))}</td>
              <td class="broj">${escapeHtml(postotak(sk.udio))}</td>
            </tr>`).join("")}</tbody>
          </table>
        </div>
      </div>`;
    razrada.querySelector("#zatvori-razradu")?.addEventListener("click", () => {
      razrada.innerHTML = "";
    });
    razrada.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  spremnikTreemapa.addEventListener("click", (e) => {
    const g = (e.target as Element).closest<SVGGElement>("g[data-sifra]");
    if (g?.dataset["sifra"]) prikaziRazradu(g.dataset["sifra"]);
  });

  function crtaj(): void {
    const blok = poNamjeni.godine[odabrana];
    const s = odabrana === "sve" ? summary.ukupno : summary.po_godini[odabrana];
    if (!blok || !s) return;

    oznaka.textContent = odabrana === "sve"
      ? `${godine[0]}.–${godine[godine.length - 1]}.`
      : `${odabrana}.`;
    iznos.textContent = eur(s.ukupno);
    pod.textContent =
      `${eur(blok.po_stanovniku)} po stanovniku · ${broj(s.broj_isplata)} isplata · `
      + `${broj(s.broj_primatelja)} primatelja`;

    istaknuta.innerHTML = istaknutoZa().map(istaknutoHtml).join("");
    razrada.innerHTML = "";
    spremnikTreemapa.innerHTML = treemapHtml(
      blok.odjeljci.map((o) => ({ sifra: o.sifra, naziv: o.naziv, iznos: o.ukupno }))
    );

    const primatelji = (top[odabrana] ?? []).slice(0, 10);
    tijeloTop.innerHTML = primatelji.map((p) => `<tr${p.ima_profil ? ` class="red-klik" data-oib="${escapeHtml(p.oib)}"` : ""}>
        <td>${p.ima_profil
          ? `<a class="veza" href="#/primatelj/${encodeURIComponent(p.oib)}">${escapeHtml(p.naziv)}</a>`
          : escapeHtml(p.naziv)}</td>
        <td class="broj">${escapeHtml(eurKratko(p.ukupno))}</td>
        <td class="broj">${escapeHtml(postotak(p.udio))}</td>
      </tr>`).join("");

    const najveci = blok.odjeljci[0]?.po_stanovniku ?? 1;
    udio.innerHTML = blok.odjeljci.slice(0, 8).map((o) => `
      <li class="udio-red">
        <span class="udio-red__naziv">${escapeHtml(o.naziv)}</span>
        <span class="udio-red__traka" aria-hidden="true">
          <span style="width:${((o.po_stanovniku / najveci) * 100).toFixed(1)}%"></span>
        </span>
        <span class="udio-red__iznos">${escapeHtml(iznosBezValute(o.po_stanovniku))} €</span>
      </li>`).join("");
  }

  tijeloTop.addEventListener("click", (e) => {
    const meta_ = e.target as HTMLElement;
    if (meta_.closest("a")) return;
    const red = meta_.closest<HTMLTableRowElement>("tr[data-oib]");
    if (red?.dataset.oib) location.hash = `#/primatelj/${encodeURIComponent(red.dataset.oib)}`;
  });

  poveziGodine(cilj.querySelector<HTMLElement>(".godine-os")!, (g) => {
    odabrana = g;
    crtaj();
  });
  crtaj();
}
