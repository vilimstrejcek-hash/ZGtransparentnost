#!/usr/bin/env python3
"""Spaja geolocirane gradske ustanove s primateljima isplata.

Ulaz:  Data za prototip/geo/*.geojson  (data.zagreb.hr, geoportal)
       Data za prototip/api/isplate.jsonl
Izlaz: public/data/ustanove.json

Spajanje ide po nazivu jer geoportal ne objavljuje OIB. Zato se traži točno
poklapanje normaliziranog naziva, a djelomično samo kad je dovoljno specifično
— lažni pogodak ovdje bi značio novac pripisan krivoj zgradi.

    .venv/bin/python scripts/build_ustanove.py
"""
from __future__ import annotations

import collections
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "Data za prototip" / "geo"
ISPLATE = ROOT / "Data za prototip" / "api" / "isplate.jsonl"
IZLAZ = ROOT / "public" / "data" / "ustanove.json"

VRSTE = {
    "geoportal-osnovne-skole": "Osnovna škola",
    "geoportal-kulturne-ustanove": "Kulturna ustanova",
    "geoportal-zdravstvene-ustanove": "Zdravstvena ustanova",
    "geoportal-domovi-za-starije-osobe": "Dom za starije",
}

# Riječi koje ne razlikuju ustanove pa se izbacuju prije usporedbe.
SUVISNO = re.compile(
    r'\b(OSNOVNA|SKOLA|SKOLE|DOO|D O O|USTANOVA|USTANOVE|GRADA|ZAGREBA|ZAGREB|'
    r'JAVNA|JAVNI|CENTAR|ZA|I|U|OD|DOM|DOMOVI)\b'
)
# Djelomično spajanje traži da se poklopi cijeli skup značajnih riječi (ne samo
# početak) i da pogodak bude jednoznačan. Nazivi škola imaju svega dvije takve
# riječi ("Osnovna škola Antuna Mihanovića" -> ANTUNA MIHANOVICA), pa je prag 2.
MIN_RIJECI = 2


def normaliziraj(tekst: str) -> str:
    bez_dijakritike = (unicodedata.normalize("NFKD", str(tekst or ""))
                       .encode("ascii", "ignore").decode().upper())
    ocisceno = re.sub(r'[^A-Z0-9]+', ' ', bez_dijakritike)
    return re.sub(r'\s+', ' ', ocisceno).strip()


def znacajne_rijeci(tekst: str) -> tuple[str, ...]:
    return tuple(r for r in SUVISNO.sub(' ', normaliziraj(tekst)).split() if len(r) > 2)


def ucitaj_primatelje() -> tuple[dict[str, dict], dict[str, list[str]], dict[tuple, list[str]]]:
    ukupno: dict[str, float] = collections.defaultdict(float)
    broj: collections.Counter[str] = collections.Counter()
    naziv: dict[str, str] = {}

    with ISPLATE.open(encoding="utf-8") as f:
        for linija in f:
            r = json.loads(linija)
            if r.get("tipOsobe") == "F":
                continue
            oib = (r.get("oib") or "").strip()
            if not oib:
                continue
            ukupno[oib] += float(r["iznos"])
            broj[oib] += 1
            naziv[oib] = r.get("primatelj") or ""

    primatelji = {o: {"naziv": naziv[o], "ukupno": round(ukupno[o], 2), "broj_isplata": broj[o]}
                  for o in ukupno}
    po_nazivu: dict[str, list[str]] = collections.defaultdict(list)
    po_rijecima: dict[tuple, list[str]] = collections.defaultdict(list)
    for oib, p in primatelji.items():
        po_nazivu[normaliziraj(p["naziv"])].append(oib)
        rijeci = znacajne_rijeci(p["naziv"])
        if len(rijeci) >= MIN_RIJECI:
            po_rijecima[tuple(sorted(rijeci))].append(oib)
    return primatelji, po_nazivu, po_rijecima


def main() -> None:
    primatelji, po_nazivu, po_rijecima = ucitaj_primatelje()

    ustanove = []
    ukupno_geo = 0
    spojeno = 0
    nacini = collections.Counter()

    for putanja in sorted(GEO.glob("*.geojson")):
        vrsta = VRSTE.get(putanja.stem, "Ustanova")
        podaci = json.loads(putanja.read_text(encoding="utf-8"))
        for objekt in podaci.get("features", []):
            svojstva = objekt.get("properties") or {}
            geometrija = objekt.get("geometry") or {}
            naziv = (svojstva.get("naziv") or "").strip()
            if not naziv or geometrija.get("type") != "Point":
                continue
            ukupno_geo += 1
            lon, lat = geometrija["coordinates"][:2]

            oibi = po_nazivu.get(normaliziraj(naziv)) or []
            nacin = "naziv"
            if not oibi:
                rijeci = znacajne_rijeci(naziv)
                if len(rijeci) >= MIN_RIJECI:
                    kandidati = po_rijecima.get(tuple(sorted(rijeci))) or []
                    # Prihvaća se samo jednoznačan pogodak.
                    if len(kandidati) == 1:
                        oibi = kandidati
                        nacin = "rijeci"

            zapis = {
                "naziv": naziv,
                "vrsta": vrsta,
                "adresa": (svojstva.get("adresa") or "").strip(),
                "cetvrt": (svojstva.get("GRAD_CETVRT") or "").strip() or None,
                "lat": round(float(lat), 6),
                "lon": round(float(lon), 6),
                "oib": None,
                "ukupno": None,
                "broj_isplata": None,
                "spajanje": None,
            }
            if oibi:
                oib = oibi[0]
                zapis.update({
                    "oib": oib,
                    "ukupno": primatelji[oib]["ukupno"],
                    "broj_isplata": primatelji[oib]["broj_isplata"],
                    "spajanje": nacin,
                })
                spojeno += 1
                nacini[nacin] += 1
            ustanove.append(zapis)

    # Ista ustanova ponekad ima više geolociranih objekata (npr. Hitna medicina).
    # Iznos se pripisuje jednoj lokaciji; ostale ostaju na karti kao podružnice,
    # inače bi zbroj na karti bio višestruko veći od stvarno isplaćenog.
    vidjeni: set[str] = set()
    lokacija_po_oibu: collections.Counter[str] = collections.Counter(
        u["oib"] for u in ustanove if u["oib"]
    )
    for u in sorted(ustanove, key=lambda x: -(x["ukupno"] or 0)):
        oib = u["oib"]
        if not oib:
            continue
        u["lokacija_ustanove"] = lokacija_po_oibu[oib]
        if oib in vidjeni:
            u["ukupno"] = None
            u["broj_isplata"] = None
            u["podruznica"] = True
        else:
            vidjeni.add(oib)
            u["podruznica"] = False

    ustanove.sort(key=lambda u: -(u["ukupno"] or 0))
    s_iznosom = [u for u in ustanove if u["ukupno"]]

    izlaz = {
        "ustanova_ukupno": ukupno_geo,
        "spojeno": spojeno,
        "iznos_spojenih": round(sum(u["ukupno"] for u in s_iznosom), 2),
        "vrste": sorted({u["vrsta"] for u in ustanove}),
        "ustanove": ustanove,
        "izvori": [
            {"naziv": "Geoportal Grada Zagreba (škole, kulturne i zdravstvene ustanove, domovi)",
             "izvor": "data.zagreb.hr"},
        ],
        "napomena": (
            "Ustanove su s isplatama spojene po nazivu jer geoportal ne objavljuje OIB. "
            "Prikazane su samo ustanove kod kojih je poklapanje jednoznačno; iznos je "
            "ukupno isplaćeno toj ustanovi u obrađenom razdoblju."
        ),
    }
    IZLAZ.parent.mkdir(parents=True, exist_ok=True)
    IZLAZ.write_text(json.dumps(izlaz, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"Ustanova s koordinatama: {ukupno_geo}")
    print(f"  spojeno s primateljem: {spojeno} ({spojeno/ukupno_geo*100:.0f}%)  {dict(nacini)}")
    print(f"  jedinstvenih ustanova: {len(s_iznosom)}")
    print(f"  iznos vezan uz njih:   {izlaz['iznos_spojenih']:,.2f} €")
    print(f"  s poznatom četvrti:    {sum(1 for u in s_iznosom if u['cetvrt'])}")
    print(f"Zapisano: {IZLAZ.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
