#!/usr/bin/env python3
"""Izvodi nalaze iz obrađenih podataka.

Nalazi se računaju, ne pišu ručno — svaki nosi brojku, izvor i objašnjenje kako
je dobiven, pa se može provjeriti. Ovo nije ocjena ni optužba, nego opažanje iz
javnih podataka.

    .venv/bin/python scripts/build_nalazi.py
"""
from __future__ import annotations

import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PODACI = ROOT / "public" / "data"
ISPLATE = ROOT / "Data za prototip" / "api" / "isplate.jsonl"
IZLAZ = PODACI / "nalazi.json"

PRAG_JEDNE_ISPLATE = 1_000_000.0


def ucitaj(ime: str):
    return json.loads((PODACI / f"{ime}.json").read_text(encoding="utf-8"))


def hr(tekst: str) -> str:
    """Engleski zapis brojeva u hrvatski: 1,234.5 -> 1.234,5"""
    return tekst.replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def nalaz(naslov: str, vrijednost: str, objasnjenje: str, kako: str,
          veza: str | None = None, tezina: str = "obicno") -> dict:
    return {"naslov": naslov, "vrijednost": vrijednost, "objasnjenje": objasnjenje,
            "kako": kako, "veza": veza, "tezina": tezina}


def main() -> None:
    summary = ucitaj("summary")
    plan = ucitaj("plan")
    cetvrti = ucitaj("cetvrti")
    namjena = ucitaj("po_namjeni")
    top = ucitaj("top_primatelji")
    meta = ucitaj("meta")

    nalazi: list[dict] = []

    # 1. Sezonalnost — prosinac naspram ostalih punih mjeseci
    puni = [m for m in summary["po_mjesecu"] if m["broj_dana"] >= 15]
    if puni:
        prosinci = [m["ukupno"] for m in puni if m["mjesec_broj"] == 12]
        ostali = [m["ukupno"] for m in puni if m["mjesec_broj"] != 12]
        if prosinci and ostali:
            p = sum(prosinci) / len(prosinci)
            o = sum(ostali) / len(ostali)
            odn = (p / o - 1) * 100
            nalazi.append(nalaz(
                "Trošenje se gomila u prosincu",
                hr(f"{odn:+.0f} %"),
                hr(f"Prosječan prosinac ({p:,.0f} €) veći je od prosječnog ostalog mjeseca "
                   f"({o:,.0f} €)."),
                f"Uspoređeno je {len(prosinci)} prosinaca s {len(ostali)} ostalih punih mjeseci "
                "u obrađenom razdoblju. Mjeseci s manje od 15 dana isplata su izuzeti.",
                "#/trendovi",
                "istaknuto" if odn > 40 else "obicno",
            ))

    # 2. Koncentracija primatelja
    svi = top.get("sve", [])
    if svi:
        prvi = svi[0]
        deset = sum(r["udio"] for r in svi[:10])
        nalazi.append(nalaz(
            "Desetina novca ide jednom primatelju",
            hr(f"{prvi['udio']:.1f} %"),
            hr(f"{prvi['naziv']} primio je {prvi['ukupno']:,.0f} € kroz {prvi['broj_isplata']:,} "
               f"isplata. Prvih deset primatelja čini {deset:.1f} % svih isplata."),
            "Udio je izračunat iz zbroja svih isplata u obrađenom razdoblju.",
            f"#/primatelj/{prvi['oib']}" if prvi["oib"] != "GDPR" else "#/isplate",
            "istaknuto" if prvi["udio"] > 8 else "obicno",
        ))

    # 3. Prekoračenja plana
    for godina, blok in sorted(plan["godine"].items()):
        if blok["prekoracenja_broj"] and blok["prekoracenja"]:
            naj = blok["prekoracenja"][0]
            nalazi.append(nalaz(
                f"Isplaćeno iznad plana u {godina}.",
                hr(f"{blok['prekoracenja_iznos']:,.0f} €"),
                hr(f"Na {blok['prekoracenja_broj']} proračunskih stavki isplaćeno je više nego "
                   f"što je planirano. Najveće pojedinačno odstupanje je "
                   f"„{naj['program_naziv']}” — plan {naj['plan']:,.0f} €, "
                   f"isplaćeno {naj['isplaceno']:,.0f} €."),
                "Plan je konsolidirani plan rashoda s data.zagreb.hr, spojen s isplatama po "
                "programskoj i ekonomskoj klasifikaciji. Izmjene proračuna tijekom godine mogu "
                "objasniti dio odstupanja.",
                "#/plan",
                "istaknuto",
            ))
            break

    # 4. Isplate bez stavke u planu
    for godina, blok in sorted(plan["godine"].items(), reverse=True):
        if blok["bez_plana_broj"]:
            nalazi.append(nalaz(
                f"Isplate bez stavke u planu, {godina}.",
                hr(f"{blok['bez_plana_iznos']:,.0f} €"),
                f"{blok['bez_plana_broj']} stavki iznad 100.000 € isplaćeno je na kombinacije "
                "programa i ekonomske klasifikacije kojih u objavljenom planu nema.",
                "Uspoređene su kombinacije šifara iz isplata s onima iz plana. Nedostatak stavke "
                "ne znači da je isplata nepravilna — može značiti i da plan nije objavljen u "
                "istom obliku.",
                "#/plan",
            ))
            break

    # 5. Razlika među gradskim četvrtima
    po_st = [(c["po_stanovniku"], c["naziv"]) for c in cetvrti["cetvrti"]
             if c["po_stanovniku"] is not None]
    if len(po_st) > 1:
        po_st.sort()
        naj, najv = po_st[-1]
        man, manv = po_st[0]
        nalazi.append(nalaz(
            "Četvrti dobivaju vrlo različito po stanovniku",
            hr(f"{naj / man:.1f}×"),
            hr(f"{najv} ima {naj:,.2f} € po stanovniku, a {manv} {man:,.2f} €."),
            "Riječ je o sredstvima mjesne samouprave, podijeljenima brojem stanovnika iz "
            "Popisa 2021. Razlike dijelom objašnjavaju površina i broj mjesnih odbora.",
            "#/cetvrti",
            "istaknuto" if naj / man > 3 else "obicno",
        ))

    # 6. Udio nerazvrstanog
    zadnja = next((p["godina"] for p in reversed(meta["pokrivenost"]) if not p["tekuca"]), None)
    blok = namjena.get(zadnja or "sve")
    if blok:
        ner = next((o for o in blok["odjeljci"] if o["sifra"] == "99"), None)
        if ner and ner["udio"] > 3:
            nalazi.append(nalaz(
                "Dio isplata nema oznaku namjene",
                hr(f"{ner['udio']:.1f} %"),
                hr(f"U {zadnja}. je {ner['ukupno']:,.0f} € nosilo funkcijsku oznaku „nije "
                   "definirano” ili „račun prethodne godine”, pa se ne može razvrstati po "
                   "namjeni."),
                "Oznaka dolazi iz samog izvora i nije procjena. Bez nje se taj dio proračuna "
                "ne može usporediti s drugim gradovima.",
                "#/detalj",
            ))

    # 7. Primatelji s jednom vrlo velikom isplatom
    po_oibu: dict[str, dict] = collections.defaultdict(
        lambda: {"n": 0, "ukupno": 0.0, "naziv": "", "najveca": 0.0})
    with ISPLATE.open(encoding="utf-8") as f:
        for linija in f:
            r = json.loads(linija)
            if r.get("tipOsobe") == "F":
                continue
            oib = (r.get("oib") or "").strip()
            if not oib:
                continue
            iznos = float(r["iznos"])
            z = po_oibu[oib]
            z["n"] += 1
            z["ukupno"] += iznos
            z["naziv"] = r.get("primatelj") or z["naziv"]
            z["najveca"] = max(z["najveca"], iznos)

    jednokratni = sorted(
        ((o, z) for o, z in po_oibu.items() if z["n"] == 1 and z["ukupno"] >= PRAG_JEDNE_ISPLATE),
        key=lambda x: -x[1]["ukupno"],
    )
    if jednokratni:
        zbroj = sum(z["ukupno"] for _, z in jednokratni)
        prvi_oib, prvi = jednokratni[0]
        nalazi.append(nalaz(
            "Primatelji s jednom jedinom velikom isplatom",
            f"{len(jednokratni)}",
            hr(f"Toliko primatelja pojavljuje se samo jednom, a svaki je primio više od milijun "
               f"eura — ukupno {zbroj:,.0f} €. Najveći je {prvi['naziv']} s "
               f"{prvi['ukupno']:,.0f} €."),
            "Brojani su primatelji s točno jednom isplatom u cijelom obrađenom razdoblju. "
            "Jednokratna isplata je uobičajena kod kupnji i građevinskih radova; popis je "
            "polazište za provjeru, ne pokazatelj nepravilnosti.",
            f"#/primatelj/{prvi_oib}",
        ))

    # 8. Najveća pojedinačna isplata
    najveca_oib, najveca = max(po_oibu.items(), key=lambda x: x[1]["najveca"])
    nalazi.append(nalaz(
        "Najveća pojedinačna isplata",
        hr(f"{najveca['najveca']:,.0f} €"),
        f"Primatelj je {najveca['naziv']}.",
        "Najveći pojedinačni iznos isplate u obrađenom razdoblju.",
        f"#/primatelj/{najveca_oib}",
    ))

    izlaz = {
        "datum_obrade": meta["datum_obrade"],
        "razdoblje": {"od": meta["prvi_datum"], "do": meta["zadnji_datum"]},
        "nalazi": nalazi,
        "napomena": (
            "Nalazi su izračunati iz javno objavljenih podataka i opisuju što u njima piše. "
            "Nisu ocjena zakonitosti ni svrsishodnosti trošenja."
        ),
    }
    IZLAZ.write_text(json.dumps(izlaz, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"Nalaza: {len(nalazi)}")
    for n in nalazi:
        print(f"  [{n['tezina']:<10}] {n['vrijednost']:>16}  {n['naslov']}")
    print(f"Zapisano: {IZLAZ.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
