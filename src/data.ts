import type { Meta, PoKlasifikaciji, Profil, Summary, TopPrimatelji } from "./types";

const BAZA = `${import.meta.env.BASE_URL}data`.replace(/\/+$/, "");

async function dohvati<T>(putanja: string): Promise<T> {
  const odgovor = await fetch(`${BAZA}/${putanja}`);
  if (!odgovor.ok) {
    throw new Error(`Ne mogu učitati ${putanja} (HTTP ${odgovor.status}).`);
  }
  return (await odgovor.json()) as T;
}

export interface Podaci {
  summary: Summary;
  top: TopPrimatelji;
  poUredu: PoKlasifikaciji;
  poEkonomskoj: PoKlasifikaciji;
  meta: Meta;
}

let kes: Podaci | null = null;

export async function ucitajPodatke(): Promise<Podaci> {
  if (kes) return kes;
  const [summary, top, poUredu, poEkonomskoj, meta] = await Promise.all([
    dohvati<Summary>("summary.json"),
    dohvati<TopPrimatelji>("top_primatelji.json"),
    dohvati<PoKlasifikaciji>("po_uredu.json"),
    dohvati<PoKlasifikaciji>("po_ekonomskoj.json"),
    dohvati<Meta>("meta.json"),
  ]);
  kes = { summary, top, poUredu, poEkonomskoj, meta };
  return kes;
}

const kesProfila = new Map<string, Profil | null>();

/** Vraća null ako primatelj nema profil (manje od 5 isplata). */
export async function ucitajProfil(oib: string): Promise<Profil | null> {
  if (kesProfila.has(oib)) return kesProfila.get(oib) ?? null;
  try {
    const profil = await dohvati<Profil>(`primatelji/${encodeURIComponent(oib)}.json`);
    kesProfila.set(oib, profil);
    return profil;
  } catch {
    kesProfila.set(oib, null);
    return null;
  }
}
