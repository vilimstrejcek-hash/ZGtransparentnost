import "./style.css";
import { ocistiGrafove } from "./charts";
import { ucitajPodatke, type Podaci } from "./data";
import { datum, escapeHtml } from "./format";

const glavno = document.querySelector<HTMLElement>("#glavno")!;
const REPO = "https://github.com/vilimstrejcek/transparentnost-plus";

type Prikaz = "pregled" | "karta" | "primatelji" | "profil";

interface Ruta {
  prikaz: Prikaz;
  oib?: string;
  upit?: string;
}

function procitajRutu(): Ruta {
  const [putanja, upit] = location.hash.replace(/^#\/?/, "").split("?");
  const [prvi, drugi] = (putanja ?? "").split("/");
  const q = new URLSearchParams(upit ?? "").get("q") ?? undefined;
  if (prvi === "primatelj" && drugi) return { prikaz: "profil", oib: decodeURIComponent(drugi) };
  if (prvi === "karta") return { prikaz: "karta" };
  if (prvi === "primatelji") return { prikaz: "primatelji", upit: q };
  return { prikaz: "pregled" };
}

function oznaciNavigaciju(prikaz: Prikaz): void {
  const aktivan = prikaz === "profil" ? "primatelji" : prikaz;
  for (const veza of document.querySelectorAll<HTMLAnchorElement>("[data-nav]")) {
    if (veza.dataset.nav === aktivan) veza.setAttribute("aria-current", "page");
    else veza.removeAttribute("aria-current");
  }
}

function ispisiPodnozje(podaci: Podaci): void {
  const { meta } = podaci;
  document.querySelector<HTMLElement>("#podnozje-sadrzaj")!.innerHTML = `
    <p>
      Izvor: Grad Zagreb —
      <a href="https://transparentnost.zagreb.hr" target="_blank" rel="noopener noreferrer">iTransparentnost</a>
      i <a href="https://data.zagreb.hr" target="_blank" rel="noopener noreferrer">data.zagreb.hr</a>.
      ${escapeHtml(datum(meta.prvi_datum))} – ${escapeHtml(datum(meta.zadnji_datum))}.
    </p>
    <p>
      <a href="${escapeHtml(import.meta.env.BASE_URL)}data/preuzimanje/najveci_primatelji.csv" download>Preuzmi podatke</a>
      · <a href="${REPO}" target="_blank" rel="noopener noreferrer">Kod</a>
      · Transparentnost+
    </p>`;
}

function prikaziGresku(poruka: string): void {
  glavno.innerHTML = `<div class="omotac"><div class="greska">${escapeHtml(poruka)}</div></div>`;
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

  try {
    switch (ruta.prikaz) {
      case "pregled": {
        const { prikaziPregled } = await import("./views/pregled");
        prikaziPregled(glavno, podaci);
        break;
      }
      case "karta": {
        const { prikaziCetvrti } = await import("./views/cetvrti");
        prikaziCetvrti(glavno, podaci);
        break;
      }
      case "primatelji": {
        const { prikaziPrimatelje } = await import("./views/primatelji");
        prikaziPrimatelje(glavno, podaci, ruta.upit ?? "");
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
  location.hash = `#/primatelji?q=${encodeURIComponent(polje.value.trim())}`;
});

window.addEventListener("hashchange", () => void usmjeri());
void usmjeri();
