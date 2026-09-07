#!/usr/bin/env python3
"""Dohvat isplata po danima, uz provjeru prema izvoru.

Straničenje po offsetu na API-ju nije pouzdano — upit nema stabilan poredak, pa
isti zahtjev s različitim `limit` vraća različite zapise. Filtriranje po datumu
i ukupan iznos (`Sum`) jesu pouzdani, pa se ovdje ide dan po dan i svaki se dan
usporedi s iznosom koji API sam prijavljuje.

Dan koji se ne poklopi razdvaja se po rasponima iznosa dok se svaki komad ne
poklopi ili dok se ne iscrpi dubina — tako se dohvat sam provjerava.

    .venv/bin/python scripts/dohvati_dane.py --zadnjih 45
    .venv/bin/python scripts/dohvati_dane.py --od 2026-08-26 --do 2026-09-07
"""
from __future__ import annotations

import argparse
import datetime
import http.client
import json
import sys
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "Data za prototip" / "api" / "isplate.jsonl"

POSLUZITELJ = "api.otvorenigrad.hr"
PUTANJA = "/itransparentnost/isplate"
TENANT = "grad-zagreb"
PAUZA = 0.8
POKUSAJA = 3
# Ograničenje po IP adresi je privremeno — traje minutama, ne satima. Umjesto
# prekida se čeka i pokušava ponovno, pa jedan 403 ne ubije cijeli dohvat.
CEKANJA_NA_403 = (60, 180, 420)
TOLERANCIJA = 0.01
# Veći limit uz filtre zna vratiti prazan popis, pa se traži u malim komadima.
LIMIT = 20
NAJVECA_DUBINA = 14
GORNJA_GRANICA = 50_000_000.0


# Broji koliko se puta već čekalo zbog ograničenja, kroz cijeli dohvat.
ceka = {"puta": 0}


def zovi(filtri: dict, limit: int) -> tuple[list[dict], float] | None:
    upit = urllib.parse.urlencode({
        "filters": json.dumps(filtri, separators=(",", ":")),
        "page": json.dumps({"limit": limit, "offset": 0}, separators=(",", ":")),
    })
    for pokusaj in range(POKUSAJA + len(CEKANJA_NA_403)):
        veza = http.client.HTTPSConnection(POSLUZITELJ, timeout=90)
        try:
            veza.request("GET", f"{PUTANJA}?{upit}",
                         headers={"LC-Tenant": TENANT, "Accept": "application/json"})
            odg = veza.getresponse()
            tijelo = odg.read().decode("utf-8")
            if odg.status == 403:
                if ceka["puta"] >= len(CEKANJA_NA_403):
                    raise SystemExit("Poslužitelj i dalje vraća 403 nakon čekanja. "
                                     "Predmemorij je sačuvan; pokušaj kasnije.")
                cekaj = CEKANJA_NA_403[ceka["puta"]]
                ceka["puta"] += 1
                print(f"    ograničenje po IP-u; čekam {cekaj}s", file=sys.stderr)
                time.sleep(cekaj)
                continue
            if odg.status != 200:
                raise RuntimeError(f"HTTP {odg.status}")
            d = json.loads(tijelo)
            return (d.get("Items") or []), float(d.get("Sum") or 0)
        except SystemExit:
            raise
        except Exception as greska:
            if pokusaj == POKUSAJA - 1:
                print(f"    zahtjev nije uspio: {greska}", file=sys.stderr)
                return None
            time.sleep(2 ** pokusaj)
        finally:
            veza.close()
    return None


def filtri_za(dan: datetime.date, lo: float | None, hi: float | None) -> dict:
    # Gornja granica raspona datuma je isključiva, pa ide sljedeći dan.
    f: dict = {"datum": {"values": [dan.isoformat(),
                                    (dan + datetime.timedelta(days=1)).isoformat()],
                         "op": "BETWEEN"}}
    if lo is not None and hi is not None:
        f["iznos"] = {"values": [lo, hi], "op": "BETWEEN"}
    return f


def dohvati_raspon(dan: datetime.date, lo: float, hi: float, dubina: int,
                   stanje: dict) -> list[dict]:
    """Dohvati isplate dana u rasponu iznosa; podijeli ako se zbroj ne poklopi."""
    odgovor = zovi(filtri_za(dan, lo, hi), LIMIT)
    time.sleep(PAUZA)
    if odgovor is None:
        stanje["neuspjeli"] += 1
        return []
    stavke, suma = odgovor
    if abs(suma) < TOLERANCIJA and not stavke:
        return []

    zbroj = sum(float(x["iznos"]) for x in stavke)
    # Poklapa se i nije odrezano na limitu -> raspon je potpun.
    if abs(zbroj - suma) < TOLERANCIJA and len(stavke) <= LIMIT:
        return stavke

    if dubina >= NAJVECA_DUBINA:
        stanje["nepotpuni"].append({"dan": dan.isoformat(), "od": lo, "do": hi,
                                    "manjak": round(suma - zbroj, 2)})
        return stavke

    sredina = (lo + hi) / 2
    return (dohvati_raspon(dan, lo, sredina, dubina + 1, stanje)
            + dohvati_raspon(dan, sredina, hi, dubina + 1, stanje))


def main() -> None:
    p = argparse.ArgumentParser(description="Dohvat isplata po danima s provjerom.")
    p.add_argument("--zadnjih", type=int, help="broj dana unatrag od danas")
    p.add_argument("--od", help="početni datum (YYYY-MM-DD)")
    p.add_argument("--do", help="završni datum (YYYY-MM-DD)")
    args = p.parse_args()

    danas = datetime.date.today()
    if args.zadnjih:
        prvi, zadnji = danas - datetime.timedelta(days=args.zadnjih), danas
    elif args.od:
        prvi = datetime.date.fromisoformat(args.od)
        zadnji = datetime.date.fromisoformat(args.do) if args.do else danas
    else:
        p.error("zadaj --zadnjih ili --od")

    CACHE.parent.mkdir(parents=True, exist_ok=True)
    postojeci: dict[str, dict] = {}
    if CACHE.exists():
        with CACHE.open(encoding="utf-8") as f:
            for linija in f:
                r = json.loads(linija)
                postojeci[r["isplateUuid"]] = r
    print(f"U predmemoriju: {len(postojeci):,} isplata".replace(",", "."))
    print(f"Dohvaćam {prvi} do {zadnji}…\n")

    stanje = {"neuspjeli": 0, "nepotpuni": []}
    novih = 0
    dan = prvi
    while dan <= zadnji:
        stavke = dohvati_raspon(dan, 0.0, GORNJA_GRANICA, 0, stanje)
        # Povrati su negativni pa ih prvi raspon ne obuhvaća.
        stavke += dohvati_raspon(dan, -GORNJA_GRANICA, 0.0, 0, stanje)
        n = 0
        for s in stavke:
            uuid = s.get("isplateUuid")
            if uuid and uuid not in postojeci:
                postojeci[uuid] = s
                n += 1
        novih += n
        if stavke or n:
            print(f"  {dan}  dohvaćeno {len(stavke):>4}, novih {n:>4}")
        dan += datetime.timedelta(days=1)

    with CACHE.open("w", encoding="utf-8") as f:
        for r in postojeci.values():
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"\nNovih isplata: {novih:,}".replace(",", "."))
    print(f"Ukupno u predmemoriju: {len(postojeci):,}".replace(",", "."))
    if stanje["neuspjeli"]:
        print(f"Neuspjelih zahtjeva: {stanje['neuspjeli']}")
    if stanje["nepotpuni"]:
        print(f"UPOZORENJE: {len(stanje['nepotpuni'])} raspona nije potvrđeno:")
        for x in stanje["nepotpuni"][:5]:
            print(f"  {x['dan']} {x['od']:.0f}–{x['do']:.0f} manjak {x['manjak']:,.2f} €")


if __name__ == "__main__":
    main()
