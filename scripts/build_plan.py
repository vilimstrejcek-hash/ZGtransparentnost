#!/usr/bin/env python3
"""Usporedba proračunskog plana sa stvarnim isplatama s gradskog računa.

Plan dolazi s data.zagreb.hr (konsolidirani plan rashoda), isplate iz
predmemorija API-ja. Spaja se po programskoj klasifikaciji (oznaka aktivnosti/
projekta) i ekonomskoj klasifikaciji (oznaka odjeljka) — te su šifre u oba
izvora identične.

    .venv/bin/python scripts/build_plan.py
"""
from __future__ import annotations

import collections
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PLANOVI = ROOT / "Data za prototip" / "proracun"
ISPLATE = ROOT / "Data za prototip" / "api" / "isplate.jsonl"
IZLAZ = ROOT / "public" / "data" / "plan.json"

NAJVISE = 30
PRAG_BEZ_PLANA = 100_000.0


# Grad je 2024. objavljivao plan u drugoj shemi (stupci "Plan 2024." i sl.);
# obrađuju se samo datoteke s aktualnim nazivima stupaca.
OBVEZNI_STUPCI = ["OznakaAktivnostiProjekta", "OznakaOdjeljka", "Plan"]


def ucitaj_plan(putanja: Path) -> tuple[dict, dict] | None:
    t = pd.read_csv(putanja, sep=";", encoding="utf-8-sig", dtype=str)
    if any(c not in t.columns for c in OBVEZNI_STUPCI):
        return None
    t["Plan"] = pd.to_numeric(t["Plan"], errors="coerce").fillna(0)
    for c in ["OznakaAktivnostiProjekta", "OznakaOdjeljka",
              "NazivAktivnostiProjekta", "NazivOdjeljka", "NazivRazdjela"]:
        t[c] = t[c].fillna("").astype(str).str.strip()

    plan: dict[tuple[str, str], float] = collections.defaultdict(float)
    nazivi: dict[tuple[str, str], tuple[str, str, str]] = {}
    for prog, ek, iznos, np_, ne, nr in zip(
        t["OznakaAktivnostiProjekta"], t["OznakaOdjeljka"], t["Plan"],
        t["NazivAktivnostiProjekta"], t["NazivOdjeljka"], t["NazivRazdjela"],
    ):
        plan[(prog, ek)] += float(iznos)
        nazivi[(prog, ek)] = (np_, ne, nr)
    return plan, nazivi


def ucitaj_isplate(godina: str) -> dict[tuple[str, str], float]:
    isplate: dict[tuple[str, str], float] = collections.defaultdict(float)
    with ISPLATE.open(encoding="utf-8") as f:
        for linija in f:
            r = json.loads(linija)
            if not r["datum"].startswith(godina):
                continue
            for p in (r.get("dodatniPodaci") or []):
                iznos = p.get("iznosPozicija")
                if iznos is None:
                    continue
                prog = (p.get("progKlasifikacijaSifra") or "").strip()
                ek = (p.get("kontoKlasifikacijaSifra") or "").strip()
                isplate[(prog, ek)] += float(iznos)
    return isplate


def za_godinu(godina: str, putanja: Path) -> dict | None:
    ucitano = ucitaj_plan(putanja)
    if ucitano is None:
        return None
    plan, nazivi = ucitano
    isplate = ucitaj_isplate(godina)

    # Po ekonomskoj klasifikaciji — grublje, ali gotovo potpuno poklapanje.
    plan_ek: dict[str, float] = collections.defaultdict(float)
    isp_ek: dict[str, float] = collections.defaultdict(float)
    naziv_ek: dict[str, str] = {}
    for (prog, ek), v in plan.items():
        plan_ek[ek] += v
        naziv_ek.setdefault(ek, nazivi[(prog, ek)][1])
    for (prog, ek), v in isplate.items():
        isp_ek[ek] += v

    po_ekonomskoj = sorted(
        ({
            "sifra": ek,
            "naziv": naziv_ek.get(ek, ""),
            "plan": round(plan_ek.get(ek, 0.0), 2),
            "isplaceno": round(isp_ek.get(ek, 0.0), 2),
            "omjer": round(isp_ek.get(ek, 0.0) / plan_ek[ek] * 100, 1) if plan_ek.get(ek) else None,
        } for ek in set(plan_ek) | set(isp_ek)),
        key=lambda r: -max(r["plan"], r["isplaceno"]),
    )[:NAJVISE]

    # Isplaćeno više nego što je planirano — najjasniji signal.
    prekoracenja = []
    for k in set(isplate) & set(plan):
        if plan[k] > 0 and isplate[k] > plan[k]:
            np_, ne, nr = nazivi[k]
            prekoracenja.append({
                "program_sifra": k[0], "program_naziv": np_,
                "ekonomska_sifra": k[1], "ekonomska_naziv": ne, "razdjel": nr,
                "plan": round(plan[k], 2),
                "isplaceno": round(isplate[k], 2),
                "razlika": round(isplate[k] - plan[k], 2),
                "omjer": round(isplate[k] / plan[k] * 100, 1),
            })
    prekoracenja.sort(key=lambda r: -r["razlika"])

    # Isplaćeno, a u planu nema takve stavke.
    bez_plana = []
    for k, v in isplate.items():
        if k not in plan and v >= PRAG_BEZ_PLANA:
            bez_plana.append({
                "program_sifra": k[0], "ekonomska_sifra": k[1],
                "isplaceno": round(v, 2),
            })
    bez_plana.sort(key=lambda r: -r["isplaceno"])

    plan_ukupno = sum(plan.values())
    isp_ukupno = sum(isplate.values())
    return {
        "plan_ukupno": round(plan_ukupno, 2),
        "isplaceno_ukupno": round(isp_ukupno, 2),
        "udio_isplacenog": round(isp_ukupno / plan_ukupno * 100, 1) if plan_ukupno else None,
        "po_ekonomskoj": po_ekonomskoj,
        "prekoracenja_broj": len(prekoracenja),
        "prekoracenja_iznos": round(sum(r["razlika"] for r in prekoracenja), 2),
        "prekoracenja": prekoracenja[:NAJVISE],
        "bez_plana_broj": len(bez_plana),
        "bez_plana_iznos": round(sum(r["isplaceno"] for r in bez_plana), 2),
        "bez_plana": bez_plana[:NAJVISE],
    }


def main() -> None:
    godine = {}
    for putanja in sorted(PLANOVI.glob("rashodi_*.csv")):
        godina = putanja.stem.split("_")[-1]
        if not godina.isdigit():
            continue
        blok = za_godinu(godina, putanja)
        if blok is None:
            print(f"{godina}: preskačem — datoteka ne koristi aktualnu shemu stupaca.")
            continue
        godine[godina] = blok
        b = blok
        print(f"{godina}: plan {b['plan_ukupno']:,.0f} € | isplaćeno {b['isplaceno_ukupno']:,.0f} € | "
              f"prekoračenja {b['prekoracenja_broj']} ({b['prekoracenja_iznos']:,.0f} €) | "
              f"bez plana {b['bez_plana_broj']} ({b['bez_plana_iznos']:,.0f} €)")

    izlaz = {
        "godine": godine,
        "napomene": [
            "Plan je konsolidirani plan rashoda koji Grad objavljuje na data.zagreb.hr i "
            "uključuje i proračunske korisnike (škole, vrtiće, ustanove).",
            "Isplate su samo one izvršene s gradskog računa. Ustanove dio svojih rashoda "
            "plaćaju sa svojih računa, pa niži omjer isplaćenog ne znači da sredstva nisu "
            "potrošena — znači da nisu prošla kroz gradski račun.",
            "Prekoračenja i isplate bez stavke u planu uspoređuju se s objavljenim planom; "
            "izmjene i dopune proračuna tijekom godine mogu objasniti dio odstupanja.",
        ],
    }
    IZLAZ.parent.mkdir(parents=True, exist_ok=True)
    IZLAZ.write_text(json.dumps(izlaz, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\nZapisano: {IZLAZ.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
