#!/usr/bin/env python3
"""Profiliranje CSV izvoza iTransparentnosti prije izgradnje podataka.

Ne mijenja ništa, samo čita i ispisuje. Pokretanje:
    .venv/bin/python scripts/profile_data.py
"""
from pathlib import Path
import sys
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "Data za prototip"
COLS = [
    "Naziv isplatitelja", "Datum", "Primatelj", "OIB", "Mjesto",
    "Proračunski korisnik", "Valuta", "Iznos na poziciji", "Pozicija",
    "Organizacijska klasifikacija", "Programska klasifikacija",
    "Izvor financiranja", "Ekonomska klasifikacija", "Funkcijska klasifikacija",
    "Broj računa", "Opis", "Datum računa", "Datum dospijeća", "IBAN",
    "Poziv na broj",
]
KEY = ["Broj računa", "OIB", "Iznos na poziciji", "Datum"]


def eur(x):
    return f"{x:,.2f}".replace(",", " ").replace(".", ",").replace(" ", ".") + " €"


def load(path):
    df = pd.read_csv(path, sep=";", encoding="utf-8-sig", dtype=str, quotechar='"')
    df["Iznos"] = pd.to_numeric(df["Iznos na poziciji"], errors="coerce")
    df["DatumTS"] = pd.to_datetime(df["Datum"], errors="coerce", utc=True)
    df["_file"] = path.name
    return df


def profile_one(df, label):
    print(f"\n{'='*70}\n{label}\n{'='*70}")
    print(f"redaka: {len(df):,}".replace(",", "."))
    bad_cols = [c for c in COLS if c not in df.columns]
    extra = [c for c in df.columns if c not in COLS + ["Iznos", "DatumTS", "_file"]]
    print(f"stupci: {len(df.columns)-3} | nedostaju: {bad_cols or 'nema'} | viška: {extra or 'nema'}")
    print(f"raspon datuma: {df['DatumTS'].min()} -> {df['DatumTS'].max()}")
    print(f"neparsirani datumi: {df['DatumTS'].isna().sum()} | neparsirani iznosi: {df['Iznos'].isna().sum()}")
    print(f"suma iznosa: {eur(df['Iznos'].sum())}")
    neg = df[df["Iznos"] < 0]
    print(f"negativni (povrati): {len(neg)} redaka, {eur(neg['Iznos'].sum())}")
    print(f"valute: {df['Valuta'].value_counts().to_dict()}")
    print(f"isplatitelji: {df['Naziv isplatitelja'].value_counts().to_dict()}")
    gdpr = (df["OIB"] == "GDPR").sum()
    print(f"GDPR (fizičke osobe): {gdpr} redaka ({gdpr/len(df)*100:.1f}%)")
    print(f"jedinstvenih OIB-ova (bez GDPR): {df.loc[df['OIB'] != 'GDPR', 'OIB'].nunique()}")
    dups = df.duplicated(subset=KEY).sum()
    print(f"duplikati po ključu {KEY}: {dups}")

    print("\n-- po mjesecu --")
    m = df.dropna(subset=["DatumTS"]).groupby(df["DatumTS"].dt.strftime("%Y-%m"))["Iznos"].agg(["count", "sum"])
    for period, row in m.iterrows():
        print(f"  {period}  {int(row['count']):>6} isplata  {eur(row['sum']):>22}")

    print("\n-- top 10 primatelja --")
    top = df.groupby(["Primatelj", "OIB"])["Iznos"].agg(["sum", "count"]).sort_values("sum", ascending=False).head(10)
    for (naziv, oib), row in top.iterrows():
        print(f"  {eur(row['sum']):>20}  {int(row['count']):>4}x  {naziv[:45]:<45} [{oib}]")

    print("\n-- praznine po stupcima (prazno/NaN) --")
    for c in COLS:
        if c in df.columns:
            empty = int((df[c].fillna("").str.strip() == "").sum())
            if empty:
                print(f"  {c}: {empty} ({empty/len(df)*100:.1f}%)")


def main():
    files = sorted(DATA_DIR.glob("*.csv"))
    if not files:
        sys.exit(f"Nema CSV-ova u {DATA_DIR}")
    print(f"Pronađeno {len(files)} CSV datoteka u '{DATA_DIR.name}/':")
    for f in files:
        print(f"  - {f.name} ({f.stat().st_size/1024:.0f} KB)")

    frames = []
    for f in files:
        df = load(f)
        profile_one(df, f"DATOTEKA: {f.name}")
        frames.append(df)

    allf = pd.concat(frames, ignore_index=True)
    profile_one(allf, "SVE DATOTEKE ZAJEDNO (prije deduplikacije)")

    print(f"\n{'='*70}\nPREKLAPANJE MEĐU DATOTEKAMA\n{'='*70}")
    dup_mask = allf.duplicated(subset=KEY, keep=False)
    print(f"redaka koji dijele ključ s nekim drugim retkom: {dup_mask.sum()}")
    if dup_mask.any():
        pairs = (allf[dup_mask].groupby(KEY)["_file"].apply(lambda s: tuple(sorted(set(s)))).value_counts())
        for combo, n in pairs.items():
            print(f"  {' + '.join(combo)}: {n} ključeva")
        print("\n  primjer preklapajućih redaka:")
        ex = allf[dup_mask].sort_values(KEY).head(4)
        for _, r in ex.iterrows():
            print(f"    [{r['_file']}] {r['Datum'][:10]} {eur(r['Iznos'])} rn={r['Broj računa']} {str(r['Primatelj'])[:30]}")

    dedup = allf.drop_duplicates(subset=KEY)
    print(f"\nnakon deduplikacije: {len(dedup):,} redaka (uklonjeno {len(allf)-len(dedup)})".replace(",", "."))
    print(f"suma nakon deduplikacije: {eur(dedup['Iznos'].sum())}")

    print(f"\n{'='*70}\nPOKRIVENOST PO KALENDARSKOJ GODINI (iz stupca Datum)\n{'='*70}")
    y = dedup.dropna(subset=["DatumTS"]).groupby(dedup["DatumTS"].dt.year)
    for year, g in y:
        months = sorted(g["DatumTS"].dt.strftime("%m").unique())
        print(f"  {year}: {len(g):>5} isplata, {eur(g['Iznos'].sum()):>22}, mjeseci: {', '.join(months)}")

    print(f"\n{'='*70}\nPRIMJER FORMATA KLASIFIKACIJA\n{'='*70}")
    for c in ["Pozicija", "Organizacijska klasifikacija", "Programska klasifikacija",
              "Izvor financiranja", "Ekonomska klasifikacija", "Funkcijska klasifikacija"]:
        vals = dedup[c].dropna().unique()
        print(f"  {c}: {len(vals)} jedinstvenih | npr. {vals[0] if len(vals) else '—'!r}")

    print(f"\n{'='*70}\nPRIMATELJI S >= 5 ISPLATA (za profile)\n{'='*70}")
    cnt = dedup[dedup["OIB"] != "GDPR"].groupby("OIB").size()
    print(f"  {(cnt >= 5).sum()} primatelja ima >= 5 isplata (od {cnt.nunique() and len(cnt)} ukupno s OIB-om)")


if __name__ == "__main__":
    main()
