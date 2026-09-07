#!/usr/bin/env python3
"""Dohvat isplata Grada Zagreba s otvorenog API-ja platforme Otvoreno.

Isti endpoint koji koristi javno sučelje transparentnost.zagreb.hr, bez
autentikacije. Podaci se spremaju u lokalni JSONL predmemorij pa se dohvat
može prekinuti i nastaviti bez ponovnog opterećivanja poslužitelja.

    .venv/bin/python scripts/fetch_api.py            # nastavi dohvat
    .venv/bin/python scripts/fetch_api.py --od-pocetka
    .venv/bin/python scripts/fetch_api.py --limit-stranica 20   # probni dohvat
"""
from __future__ import annotations

import argparse
import http.client
import json
import socket
import sys
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IZLAZ = ROOT / "Data za prototip" / "api"
CACHE = IZLAZ / "isplate.jsonl"
STANJE = IZLAZ / "stanje.json"

POSLUZITELJ = "api.otvorenigrad.hr"
PUTANJA = "/itransparentnost/isplate"
# Poslužitelj traži točno ovakvo pisanje zaglavlja — urllib bi ga pretvorio u
# "Lc-Tenant" i vratio "Stage is not defined", pa ide preko http.client.
TENANT_ZAGLAVLJE = "LC-Tenant"
TENANT = "grad-zagreb"

# Poslužitelj ignorira limit veći od 2000 i vraća prazan odgovor, a na nekim
# offsetima se guši i vraća 502 — u tom slučaju stranica se prepolovi.
VELICINA = 1000
NAJMANJA_VELICINA = 125
PAUZA = 0.8          # sekundi između zahtjeva; kraće vodi na HTTP 403 po IP-u
POKUSAJA = 3
# Ograničenje po IP adresi je privremeno — traje minutama, ne satima. Umjesto
# prekida se čeka i pokušava ponovno, pa jedan 403 ne ubije cijeli dohvat.
CEKANJA_NA_403 = (60, 180, 420)


class Ograniceno(Exception):
    """Poslužitelj je privremeno odbio zahtjev (HTTP 403)."""


def dohvati(offset: int, velicina: int) -> list[dict] | None:
    """Vrati zapise, ili None ako poslužitelj nije uspio isporučiti stranicu."""
    stranica = json.dumps({"limit": velicina, "offset": offset}, separators=(",", ":"))
    putanja = f"{PUTANJA}?{urllib.parse.urlencode({'page': stranica})}"
    zaglavlja = {
        TENANT_ZAGLAVLJE: TENANT,
        "Accept": "application/json",
        "User-Agent": "Transparentnost+/0.1 (prototip otvorenih podataka)",
    }

    zadnja: Exception | None = None
    for pokusaj in range(POKUSAJA + len(CEKANJA_NA_403)):
        veza = http.client.HTTPSConnection(POSLUZITELJ, timeout=90)
        try:
            veza.request("GET", putanja, headers=zaglavlja)
            odgovor = veza.getresponse()
            tijelo = odgovor.read().decode("utf-8")
            if odgovor.status == 403:
                raise Ograniceno()
            if odgovor.status != 200:
                raise RuntimeError(f"HTTP {odgovor.status}: {tijelo[:200]}")
            return json.loads(tijelo).get("Items") or []
        except Ograniceno:
            if pokusaj >= len(CEKANJA_NA_403):
                raise SystemExit(
                    "Poslužitelj i dalje vraća 403 nakon čekanja. Predmemorij je "
                    "sačuvan; pokreni skriptu ponovno kasnije."
                )
            cekaj = CEKANJA_NA_403[pokusaj]
            print(f"    ograničenje po IP-u; čekam {cekaj}s pa nastavljam", file=sys.stderr)
            time.sleep(cekaj)
            continue
        except (OSError, socket.timeout, http.client.HTTPException,
                json.JSONDecodeError, RuntimeError) as greska:
            zadnja = greska
            cekaj = 2 ** pokusaj
            print(f"    pokušaj {pokusaj + 1} nije uspio ({greska}); čekam {cekaj}s", file=sys.stderr)
            time.sleep(cekaj)
        finally:
            veza.close()
    print(f"    stranica {velicina} na offsetu {offset} ne prolazi: {zadnja}", file=sys.stderr)
    return None


def ucitaj_stanje() -> dict:
    if STANJE.exists():
        return json.loads(STANJE.read_text(encoding="utf-8"))
    return {"offset": 0, "uuidi": []}


def main() -> None:
    p = argparse.ArgumentParser(description="Dohvat isplata s API-ja platforme Otvoreno.")
    p.add_argument("--od-pocetka", action="store_true", help="zanemari predmemorij i kreni ispočetka")
    p.add_argument("--limit-stranica", type=int, default=0, help="dohvati najviše toliko stranica (0 = sve)")
    p.add_argument("--velicina", type=int, default=VELICINA, help=f"zapisa po zahtjevu (najviše {VELICINA})")
    p.add_argument("--novo", type=int, nargs="?", const=12, metavar="STRANICA",
                   help="dohvati prvih toliko stranica (zadano 12) — za nove dane")
    args = p.parse_args()

    IZLAZ.mkdir(parents=True, exist_ok=True)
    if args.od_pocetka:
        CACHE.unlink(missing_ok=True)
        STANJE.unlink(missing_ok=True)

    stanje = ucitaj_stanje()
    vidjeni: set[str] = set(stanje["uuidi"])
    offset: int = stanje["offset"]
    velicina = min(args.velicina, VELICINA)

    # Novi zapisi dolaze na početak popisa, pa se za osvježavanje prelista
    # nekoliko prvih stranica i dedupliciraju se po oznaci isplate. Ne staje se
    # na prvom starom datumu jer poredak nije stabilan — ista stranica s drugim
    # limitom vraća druge zapise. Razdvajanje po rasponima iznosa bilo bi
    # točnije, ali troši toliko zahtjeva da poslužitelj uvede ograničenje.
    if args.novo:
        if not CACHE.exists():
            raise SystemExit("Nema predmemorija — pokreni prvo potpuni dohvat.")
        datumi = set()
        with CACHE.open(encoding="utf-8") as f:
            for linija in f:
                r = json.loads(linija)
                vidjeni.add(r["isplateUuid"])
                datumi.add(r["datum"][:10])
        offset = 0
        args.limit_stranica = args.novo
        print(f"Predmemorij ide do {max(datumi)}; prelistavam {args.novo} stranica od početka.")

    if vidjeni:
        broj = f"{len(vidjeni):,}".replace(",", ".")
        print(f"Nastavljam od offseta {offset} ({broj} zapisa u predmemoriju).")

    novih_ukupno = 0
    stranica = 0
    t0 = time.time()

    with CACHE.open("a", encoding="utf-8") as izlaz:
        while True:
            if args.limit_stranica and stranica >= args.limit_stranica:
                print(f"Dosegnut limit od {args.limit_stranica} stranica.")
                break

            trenutna = velicina
            stavke = dohvati(offset, trenutna)
            while stavke is None and trenutna > NAJMANJA_VELICINA:
                trenutna = max(NAJMANJA_VELICINA, trenutna // 2)
                print(f"    smanjujem stranicu na {trenutna} i pokušavam ponovno")
                stavke = dohvati(offset, trenutna)
            if stavke is None:
                raise RuntimeError(
                    f"Poslužitelj ne isporučuje offset {offset} ni sa stranicom "
                    f"{NAJMANJA_VELICINA}. Predmemorij je sačuvan — pokreni skriptu "
                    f"ponovno da nastavi odavde."
                )
            stranica += 1
            if not stavke:
                print(f"Prazan odgovor na offsetu {offset} — kraj arhive.")
                break

            novih = 0
            for s in stavke:
                uuid = s.get("isplateUuid")
                if not uuid or uuid in vidjeni:
                    continue
                vidjeni.add(uuid)
                izlaz.write(json.dumps(s, ensure_ascii=False) + "\n")
                novih += 1
            izlaz.flush()
            novih_ukupno += novih

            datumi = [s["datum"][:10] for s in stavke if s.get("datum")]
            raspon = f"{min(datumi)} .. {max(datumi)}" if datumi else "—"
            ukupno = f"{len(vidjeni):,}".replace(",", ".")
            print(f"  offset {offset:>7}: {len(stavke):>5} zapisa, {novih:>5} novih, "
                  f"{raspon}  [ukupno {ukupno}]")

            offset += len(stavke)
            STANJE.write_text(
                json.dumps({"offset": offset, "uuidi": sorted(vidjeni)}, ensure_ascii=False),
                encoding="utf-8",
            )
            time.sleep(PAUZA)

    trajanje = time.time() - t0
    print(f"\nGotovo: {novih_ukupno:,} novih zapisa u {stranica} zahtjeva "
          f"({trajanje:.0f}s). Ukupno u predmemoriju: {len(vidjeni):,}."
          .replace(",", "\u00a0"))
    print(f"Predmemorij: {CACHE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
