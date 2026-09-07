#!/usr/bin/env python3
"""Priprema obrađene podatke za preuzimanje (CSV i JSON).

Cilj natječaja je ponovna uporaba otvorenih podataka, pa se sve što aplikacija
prikazuje objavljuje i u strojno čitljivom obliku, pod CC BY 4.0.

    .venv/bin/python scripts/build_preuzimanje.py
"""
from __future__ import annotations

import csv
import io
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PODACI = ROOT / "public" / "data"
IZLAZ = PODACI / "preuzimanje"


def zapisi_csv(ime: str, zaglavlje: list[str], redci: list[list]) -> int:
    put = IZLAZ / f"{ime}.csv"
    spremnik = io.StringIO()
    pisac = csv.writer(spremnik, delimiter=";", lineterminator="\n")
    pisac.writerow(zaglavlje)
    pisac.writerows(redci)
    # BOM da se u Excelu ispravno prikažu hrvatska slova.
    put.write_text("﻿" + spremnik.getvalue(), encoding="utf-8")
    return put.stat().st_size


def ucitaj(ime: str):
    return json.loads((PODACI / f"{ime}.json").read_text(encoding="utf-8"))


def main() -> None:
    IZLAZ.mkdir(parents=True, exist_ok=True)
    skupovi = []

    # 1. Isplate po namjeni (COFOG), po godinama
    namjena = ucitaj("po_namjeni")
    redci = []
    for godina, blok in namjena.items():
        if godina.startswith("_"):
            continue
        for o in blok["odjeljci"]:
            redci.append([godina, o["sifra"], o["naziv"], f"{o['ukupno']:.2f}",
                          f"{o['udio']:.2f}", f"{o['po_stanovniku']:.2f}"])
    v = zapisi_csv("isplate_po_namjeni",
                   ["godina", "sifra_odjeljka", "naziv_odjeljka", "iznos_eur",
                    "udio_posto", "po_stanovniku_eur"], redci)
    skupovi.append(("isplate_po_namjeni", "Isplate po namjeni (funkcijska klasifikacija, COFOG)",
                    len(redci), v))

    # 2. Isplate po gradskom uredu
    uredi = ucitaj("po_uredu")
    redci = [[g, r["sifra"], r["naziv"], f"{r['ukupno']:.2f}", r["broj_isplata"],
              r["broj_primatelja"], f"{r['udio']:.2f}"]
             for g, popis in uredi.items() for r in popis]
    v = zapisi_csv("isplate_po_uredu",
                   ["godina", "sifra_ureda", "naziv_ureda", "iznos_eur",
                    "broj_isplata", "broj_primatelja", "udio_posto"], redci)
    skupovi.append(("isplate_po_uredu", "Isplate po gradskom uredu (organizacijska klasifikacija)",
                    len(redci), v))

    # 3. Isplate po ekonomskoj klasifikaciji
    ekon = ucitaj("po_ekonomskoj")
    redci = [[g, r["sifra"], r["naziv"], f"{r['ukupno']:.2f}", r["broj_isplata"],
              r["broj_primatelja"], f"{r['udio']:.2f}"]
             for g, popis in ekon.items() for r in popis]
    v = zapisi_csv("isplate_po_ekonomskoj",
                   ["godina", "sifra", "naziv", "iznos_eur", "broj_isplata",
                    "broj_primatelja", "udio_posto"], redci)
    skupovi.append(("isplate_po_ekonomskoj", "Isplate po vrsti rashoda (ekonomska klasifikacija)",
                    len(redci), v))

    # 4. Najveći primatelji
    top = ucitaj("top_primatelji")
    redci = [[g, r["oib"], r["naziv"], f"{r['ukupno']:.2f}", r["broj_isplata"], f"{r['udio']:.2f}"]
             for g, popis in top.items() for r in popis]
    v = zapisi_csv("najveci_primatelji",
                   ["godina", "oib", "naziv", "iznos_eur", "broj_isplata", "udio_posto"], redci)
    skupovi.append(("najveci_primatelji", "Pedeset najvećih primatelja po godini", len(redci), v))

    # 5. Gradske četvrti
    cet = ucitaj("cetvrti")
    redci = [[cet["godina"], c["naziv"], c["stanovnika"] or "", f"{c['ukupno']:.2f}",
              f"{c['po_stanovniku']:.2f}" if c["po_stanovniku"] is not None else ""]
             for c in cet["cetvrti"]]
    v = zapisi_csv("gradske_cetvrti",
                   ["godina", "gradska_cetvrt", "stanovnika", "iznos_eur", "po_stanovniku_eur"], redci)
    skupovi.append(("gradske_cetvrti", "Sredstva mjesne samouprave po gradskoj četvrti", len(redci), v))

    # 6. Geolocirane ustanove
    ust = ucitaj("ustanove")
    redci = [[u["naziv"], u["vrsta"], u["adresa"], u["cetvrt"] or "", u["lat"], u["lon"],
              u["oib"] or "", f"{u['ukupno']:.2f}" if u["ukupno"] else "",
              u["broj_isplata"] or ""]
             for u in ust["ustanove"]]
    v = zapisi_csv("ustanove",
                   ["naziv", "vrsta", "adresa", "gradska_cetvrt", "lat", "lon",
                    "oib", "iznos_eur", "broj_isplata"], redci)
    skupovi.append(("ustanove", "Gradske ustanove s koordinatama i pripisanim isplatama", len(redci), v))

    # 7. Plan i izvršenje
    plan = ucitaj("plan")
    redci = []
    for g, b in plan["godine"].items():
        for r in b["po_ekonomskoj"]:
            redci.append([g, r["sifra"], r["naziv"], f"{r['plan']:.2f}", f"{r['isplaceno']:.2f}",
                          f"{r['omjer']:.1f}" if r["omjer"] is not None else ""])
    v = zapisi_csv("plan_i_izvrsenje",
                   ["godina", "sifra", "naziv", "plan_eur", "isplaceno_eur", "omjer_posto"], redci)
    skupovi.append(("plan_i_izvrsenje", "Plan rashoda i isplate s gradskog računa", len(redci), v))

    # 8. Prekoračenja plana
    redci = []
    for g, b in plan["godine"].items():
        for r in b["prekoracenja"]:
            redci.append([g, r["program_sifra"], r["program_naziv"], r["ekonomska_sifra"],
                          r["ekonomska_naziv"], f"{r['plan']:.2f}", f"{r['isplaceno']:.2f}",
                          f"{r['razlika']:.2f}", f"{r['omjer']:.1f}"])
    v = zapisi_csv("iznad_plana",
                   ["godina", "sifra_programa", "naziv_programa", "sifra_ekonomske",
                    "naziv_ekonomske", "plan_eur", "isplaceno_eur", "razlika_eur", "omjer_posto"], redci)
    skupovi.append(("iznad_plana", "Stavke isplaćene iznad objavljenog plana", len(redci), v))

    # 9. Mjesečni tijek
    summary = ucitaj("summary")
    redci = [[m["mjesec"], f"{m['ukupno']:.2f}", m["broj_isplata"], m["broj_dana"]]
             for m in summary["po_mjesecu"]]
    v = zapisi_csv("po_mjesecu", ["mjesec", "iznos_eur", "broj_isplata", "broj_dana"], redci)
    skupovi.append(("po_mjesecu", "Isplate po mjesecu", len(redci), v))

    meta = ucitaj("meta")
    popis = {
        "naslov": "Transparentnost+ — obrađeni otvoreni podaci",
        "licenca": "CC BY 4.0",
        "pripisivanje": "Transparentnost+ (STRX), obrada javnih podataka Grada Zagreba, CC BY 4.0",
        "datum_obrade": meta["datum_obrade"],
        "pripremljeno": date.today().isoformat(),
        "razdoblje": {"od": meta["prvi_datum"], "do": meta["zadnji_datum"]},
        "skupovi": [
            {"ime": ime, "opis": opis, "redaka": n,
             "csv": f"data/preuzimanje/{ime}.csv", "bajtova": b}
            for ime, opis, n, b in skupovi
        ],
        "izvori": [
            "iTransparentnost (api.otvorenigrad.hr) — isplate s gradskog računa",
            "data.zagreb.hr — plan rashoda, sredstva mjesne samouprave, geoportal ustanova",
            "Državni zavod za statistiku — Popis stanovništva 2021.",
        ],
    }
    (PODACI / "preuzimanje.json").write_text(
        json.dumps(popis, ensure_ascii=False, indent=1), encoding="utf-8")

    ukupno = sum(b for *_, b in skupovi)
    print(f"Pripremljeno {len(skupovi)} skupova, ukupno {ukupno/1024:.0f} KB:")
    for ime, opis, n, b in skupovi:
        print(f"  {ime:<26} {n:>6} redaka  {b/1024:>7.1f} KB  {opis[:44]}")


if __name__ == "__main__":
    main()
