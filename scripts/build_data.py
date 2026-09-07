#!/usr/bin/env python3
"""Gradi JSON-ove za frontend iz CSV izvoza iTransparentnosti.

Ulaz:  Data za prototip/*.csv
Izlaz: public/data/{summary,top_primatelji,po_uredu,po_ekonomskoj,meta}.json
       public/data/primatelji/{OIB}.json

Pokretanje:
    .venv/bin/python scripts/build_data.py
"""
from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "Data za prototip"
OUT_DIR = ROOT / "public" / "data"

# Ključ za deduplikaciju. Primatelj je uključen jer redci s praznim brojem
# računa (0000000000) inače spajaju legitimne različite isplate — npr. isti
# povrat od -9,29 € trima različitim osobama istog dana.
DEDUP_KEY = ["Broj računa", "OIB", "Iznos na poziciji", "Datum", "Primatelj"]

# Stupci koje nikad ne iznosimo u JSON (brief: ne prikazivati).
DROP_COLS = ["IBAN", "Poziv na broj"]

GDPR = "GDPR"
GDPR_NAZIV = "Fizičke osobe (anonimizirano)"
MIN_ISPLATA_ZA_PROFIL = 5

# "3239 OSTALE USLUGE" -> ("3239", "OSTALE USLUGE"); "A011120A112004 POSLOVI ..." isto.
SIFRA_RE = re.compile(r"^\s*([A-Za-z0-9]+)\s+(.*\S)\s*$")


def split_klasifikacija(value: str) -> tuple[str, str]:
    """Razdvoji 'ŠIFRA NAZIV' na (šifra, naziv). Vrati ('', '') za prazno."""
    if not isinstance(value, str) or not value.strip():
        return "", ""
    m = SIFRA_RE.match(value)
    if not m:
        return "", value.strip()
    return m.group(1), m.group(2)


def load_all() -> tuple[pd.DataFrame, list[dict]]:
    files = sorted(DATA_DIR.glob("*.csv"))
    if not files:
        raise SystemExit(f"Nema CSV-ova u {DATA_DIR}")

    frames, izvori = [], []
    for f in files:
        df = pd.read_csv(f, sep=";", encoding="utf-8-sig", dtype=str, quotechar='"')
        df["_izvor"] = f.name
        izvori.append({"datoteka": f.name, "redaka": len(df)})
        frames.append(df)
    return pd.concat(frames, ignore_index=True), izvori


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    n_ulaz = len(df)
    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])

    df["iznos"] = pd.to_numeric(df["Iznos na poziciji"], errors="coerce")
    df["datum"] = pd.to_datetime(df["Datum"], errors="coerce", utc=True, format="mixed")

    n_bez_iznosa = int(df["iznos"].isna().sum())
    n_bez_datuma = int(df["datum"].isna().sum())
    df = df.dropna(subset=["iznos", "datum"])

    df = df.drop_duplicates(subset=DEDUP_KEY)
    n_dupl = n_ulaz - n_bez_iznosa - n_bez_datuma - len(df)

    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].fillna("").str.strip()

    # Fizičke osobe se grupiraju u jedan subjekt — imena se ne iznose.
    je_gdpr = df["OIB"] == GDPR
    df["oib"] = df["OIB"].where(~je_gdpr, GDPR)
    df["primatelj"] = df["Primatelj"].where(~je_gdpr, GDPR_NAZIV)
    df["mjesto"] = df["Mjesto"].where(~je_gdpr, "")

    for col, prefix in [
        ("Organizacijska klasifikacija", "ured"),
        ("Ekonomska klasifikacija", "ekonomska"),
        ("Programska klasifikacija", "programska"),
        ("Funkcijska klasifikacija", "funkcijska"),
        ("Izvor financiranja", "izvor"),
        ("Pozicija", "pozicija"),
    ]:
        parts = df[col].apply(split_klasifikacija)
        df[f"{prefix}_sifra"] = [p[0] for p in parts]
        df[f"{prefix}_naziv"] = [p[1] for p in parts]

    df["godina"] = df["datum"].dt.year.astype(int)
    df["mjesec"] = df["datum"].dt.strftime("%Y-%m")
    df["datum_iso"] = df["datum"].dt.strftime("%Y-%m-%d")

    # Isti OIB ponekad ima varijante naziva — uzmi najčešći kao kanonski.
    kanon = (
        df.groupby(["oib", "primatelj"]).size().reset_index(name="n")
        .sort_values("n", ascending=False).drop_duplicates("oib")
        .set_index("oib")["primatelj"]
    )
    df["primatelj"] = df["oib"].map(kanon)

    stats = {
        "redaka_ulaz": n_ulaz,
        "redaka_izlaz": len(df),
        "uklonjeno_duplikata": int(n_dupl),
        "uklonjeno_bez_iznosa": n_bez_iznosa,
        "uklonjeno_bez_datuma": n_bez_datuma,
    }
    return df, stats


def r2(x) -> float:
    return round(float(x), 2)


def build_summary(df: pd.DataFrame) -> dict:
    def bloc(g: pd.DataFrame) -> dict:
        top10 = g.groupby("oib")["iznos"].sum().sort_values(ascending=False).head(10).sum()
        ukupno = g["iznos"].sum()
        return {
            "ukupno": r2(ukupno),
            "broj_isplata": int(len(g)),
            "broj_primatelja": int(g["oib"].nunique()),
            "udio_top10": r2(top10 / ukupno * 100) if ukupno else 0.0,
            "povrati_iznos": r2(g.loc[g["iznos"] < 0, "iznos"].sum()),
            "povrati_broj": int((g["iznos"] < 0).sum()),
        }

    po_mjesecu = (
        df.groupby("mjesec")
        .agg(sum=("iznos", "sum"), count=("iznos", "size"), dana=("datum_iso", "nunique"))
        .reset_index().sort_values("mjesec")
    )
    return {
        "ukupno": bloc(df),
        "po_godini": {str(y): bloc(g) for y, g in df.groupby("godina")},
        "po_mjesecu": [
            {
                "mjesec": r["mjesec"],
                "godina": int(r["mjesec"][:4]),
                "mjesec_broj": int(r["mjesec"][5:]),
                "ukupno": r2(r["sum"]),
                "broj_isplata": int(r["count"]),
                "broj_dana": int(r["dana"]),
            }
            for _, r in po_mjesecu.iterrows()
        ],
        "godine": sorted(str(y) for y in df["godina"].unique()),
    }


def build_top_primatelji(df: pd.DataFrame, n: int = 50) -> dict:
    def top_for(g: pd.DataFrame) -> list[dict]:
        ukupno_sve = g["iznos"].sum()
        agg = (
            g.groupby(["oib", "primatelj"])
            .agg(ukupno=("iznos", "sum"), broj_isplata=("iznos", "size"))
            .reset_index().sort_values("ukupno", ascending=False).head(n)
        )
        out = []
        for _, r in agg.iterrows():
            uredi = (
                g[g["oib"] == r["oib"]].groupby(["ured_sifra", "ured_naziv_kanon"])["iznos"]
                .sum().sort_values(ascending=False)
            )
            out.append({
                "oib": r["oib"],
                "naziv": r["primatelj"],
                "ukupno": r2(r["ukupno"]),
                "broj_isplata": int(r["broj_isplata"]),
                "udio": r2(r["ukupno"] / ukupno_sve * 100) if ukupno_sve else 0.0,
                "ima_profil": bool(r["oib"] != GDPR and r["broj_isplata"] >= MIN_ISPLATA_ZA_PROFIL),
                "uredi": [
                    {"sifra": s, "naziv": nm, "ukupno": r2(v)}
                    for (s, nm), v in uredi.items()
                ][:5],
            })
        return out

    res = {str(y): top_for(g) for y, g in df.groupby("godina")}
    res["sve"] = top_for(df)
    return res


# Ista šifra ureda nosi više naziva: dijelom stvarna preimenovanja (012, 033),
# dijelom podjedinice pod istim razdjelom (ustanove pod 009, 021, 024).
# Grupiramo po šifri, a kao naziv biramo tijelo uprave iz najnovijih podataka.
TIJELO_UPRAVE_RE = re.compile(
    r"^(GRADSKI URED|URED |STRUČNA SLUŽBA|SLUŽBA ZA|GRADSKI ZAVOD)", re.IGNORECASE
)


def kanonski_nazivi(df: pd.DataFrame, prefix: str) -> dict[str, str]:
    """Za svaku šifru odaberi naziv: tijelo uprave ispred podjedinice,
    a među njima onaj iz najnovijih podataka."""
    g = (
        df.groupby([f"{prefix}_sifra", f"{prefix}_naziv"])
        .agg(zadnji=("datum", "max"), ukupno=("iznos", "sum"))
        .reset_index()
    )
    g["_rang"] = g[f"{prefix}_naziv"].apply(
        lambda n: 0 if TIJELO_UPRAVE_RE.match(n or "") else 1
    )
    g = g.sort_values(["_rang", "zadnji", "ukupno"], ascending=[True, False, False])
    return g.drop_duplicates(f"{prefix}_sifra").set_index(f"{prefix}_sifra")[f"{prefix}_naziv"].to_dict()


def build_po_klasifikaciji(df: pd.DataFrame, prefix: str) -> dict:
    kanon = kanonski_nazivi(df, prefix)

    def agg_for(g: pd.DataFrame) -> list[dict]:
        ukupno_sve = g["iznos"].sum()
        a = (
            g.groupby(f"{prefix}_sifra")
            .agg(ukupno=("iznos", "sum"), broj_isplata=("iznos", "size"),
                 broj_primatelja=("oib", "nunique"))
            .reset_index().sort_values("ukupno", ascending=False)
        )
        out = []
        for _, r in a.iterrows():
            sifra = r[f"{prefix}_sifra"]
            pod = (
                g[g[f"{prefix}_sifra"] == sifra].groupby(f"{prefix}_naziv")["iznos"]
                .agg(["sum", "size"]).reset_index().sort_values("sum", ascending=False)
            )
            out.append({
                "sifra": sifra,
                "naziv": kanon.get(sifra, ""),
                "ukupno": r2(r["ukupno"]),
                "broj_isplata": int(r["broj_isplata"]),
                "broj_primatelja": int(r["broj_primatelja"]),
                "udio": r2(r["ukupno"] / ukupno_sve * 100) if ukupno_sve else 0.0,
                "podjedinice": [
                    {"naziv": pr[f"{prefix}_naziv"], "ukupno": r2(pr["sum"]),
                     "broj_isplata": int(pr["size"])}
                    for _, pr in pod.iterrows()
                ] if len(pod) > 1 else [],
            })
        return out

    res = {str(y): agg_for(g) for y, g in df.groupby("godina")}
    res["sve"] = agg_for(df)
    return res


def build_profili(df: pd.DataFrame, out_dir: Path) -> int:
    # Fizičke osobe nemaju profil — u tom bi se popisu iznosila osobna imena.
    kandidati = df[df["oib"] != GDPR]
    brojevi = kandidati.groupby("oib").size()
    oibi = brojevi[brojevi >= MIN_ISPLATA_ZA_PROFIL].index

    out_dir.mkdir(parents=True, exist_ok=True)
    for oib in oibi:
        g = kandidati[kandidati["oib"] == oib].sort_values("datum", ascending=False)
        po_mjesecu = g.groupby("mjesec")["iznos"].agg(["sum", "count"]).reset_index().sort_values("mjesec")
        po_uredu = (
            g.groupby(["ured_sifra", "ured_naziv_kanon"])["iznos"]
            .agg(["sum", "count"]).reset_index().sort_values("sum", ascending=False)
        )
        profil = {
            "oib": oib,
            "naziv": g["primatelj"].iloc[0],
            "mjesto": next((m for m in g["mjesto"] if m), ""),
            "ukupno": r2(g["iznos"].sum()),
            "broj_isplata": int(len(g)),
            "prva_isplata": g["datum_iso"].min(),
            "zadnja_isplata": g["datum_iso"].max(),
            "po_godini": {
                str(y): {"ukupno": r2(gg["iznos"].sum()), "broj_isplata": int(len(gg))}
                for y, gg in g.groupby("godina")
            },
            "po_mjesecu": [
                {"mjesec": r["mjesec"], "ukupno": r2(r["sum"]), "broj_isplata": int(r["count"])}
                for _, r in po_mjesecu.iterrows()
            ],
            "po_uredu": [
                {"sifra": r["ured_sifra"], "naziv": r["ured_naziv_kanon"],
                 "ukupno": r2(r["sum"]), "broj_isplata": int(r["count"])}
                for _, r in po_uredu.iterrows()
            ],
            "isplate": [
                {
                    "datum": r["datum_iso"],
                    "iznos": r2(r["iznos"]),
                    "ured_sifra": r["ured_sifra"],
                    "ured_naziv": r["ured_naziv_kanon"],
                    "ured_naziv_izvorni": r["ured_naziv"],
                    "pozicija_sifra": r["pozicija_sifra"],
                    "pozicija_naziv": r["pozicija_naziv"],
                    "ekonomska_sifra": r["ekonomska_sifra"],
                    "ekonomska_naziv": r["ekonomska_naziv"],
                    "opis": r["Opis"],
                    "broj_racuna": r["Broj računa"],
                    "datum_racuna": r["Datum računa"][:10] if r["Datum računa"] else "",
                }
                for _, r in g.iterrows()
            ],
        }
        write_json(out_dir / f"{oib}.json", profil)
    return len(oibi)


def build_meta(df: pd.DataFrame, stats: dict, izvori: list[dict], n_profila: int) -> dict:
    dani = sorted(df["datum_iso"].unique())
    pokrivenost = []
    for y, g in df.groupby("godina"):
        mjeseci = sorted(g["mjesec"].unique())
        pokrivenost.append({
            "godina": str(y),
            "mjeseci": mjeseci,
            "broj_mjeseci": len(mjeseci),
            "dani": sorted(g["datum_iso"].unique()),
            "broj_dana": int(g["datum_iso"].nunique()),
            "broj_isplata": int(len(g)),
            "ukupno": r2(g["iznos"].sum()),
        })

    djelomicne = [p["godina"] for p in pokrivenost if p["broj_mjeseci"] < 12]
    if djelomicne:
        upozorenje = (
            "Podaci ne pokrivaju cijele godine. Uključeno je "
            + str(len(dani)) + " dana isplata: "
            + ", ".join(
                f"{p['godina']} ({', '.join(p['mjeseci'])})" for p in pokrivenost
            )
            + ". Zbrojevi po godini odnose se samo na ta razdoblja i nisu godišnji ukupni iznosi."
        )
    else:
        upozorenje = "Podaci pokrivaju sve mjesece uključenih godina."

    return {
        "datum_obrade": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "prvi_datum": dani[0],
        "zadnji_datum": dani[-1],
        "broj_transakcija": stats["redaka_izlaz"],
        "broj_primatelja": int(df["oib"].nunique()),
        "broj_profila": n_profila,
        "broj_dana": len(dani),
        "puna_pokrivenost": not djelomicne,
        "upozorenje": upozorenje,
        "pokrivenost": pokrivenost,
        "izvori": izvori,
        "obrada": stats,
        "napomene": [
            "IBAN i poziv na broj nisu uključeni u objavljene podatke.",
            f"Isplate fizičkim osobama su u izvoru anonimizirane (OIB = GDPR) i prikazane su zbirno kao „{GDPR_NAZIV}”; pojedinačni profil se ne generira.",
            f"Deduplikacija po: {' + '.join(DEDUP_KEY)}.",
        ],
    }


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    raw, izvori = load_all()
    df, stats = clean(raw)
    df["ured_naziv_kanon"] = df["ured_sifra"].map(kanonski_nazivi(df, "ured")).fillna("")
    print(f"Učitano {stats['redaka_ulaz']} redaka iz {len(izvori)} datoteka.")
    print(f"Nakon čišćenja: {stats['redaka_izlaz']} (duplikata: {stats['uklonjeno_duplikata']}, "
          f"bez iznosa: {stats['uklonjeno_bez_iznosa']}, bez datuma: {stats['uklonjeno_bez_datuma']})")

    if (OUT_DIR / "primatelji").exists():
        shutil.rmtree(OUT_DIR / "primatelji")

    write_json(OUT_DIR / "summary.json", build_summary(df))
    write_json(OUT_DIR / "top_primatelji.json", build_top_primatelji(df))
    write_json(OUT_DIR / "po_uredu.json", build_po_klasifikaciji(df, "ured"))
    write_json(OUT_DIR / "po_ekonomskoj.json", build_po_klasifikaciji(df, "ekonomska"))
    n_profila = build_profili(df, OUT_DIR / "primatelji")
    write_json(OUT_DIR / "meta.json", build_meta(df, stats, izvori, n_profila))

    print(f"Zapisano u {OUT_DIR.relative_to(ROOT)}/: summary, top_primatelji, po_uredu, "
          f"po_ekonomskoj, meta + {n_profila} profila.")


if __name__ == "__main__":
    main()
