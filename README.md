# Transparentnost+

Analitička nadogradnja gradske aplikacije [iTransparentnost](https://transparentnost.zagreb.hr)
Grada Zagreba. Statična web aplikacija koja iz CSV izvoza portala gradi tri prikaza isplata:
pregled po mjesecu i namjeni, rangiranje primatelja, i profil pojedinog primatelja.

Prototip. Bez backend-a, baze i prikupljanja podataka o korisnicima — sve se računa unaprijed
u JSON datoteke koje se posluže kao statične datoteke.

> **Ovo nije službena stranica Grada Zagreba.** Nezavisni je projekt koji obrađuje javno
> objavljene podatke Grada.

## Prikazi

1. **Pregled** — koliko je uloženo, u što, tko su najveći primatelji i koliko po stanovniku.
   Klik na područje otvara razradu i vodi na isplate iza njega.
2. **Isplate** — pojedinačne isplate po mjesecu, s filtrima po namjeni, uredu i pretragom
   opisa. Usporedba s istim mjesecom prethodne godine i najveće stavke u razdoblju.
3. **Gdje se ulaže** — gradske četvrti obojane po iznosu po stanovniku i ustanove na karti.
4. **Primatelji** — pretraživa tablica; klik otvara profil sa svim isplatama.

## Pokretanje

Potrebni su Node 20+ i Python 3.11+.

```bash
# 1. ovisnosti
npm install
python3 -m venv .venv && .venv/bin/pip install pandas

# 2. dohvat podataka s otvorenog API-ja (traje nekoliko minuta)
.venv/bin/python scripts/fetch_api.py

# 3. izgradnja JSON-ova za frontend
.venv/bin/python scripts/build_data.py       # isplate, namjena, tok, primatelji
.venv/bin/python scripts/build_plan.py       # plan rashoda i odstupanja
.venv/bin/python scripts/build_cetvrti.py    # sredstva mjesne samouprave po četvrtima
.venv/bin/python scripts/build_granice.py    # granice četvrti iz shapefilea
.venv/bin/python scripts/build_ustanove.py   # geolocirane ustanove
.venv/bin/python scripts/build_isplate.py     # isplate podijeljene po mjesecima
.venv/bin/python scripts/build_nalazi.py      # izračun nalaza
.venv/bin/python scripts/build_preuzimanje.py # CSV izvoz za preuzimanje

# 4. lokalni razvoj
npm run dev

# 5. produkcijski build (izlaz u dist/)
npm run build
```

## Podaci

### Izvor

Podaci dolaze s otvorenog API-ja platforme Otvoreno, istog koji koristi javno sučelje
portala iTransparentnost:

```
GET https://api.otvorenigrad.hr/itransparentnost/isplate
Zaglavlje: LC-Tenant: grad-zagreb
```

API nema autentikaciju. Zaglavlje `LC-Tenant` mora biti pisano točno tako — Pythonov
`urllib` ga normalizira u `Lc-Tenant` i poslužitelj tada vraća `Stage is not defined`, pa
`scripts/fetch_api.py` koristi `http.client`.

`scripts/fetch_api.py` sprema sirove zapise u `Data za prototip/api/isplate.jsonl` i može se
prekinuti i nastaviti. Alternativa je ručni CSV izvoz s portala („Preuzmi .csv”); ako
`isplate.jsonl` ne postoji, `build_data.py` se vraća na CSV-ove iz `Data za prototip/`.
Za profiliranje CSV izvoza postoji `scripts/profile_data.py`.

### Ograničenja API-ja

Poslužitelj je nepouzdan pri dohvatu većih količina i to je vrijedno znati prije nego se
skripte mijenjaju:

- `limit` veći od ~2000 vraća prazan popis; kod filtriranih upita prazno vraća već i `limit`
  od 100. Zapisi se ne mogu pouzdano prelistati kroz `offset` — straničenje preskače retke
  jer upit nema stabilan poredak.
- Ukupan iznos (`Sum`) u odgovoru **jest** pouzdan i koristi se za provjeru potpunosti
  (`scripts/verify_api.py` uspoređuje dnevne zbrojeve s lokalnima).
- Prečest dohvat vodi na HTTP 403 po IP adresi. Skripte pauziraju između zahtjeva i
  prekidaju rad umjesto da navaljuju.

Filtriranje je moguće preko `filters` parametra, npr.
`filters={"datum":{"values":["2026-01-01","2026-02-01"],"op":"BETWEEN"}}` (gornja granica je
isključiva).

### Izlazne datoteke

`scripts/build_data.py` čisti podatke, razgrće ih po proračunskim pozicijama i zapisuje u
`public/data/`:

| Datoteka | Sadržaj |
| --- | --- |
| `summary.json` | ukupno po godini i mjesecu, uz broj pokrivenih dana po mjesecu |
| `top_primatelji.json` | top 50 primatelja po godini i ukupno |
| `po_uredu.json` | isplate po organizacijskoj klasifikaciji (gradskom uredu) |
| `po_ekonomskoj.json` | isplate po ekonomskoj klasifikaciji |
| `primatelji/{OIB}.json` | sve isplate za primatelje s najmanje 5 isplata |
| `meta.json` | raspon datuma, datum obrade, broj isplata, pokrivenost |
| `sifarnici.json` | šifra → naziv za urede, ekonomske klasifikacije i pozicije |
| `tok.json` | tok od izvora financiranja prema namjeni |
| `plan.json` | plan rashoda, prekoračenja i isplate bez stavke u planu |
| `cetvrti.json` | sredstva mjesne samouprave po gradskoj četvrti |
| `granice.json` | granice gradskih četvrti (GeoJSON, iz SHP-a) |
| `ustanove.json` | gradske ustanove s koordinatama i pripisanim isplatama |
| `nalazi.json` | izračunata opažanja s objašnjenjem postupka |
| `isplate/YYYY-MM.json` | pojedinačne isplate po mjesecu (redak je proračunska pozicija) |
| `preuzimanje/*.csv` | isti podaci u CSV-u, za preuzimanje |

### Odluke pri obradi

- **Deduplikacija** ide po `Broj računa + OIB + Iznos + Datum + Primatelj`. Primatelj je u
  ključu jer redci s praznim brojem računa (`0000000000`) inače spoje legitimne različite
  isplate — primjerice isti povrat trima različitim osobama istog dana.
- **Fizičke osobe** su u izvoru anonimizirane (`OIB` i `Mjesto` = `GDPR`) i prikazane su zbirno
  kao „Fizičke osobe (anonimizirano)”. Za njih se ne izrađuje profil jer bi popis isplata
  iznosio osobna imena iz stupca `Primatelj`.
- **IBAN i poziv na broj** se ne zapisuju u JSON-ove niti prikazuju.
- **Klasifikacije** se razdvajaju na šifru i naziv. Ista šifra gradskog ureda nosi više naziva —
  dijelom zbog preimenovanja ureda kroz godine (012, 033), dijelom zato što pod istim razdjelom
  postoje i podređene ustanove (009, 021, 024). Grupira se po šifri, a kao naziv se uzima tijelo
  uprave iz najnovijih podataka; podjedinice ostaju vidljive u razradi.
- **Jedna isplata može biti razdijeljena na više proračunskih pozicija.** Zbrojevi se računaju
  po pozicijama, a broj isplata po jedinstvenoj oznaci isplate — zato se ta dva broja razlikuju.
- **Profili primatelja** prikazuju najviše 400 najvećih isplata; zbirni iznosi i grafovi
  računaju se iz svih. Najveći primatelj ima preko 29.000 isplata, pa bi cijeli popis bio
  višemegabajtna datoteka.
- **Nazivi klasifikacija** ne ponavljaju se u svakoj isplati nego se razrješavaju iz
  `sifarnici.json`.
- **Pokrivenost** se računa iz podataka i prikazuje na svakom prikazu. Tekuća godina se ne
  označava kao manjkava jer je prirodno nepotpuna.

Sirovi podaci (CSV izvozi i `api/isplate.jsonl`) ne drže se u repozitoriju — u repo idu samo
obrađeni JSON-ovi.

## Dodatni izvori

Uz isplate s API-ja, aplikacija spaja i:

| Izvor | Što daje |
| --- | --- |
| data.zagreb.hr — konsolidirani plan rashoda | usporedba plana i izvršenja |
| data.zagreb.hr — sredstva mjesne samouprave | iznosi po gradskim četvrtima |
| data.zagreb.hr — granice gradskih četvrti (SHP) | poligoni na karti |
| data.zagreb.hr — geoportal ustanova | koordinate škola, kulturnih i zdravstvenih ustanova |
| DZS, Popis 2021. (preko zagreb.hr) | stanovništvo Grada i četvrti |

Šifra gradske četvrti u DBF-u kodirana je u CP1250, a granice su u projekciji
HTRS96 / Croatia TM (EPSG:3765) — oboje rješava `scripts/build_granice.py`.

## Tehnologije

Vite, TypeScript (vanilla, bez okvira), Chart.js za grafove, d3-sankey za tok novca,
Leaflet za kartu. Treemap je vlastita izvedba squarified algoritma. Deploy na
Cloudflare Pages: build `npm run build`, izlazni direktorij `dist/`.

Vizualni identitet slijedi paletu i tipografiju Grada Zagreba (Roboto, plava #0072BC),
uz jasnu naznaku da stranica nije službena.

## Licenca

- **Kod:** MIT — vidi [LICENSE](LICENSE).
- **Obrađeni podaci** u `public/data/`: CC BY 4.0 — vidi [LICENSE-PODACI.md](LICENSE-PODACI.md).

Izvorni podaci javno su objavljeni od strane Grada Zagreba (iTransparentnost, data.zagreb.hr)
i Državnog zavoda za statistiku. Podloga karte © OpenStreetMap suradnici.
