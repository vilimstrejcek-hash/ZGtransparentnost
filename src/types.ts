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
  uredi: UredKratki[];
}

export type TopPrimatelji = Record<string, Primatelj[]>;

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
