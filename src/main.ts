import "./style.css";
import { ocistiGrafove } from "./charts";
import { ucitajPodatke, type Podaci } from "./data";
import { datum, escapeHtml } from "./format";

const glavno = document.querySelector<HTMLElement>("#glavno")!;
const REPO = "https://github.com/vilimstrejcek/transparentnost-plus";

type Prikaz =
  | "naslovnica" | "pregled" | "detalj" | "cetvrti" | "isplate"
  | "plan" | "trendovi" | "podaci" | "pojmovnik" | "profil";

interface Ruta {
  prikaz: Prikaz;
  oib?: string;
  upit?: string;
}

const RUTE: Record<string, Prikaz> = {
  "": "naslovnica",
  pregled: "pregled",
  detalj: "detalj",
  cetvrti: "cetvrti",
  isplate: "isplate",
  plan: "plan",
  trendovi: "trendovi",
  podaci: "podaci",
  pojmovnik: "pojmovnik",
};

/** Prikaz pod kojim se u navigaciji označava trenutna stranica. */
const NAV: Partial<Record<Prikaz, string>> = {
  profil: "isplate",
};

function procitajRutu(): Ruta {
  const [putanja, upit] = location.hash.replace(/^#\/?/, "").split("?");
  const [prvi, drugi] = (putanja ?? "").split("/");
  if (prvi === "primatelj" && drugi) return { prikaz: "profil", oib: decodeURIComponent(drugi) };
  const prikaz = RUTE[prvi ?? ""] ?? "naslovnica";
  return { prikaz, upit: new URLSearchParams(upit ?? "").get("q") ?? undefined };
}

function oznaciNavigaciju(prikaz: Prikaz): void {
  const aktivan = NAV[prikaz] ?? prikaz;
  for (const veza of document.querySelectorAll<HTMLAnchorElement>("[data-nav]")) {
    if (veza.dataset.nav === aktivan) veza.setAttribute("aria-current", "page");
    else veza.removeAttribute("aria-current");
  }
}

function ispisiPodnozje(podaci: Podaci): void {
  const { meta } = podaci;
  document.querySelector<HTMLElement>("#podnozje-sadrzaj")!.innerHTML = `
    <div>
      <h4>Transparentnost+</h4>
      <p><strong>Ovo nije službena stranica Grada Zagreba.</strong> Nezavisni je projekt
         koji obrađuje javno objavljene podatke Grada.</p>
      <p>Analitička nadogradnja gradske aplikacije iTransparentnost.</p>
      <p>Podaci obrađeni ${escapeHtml(datum(meta.datum_obrade))}, razdoblje
         ${escapeHtml(datum(meta.prvi_datum))} – ${escapeHtml(datum(meta.zadnji_datum))}.</p>
    </div>
    <div>
      <h4>Prikazi</h4>
      <ul>
        <li><a href="#/pregled">Pregled</a></li>
        <li><a href="#/detalj">Detalj proračuna</a></li>
        <li><a href="#/cetvrti">Ulaganja po četvrtima</a></li>
        <li><a href="#/isplate">Isplate primateljima</a></li>
        <li><a href="#/pojmovnik">Pojmovnik</a></li>
      </ul>
    </div>
    <div>
      <h4>Izvori i licence</h4>
      <ul>
        <li><a href="https://transparentnost.zagreb.hr" target="_blank" rel="noopener noreferrer">iTransparentnost</a></li>
        <li><a href="https://data.zagreb.hr" target="_blank" rel="noopener noreferrer">data.zagreb.hr</a></li>
        <li><a href="${REPO}" target="_blank" rel="noopener noreferrer">Kod na GitHubu (MIT)</a></li>
        <li>Obrađeni podaci: CC BY 4.0</li>
      </ul>
      <p>IBAN i poziv na broj nisu objavljeni. Isplate fizičkim osobama prikazane su zbirno.</p>
    </div>`;
}

function ispisiPojas(podaci: Podaci): void {
  const { summary, poNamjeni, meta } = podaci;
  const u = summary.ukupno;
  const stavke: [string, string][] = [
    ["Razdoblje", `${datum(meta.prvi_datum)} – ${datum(meta.zadnji_datum)}`],
    ["Ukupno isplaćeno", u.ukupno.toLocaleString("hr-HR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })],
    ["Isplata", u.broj_isplata.toLocaleString("hr-HR")],
    ["Primatelja", u.broj_primatelja.toLocaleString("hr-HR")],
    ["Po stanovniku", (u.ukupno / poNamjeni.stanovnika).toLocaleString("hr-HR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })],
  ];
  const pojas = document.querySelector<HTMLElement>("#pojas")!;
  pojas.innerHTML = `<div class="omotac pojas__unutra">
    ${stavke.map(([o, v]) => `<span class="pojas__stavka">${escapeHtml(o)}: <b>${escapeHtml(v)}</b></span>`).join("")}
  </div>`;
  pojas.hidden = false;
}

function prikaziGresku(poruka: string): void {
  glavno.innerHTML = `<div class="omotac"><div class="greska">
    <strong>Greška pri učitavanju.</strong>
    <p>${escapeHtml(poruka)}</p>
    <p>Ako pokrećeš lokalno, provjeri jesu li pokrenute skripte iz <code>scripts/</code>.</p>
  </div></div>`;
}

async function usmjeri(): Promise<void> {
  const ruta = procitajRutu();
  oznaciNavigaciju(ruta.prikaz);
  ocistiGrafove();
  const { ocistiKartu } = await import("./views/cetvrti");
  ocistiKartu();
  glavno.innerHTML = `<p class="ucitavanje">Učitavanje…</p>`;

  let podaci: Podaci;
  try {
    podaci = await ucitajPodatke();
  } catch (greska) {
    prikaziGresku(greska instanceof Error ? greska.message : String(greska));
    return;
  }
  ispisiPodnozje(podaci);
  ispisiPojas(podaci);

  try {
    switch (ruta.prikaz) {
      case "naslovnica": {
        const { prikaziNaslovnicu } = await import("./views/naslovnica");
        prikaziNaslovnicu(glavno, podaci);
        break;
      }
      case "pregled": {
        const { prikaziPregled } = await import("./views/pregled");
        prikaziPregled(glavno, podaci);
        break;
      }
      case "detalj": {
        const { prikaziDetalj } = await import("./views/detalj");
        prikaziDetalj(glavno, podaci);
        break;
      }
      case "cetvrti": {
        const { prikaziCetvrti } = await import("./views/cetvrti");
        prikaziCetvrti(glavno, podaci);
        break;
      }
      case "isplate": {
        const { prikaziIsplate } = await import("./views/isplate");
        prikaziIsplate(glavno, podaci, ruta.upit ?? "");
        break;
      }
      case "plan": {
        const { prikaziPlan } = await import("./views/plan");
        prikaziPlan(glavno, podaci);
        break;
      }
      case "trendovi": {
        const { prikaziTrendove } = await import("./views/trendovi");
        prikaziTrendove(glavno, podaci);
        break;
      }
      case "podaci": {
        const { prikaziPodatke } = await import("./views/podaci");
        await prikaziPodatke(glavno, podaci);
        break;
      }
      case "pojmovnik": {
        const { prikaziPojmovnik } = await import("./views/pojmovnik");
        prikaziPojmovnik(glavno, podaci);
        break;
      }
      case "profil": {
        const { prikaziProfil } = await import("./views/profil");
        await prikaziProfil(glavno, podaci, ruta.oib!);
        break;
      }
    }
  } catch (greska) {
    prikaziGresku(greska instanceof Error ? greska.message : String(greska));
    return;
  }

  window.scrollTo({ top: 0 });
}

document.querySelector<HTMLFormElement>("#trazilica")!.addEventListener("submit", (e) => {
  e.preventDefault();
  const polje = document.querySelector<HTMLInputElement>("#pretraga-glavna")!;
  location.hash = `#/isplate?q=${encodeURIComponent(polje.value.trim())}`;
});

window.addEventListener("hashchange", () => void usmjeri());
void usmjeri();
