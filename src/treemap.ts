/** Squarified treemap — pravokutnici bliski kvadratu čitaju se lakše od izduženih. */
export interface Plocica {
  naziv: string;
  vrijednost: number;
  boja: string;
  sifra?: string;
}

export interface Polje extends Plocica {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Okvir { x: number; y: number; w: number; h: number; }

/** Najgori omjer stranica u retku — što bliže 1, to su pločice kvadratnije. */
function najgoriOmjer(red: number[], duljina: number): number {
  if (!red.length || !duljina) return Infinity;
  const zbroj = red.reduce((a, b) => a + b, 0);
  if (!zbroj) return Infinity;
  const min = Math.min(...red);
  const max = Math.max(...red);
  const s2 = zbroj * zbroj;
  const d2 = duljina * duljina;
  return Math.max((d2 * max) / s2, s2 / (d2 * min));
}

export function rasporedi(stavke: Plocica[], sirina: number, visina: number): Polje[] {
  const pozitivne = stavke.filter((s) => s.vrijednost > 0);
  const zbroj = pozitivne.reduce((a, b) => a + b.vrijednost, 0);
  if (!zbroj || sirina <= 0 || visina <= 0) return [];

  const mjera = (sirina * visina) / zbroj;
  const preostale = pozitivne
    .map((s) => ({ ...s, povrsina: s.vrijednost * mjera }))
    .sort((a, b) => b.povrsina - a.povrsina);

  const polja: Polje[] = [];
  let okvir: Okvir = { x: 0, y: 0, w: sirina, h: visina };
  let red: typeof preostale = [];

  const polozi = (redak: typeof preostale, o: Okvir): Okvir => {
    const zbrojReda = redak.reduce((a, b) => a + b.povrsina, 0);
    const vodoravno = o.w >= o.h;
    const debljina = zbrojReda / (vodoravno ? o.h : o.w);
    let pomak = 0;
    for (const s of redak) {
      const duljina = s.povrsina / debljina;
      polja.push({
        naziv: s.naziv, vrijednost: s.vrijednost, boja: s.boja, sifra: s.sifra,
        x: vodoravno ? o.x : o.x + pomak,
        y: vodoravno ? o.y + pomak : o.y,
        w: vodoravno ? debljina : duljina,
        h: vodoravno ? duljina : debljina,
      });
      pomak += duljina;
    }
    return vodoravno
      ? { x: o.x + debljina, y: o.y, w: o.w - debljina, h: o.h }
      : { x: o.x, y: o.y + debljina, w: o.w, h: o.h - debljina };
  };

  for (const stavka of preostale) {
    const duljina = Math.min(okvir.w, okvir.h);
    const trenutni = red.map((r) => r.povrsina);
    const prosireni = [...trenutni, stavka.povrsina];
    if (red.length && najgoriOmjer(trenutni, duljina) <= najgoriOmjer(prosireni, duljina)) {
      okvir = polozi(red, okvir);
      red = [stavka];
    } else {
      red.push(stavka);
    }
  }
  if (red.length) polozi(red, okvir);
  return polja;
}
