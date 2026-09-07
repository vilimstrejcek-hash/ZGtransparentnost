import type { Podaci } from "../data";
import { datum, escapeHtml } from "../format";
import { zaglavljeHtml } from "../ui";
import type { Nalazi } from "../types";

const BAZA = import.meta.env.BASE_URL.replace(/\/+$/, "");

export async function prikaziNalaze(cilj: HTMLElement, podaci: Podaci): Promise<void> {
  const { meta } = podaci;
  let podatak: Nalazi | null = null;
  try {
    podatak = await fetch(`${BAZA}/data/nalazi.json`).then((o) => o.json());
  } catch {
    podatak = null;
  }

  const nalazi = podatak?.nalazi ?? [];

  cilj.innerHTML = `
    <div class="omotac">
      ${zaglavljeHtml("Nalazi", datum(meta.zadnji_datum),
        "Što iz podataka ispada samo od sebe. Svaki nalaz nosi brojku, objašnjenje kako je " +
        "dobiven i poveznicu na prikaz iz kojeg proizlazi.")}

      <p class="napomena">
        <strong>Kako čitati.</strong> ${escapeHtml(podatak?.napomena ?? "")}
        Nalazi se preračunavaju pri svakoj obradi podataka, pa se mijenjaju kako podaci rastu.
      </p>

      <div class="nalazi">
        ${nalazi.length
          ? nalazi.map((n) => `
            <article class="nalaz${n.tezina === "istaknuto" ? " nalaz--istaknut" : ""}">
              <div class="nalaz__vrijednost">${escapeHtml(n.vrijednost)}</div>
              <div class="nalaz__tijelo">
                <h3>${escapeHtml(n.naslov)}</h3>
                <p>${escapeHtml(n.objasnjenje)}</p>
                <details class="nalaz__kako">
                  <summary>Kako je izračunato</summary>
                  <p>${escapeHtml(n.kako)}</p>
                </details>
                ${n.veza ? `<p><a class="veza" href="${escapeHtml(n.veza)}">Pogledaj podatke →</a></p>` : ""}
              </div>
            </article>`).join("")
          : `<p class="prazno">Nalazi nisu dostupni.</p>`}
      </div>

      <section class="odjeljak" style="margin-top:34px">
        <h3>Što ovi nalazi nisu</h3>
        <p class="uvod" style="margin:0">
          Ovo su opažanja iz javnih podataka, ne ocjena zakonitosti ili opravdanosti trošenja.
          Odstupanje od plana može biti posljedica izmjena proračuna tijekom godine, a
          jednokratna velika isplata je uobičajena kod kupnji i građevinskih radova.
          Nalazi su polazište za pitanje, ne zaključak.
        </p>
      </section>
    </div>`;
}
