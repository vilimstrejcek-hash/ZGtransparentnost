export interface Blok {
  ukupno: number;
  broj_isplata: number;
  broj_stavki: number;
  broj_primatelja: number;
  udio_top10: number;
  povrati_iznos: number;
  povrati_broj: number;
}

export interface MjesecniZapis {
  mjesec: string;
  godina: number;
  mjesec_broj: number;
  ukupno: number;
  broj_isplata: number;
  broj_dana: number;
}

export interface Summary {
  ukupno: Blok;
  po_godini: Record<string, Blok>;
  po_mjesecu: MjesecniZapis[];
  godine: string[];
}

export interface UredKratki {
  sifra: string;
  naziv: string;
  ukupno: number;
}

export interface Primatelj {
  oib: string;
  naziv: string;
  ukupno: number;
  broj_isplata: number;
  udio: number;
  ima_profil: boolean;
}

export type SviPrimatelji = Record<string, Primatelj[]>;

export interface Podjedinica {
  naziv: string;
  ukupno: number;
  broj_isplata: number;
}

export interface Klasifikacija {
  sifra: string;
  naziv: string;
  ukupno: number;
  broj_isplata: number;
  broj_primatelja: number;
  udio: number;
  podjedinice: Podjedinica[];
}

export type PoKlasifikaciji = Record<string, Klasifikacija[]>;

/** Skraćeni ključevi — nazivi se razrješavaju iz šifarnika. */
export interface Isplata {
  d: string;   // datum
  i: number;   // iznos
  u: string;   // šifra ureda
  p: string;   // šifra pozicije
  e: string;   // šifra ekonomske klasifikacije
  o: string;   // opis
  br: string;  // broj računa
  ug: string;  // broj ugovora
  dr: string;  // datum računa
}

export interface Sifarnici {
  ured: Record<string, string>;
  ekonomska: Record<string, string>;
  pozicija: Record<string, string>;
  funkcijska: Record<string, string>;
  izvor: Record<string, string>;
}

export interface Profil {
  oib: string;
  naziv: string;
  mjesto: string;
  ukupno: number;
  broj_isplata: number;
  prikazano_isplata: number;
  popis_potpun: boolean;
  prva_isplata: string;
  zadnja_isplata: string;
  po_godini: Record<string, { ukupno: number; broj_isplata: number }>;
  po_mjesecu: { mjesec: string; ukupno: number; broj_isplata: number }[];
  po_uredu: { sifra: string; naziv: string; ukupno: number; broj_isplata: number }[];
  isplate: Isplata[];
}

export interface PokrivenostGodina {
  godina: string;
  mjeseci: string[];
  broj_mjeseci: number;
  potpuna: boolean;
  tekuca: boolean;
  broj_dana: number;
  broj_isplata: number;
  ukupno: number;
}

export interface Meta {
  datum_obrade: string;
  prvi_datum: string;
  zadnji_datum: string;
  broj_isplata: number;
  broj_stavki: number;
  broj_primatelja: number;
  broj_profila: number;
  broj_dana: number;
  puna_pokrivenost: boolean;
  upozorenje: string;
  pokrivenost: PokrivenostGodina[];
  izvori: { datoteka: string; redaka: number }[];
  obrada: Record<string, number>;
  napomene: string[];
}

export interface Skupina {
  sifra: string;
  naziv: string;
  ukupno: number;
  udio: number;
  primatelji: Primatelj[];
  vrste: { sifra: string; naziv: string; ukupno: number; udio: number }[];
}

export interface Odjeljak {
  sifra: string;
  naziv: string;
  ukupno: number;
  udio: number;
  po_stanovniku: number;
  eura_od_sto: number;
  broj_stavki: number;
  skupine: Skupina[];
}

export interface NamjenaGodina {
  ukupno: number;
  po_stanovniku: number;
  odjeljci: Odjeljak[];
}

export interface PoNamjeni {
  godine: Record<string, NamjenaGodina>;
  stanovnika: number;
  izvorStanovnistva: string;
}

export interface PlanEkonomska {
  sifra: string;
  naziv: string;
  plan: number;
  isplaceno: number;
  omjer: number | null;
}

export interface Prekoracenje {
  program_sifra: string;
  program_naziv: string;
  ekonomska_sifra: string;
  ekonomska_naziv: string;
  razdjel: string;
  plan: number;
  isplaceno: number;
  razlika: number;
  omjer: number;
}

export interface PlanGodina {
  plan_ukupno: number;
  isplaceno_ukupno: number;
  udio_isplacenog: number | null;
  po_ekonomskoj: PlanEkonomska[];
  prekoracenja_broj: number;
  prekoracenja_iznos: number;
  prekoracenja: Prekoracenje[];
  bez_plana_broj: number;
  bez_plana_iznos: number;
  bez_plana: { program_sifra: string; ekonomska_sifra: string; isplaceno: number }[];
}

export interface Plan {
  godine: Record<string, PlanGodina>;
  napomene: string[];
}

export interface Cetvrt {
  naziv: string;
  stanovnika: number | null;
  ukupno: number;
  po_stanovniku: number | null;
  namjene: { naziv: string; iznos: number }[];
}

export interface Cetvrti {
  godina: string;
  ukupno: number;
  stanovnika: number;
  prosjek_po_stanovniku: number | null;
  namjene: string[];
  cetvrti: Cetvrt[];
  izvori: { naziv: string; izvor: string; godina: string }[];
  napomena: string;
}

export interface Ustanova {
  naziv: string;
  vrsta: string;
  adresa: string;
  cetvrt: string | null;
  lat: number;
  lon: number;
  oib: string | null;
  ukupno: number | null;
  broj_isplata: number | null;
  spajanje: string | null;
  podruznica?: boolean;
  lokacija_ustanove?: number;
}

export interface Ustanove {
  ustanova_ukupno: number;
  spojeno: number;
  iznos_spojenih: number;
  vrste: string[];
  ustanove: Ustanova[];
  izvori: { naziv: string; izvor: string }[];
  napomena: string;
}

export interface TokVeza {
  izvor: string;
  namjena: string;
  iznos: number;
}

export interface TokGodina {
  izvori: { naziv: string; iznos: number }[];
  namjene: { naziv: string; iznos: number }[];
  veze: TokVeza[];
  ukupno: number;
}

export type Tok = Record<string, TokGodina>;

export interface GraniceZnacajka {
  type: "Feature";
  properties: { naziv: string };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface Granice {
  type: "FeatureCollection";
  features: GraniceZnacajka[];
}

export interface Preuzimanje {
  naslov: string;
  licenca: string;
  pripisivanje: string;
  datum_obrade: string;
  razdoblje: { od: string; do: string };
  skupovi: { ime: string; opis: string; redaka: number; csv: string; bajtova: number }[];
  izvori: string[];
}



/** [dan, indeks primatelja, iznos, opis, ured, odjeljak namjene, puna šifra
    namjene, ekonomska, račun, ugovor] */
export type Redak = [number, number, number, string, string, string, string, string, string, string];

export interface MjesecPodaci {
  mjesec: string;
  primatelji: [string, string][];
  redci: Redak[];
}

export interface MjesecIndeks {
  mjeseci: { mjesec: string; redaka: number; ukupno: number; dana: number; bajtova: number }[];
}

export interface FizickeGodina {
  ukupno: number;
  broj_isplata: number;
  udio: number;
  vrste: { sifra: string; naziv: string; ukupno: number; udio: number }[];
}

export type Fizicke = Record<string, FizickeGodina>;
