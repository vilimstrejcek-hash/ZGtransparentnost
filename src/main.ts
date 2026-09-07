import "./style.css";
import { ocistiGrafove } from "./charts";
import { ucitajPodatke, type Podaci } from "./data";
import { datum, escapeHtml } from "./format";
import { prikaziPregled } from "./views/pregled";

const glavno = document.querySelector<HTMLElement>("#glavno")!;

interface Ruta {
  prikaz: "pregled" | "primatelji" | "profil";
  oib?: string;
}

function procitajRutu(): Ruta {
  const hash = location.hash.replace(/^#\/?/, "");
  const [prvi, drugi] = hash.split("/");
  if (prvi === "primatelj" && drugi) return { prikaz: "profil", oib: decodeURIComponent(drugi) };
  if (prvi === "primatelji") return { prikaz: "primatelji" };
  return { prikaz: "pregled" };
}

function oznaciNavigaciju(prikaz: Ruta["prikaz"]): void {
  const aktivan = prikaz === "pregled" ? "pregled" : "primatelji";
  for (const veza of document.querySelectorAll<HTMLAnchorElement>("[data-nav]")) {
    if (veza.dataset.nav === aktivan) veza.setAttribute("aria-current", "page");
    else veza.removeAttribute("aria-current");
  }
}

function ispisiPodnozje(podaci: Podaci): void {
  const { meta } = podaci;
  const repo = "https://github.com/vilimstrejcek/transparentnost-plus";
  const pokrivenost = meta.pokrivenost
    .map((p) => `${p.godina}. (${p.mjeseci.join(", ")})`)
    .join("; ");

  document.querySelector<HTMLElement>("#podnozje-sadrzaj")!.innerHTML = `
    <p>Izvor: Grad Zagreb, <a href="https://transparentnost.zagreb.hr" target="_blank"
      rel="noopener noreferrer">iTransparentnost</a>. Podaci obrađeni ${escapeHtml(datum(meta.datum_obrade))}</p>
    <p>Kod: <a href="${repo}" target="_blank" rel="noopener noreferrer">GitHub</a>, MIT licenca.
      Prototip — pokrivenost podataka: ${escapeHtml(pokrivenost)}.</p>
    <p>IBAN i poziv na broj nisu objavljeni. Isplate fizičkim osobama u izvoru su
      anonimizirane i prikazane zbirno.</p>
  `;
}

function prikaziGresku(poruka: string): void {
  glavno.innerHTML = `<div class="greska">
    <strong>Greška pri učitavanju.</strong>
    <p>${escapeHtml(poruka)}</p>
    <p>Ako pokrećeš lokalno, provjeri je li pokrenut <code>npm run data</code> pa <code>npm run dev</code>.</p>
  </div>`;
}

async function usmjeri(): Promise<void> {
  const ruta = procitajRutu();
  oznaciNavigaciju(ruta.prikaz);
  ocistiGrafove();
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
      case "pregled":
        prikaziPregled(glavno, podaci);
        break;
      case "primatelji": {
        const { prikaziPrimatelje } = await import("./views/primatelji");
        prikaziPrimatelje(glavno, podaci);
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

  if (location.hash) window.scrollTo({ top: 0 });
}

window.addEventListener("hashchange", () => void usmjeri());
void usmjeri();
