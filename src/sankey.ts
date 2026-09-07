import { sankey, sankeyLinkHorizontal, sankeyJustify } from "d3-sankey";
import { escapeHtml, eur, eurKratko } from "./format";
import { bojaPoIndeksu } from "./ui";
import type { TokGodina } from "./types";

interface Cvor { name: string; strana: "izvor" | "namjena"; index?: number;
  x0?: number; x1?: number; y0?: number; y1?: number; value?: number; }
interface Veza { source: number; target: number; value: number;
  width?: number; y0?: number; y1?: number; }

/** Tok novca od izvora financiranja prema namjeni. */
export function sankeyHtml(tok: TokGodina, sirina = 1100, visina = 460): string {
  const izvori = tok.izvori.map((i) => i.naziv);
  const namjene = tok.namjene.map((n) => n.naziv);
  if (!izvori.length || !namjene.length) {
    return `<p class="prazno">Nema podataka za prikaz toka.</p>`;
  }

  const cvorovi: Cvor[] = [
    ...izvori.map((n) => ({ name: n, strana: "izvor" as const })),
    ...namjene.map((n) => ({ name: n, strana: "namjena" as const })),
  ];
  const indeks = new Map(cvorovi.map((c, i) => [`${c.strana}:${c.name}`, i]));
  const veze: Veza[] = tok.veze
    .map((v) => ({
      source: indeks.get(`izvor:${v.izvor}`) ?? -1,
      target: indeks.get(`namjena:${v.namjena}`) ?? -1,
      value: v.iznos,
    }))
    .filter((v) => v.source >= 0 && v.target >= 0 && v.value > 0);

  const margina = { gore: 10, dolje: 10, lijevo: 4, desno: 4 };
  const raspored = sankey<Cvor, Veza>()
    .nodeWidth(14)
    .nodePadding(11)
    .nodeAlign(sankeyJustify)
    .extent([
      [margina.lijevo, margina.gore],
      [sirina - margina.desno, visina - margina.dolje],
    ]);

  const graf = raspored({
    nodes: cvorovi.map((c) => ({ ...c })),
    links: veze.map((v) => ({ ...v })),
  });

  const bojaCvora = (c: Cvor, i: number): string =>
    c.strana === "izvor" ? "#55606e" : bojaPoIndeksu(i);

  const putanja = sankeyLinkHorizontal();

  const vezeHtml = (graf.links as (Veza & { source: Cvor; target: Cvor })[])
    .map((v) => {
      const ciljIndeks = namjene.indexOf(v.target.name);
      return `<path class="sankey__veza" d="${putanja(v as never) ?? ""}"
        stroke="${bojaPoIndeksu(ciljIndeks)}" stroke-width="${Math.max(1, v.width ?? 1)}">
        <title>${escapeHtml(`${v.source.name} → ${v.target.name}: ${eur(v.value)}`)}</title>
      </path>`;
    }).join("");

  const cvoroviHtml = (graf.nodes as Cvor[]).map((c, i) => {
    const desno = c.strana === "namjena";
    const bojaIdx = desno ? namjene.indexOf(c.name) : i;
    const x = c.x0 ?? 0;
    const y = c.y0 ?? 0;
    const w = (c.x1 ?? 0) - x;
    const h = (c.y1 ?? 0) - y;
    const tx = desno ? x - 8 : x + w + 8;
    const sidro = desno ? "end" : "start";
    const visok = h >= 13;
    return `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${Math.max(1, h)}"
          fill="${bojaCvora(c, bojaIdx)}">
          <title>${escapeHtml(`${c.name}: ${eur(c.value ?? 0)}`)}</title>
        </rect>
        ${visok ? `<text class="sankey__natpis" x="${tx}" y="${y + h / 2}"
          dy="0.35em" text-anchor="${sidro}">${escapeHtml(c.name)}
          <tspan fill="#767676"> ${escapeHtml(eurKratko(c.value ?? 0))}</tspan></text>` : ""}
      </g>`;
  }).join("");

  return `
    <div class="odjeljak__zaglavlje">
      <span class="sankey__strana">Odakle novac dolazi</span>
      <span class="sankey__strana">Kamo odlazi</span>
    </div>
    <svg class="sankey" viewBox="0 0 ${sirina} ${visina}" role="img"
      aria-label="Tok novca od izvora financiranja prema namjeni">
      <g>${vezeHtml}</g>
      <g>${cvoroviHtml}</g>
    </svg>`;
}
