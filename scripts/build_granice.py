#!/usr/bin/env python3
"""Pretvara granice gradskih četvrti iz shapefilea u GeoJSON za kartu.

Grad objavljuje granice samo kao SHP u projekciji HTRS96 / Croatia TM
(EPSG:3765), pa se prevode u WGS84 i pojednostavljuju da datoteka ostane mala.

    .venv/bin/python scripts/build_granice.py
"""
from __future__ import annotations

import json
import math
import unicodedata
from pathlib import Path

import pyproj
import shapefile

ROOT = Path(__file__).resolve().parent.parent
SHP = ROOT / "Data za prototip" / "geo" / "rpj_gc" / "RPJ_GC.shp"
CETVRTI = ROOT / "public" / "data" / "cetvrti.json"
IZLAZ = ROOT / "public" / "data" / "granice.json"

# Dopušteno odstupanje pri pojednostavljenju, u stupnjevima (~10 m).
TOLERANCIJA = 0.0001


def kljuc(naziv: str) -> str:
    bez = unicodedata.normalize("NFKD", naziv).encode("ascii", "ignore").decode()
    return "".join(z for z in bez.lower() if z.isalnum())


def udaljenost_od_pravca(t, a, b) -> float:
    (x, y), (x1, y1), (x2, y2) = t, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / math.hypot(dx, dy)


def pojednostavi(tocke: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Ramer–Douglas–Peucker: izbacuje točke koje ne mijenjaju oblik."""
    if len(tocke) < 3:
        return tocke
    najdalja, indeks = 0.0, 0
    for i in range(1, len(tocke) - 1):
        d = udaljenost_od_pravca(tocke[i], tocke[0], tocke[-1])
        if d > najdalja:
            najdalja, indeks = d, i
    if najdalja <= tol:
        return [tocke[0], tocke[-1]]
    lijevo = pojednostavi(tocke[: indeks + 1], tol)
    desno = pojednostavi(tocke[indeks:], tol)
    return lijevo[:-1] + desno


def main() -> None:
    pretvorba = pyproj.Transformer.from_crs("EPSG:3765", "EPSG:4326", always_xy=True)

    poznate: dict[str, str] = {}
    if CETVRTI.exists():
        for c in json.loads(CETVRTI.read_text(encoding="utf-8"))["cetvrti"]:
            poznate[kljuc(c["naziv"])] = c["naziv"]

    # DBF Grada Zagreba kodiran je u CP1250 (Č dolazi kao 0xC8), ne u UTF-8.
    citac = shapefile.Reader(str(SHP), encoding="cp1250")
    polja = [p[0] for p in citac.fields[1:]]
    print(f"Polja u shapefileu: {polja}")

    znacajke = []
    nespojene = []
    for zapis in citac.shapeRecords():
        svojstva = dict(zip(polja, zapis.record))
        naziv = str(svojstva.get("JMS_IME") or svojstva.get("NAZIV") or "").strip()

        kanonski = poznate.get(kljuc(naziv))
        if not kanonski:
            nespojene.append(naziv)

        oblik = zapis.shape
        dijelovi = list(oblik.parts) + [len(oblik.points)]
        prstenovi = []
        for i in range(len(dijelovi) - 1):
            tocke = oblik.points[dijelovi[i]:dijelovi[i + 1]]
            wgs = [pretvorba.transform(x, y) for x, y in tocke]
            zaokruzeno = [(round(lon, 5), round(lat, 5)) for lon, lat in wgs]
            manje = pojednostavi(zaokruzeno, TOLERANCIJA)
            if len(manje) >= 4:
                if manje[0] != manje[-1]:
                    manje.append(manje[0])
                prstenovi.append([[lon, lat] for lon, lat in manje])
        if not prstenovi:
            continue

        znacajke.append({
            "type": "Feature",
            "properties": {"naziv": kanonski or naziv},
            "geometry": {"type": "Polygon", "coordinates": prstenovi},
        })

    izlaz = {"type": "FeatureCollection", "features": znacajke}
    IZLAZ.parent.mkdir(parents=True, exist_ok=True)
    IZLAZ.write_text(json.dumps(izlaz, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    tocaka = sum(len(p) for z in znacajke for p in z["geometry"]["coordinates"])
    print(f"Četvrti: {len(znacajke)} | točaka nakon pojednostavljenja: {tocaka:,}".replace(",", "."))
    print(f"Veličina: {IZLAZ.stat().st_size / 1024:.0f} KB")
    if nespojene:
        print(f"UPOZORENJE: nazivi bez para u cetvrti.json: {nespojene}")
    print(f"Zapisano: {IZLAZ.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
