# Transparentnost+

Analitička nadogradnja gradske aplikacije [iTransparentnost](https://transparentnost.zagreb.hr)
Grada Zagreba. Statična web aplikacija koja iz CSV izvoza portala gradi tri prikaza isplata:
pregled po mjesecu i namjeni, rangiranje primatelja, i profil pojedinog primatelja.

Prototip. Bez backend-a, baze i prikupljanja podataka o korisnicima — sve se računa unaprijed
u JSON datoteke koje se posluže kao statične datoteke.

## Prikazi

1. **Pregled** — ukupno isplaćeno po mjesecu, raspodjela po gradskim uredima i po ekonomskoj
   klasifikaciji, uz kartice s ukupnim iznosom, brojem isplata, brojem primatelja i udjelom
   deset najvećih primatelja.
2. **Primatelji** — top 20 po odabranoj godini na grafu, tablica top 50 s pretragom po nazivu
   i OIB-u. Klik na primatelja otvara profil.
3. **Profil primatelja** — isplate kroz vrijeme, raspodjela po uredima iz kojih je primao
   sredstva, i tablica svih isplata s opisom i brojem računa.

## Pokretanje

Potrebni su Node 20+ i Python 3.11+.

```bash
# 1. ovisnosti
npm install
python3 -m venv .venv && .venv/bin/pip install pandas

# 2. CSV izvoze stavi u "Data za prototip/" pa izgradi JSON-ove
.venv/bin/python scripts/build_data.py

# 3. lokalni razvoj
npm run dev

# 4. produkcijski build (izlaz u dist/)
npm run build
```

Prije izgradnje podataka korisno je pokrenuti profiliranje, koje ispiše broj redaka, raspon
datuma, sume i pokrivenost po datoteci:

```bash
.venv/bin/python scripts/profile_data.py
```

## Podaci

Izvor je CSV izvoz s portala iTransparentnost (gumb „Preuzmi .csv”). Format: separator `;`,
UTF-8 s BOM-om, 20 stupaca, datumi u ISO obliku, iznosi decimalni s točkom.

`scripts/build_data.py` učita sve CSV-ove iz `Data za prototip/`, očisti ih, deduplicira i
zapiše u `public/data/`:

| Datoteka | Sadržaj |
| --- | --- |
| `summary.json` | ukupno po godini i mjesecu, uz broj pokrivenih dana po mjesecu |
| `top_primatelji.json` | top 50 primatelja po godini i ukupno |
| `po_uredu.json` | isplate po organizacijskoj klasifikaciji (gradskom uredu) |
| `po_ekonomskoj.json` | isplate po ekonomskoj klasifikaciji |
| `primatelji/{OIB}.json` | sve isplate za primatelje s najmanje 5 isplata |
| `meta.json` | raspon datuma, datum obrade, broj transakcija, pokrivenost |

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
- **Pokrivenost** se računa iz podataka i prikazuje na svakom prikazu. Ako izvozi ne pokrivaju
  cijele godine, aplikacija to eksplicitno navodi i ne predstavlja djelomične zbrojeve kao
  godišnje ukupne iznose.

CSV izvozi se ne drže u repozitoriju (vidi `.gitignore`) — u repo idu samo obrađeni JSON-ovi.

## Tehnologije

Vite, TypeScript (vanilla, bez okvira), Chart.js. Deploy na Cloudflare Pages:
build `npm run build`, izlazni direktorij `dist/`.

## Licenca

MIT — vidi [LICENSE](LICENSE).

Podaci su vlasništvo Grada Zagreba i preuzeti su s portala iTransparentnost.
