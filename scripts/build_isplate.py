#!/usr/bin/env python3
"""Dijeli isplate po mjesecima da se mogu pregledavati pojedinačno.

Redak je proračunska pozicija, ne isplata — isto kao u svim zbrojevima, pa se
filtrirani zbroj uvijek poklapa s brojkama na ostalim prikazima. Jedna isplata
razdijeljena na dvije namjene pojavljuje se dvaput, sa svojim dijelom iznosa.

Zapis je niz nizova, a nazivi primatelja i klasifikacije idu u rječnik na vrhu
datoteke. S objektima po retku i ponovljenim nazivima izlaz je 85 MB; ovako je
oko trećine toga, uz isti sadržaj.

    .venv/bin/python scripts/build_isplate.py
"""
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ULAZ = ROOT / "Data za prototip" / "api" / "isplate.jsonl"
IZLAZ = ROOT / "public" / "data" / "isplate"

GDPR_NAZIV = "Fizičke osobe (anonimizirano)"
COFOG = {
    "01": "Opće javne usluge", "02": "Obrana", "03": "Javni red i sigurnost",
    "04": "Ekonomski poslovi", "05": "Zaštita okoliša",
    "06": "Stanovanje i komunalne pogodnosti", "07": "Zdravstvo",
    "08": "Rekreacija, kultura i religija", "09": "Obrazovanje",
    "10": "Socijalna zaštita",
}


def odjeljak(sifra: str) -> str:
    sifra = (sifra or "").strip()
    if sifra == "999999":
        return "98"
    return sifra[:2] if sifra[:2] in COFOG else "99"


def sazmi(tekst: str, najvise: int) -> str:
    t = re.sub(r"\s+", " ", (tekst or "").strip())
    return t if len(t) <= najvise else t[: najvise - 1] + "…"


def main() -> None:
    IZLAZ.mkdir(parents=True, exist_ok=True)
    for stara in IZLAZ.glob("*.json"):
        stara.unlink()

    po_mjesecu: dict[str, list[dict]] = collections.defaultdict(list)

    with ULAZ.open(encoding="utf-8") as f:
        for linija in f:
            r = json.loads(linija)
            fizicka = r.get("tipOsobe") == "F" or r.get("primatelj") == "GDPR"
            datum = r["datum"][:10]
            naziv = GDPR_NAZIV if fizicka else sazmi(r.get("primatelj") or "", 70)
            oib = "" if fizicka else (r.get("oib") or "").strip()
            opis = sazmi(r.get("opis") or "", 110)
            racun = sazmi(r.get("brojRacuna") or "", 30)
            ugovor = sazmi(r.get("brojUgovora") or "", 24)

            pozicije = [p for p in (r.get("dodatniPodaci") or [])
                        if p.get("iznosPozicija") is not None]
            if not pozicije:
                pozicije = [{}]

            for p in pozicije:
                iznos = p.get("iznosPozicija")
                po_mjesecu[datum[:7]].append({
                    "d": datum,
                    "n": naziv,
                    "o": oib,
                    "i": round(float(iznos if iznos is not None else r["iznos"]), 2),
                    "t": opis,
                    "u": (p.get("orgKlasifikacijaSifra") or "").strip(),
                    "f": odjeljak(p.get("funkKlasifikacijaSifra") or ""),
                    "fs": (p.get("funkKlasifikacijaSifra") or "").strip(),
                    "e": (p.get("kontoKlasifikacijaSifra") or "").strip(),
                    "r": racun,
                    "g": ugovor,
                })

    popis = []
    ukupno_bajtova = 0
    for mjesec in sorted(po_mjesecu):
        redci = sorted(po_mjesecu[mjesec], key=lambda x: (x["d"], -x["i"]))

        # Rječnik primatelja: naziv i OIB se u mjesecu ponavljaju stotinama puta.
        kljucevi: dict[tuple[str, str], int] = {}
        primatelji: list[list[str]] = []
        for x in redci:
            k = (x["n"], x["o"])
            if k not in kljucevi:
                kljucevi[k] = len(primatelji)
                primatelji.append([x["n"], x["o"]])

        put = IZLAZ / f"{mjesec}.json"
        put.write_text(json.dumps({
            "mjesec": mjesec,
            "primatelji": primatelji,
            # [dan, indeks primatelja, iznos, opis, ured, odjeljak namjene,
            #  puna šifra namjene, ekonomska, račun, ugovor]
            "redci": [[int(x["d"][8:]), kljucevi[(x["n"], x["o"])], x["i"], x["t"],
                       x["u"], x["f"], x["fs"], x["e"], x["r"], x["g"]] for x in redci],
        }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        velicina = put.stat().st_size
        ukupno_bajtova += velicina
        popis.append({
            "mjesec": mjesec,
            "redaka": len(redci),
            "ukupno": round(sum(x["i"] for x in redci), 2),
            "dana": len({x["d"] for x in redci}),
            "bajtova": velicina,
        })

    (IZLAZ / "index.json").write_text(
        json.dumps({"mjeseci": popis}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")

    print(f"Mjeseci: {len(popis)} | redaka: {sum(p['redaka'] for p in popis):,} | "
          f"ukupno {ukupno_bajtova / 1024 / 1024:.0f} MB".replace(",", "."))
    naj = max(popis, key=lambda p: p["bajtova"])
    print(f"Najveći mjesec: {naj['mjesec']} — {naj['redaka']:,} redaka, "
          f"{naj['bajtova'] / 1024:.0f} KB".replace(",", "."))
    print(f"Prosjek: {ukupno_bajtova / len(popis) / 1024:.0f} KB po mjesecu")
    print(f"Zbroj svih mjeseci: {sum(p['ukupno'] for p in popis):,.2f} €")


if __name__ == "__main__":
    main()
