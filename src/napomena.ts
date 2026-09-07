import { escapeHtml } from "./format";
import type { Meta } from "./types";

/** Napomena o pokrivenosti — vidljiva na svakom prikazu (zahtjev brief-a). */
export function napomenaHtml(meta: Meta, dodatak = ""): string {
  const razdoblja = meta.pokrivenost
    .map((p) => `${p.godina}. (${p.mjeseci.length} mj., ${p.broj_dana} d.)`)
    .join(" · ");

  if (meta.puna_pokrivenost) {
    return `<p class="napomena"><strong>Pokrivenost:</strong> ${escapeHtml(razdoblja)}.
      ${escapeHtml(dodatak)}</p>`;
  }

  return `<p class="napomena">
    <strong>Nepotpuna pokrivenost.</strong> ${escapeHtml(meta.upozorenje)}
    ${dodatak ? ` ${escapeHtml(dodatak)}` : ""}
  </p>`;
}
