import { broj, datum, escapeHtml } from "./format";
import type { Meta } from "./types";

/** Napomena o pokrivenosti — vidljiva na svakom prikazu (zahtjev brief-a). */
export function napomenaHtml(meta: Meta, dodatak = ""): string {
  const razdoblje = `${datum(meta.prvi_datum)} – ${datum(meta.zadnji_datum)}`;
  const opseg = `${broj(meta.broj_isplata)} isplata kroz ${broj(meta.broj_dana)} dana`;

  if (meta.puna_pokrivenost) {
    const tekuca = meta.pokrivenost.find((p) => p.tekuca);
    const uzTekucu = tekuca
      ? ` Tekuća ${tekuca.godina}. godina obuhvaća ${broj(tekuca.broj_mjeseci)} mjeseci i prirodno je nepotpuna.`
      : "";
    return `<p class="napomena napomena--uredu">
      <strong>Pokrivenost:</strong> ${escapeHtml(razdoblje)} — ${escapeHtml(opseg)}.
      Sve isplate objavljene na portalu iTransparentnost u tom razdoblju.${escapeHtml(uzTekucu)}
      ${dodatak ? ` ${escapeHtml(dodatak)}` : ""}
    </p>`;
  }

  return `<p class="napomena">
    <strong>Nepotpuna pokrivenost.</strong> ${escapeHtml(meta.upozorenje)}
    ${dodatak ? ` ${escapeHtml(dodatak)}` : ""}
  </p>`;
}
