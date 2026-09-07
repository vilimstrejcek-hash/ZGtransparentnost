import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { broj, escapeHtml, eur } from "./format";
import type { Ustanova } from "./types";

const ZAGREB: [number, number] = [45.815, 15.982];

/** Boja po vrsti ustanove — usklađena s paletom ostatka aplikacije. */
const BOJE: Record<string, string> = {
  "Osnovna škola": "#1f4e8c",
  "Kulturna ustanova": "#7a6a9c",
  "Zdravstvena ustanova": "#8a5b5b",
  "Dom za starije": "#2b6a63",
};

const boja = (vrsta: string): string => BOJE[vrsta] ?? "#4a5a72";

/** Polumjer po korijenu iznosa — površina kruga tada odgovara iznosu. */
function polumjer(iznos: number, najveci: number): number {
  if (!iznos || !najveci) return 4;
  return 5 + Math.sqrt(iznos / najveci) * 22;
}

export interface KartaRuke {
  postavi(ustanove: Ustanova[]): void;
  unisti(): void;
}

export function nacrtajKartu(spremnik: HTMLElement): KartaRuke {
  const karta = L.map(spremnik, { scrollWheelZoom: false }).setView(ZAGREB, 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(karta);

  let sloj = L.layerGroup().addTo(karta);

  function postavi(ustanove: Ustanova[]): void {
    sloj.clearLayers();
    const sIznosom = ustanove.filter((u) => u.ukupno);
    const najveci = Math.max(...sIznosom.map((u) => u.ukupno ?? 0), 0);

    for (const u of ustanove) {
      const iznos = u.ukupno ?? 0;
      const podruznica = !iznos;
      const krug = L.circleMarker([u.lat, u.lon], {
        radius: podruznica ? 4 : polumjer(iznos, najveci),
        color: boja(u.vrsta),
        weight: podruznica ? 1 : 1.5,
        opacity: podruznica ? 0.5 : 0.9,
        fillColor: boja(u.vrsta),
        fillOpacity: podruznica ? 0.15 : 0.45,
      });

      const veza = u.oib
        ? `<a class="veza" href="#/primatelj/${encodeURIComponent(u.oib)}">Otvori profil primatelja</a>`
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
      krug.addTo(sloj);
    }

    if (sIznosom.length) {
      karta.fitBounds(L.latLngBounds(sIznosom.map((u) => [u.lat, u.lon] as [number, number])).pad(0.08));
    }
  }

  return {
    postavi,
    unisti() {
      sloj.clearLayers();
      karta.remove();
    },
  };
}

export const BOJE_VRSTA = BOJE;
