import type {
  Cetvrti, Meta, NamjenaGodina, Plan, PoKlasifikaciji, PoNamjeni, Profil, Sifarnici,
  Summary, Tok, TopPrimatelji, Ustanove,
} from "./types";

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
  sifarnici: Sifarnici;
  poNamjeni: PoNamjeni;
  plan: Plan;
  cetvrti: Cetvrti;
  ustanove: Ustanove;
  tok: Tok;
  meta: Meta;
}

/** U JSON-u su godine ključevi, a metapodaci nose prefiks podcrte. */
function razdvojiNamjenu(sirovi: Record<string, unknown>): PoNamjeni {
  const godine: Record<string, NamjenaGodina> = {};
  for (const [kljuc, vrijednost] of Object.entries(sirovi)) {
    if (!kljuc.startsWith("_")) godine[kljuc] = vrijednost as NamjenaGodina;
  }
  return {
    godine,
    stanovnika: Number(sirovi["_stanovnika"] ?? 0),
    izvorStanovnistva: String(sirovi["_izvor_stanovnistva"] ?? ""),
  };
}

let kes: Podaci | null = null;

export async function ucitajPodatke(): Promise<Podaci> {
  if (kes) return kes;
  const [summary, top, poUredu, poEkonomskoj, sifarnici, poNamjeniSirovi, plan, cetvrti,
         ustanove, tok, meta] = await Promise.all([
    dohvati<Summary>("summary.json"),
    dohvati<TopPrimatelji>("top_primatelji.json"),
    dohvati<PoKlasifikaciji>("po_uredu.json"),
    dohvati<PoKlasifikaciji>("po_ekonomskoj.json"),
    dohvati<Sifarnici>("sifarnici.json"),
    dohvati<Record<string, unknown>>("po_namjeni.json"),
    dohvati<Plan>("plan.json"),
    dohvati<Cetvrti>("cetvrti.json"),
    dohvati<Ustanove>("ustanove.json"),
    dohvati<Tok>("tok.json"),
    dohvati<Meta>("meta.json"),
  ]);
  const poNamjeni = razdvojiNamjenu(poNamjeniSirovi);
  kes = { summary, top, poUredu, poEkonomskoj, sifarnici, poNamjeni, plan, cetvrti,
          ustanove, tok, meta };
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
