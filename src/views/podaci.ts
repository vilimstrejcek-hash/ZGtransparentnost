import type { Podaci } from "../data";
import { broj, datum, escapeHtml } from "../format";
import { zaglavljeHtml } from "../ui";
import type { Preuzimanje } from "../types";

const BAZA = import.meta.env.BASE_URL.replace(/\/+$/, "");

function velicina(bajtova: number): string {
  return bajtova >= 1024 * 1024
    ? `${(bajtova / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bajtova / 1024)} KB`;
}

export async function prikaziPodatke(cilj: HTMLElement, podaci: Podaci): Promise<void> {
  const { meta } = podaci;
  let popis: Preuzimanje | null = null;
  try {
    popis = await fetch(`${BAZA}/data/preuzimanje.json`).then((o) => o.json());
  } catch {
    popis = null;
  }

  cilj.innerHTML = `
    <div class="omotac">
      ${zaglavljeHtml("Podaci za preuzimanje", datum(meta.zadnji_datum),
        "Sve što ova aplikacija prikazuje dostupno je i u strojno čitljivom obliku, " +
        "besplatno i bez registracije. Podaci su obrađeni iz javnih izvora Grada Zagreba.")}

      <div class="obavijest">
        <h3>Licenca i pripisivanje</h3>
        <p>
          Obrađeni podaci objavljeni su pod licencom
          <a class="veza" href="https://creativecommons.org/licenses/by/4.0/deed.hr"
             target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.
          Smiješ ih koristiti, mijenjati i objavljivati, uz navođenje izvora:
        </p>
        <p class="pripisivanje">
          Transparentnost+ (STRX), obrada javnih podataka Grada Zagreba, CC BY 4.0
        </p>
        <p class="sitno">
          Kod aplikacije je pod MIT licencom i dostupan je na GitHubu.
          Izvorni podaci ostaju vlasništvo Grada Zagreba i Državnog zavoda za statistiku.
        </p>
      </div>

      <section class="odjeljak">
        <h3>Tablice (CSV)</h3>
        <p class="sitno" style="margin-top:-4px">
          Razdvojeno točkom sa zarezom, UTF-8 s BOM-om — otvara se izravno u Excelu.
        </p>
        <div class="tablica-okvir">
          <table>
            <thead><tr>
              <th>Skup podataka</th><th class="broj">Redaka</th>
              <th class="broj">Veličina</th><th class="broj">Preuzimanje</th>
            </tr></thead>
            <tbody id="popis-skupova"></tbody>
          </table>
        </div>
      </section>

      <section class="odjeljak">
        <h3>Izravni JSON</h3>
        <p class="sitno" style="margin-top:-4px">
          Iste datoteke koje koristi i sama aplikacija — pogodne za dohvat iz koda.
        </p>
        <div class="tablica-okvir">
          <table>
            <thead><tr><th>Datoteka</th><th>Sadržaj</th></tr></thead>
            <tbody>
              ${[
                ["summary.json", "ukupni iznosi po godini i mjesecu"],
                ["po_namjeni.json", "isplate po namjeni (COFOG), s iznosom po stanovniku"],
                ["po_uredu.json", "isplate po gradskom uredu"],
                ["po_ekonomskoj.json", "isplate po vrsti rashoda"],
                ["top_primatelji.json", "najveći primatelji po godini"],
                ["tok.json", "tok od izvora financiranja prema namjeni"],
                ["plan.json", "plan rashoda i odstupanja"],
                ["cetvrti.json", "sredstva mjesne samouprave po četvrtima"],
                ["granice.json", "granice gradskih četvrti (GeoJSON)"],
                ["ustanove.json", "gradske ustanove s koordinatama"],
                ["meta.json", "razdoblje, pokrivenost i napomene o obradi"],
              ].map(([f, o]) => `<tr>
                <td><a class="veza" href="${BAZA}/data/${f}" target="_blank" rel="noopener">${escapeHtml(String(f))}</a></td>
                <td>${escapeHtml(String(o))}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>

      <section class="odjeljak">
        <h3>Kako su podaci nastali</h3>
        <ol class="postupak">
          <li><strong>Dohvat.</strong> Isplate se dohvaćaju s otvorenog API-ja platforme
            Otvoreno, istog koji koristi javno sučelje iTransparentnosti.</li>
          <li><strong>Čišćenje.</strong> Zapisi se razgrću po proračunskim pozicijama,
            klasifikacije se razdvajaju na šifru i naziv, a isplate fizičkim osobama
            grupiraju se zbirno jer su u izvoru anonimizirane.</li>
          <li><strong>Spajanje.</strong> Plan rashoda, sredstva mjesne samouprave, granice
            četvrti, geolocirane ustanove i popis stanovništva dolaze s data.zagreb.hr
            odnosno od Državnog zavoda za statistiku.</li>
          <li><strong>Provjera.</strong> Dnevni zbrojevi uspoređuju se s onima koje vraća
            API. Sve skripte su u repozitoriju i mogu se pokrenuti ponovno.</li>
        </ol>
        <p class="sitno">
          IBAN i poziv na broj ne objavljuju se ni u jednom skupu, iako ih izvor sadrži.
        </p>
      </section>
    </div>`;

  const tijelo = cilj.querySelector<HTMLElement>("#popis-skupova")!;
  tijelo.innerHTML = popis?.skupovi?.length
    ? popis.skupovi.map((s) => `<tr>
        <td><strong>${escapeHtml(s.opis)}</strong><br><span class="sitno">${escapeHtml(s.ime)}.csv</span></td>
        <td class="broj">${escapeHtml(broj(s.redaka))}</td>
        <td class="broj">${escapeHtml(velicina(s.bajtova))}</td>
        <td class="broj"><a class="gumb gumb--malo" href="${BAZA}/${escapeHtml(s.csv)}" download>Preuzmi</a></td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="prazno">Popis skupova nije dostupan.</td></tr>`;
}
