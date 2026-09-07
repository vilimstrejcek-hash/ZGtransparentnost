import type { Podaci } from "../data";
import { broj, datum, escapeHtml, eur, eurKratko, mjesecNaziv, postotak } from "../format";
import {
  csvIznos, poveziSortiranje, preuzmiCsv, pretraziRedke, sortirajRedke,
  zaglavljeTabliceHtml, type Poredak, type Stupac,
} from "../ui";
import type { MjesecIndeks, MjesecPodaci, Redak } from "../types";

const BAZA = import.meta.env.BASE_URL.replace(/\/+$/, "");
const KORAK = 50;

const IMENA_MJESECI = [
  "siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj",
  "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac",
];

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
  namjena: string;      // dvoznamenkasti odjeljak
  podskupina: string;   // puna šifra funkcijske klasifikacije
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
  const godineSPodacima = [...new Set(mjeseci.map((m) => m.slice(0, 4)))].sort().reverse();

  /** Mjeseci koji u odabranoj godini uopće imaju isplata. */
  const mjeseciGodine = (godina: string): string[] =>
    mjeseci.filter((m) => m.startsWith(godina)).map((m) => m.slice(5));

  const f: Filtri = {
    mjesec: pocetni.mjesec && mjeseci.includes(pocetni.mjesec) ? pocetni.mjesec : zadnji,
    namjena: pocetni.namjena ?? "",
    podskupina: pocetni.podskupina ?? "",
    ured: pocetni.ured ?? "",
    upit: pocetni.upit ?? "",
  };
  let prikazano = KORAK;
  const poredak: Poredak = { kljuc: "dan", silazno: false };

  const uredi = Object.entries(sifarnici.ured).sort((a, b) => a[1].localeCompare(b[1], "hr"));

  cilj.innerHTML = `
    <div class="omotac">
      <div class="zaglavlje-stranice">
        <h1 class="naslov-stranice">Isplate</h1>
        <p class="datum-podataka">Podaci do ${escapeHtml(datum(meta.zadnji_datum))}</p>
      </div>

      <div class="razdoblje">
        <button type="button" class="razdoblje__strelica" id="prethodni" aria-label="Prethodni mjesec">‹</button>
        <select class="odabir razdoblje__godina" id="izbor-godine" aria-label="Godina">
          ${godineSPodacima.map((g) => `<option value="${g}">${g}.</option>`).join("")}
        </select>
        <select class="odabir razdoblje__mjesec" id="izbor-mjeseca" aria-label="Mjesec">
          ${IMENA_MJESECI.map((ime, i) => `
            <option value="${String(i + 1).padStart(2, "0")}">${escapeHtml(ime)}</option>`).join("")}
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
          placeholder="Pretraži po svim stupcima" aria-label="Pretraga"
          value="${escapeHtml(f.upit)}" autocomplete="off" />
        <button type="button" class="gumb gumb--malo" id="ocisti">Očisti sve</button>
      </div>

      <div class="oznake" id="oznake" hidden></div>

      <div id="sadrzaj"><p class="ucitavanje">Učitavanje isplata…</p></div>
    </div>`;

  const sazetak = cilj.querySelector<HTMLElement>("#sazetak")!;
  const sadrzaj = cilj.querySelector<HTMLElement>("#sadrzaj")!;
  const izborGodine = cilj.querySelector<HTMLSelectElement>("#izbor-godine")!;
  const izborMjeseca = cilj.querySelector<HTMLSelectElement>("#izbor-mjeseca")!;

  /** Mjeseci bez podataka ostaju vidljivi, ali se ne mogu odabrati. */
  function osvjeziMjesece(): void {
    const dostupni = new Set(mjeseciGodine(f.mjesec.slice(0, 4)));
    for (const opcija of izborMjeseca.options) {
      opcija.disabled = !dostupni.has(opcija.value);
    }
  }
  const izborNamjene = cilj.querySelector<HTMLSelectElement>("#izbor-namjene")!;
  const izborUreda = cilj.querySelector<HTMLSelectElement>("#izbor-ureda")!;
  const pretraga = cilj.querySelector<HTMLInputElement>("#pretraga")!;
  const spremnikOznaka = cilj.querySelector<HTMLElement>("#oznake")!;

  /** Aktivni filtri kao vidljive oznake — bez njih se ne vidi da je popis sužen. */
  function crtajOznake(): void {
    const oznake: { kljuc: keyof Filtri; opis: string; vrijednost: string }[] = [];
    if (f.podskupina) {
      oznake.push({
        kljuc: "podskupina", opis: "Namjena",
        vrijednost: `${sifarnici.funkcijska[f.podskupina] ?? f.podskupina} (${f.podskupina})`,
      });
    }
    if (f.namjena) {
      oznake.push({ kljuc: "namjena", opis: "Područje", vrijednost: COFOG[f.namjena] ?? f.namjena });
    }
    if (f.ured) {
      oznake.push({ kljuc: "ured", opis: "Ured", vrijednost: sifarnici.ured[f.ured] ?? f.ured });
    }
    if (f.upit.trim()) {
      oznake.push({ kljuc: "upit", opis: "Pretraga", vrijednost: `„${f.upit.trim()}”` });
    }

    spremnikOznaka.hidden = oznake.length === 0;
    spremnikOznaka.innerHTML = oznake.map((o) => `
      <span class="oznaka">
        <span class="oznaka__opis">${escapeHtml(o.opis)}</span>
        ${escapeHtml(o.vrijednost)}
        <button type="button" data-ukloni="${o.kljuc}" aria-label="Ukloni filtar">×</button>
      </span>`).join("");
  }

  function filtriraj(p: MjesecPodaci): Redak[] {
    const suzeni = p.redci.filter((r) => {
      if (f.namjena && r[5] !== f.namjena) return false;
      if (f.podskupina && r[6] !== f.podskupina) return false;
      if (f.ured && r[4] !== f.ured) return false;
      return true;
    });
    // Broj računa i ugovora nisu stupci u tablici, ali se po njima traži.
    return pretraziRedke(suzeni, stupci(p), f.upit, (r) => `${r[8]} ${r[9]}`);
  }

  function stupci(p: MjesecPodaci): Stupac<Redak>[] {
    return [
      { kljuc: "dan", naziv: "Dan", vrijednost: (r) => r[0] },
      { kljuc: "primatelj", naziv: "Primatelj", vrijednost: (r) => p.primatelji[r[1]]?.[0] ?? "" },
      { kljuc: "opis", naziv: "Opis", vrijednost: (r) => r[3] },
      { kljuc: "ured", naziv: "Ured", vrijednost: (r) => sifarnici.ured[r[4]] ?? r[4] },
      { kljuc: "namjena", naziv: "Namjena", vrijednost: (r) => COFOG[r[5]] ?? "" },
      { kljuc: "iznos", naziv: "Iznos", broj: true, vrijednost: (r) => r[2] },
    ];
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
    izborGodine.value = f.mjesec.slice(0, 4);
    osvjeziMjesece();
    izborMjeseca.value = f.mjesec.slice(5);
    izborNamjene.value = f.namjena;
    izborUreda.value = f.ured;

    crtajOznake();
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

    const filtrirano = f.namjena || f.podskupina || f.ured || f.upit.trim();
    sazetak.innerHTML = `
      <div class="brojka">
        <p class="brojka__oznaka">${filtrirano ? "Odabrani filtri" : "Ukupno u mjesecu"}</p>
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
    const poredani = sortirajRedke(redci, stupci(p), poredak);
    const kronoloski = poredani.slice(0, prikazano);

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
          <span class="sitno">
            <span id="brojac"></span>
            <button type="button" class="gumb gumb--malo" id="preuzmi">Preuzmi CSV</button>
          </span>
        </div>
        <div class="tablica-okvir">
          <table>
            <thead id="zaglavlje">${zaglavljeTabliceHtml(stupci(p), poredak)}</thead>
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

    sadrzaj.querySelector("#preuzmi")?.addEventListener("click", () => {
      const dijelovi = ["isplate", f.mjesec, f.podskupina || f.namjena, f.ured].filter(Boolean);
      preuzmiCsv(
        dijelovi.join("-"),
        ["datum", "primatelj", "oib", "opis", "ured", "namjena", "broj_racuna",
         "broj_ugovora", "iznos_eur"],
        poredani.map((r) => {
          const [ime, oib] = p.primatelji[r[1]] ?? ["", ""];
          return [
            `${f.mjesec}-${String(r[0]).padStart(2, "0")}`,
            ime ?? "", oib ?? "", r[3],
            sifarnici.ured[r[4]] ?? r[4], COFOG[r[5]] ?? "", r[8], r[9], csvIznos(r[2]),
          ];
        })
      );
    });

    const zaglavlje = sadrzaj.querySelector<HTMLElement>("#zaglavlje");
    if (zaglavlje) {
      poveziSortiranje(zaglavlje, stupci(p), poredak, () => {
        prikazano = KORAK;
        void crtaj();
      });
    }
  }

  function osvjezi(): void {
    prikazano = KORAK;
    void crtaj();
  }

  izborGodine.addEventListener("change", () => {
    const godina = izborGodine.value;
    const dostupni = mjeseciGodine(godina);
    // Ako odabrani mjesec u novoj godini ne postoji, uzima se najbliži dostupni.
    const zeljeni = f.mjesec.slice(5);
    const mjesec = dostupni.includes(zeljeni) ? zeljeni : (dostupni[dostupni.length - 1] ?? "");
    if (mjesec) { f.mjesec = `${godina}-${mjesec}`; osvjezi(); }
  });
  izborMjeseca.addEventListener("change", () => {
    f.mjesec = `${f.mjesec.slice(0, 4)}-${izborMjeseca.value}`;
    osvjezi();
  });
  izborNamjene.addEventListener("change", () => { f.namjena = izborNamjene.value; osvjezi(); });
  izborUreda.addEventListener("change", () => { f.ured = izborUreda.value; osvjezi(); });
  pretraga.addEventListener("input", () => { f.upit = pretraga.value; osvjezi(); });
  spremnikOznaka.addEventListener("click", (e) => {
    const gumb = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-ukloni]");
    const kljuc = gumb?.dataset["ukloni"] as keyof Filtri | undefined;
    if (!kljuc) return;
    if (kljuc === "upit") pretraga.value = "";
    (f[kljuc] as string) = "";
    osvjezi();
  });

  cilj.querySelector("#ocisti")!.addEventListener("click", () => {
    f.namjena = ""; f.podskupina = ""; f.ured = ""; f.upit = ""; pretraga.value = ""; osvjezi();
  });

  const pomak = (korak: number): void => {
    const i = mjeseci.indexOf(f.mjesec) + korak;
    if (i >= 0 && i < mjeseci.length) { f.mjesec = mjeseci[i] as string; osvjezi(); }
  };
  cilj.querySelector("#prethodni")!.addEventListener("click", () => pomak(-1));
  cilj.querySelector("#sljedeci")!.addEventListener("click", () => pomak(1));

  await crtaj();
}
