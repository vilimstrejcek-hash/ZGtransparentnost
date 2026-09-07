#!/usr/bin/env python3
"""Podaci po gradskim četvrtima: koliko novca i koliko po stanovniku.

Izvori (oba s data.zagreb.hr, odnosno zagreb.hr):
  - raspodjela sredstava mjesne samouprave po gradskoj četvrti i namjeni
  - stanovništvo po gradskim četvrtima, Popis 2021.

    .venv/bin/python scripts/build_cetvrti.py
"""
from __future__ import annotations

import json
import unicodedata
from pathlib import Path

import openpyxl
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
ULAZ = ROOT / "Data za prototip" / "cetvrti"
IZLAZ = ROOT / "public" / "data" / "cetvrti.json"

RASPODJELA = ULAZ / "ms_2024.csv"
STANOVNISTVO = ULAZ / "stanovnistvo_popis2021.xlsx"
GODINA = "2024"


def kljuc(naziv: str) -> str:
    """Naziv četvrti sveden na oblik za uspoređivanje (bez dijakritike i razmaka)."""
    bez = unicodedata.normalize("NFKD", naziv).encode("ascii", "ignore").decode()
    return "".join(z for z in bez.lower() if z.isalnum())


def ucitaj_stanovnistvo() -> dict[str, int]:
    """Gradske četvrti su podebljani redci s uvlakom 1; mjesni odbori imaju 3."""
    ws = openpyxl.load_workbook(STANOVNISTVO, data_only=True)["T1"]
    stanovnici: dict[str, int] = {}
    for red in ws.iter_rows():
        celija = red[0]
        naziv = str(celija.value or "").strip()
        if not naziv or not celija.font.bold or celija.alignment.indent != 1.0:
            continue
        broj = red[2].value
        if isinstance(broj, (int, float)):
            stanovnici[kljuc(naziv)] = int(broj)
    return stanovnici


def broj_iz_teksta(vrijednost) -> float:
    """'8.226.900,00' -> 8226900.0"""
    tekst = str(vrijednost or "").strip()
    if not tekst or tekst.lower() == "nan":
        return 0.0
    return pd.to_numeric(tekst.replace(".", "").replace(",", "."), errors="coerce") or 0.0


def main() -> None:
    tablica = pd.read_csv(RASPODJELA, sep=";", encoding="utf-8-sig", dtype=str)
    tablica.columns = [c.replace("\n", " ").strip() for c in tablica.columns]
    tablica = tablica.loc[:, [c for c in tablica.columns if c and not c.startswith("Unnamed")]]

    stupac_naziva = tablica.columns[0]
    namjene = [c for c in tablica.columns[1:] if c != "Ukupno"]

    stanovnici = ucitaj_stanovnistvo()
    nedostaju: list[str] = []
    cetvrti = []

    for _, red in tablica.iterrows():
        naziv = str(red[stupac_naziva] or "").strip()
        if not naziv or naziv.lower().startswith("sveukupno"):
            continue
        ukupno = broj_iz_teksta(red.get("Ukupno"))
        if not ukupno:
            continue
        broj_stanovnika = stanovnici.get(kljuc(naziv))
        if broj_stanovnika is None:
            nedostaju.append(naziv)
        cetvrti.append({
            "naziv": naziv,
            "stanovnika": broj_stanovnika,
            "ukupno": round(ukupno, 2),
            "po_stanovniku": round(ukupno / broj_stanovnika, 2) if broj_stanovnika else None,
            "namjene": [
                {"naziv": n, "iznos": round(broj_iz_teksta(red.get(n)), 2)}
                for n in namjene
                if broj_iz_teksta(red.get(n))
            ],
        })

    cetvrti.sort(key=lambda c: -(c["po_stanovniku"] or 0))
    ukupno_svih = sum(c["ukupno"] for c in cetvrti)
    stanovnika_svih = sum(c["stanovnika"] or 0 for c in cetvrti)

    izlaz = {
        "godina": GODINA,
        "ukupno": round(ukupno_svih, 2),
        "stanovnika": stanovnika_svih,
        "prosjek_po_stanovniku": round(ukupno_svih / stanovnika_svih, 2) if stanovnika_svih else None,
        "namjene": namjene,
        "cetvrti": cetvrti,
        "izvori": [
            {"naziv": "Raspodjela sredstava mjesne samouprave po gradskoj četvrti i namjeni",
             "izvor": "data.zagreb.hr", "godina": GODINA},
            {"naziv": "Stanovništvo po gradskim četvrtima, Popis 2021.",
             "izvor": "Državni zavod za statistiku / zagreb.hr", "godina": "2021"},
        ],
        "napomena": (
            "Prikazana su sredstva mjesne samouprave — proračun kojim raspolažu gradske "
            "četvrti i mjesni odbori za komunalne akcije i održavanje infrastrukture. "
            "To je dio ukupnog gradskog proračuna, ne cjelina."
        ),
    }

    IZLAZ.parent.mkdir(parents=True, exist_ok=True)
    IZLAZ.write_text(json.dumps(izlaz, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"Četvrti: {len(cetvrti)} | ukupno {ukupno_svih:,.2f} € | "
          f"{stanovnika_svih:,} stanovnika".replace(",", "."))
    if nedostaju:
        print(f"UPOZORENJE: bez podatka o stanovnicima: {', '.join(nedostaju)}")
    print(f"Zapisano: {IZLAZ.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
