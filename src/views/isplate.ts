import type { Podaci } from "../data";
import { broj, datum, escapeHtml, eur, eurKratko, mjesecNaziv, postotak } from "../format";
import type { MjesecIndeks, MjesecPodaci, Redak } from "../types";

const BAZA = import.meta.env.BASE_URL.replace(/\/+$/, "");
const KORAK = 50;

const COFOG: Record<string, string> = {
  "01": "Opće javne usluge", "02": "Obrana", "03": "Javni red i sigurnost",
  "04": "Ekonomski poslovi", "05": "Zaštita okoliša",
  "06": "Stanovanje i komunalne pogodnosti", "07": "Zdravstvo",
  "08": "Rekreacija, kultura i religija", "09": "Obrazovanje",
  "10": "Socijalna zaštita", "98": "Računi iz prethodne godine",
  "99": "Bez oznake namjene",
};

interface Filtri {
  mjesec: string;
  namjena: string;
  ured: string;
  upit: string;
}

const kes = new Map<string, MjesecPodaci>();

async function ucitajMjesec(mjesec: string): Promise<MjesecPodaci> {
  const postojeci = kes.get(mjesec);
  if (postojeci) return postojeci;
  const p: MjesecPodaci = await fetch(`${BAZA}/data/isplate/${mjesec}.json`).then((o) => o.json());
  kes.set(mjesec, p);
  return p;
}

export async function prikaziIsplate(
  cilj: HTMLElement, podaci: Podaci, pocetni: Partial<Filtri> = {}
): Promise<void> {
  const { sifarnici, meta } = podaci;
  const indeks: MjesecIndeks = await fetch(`${BAZA}/data/isplate/index.json`)
    .then((o) => o.json());
  const mjeseci = indeks.mjeseci.map((m) => m.mjesec);
  const zadnji = mjeseci[mjeseci.length - 1] ?? "";

  const f: Filtri = {
    mjesec: pocetni.mjesec && mjeseci.includes(pocetni.mjesec) ? pocetni.mjesec : zadnji,
    namjena: pocetni.namjena ?? "",
    ured: pocetni.ured ?? "",
    upit: pocetni.upit ?? "",
  };
  let prikazano = KORAK;

  const uredi = Object.entries(sifarnici.ured).sort((a, b) => a[1].localeCompare(b[1], "hr"));

  cilj.innerHTML = `
    <div class="omotac">
      <div class="zaglavlje-stranice">
        <h1 class="naslov-stranice">Isplate</h1>
        <p class="datum-podataka">Podaci do ${escapeHtml(datum(meta.zadnji_datum))}</p>
      </div>

      <div class="razdoblje">
        <button type="button" class="razdoblje__strelica" id="prethodni" aria-label="Prethodni mjesec">‹</button>
        <select class="odabir razdoblje__odabir" id="izbor-mjeseca" aria-label="Mjesec">
          ${mjeseci.slice().reverse().map((m) => `
            <option value="${m}">${escapeHtml(mjesecNaziv(m))}</option>`).join("")}
        </select>
        <button type="button" class="razdoblje__strelica" id="sljedeci" aria-label="Sljedeći mjesec">›</button>
      </div>

      <div class="brojke" id="sazetak"></div>

      <div class="filtri">
        <select class="odabir" id="izbor-namjene" aria-label="Namjena" style="max-width:270px">
          <option value="">Sve namjene</option>
          ${Object.entries(COFOG).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join("")}
        </select>
        <select class="odabir" id="izbor-ureda" aria-label="Gradski ured" style="max-width:300px">
          <option value="">Svi uredi</option>
          ${uredi.map(([k, v]) => `<option value="${escapeHtml(k)}">${escapeHtml(v)}</option>`).join("")}
        </select>
        <input type="search" class="polje" id="pretraga"
          placeholder="Pretraži opis ili primatelja" aria-label="Pretraga"
          value="${escapeHtml(f.upit)}" autocomplete="off" />
        <button type="button" class="gumb gumb--malo" id="ocisti">Očisti</button>
      </div>

      <div id="sadrzaj"><p class="ucitavanje">Učitavanje isplata…</p></div>
    </div>`;

  const sazetak = cilj.querySelector<HTMLElement>("#sazetak")!;
  const sadrzaj = cilj.querySelector<HTMLElement>("#sadrzaj")!;
  const izborMjeseca = cilj.querySelector<HTMLSelectElement>("#izbor-mjeseca")!;
  const izborNamjene = cilj.querySelector<HTMLSelectElement>("#izbor-namjene")!;
  const izborUreda = cilj.querySelector<HTMLSelectElement>("#izbor-ureda")!;
  const pretraga = cilj.querySelector<HTMLInputElement>("#pretraga")!;

  function filtriraj(p: MjesecPodaci): Redak[] {
    const q = f.upit.trim().toLowerCase();
    return p.redci.filter((r) => {
      if (f.namjena && r[5] !== f.namjena) return false;
      if (f.ured && r[4] !== f.ured) return false;
      if (!q) return true;
      const ime = p.primatelji[r[1]]?.[0] ?? "";
      return r[3].toLowerCase().includes(q) || ime.toLowerCase().includes(q);
    });
  }

  function redakHtml(p: MjesecPodaci, r: Redak): string {
    const [dan, idx, iznos, opis, ured, namjena] = r;
    const [ime, oib] = p.primatelji[idx] ?? ["", ""];
    const dan2 = String(dan).padStart(2, "0");
    return `<tr>
      <td class="sitno">${dan2}.${escapeHtml(p.mjesec.slice(5))}.</td>
      <td>${oib
        ? `<a class="veza" href="#/primatelj/${encodeURIComponent(oib)}">${escapeHtml(ime ?? "")}</a>`
        : escapeHtml(ime ?? "")}</td>
      <td>${escapeHtml(opis) || '<span class="sitno">—</span>'}</td>
      <td class="sitno">${escapeHtml(sifarnici.ured[ured] ?? ured ?? "")}</td>
      <td class="sitno">${escapeHtml(COFOG[namjena] ?? "")}</td>
      <td class="broj${iznos < 0 ? " negativno" : ""}">${escapeHtml(eur(iznos))}</td>
    </tr>`;
  }

  async function crtaj(): Promise<void> {
    izborMjeseca.value = f.mjesec;
    izborNamjene.value = f.namjena;
    izborUreda.value = f.ured;

    sadrzaj.innerHTML = `<p class="ucitavanje">Učitavanje isplata…</p>`;
    const p = await ucitajMjesec(f.mjesec);
    const redci = filtriraj(p);
    const zbroj = redci.reduce((a, b) => a + b[2], 0);
    const sviZbroj = p.redci.reduce((a, b) => a + b[2], 0);

    // Isti mjesec prethodne godine — usporedba koja ima smisla.
    const [g, m] = f.mjesec.split("-");
    const lani = `${Number(g) - 1}-${m}`;
    const laniPodatak = indeks.mjeseci.find((x) => x.mjesec === lani);
    const promjena = laniPodatak && laniPodatak.ukupno
      ? (sviZbroj / laniPodatak.ukupno - 1) * 100
      : null;

    const filtrirano = f.namjena || f.ured || f.upit.trim();
    sazetak.innerHTML = `
      <div class="brojka">
        <p class="brojka__oznaka">${filtrirano ? "Odabrano" : "Ukupno u mjesecu"}</p>
        <div class="brojka__vrijednost">${escapeHtml(eur(zbroj))}</div>
        <p class="brojka__dodatak">${escapeHtml(broj(redci.length))} stavki${
          filtrirano ? ` od ${escapeHtml(broj(p.redci.length))}` : ""}</p>
      </div>
      <div class="brojka">
        <p class="brojka__oznaka">Prema istom mjesecu lani</p>
        <div class="brojka__vrijednost">${promjena === null ? "—"
          : `${promjena >= 0 ? "+" : ""}${escapeHtml(postotak(promjena))}`}</div>
        <p class="brojka__dodatak">${laniPodatak
          ? `${escapeHtml(mjesecNaziv(lani))}: ${escapeHtml(eurKratko(laniPodatak.ukupno))}`
          : "nema podatka za lani"}</p>
      </div>
      <div class="brojka">
        <p class="brojka__oznaka">Dana s isplatama</p>
        <div class="brojka__vrijednost">${escapeHtml(broj(new Set(p.redci.map((r) => r[0])).size))}</div>
        <p class="brojka__dodatak">u ${escapeHtml(mjesecNaziv(f.mjesec))}</p>
      </div>
      <div class="brojka">
        <p class="brojka__oznaka">Najveća stavka</p>
        <div class="brojka__vrijednost">${escapeHtml(eurKratko(
          Math.max(...redci.map((r) => r[2]), 0)))}</div>
        <p class="brojka__dodatak">pojedinačno</p>
      </div>`;

    const najvece = [...redci].sort((a, b) => b[2] - a[2]).slice(0, 10);
    const kronoloski = redci.slice(0, prikazano);

    sadrzaj.innerHTML = `
      ${najvece.length ? `
        <section class="odjeljak">
          <h2>Najveće isplate u razdoblju</h2>
          <div class="tablica-okvir">
            <table>
              <thead><tr><th>Dan</th><th>Primatelj</th><th>Opis</th><th>Ured</th><th>Namjena</th><th class="broj">Iznos</th></tr></thead>
              <tbody>${najvece.map((r) => redakHtml(p, r)).join("")}</tbody>
            </table>
          </div>
        </section>` : ""}

      <section class="odjeljak">
        <div class="odjeljak__zaglavlje">
          <h2>Sve isplate</h2>
          <span class="sitno" id="brojac"></span>
        </div>
        <div class="tablica-okvir">
          <table>
            <thead><tr><th>Dan</th><th>Primatelj</th><th>Opis</th><th>Ured</th><th>Namjena</th><th class="broj">Iznos</th></tr></thead>
            <tbody id="tijelo">${kronoloski.map((r) => redakHtml(p, r)).join("")
              || `<tr><td colspan="6" class="prazno">Nema isplata koje odgovaraju filtrima.</td></tr>`}</tbody>
          </table>
        </div>
        ${redci.length > prikazano
          ? `<p style="text-align:center;margin-top:14px">
              <button type="button" class="gumb" id="jos">Prikaži još ${escapeHtml(broj(Math.min(KORAK, redci.length - prikazano)))}</button>
            </p>` : ""}
      </section>`;

    const brojac = sadrzaj.querySelector<HTMLElement>("#brojac");
    if (brojac) {
      brojac.textContent = `prikazano ${broj(Math.min(prikazano, redci.length))} od ${broj(redci.length)}`;
    }
    sadrzaj.querySelector("#jos")?.addEventListener("click", () => {
      prikazano += KORAK;
      void crtaj();
    });
  }

  function osvjezi(): void {
    prikazano = KORAK;
    void crtaj();
  }

  izborMjeseca.addEventListener("change", () => { f.mjesec = izborMjeseca.value; osvjezi(); });
  izborNamjene.addEventListener("change", () => { f.namjena = izborNamjene.value; osvjezi(); });
  izborUreda.addEventListener("change", () => { f.ured = izborUreda.value; osvjezi(); });
  pretraga.addEventListener("input", () => { f.upit = pretraga.value; osvjezi(); });
  cilj.querySelector("#ocisti")!.addEventListener("click", () => {
    f.namjena = ""; f.ured = ""; f.upit = ""; pretraga.value = ""; osvjezi();
  });

  const pomak = (korak: number): void => {
    const i = mjeseci.indexOf(f.mjesec) + korak;
    if (i >= 0 && i < mjeseci.length) { f.mjesec = mjeseci[i] as string; osvjezi(); }
  };
  cilj.querySelector("#prethodni")!.addEventListener("click", () => pomak(-1));
  cilj.querySelector("#sljedeci")!.addEventListener("click", () => pomak(1));

  await crtaj();
}
