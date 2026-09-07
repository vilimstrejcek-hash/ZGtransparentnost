import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController,
  Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip,
} from "chart.js";
import { eur, eurOs } from "./format";

Chart.register(
  ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler,
  Legend, LineController, LineElement, LinearScale, PointElement, Tooltip
);

Chart.defaults.font.family =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = "#5b6779";
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation = { duration: 350 };

/** Prigušena plavo-siva paleta — bez šarenila, čitljiva i u nizu. */
export const PALETA = [
  "#1f4e8c", "#3d76c4", "#6f9ad4", "#2b6a63", "#5a8f88",
  "#7a6a9c", "#a08a5b", "#8a5b5b", "#4a5a72", "#96a4b8",
];

export const boja = (i: number): string => PALETA[i % PALETA.length] as string;

export const OPCI_TOOLTIP = {
  backgroundColor: "#12203a",
  padding: 10,
  titleFont: { weight: 600 as const },
  cornerRadius: 6,
  displayColors: false,
};

export const OS_NOVAC = {
  ticks: { callback: (v: string | number) => eurOs(Number(v)) },
  grid: { color: "#eceff5" },
  border: { display: false },
};

export const novacTooltip = (naziv?: (i: number) => string) => ({
  ...OPCI_TOOLTIP,
  callbacks: {
    ...(naziv ? { title: (stavke: { dataIndex: number }[]) => naziv(stavke[0]!.dataIndex) } : {}),
    label: (ctx: { parsed: { x: number; y: number } | number }) => {
      const p = ctx.parsed;
      const v = typeof p === "number" ? p : (p.x ?? p.y);
      return eur(Number(v));
    },
  },
});

/* Chart.js generici ne prolaze kroz ovaj omotač bez gubitka tipa dataseta,
   pa je konfiguracija namjerno labavo tipizirana na jednom mjestu. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Konfiguracija = ConstructorParameters<typeof Chart<any, any, any>>[1];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BiloKojiGraf = Chart<any, any, any>;

/** Uništi prethodni graf na canvasu prije ponovnog crtanja. */
const grafovi = new Map<HTMLCanvasElement, BiloKojiGraf>();

export function nacrtaj(
  canvas: HTMLCanvasElement,
  konfiguracija: Konfiguracija
): BiloKojiGraf {
  grafovi.get(canvas)?.destroy();
  const graf = new Chart(canvas, konfiguracija);
  grafovi.set(canvas, graf);
  return graf;
}

export function ocistiGrafove(): void {
  for (const g of grafovi.values()) g.destroy();
  grafovi.clear();
}
