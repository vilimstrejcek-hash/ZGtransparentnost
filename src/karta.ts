import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { broj, escapeHtml, eur, eurKratko } from "./format";
import type { Cetvrt, Granice, Ustanova } from "./types";

const ZAGREB: [number, number] = [45.83, 15.98];

/** Boja po vrsti ustanove — usklađena s paletom ostatka aplikacije. */
const BOJE: Record<string, string> = {
  "Osnovna škola": "#1d5b74",
  "Kulturna ustanova": "#7d5ba6",
  "Zdravstvena ustanova": "#a8443c",
  "Dom za starije": "#2f7d6f",
};

/** Stupnjevi za bojanje četvrti po iznosu po stanovniku — svijetlo prema tamnom. */
const STUPNJEVI = ["#eef3f6", "#cfe0e8", "#a9c9d8", "#7fb0c6", "#4e8fae", "#2b6c8c"];

export const BOJE_VRSTA = BOJE;

const bojaVrste = (vrsta: string): string => BOJE[vrsta] ?? "#55606e";

/** Polumjer po korijenu iznosa — površina kruga tada odgovara iznosu. */
function polumjer(iznos: number, najveci: number): number {
  if (!iznos || !najveci) return 4;
  return 5 + Math.sqrt(iznos / najveci) * 21;
}

/** Granice razreda po kvantilima. Linearna podjela ovdje ne radi: Brezovica
   odskače toliko da bi većina četvrti završila u najsvjetlijem razredu. */
export function kvantilneGranice(vrijednosti: number[], razreda = STUPNJEVI.length): number[] {
  const poredane = [...vrijednosti].sort((a, b) => a - b);
  if (!poredane.length) return [];
  const granice: number[] = [];
  for (let i = 1; i < razreda; i++) {
    const mjesto = (poredane.length - 1) * (i / razreda);
    const donji = Math.floor(mjesto);
    const gornji = Math.min(poredane.length - 1, donji + 1);
    const udio = mjesto - donji;
    granice.push((poredane[donji] as number) * (1 - udio) + (poredane[gornji] as number) * udio);
  }
  return granice;
}

function bojaCetvrti(vrijednost: number | null, granice: number[]): string {
  if (vrijednost === null) return "#f2f5f6";
  let i = 0;
  while (i < granice.length && vrijednost >= (granice[i] as number)) i++;
  return STUPNJEVI[Math.min(i, STUPNJEVI.length - 1)] as string;
}

export interface KartaRuke {
  postaviUstanove(ustanove: Ustanova[]): void;
  namjestiOkvir(): void;
  prikaziCetvrti(vidljivo: boolean): void;
  istakni(naziv: string | null): void;
  unisti(): void;
}

export interface KartaPostavke {
  granice: Granice;
  cetvrti: Cetvrt[];
  naOdabirCetvrti?: (naziv: string) => void;
}

export function nacrtajKartu(spremnik: HTMLElement, postavke: KartaPostavke): KartaRuke {
  // Kotačić se ne uključuje odmah jer bi otimao pomicanje stranice. Uključuje se
  // klikom na kartu, a gasi kad miš ode s nje. Ctrl/Cmd + kotačić radi uvijek.
  const karta = L.map(spremnik, { scrollWheelZoom: false }).setView(ZAGREB, 11);

  const uputa = L.DomUtil.create("div", "karta__uputa", spremnik);
  uputa.textContent = "Klikni za zumiranje kotačićem · dvoklik ili + / −";
  L.DomEvent.disableClickPropagation(uputa);

  const ukljuciKotacic = (): void => {
    karta.scrollWheelZoom.enable();
    uputa.hidden = true;
  };
  const iskljuciKotacic = (): void => {
    karta.scrollWheelZoom.disable();
    uputa.hidden = false;
  };

  karta.on("click", ukljuciKotacic);
  karta.on("focus", ukljuciKotacic);
  spremnik.addEventListener("mouseleave", iskljuciKotacic);

  // Ctrl/Cmd + kotačić zumira i bez prethodnog klika, kao u kartografskim alatima.
  spremnik.addEventListener("wheel", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const smjer = e.deltaY < 0 ? 1 : -1;
    karta.setZoomAround(
      karta.mouseEventToLatLng(e as unknown as MouseEvent),
      karta.getZoom() + smjer
    );
  }, { passive: false });

  // CARTO-ove svijetle pločice od nedavno traže ključ, pa ide standardni OSM.
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(karta);

  const poNazivu = new Map(postavke.cetvrti.map((c) => [c.naziv, c]));
  const vrijednosti = postavke.cetvrti
    .map((c) => c.po_stanovniku)
    .filter((v): v is number => v !== null);
  const granice = kvantilneGranice(vrijednosti);

  const stilCetvrti = (naziv: string, naglaseno = false): L.PathOptions => {
    const c = poNazivu.get(naziv);
    return {
      color: naglaseno ? "#12303f" : "#ffffff",
      weight: naglaseno ? 2.5 : 1,
      fillColor: bojaCetvrti(c?.po_stanovniku ?? null, granice),
      fillOpacity: naglaseno ? 0.9 : 0.72,
    };
  };

  const slojCetvrti = L.geoJSON(postavke.granice as unknown as GeoJSON.GeoJsonObject, {
    style: (znacajka) => stilCetvrti(String(znacajka?.properties?.["naziv"] ?? "")),
    onEachFeature: (znacajka, sloj) => {
      const naziv = String(znacajka.properties?.["naziv"] ?? "");
      const c = poNazivu.get(naziv);
      sloj.bindTooltip(
        `<strong>${escapeHtml(naziv)}</strong><br>
         ${c?.po_stanovniku !== null && c ? `${escapeHtml(eur(c.po_stanovniku ?? 0))} po stanovniku` : "nema podatka"}
         ${c ? `<br>${escapeHtml(eurKratko(c.ukupno))} ukupno · ${escapeHtml(broj(c.stanovnika ?? 0))} stanovnika` : ""}`,
        { sticky: true }
      );
      sloj.on("click", () => postavke.naOdabirCetvrti?.(naziv));
    },
  }).addTo(karta);

  const slojUstanova = L.layerGroup().addTo(karta);

  function postaviUstanove(ustanove: Ustanova[]): void {
    slojUstanova.clearLayers();
    const sIznosom = ustanove.filter((u) => u.ukupno);
    const najveciIznos = Math.max(...sIznosom.map((u) => u.ukupno ?? 0), 0);

    for (const u of ustanove) {
      const iznos = u.ukupno ?? 0;
      const podruznica = !iznos;
      const krug = L.circleMarker([u.lat, u.lon], {
        radius: podruznica ? 3.5 : polumjer(iznos, najveciIznos),
        color: "#ffffff",
        weight: podruznica ? 0.8 : 1.4,
        opacity: 0.95,
        fillColor: bojaVrste(u.vrsta),
        fillOpacity: podruznica ? 0.35 : 0.85,
      });

      const veza = u.oib
        ? `<a class="veza" href="#/primatelj/${encodeURIComponent(u.oib)}">Otvori sve isplate</a>`
        : "";
      krug.bindPopup(`
        <strong>${escapeHtml(u.naziv)}</strong><br>
        <span class="karta__vrsta">${escapeHtml(u.vrsta)}</span>
        ${u.adresa ? `<br>${escapeHtml(u.adresa)}` : ""}
        ${u.cetvrt ? `<br><em>${escapeHtml(u.cetvrt)}</em>` : ""}
        <br><br>
        ${iznos
          ? `<strong>${escapeHtml(eur(iznos))}</strong><br>
             ${escapeHtml(broj(u.broj_isplata ?? 0))} isplata
             ${u.lokacija_ustanove && u.lokacija_ustanove > 1
               ? `<br><span class="karta__vrsta">iznos se odnosi na ustanovu, koja ima ${escapeHtml(broj(u.lokacija_ustanove))} lokacija</span>`
               : ""}
             <br>${veza}`
          : podruznica && u.oib
            ? `<span class="karta__vrsta">Druga lokacija iste ustanove — iznos je pripisan glavnoj.</span><br>${veza}`
            : `<span class="karta__vrsta">Nema isplata koje se mogu jednoznačno pripisati ovoj ustanovi.</span>`}
      `);
      krug.addTo(slojUstanova);
    }
  }

  // Leaflet računa zoom iz veličine spremnika; ako se karta stvori prije nego
  // preglednik rasporedi stranicu, dobije nulu i ostane na prikazu cijelog
  // svijeta. Zato se okvir postavlja tek nakon sljedećeg iscrtavanja.
  const namjestiOkvir = (): void => {
    karta.invalidateSize();
    const okvir = slojCetvrti.getBounds();
    if (okvir.isValid()) karta.fitBounds(okvir.pad(0.02));
  };
  requestAnimationFrame(namjestiOkvir);

  return {
    postaviUstanove,
    prikaziCetvrti(vidljivo) {
      if (vidljivo) slojCetvrti.addTo(karta);
      else karta.removeLayer(slojCetvrti);
    },
    istakni(naziv) {
      slojCetvrti.eachLayer((sloj) => {
        const ime = String(
          (sloj as L.GeoJSON & { feature?: { properties?: Record<string, unknown> } })
            .feature?.properties?.["naziv"] ?? ""
        );
        (sloj as L.Path).setStyle(stilCetvrti(ime, ime === naziv));
      });
    },
    namjestiOkvir,
    unisti() {
      slojUstanova.clearLayers();
      karta.remove();
    },
  };
}

export const STUPNJEVI_BOJA = STUPNJEVI;
