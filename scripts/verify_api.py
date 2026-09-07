#!/usr/bin/env python3
"""Provjera potpunosti lokalnog predmemorija po danima.

API vraća pouzdan ukupni iznos (Sum) za zadani raspon datuma, ali dohvat samih
stavki je nepouzdan (veći limit zna vratiti prazan popis, a straničenje
preskače zapise). Zato se potpunost mjeri usporedbom dnevnog zbroja iz
predmemorija s dnevnim Sum-om s API-ja.

    .venv/bin/python scripts/verify_api.py
"""
from __future__ import annotations

import collections
import datetime
import http.client
import json
import sys
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "Data za prototip" / "api" / "isplate.jsonl"
IZVJESTAJ = ROOT / "Data za prototip" / "api" / "potpunost.json"

POSLUZITELJ = "api.otvorenigrad.hr"
PUTANJA = "/itransparentnost/isplate"
TENANT = "grad-zagreb"
PAUZA = 0.8
TOLERANCIJA = 0.01


def dnevni_sum(dan: datetime.date) -> float | None:
    """Ukupan iznos isplata na zadani dan prema API-ju.

    Gornja granica raspona je isključiva, pa se šalje sljedeći dan.
    """
    filtri = json.dumps(
        {"datum": {"values": [dan.isoformat(), (dan + datetime.timedelta(days=1)).isoformat()],
                   "op": "BETWEEN"}},
        separators=(",", ":"),
    )
    upit = urllib.parse.urlencode({"filters": filtri, "page": '{"limit":1,"offset":0}'})
    for pokusaj in range(3):
        veza = http.client.HTTPSConnection(POSLUZITELJ, timeout=60)
        try:
            veza.request("GET", f"{PUTANJA}?{upit}",
                         headers={"LC-Tenant": TENANT, "Accept": "application/json"})
            odg = veza.getresponse()
            tijelo = odg.read().decode("utf-8")
            if odg.status == 403:
                raise SystemExit(
                    "Poslužitelj vraća HTTP 403 (ograničenje po IP adresi). "
                    "Prekidam provjeru; pokušaj ponovno za nekoliko sati."
                )
            if odg.status != 200:
                raise RuntimeError(f"HTTP {odg.status}")
            return float(json.loads(tijelo).get("Sum") or 0)
        except Exception as greska:  # mreža ili privremena greška poslužitelja
            if pokusaj == 2:
                print(f"    {dan}: dohvat nije uspio ({greska})", file=sys.stderr)
                return None
            time.sleep(2 ** pokusaj)
        finally:
            veza.close()
    return None


def main() -> None:
    lokalno: dict[str, float] = collections.defaultdict(float)
    broj: collections.Counter[str] = collections.Counter()
    with CACHE.open(encoding="utf-8") as f:
        for linija in f:
            r = json.loads(linija)
            dan = r["datum"][:10]
            lokalno[dan] += float(r["iznos"])
            broj[dan] += 1

    dani = sorted(lokalno)
    prvi = datetime.date.fromisoformat(dani[0])
    zadnji = datetime.date.today()
    print(f"Predmemorij: {sum(broj.values()):,} isplata, {len(dani)} dana, "
          f"{sum(lokalno.values()):,.2f} €".replace(",", "."))
    print(f"Provjeravam svaki dan od {prvi} do {zadnji}…\n")

    rezultat = []
    manjak_ukupno = 0.0
    dan = prvi
    while dan <= zadnji:
        api = dnevni_sum(dan)
        nas = round(lokalno.get(dan.isoformat(), 0.0), 2)
        if api is not None:
            razlika = round(api - nas, 2)
            if abs(razlika) > TOLERANCIJA:
                manjak_ukupno += razlika
                rezultat.append({
                    "dan": dan.isoformat(),
                    "api": round(api, 2),
                    "lokalno": nas,
                    "razlika": razlika,
                    "isplata_lokalno": broj.get(dan.isoformat(), 0),
                })
                print(f"  {dan}  api={api:>15,.2f}  lokalno={nas:>15,.2f}  manjak={razlika:>14,.2f}")
        dan += datetime.timedelta(days=1)
        time.sleep(PAUZA)

    IZVJESTAJ.write_text(json.dumps({
        "provjereno": datetime.date.today().isoformat(),
        "dana_s_odstupanjem": len(rezultat),
        "ukupan_manjak": round(manjak_ukupno, 2),
        "lokalno_ukupno": round(sum(lokalno.values()), 2),
        "dani": rezultat,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"\nDana s odstupanjem: {len(rezultat)}")
    print(f"Ukupan manjak: {manjak_ukupno:,.2f} €")
    print(f"Izvještaj: {IZVJESTAJ.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
