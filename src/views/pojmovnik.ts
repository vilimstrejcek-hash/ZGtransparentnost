import type { Podaci } from "../data";
import { datum, escapeHtml } from "../format";
import { zaglavljeHtml } from "../ui";

const POJMOVI: [string, string][] = [
  ["Isplata",
   "Pojedinačno plaćanje s računa Grada Zagreba prema primatelju. Jedna isplata može se " +
   "razdijeliti na više proračunskih pozicija, pa je broj stavki veći od broja isplata."],
  ["Funkcijska klasifikacija (COFOG)",
   "Razvrstavanje rashoda prema namjeni — obrazovanje, promet, kultura, socijalna zaštita. " +
   "Međunarodni je standard, pa se Zagreb može uspoređivati s drugim europskim gradovima."],
  ["Ekonomska klasifikacija",
   "Razvrstavanje prema vrsti rashoda: plaće, materijal, usluge, subvencije, ulaganja."],
  ["Organizacijska klasifikacija",
   "Gradski ured odnosno razdjel koji je isplatu izvršio. Ista šifra kroz godine ponekad " +
   "nosi različit naziv jer su se uredi preimenovali; ovdje se koristi aktualni naziv."],
  ["Izvor financiranja",
   "Odakle novac dolazi: opći prihodi, prihodi za posebne namjene, pomoći i EU sredstva, " +
   "primici od zaduživanja."],
  ["Konsolidirani plan rashoda",
   "Proračun koji Grad objavljuje na data.zagreb.hr. Uključuje i proračunske korisnike — " +
   "škole, vrtiće i ustanove — koji dio rashoda plaćaju sa svojih računa. Zato udio isplaćenog " +
   "s gradskog računa nije isto što i stopa izvršenja proračuna."],
  ["Sredstva mjesne samouprave",
   "Proračun kojim raspolažu gradske četvrti i mjesni odbori za komunalne akcije i održavanje " +
   "infrastrukture. To je dio ukupnog gradskog proračuna, ne cjelina."],
  ["Anonimizirani primatelji",
   "Isplate fizičkim osobama u izvoru su anonimizirane oznakom GDPR. Prikazane su zbirno i za " +
   "njih se ne izrađuje profil."],
];

export function prikaziPojmovnik(cilj: HTMLElement, podaci: Podaci): void {
  const { meta } = podaci;
  cilj.innerHTML = `
    <div class="omotac">
      ${zaglavljeHtml("Pojmovnik", datum(meta.zadnji_datum),
        "Što znače pojmovi iz proračuna Grada Zagreba i kako ih treba čitati.")}

      <div class="tablica-okvir">
        <table>
          <thead><tr><th style="width:16rem">Pojam</th><th>Objašnjenje</th></tr></thead>
          <tbody>
            ${POJMOVI.map(([p, o]) => `<tr>
              <td><strong>${escapeHtml(p)}</strong></td>
              <td>${escapeHtml(o)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <section class="odjeljak" style="margin-top:34px">
        <h3>Izvori podataka</h3>
        <div class="tablica-okvir">
          <table>
            <thead><tr><th>Izvor</th><th>Što daje</th></tr></thead>
            <tbody>
              <tr><td><a class="veza" href="https://transparentnost.zagreb.hr" target="_blank" rel="noopener noreferrer">iTransparentnost</a></td>
                <td>sve isplate s gradskog računa</td></tr>
              <tr><td><a class="veza" href="https://data.zagreb.hr" target="_blank" rel="noopener noreferrer">data.zagreb.hr</a></td>
                <td>konsolidirani plan rashoda, sredstva mjesne samouprave, geoportal ustanova</td></tr>
              <tr><td>Državni zavod za statistiku</td>
                <td>stanovništvo Grada i gradskih četvrti, Popis 2021.</td></tr>
              <tr><td><a class="veza" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></td>
                <td>podloga karte</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>`;
}
