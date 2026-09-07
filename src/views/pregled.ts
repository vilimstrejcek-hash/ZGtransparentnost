import type { Podaci } from "../data";
import { broj, datum, escapeHtml, eur, postotak } from "../format";
import { sankeyHtml } from "../sankey";
import { brojkaHtml, godineOsHtml, kontroleDnoHtml, poveziGodine, zaglavljeHtml } from "../ui";

const KORACI: [string, string][] = [
  ["Gradski prihodi",
   "Prikupljaju se iz gradskih poreza i prireza, komunalne naknade i komunalnog doprinosa."],
  ["Ostali izvori",
   "Pomoći iz državnog proračuna i EU fondova, prihodi za posebne namjene te zaduživanje."],
  ["Na što se troši",
   "Grad time financira javne usluge i ustanove — vrtiće i škole, promet, kulturu, sport i socijalnu skrb."],
];

export function prikaziPregled(cilj: HTMLElement, podaci: Podaci): void {
  const { tok, summary, meta } = podaci;
  const godine = summary.godine;
  const zadnjaPotpuna = meta.pokrivenost.filter((p) => !p.tekuca).at(-1)?.godina;
  let odabrana = zadnjaPotpuna ?? godine[godine.length - 1] ?? "sve";

  cilj.innerHTML = `
    <div class="omotac">
      ${zaglavljeHtml("Pregled", datum(meta.zadnji_datum))}

      <div class="koraci">
        ${KORACI.map(([naslov, opis], i) => `
          <div class="korak">
            <div class="korak__broj">${i + 1}.</div>
            <h3>${escapeHtml(naslov)}</h3>
            <p>${escapeHtml(opis)}</p>
          </div>`).join("")}
      </div>

      <div class="brojke" id="brojke"></div>

      <section class="odjeljak">
        <h3 style="text-align:center">Tok novca Grada Zagreba</h3>
        <div id="sankey"></div>
      </section>

      ${kontroleDnoHtml(godineOsHtml(godine, odabrana, "Sve zajedno"),
        `<p class="sitno" style="text-align:center;margin:0">
          Stvarne isplate s gradskog računa, bez usklađivanja za inflaciju.
        </p>`)}
    </div>`;

  const spremnikSankey = cilj.querySelector<HTMLElement>("#sankey")!;
  const spremnikBrojki = cilj.querySelector<HTMLElement>("#brojke")!;

  function crtaj(): void {
    const t = tok[odabrana];
    const s = odabrana === "sve" ? summary.ukupno : summary.po_godini[odabrana];
    spremnikSankey.innerHTML = t ? sankeyHtml(t) : `<p class="prazno">Nema podataka.</p>`;
    spremnikBrojki.innerHTML = s
      ? [
          brojkaHtml("Ukupno isplaćeno", eur(s.ukupno),
            odabrana === "sve" ? `${godine[0]}.–${godine[godine.length - 1]}.` : `${odabrana}. godina`),
          brojkaHtml("Broj isplata", broj(s.broj_isplata), `na ${broj(s.broj_stavki)} pozicija`),
          brojkaHtml("Primatelja", broj(s.broj_primatelja), "jedinstvenih OIB-ova"),
          brojkaHtml("Udio deset najvećih", postotak(s.udio_top10), "od ukupnog iznosa"),
        ].join("")
      : "";
  }

  poveziGodine(cilj.querySelector<HTMLElement>(".godine-os")!, (g) => {
    odabrana = g;
    crtaj();
  });
  crtaj();
}
