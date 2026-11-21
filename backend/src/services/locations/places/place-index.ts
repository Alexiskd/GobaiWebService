/**
 * Moteur de recherche de lieux interne à l'application (remplace Photon / komoot) : aucun service extérieur n'est
 * appelé. Les données (GeoNames cities1000 enrichi par Natural Earth, voir tools/geonames/construire-lieux.mjs)
 * sont chargées une fois en mémoire, rangées en colonnes (tableaux typés, textes répétés partagés), puis chaque
 * recherche est un simple parcours d'index.
 *
 * Ce que le moteur comprend :
 *  - accents, majuscules, tirets, apostrophes : « saint etienne » trouve « Saint-Étienne » ;
 *  - début de nom : « conf » trouve « Conflans-Sainte-Honorine » ;
 *  - n'importe quel mot du nom : « honorine » trouve aussi Conflans-Sainte-Honorine ;
 *  - abréviations : « st », « ste » valent « saint », « sainte » ;
 *  - autres noms : français (« Londres »), écritures locales (« 東京 », « Москва ») pour les grandes villes ;
 *  - précisions : « Paris, Texas » ou « paris texas » — région, département/comté ou pays (en français, en anglais ou
 *    son code ISO) ;
 *  - fautes de frappe : une lettre de travers (deux pour un nom long), si les recherches exactes ne suffisent pas.
 * Classement : qualité de la correspondance, puis population (grandes villes d'abord), puis nom le plus court.
 */

/** Un résultat de recherche. */
export interface PlaceHit { name: string; context: string; lon: number; lat: number }

/** Plie un texte pour la comparaison : sans accents, minuscules, ponctuation en espaces. */
export function fold(s: string): string {
  const t = String(s ?? '');
  // Raccourci : texte ASCII déjà simple (le cas de la plupart des noms).
  if (/^[a-z0-9 ]*$/.test(t)) return t.trim();
  return t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Abréviations courantes, développées dans la recherche.
const ABBREVIATIONS: Record<string, string> = { st: 'saint', ste: 'sainte', sts: 'saints', mt: 'mont', ft: 'fort' };
/** Plie la recherche et développe les abréviations. */
export function foldQuery(s: string): string {
  return fold(s).split(' ').map((w) => ABBREVIATIONS[w] ?? w).join(' ');
}

/** Distance d'édition (Damerau-Levenshtein restreinte), arrêtée dès qu'elle dépasse `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = b.length;
  let prev2 = new Array<number>(n + 1).fill(0);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(n + 1);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

// Vrai si chaque mot de `tokens` est le début d'un mot du texte `text` (mots séparés par des espaces).
const allPrefixWords = (tokens: string[], text: string) => tokens.every((t) => text.startsWith(t) || text.includes(` ${t}`));

// Clé d'index d'un mot : ses deux premiers caractères (un seul pour un mot d'une lettre).
const keyOf = (w: string) => { const c = [...w]; return c.length > 1 ? c[0] + c[1] : (c[0] ?? ''); };

/** Table de textes partagés : chaque texte distinct n'est gardé qu'une fois, désigné par son numéro. */
class Strings {
  readonly list: string[] = [''];
  private readonly ids = new Map<string, number>([['', 0]]);
  id(s: string): number {
    let i = this.ids.get(s);
    if (i === undefined) { i = this.list.length; this.list.push(s); this.ids.set(s, i); }
    return i;
  }
}

/** Index de recherche des lieux, construit une fois à partir du fichier de la base. */
export class PlaceIndex {
  private readonly n: number;
  // Nom affiché (français s'il existe) et noms pliés (principal, français, autres, séparés par « | »).
  private readonly display: string[];
  private readonly folded: string[];
  private readonly lat: Float64Array;
  private readonly lon: Float64Array;
  private readonly pop: Uint32Array;
  // Pays, région, comté : numéros dans les tables partagées.
  private readonly country: Uint16Array;
  private readonly region: Uint32Array;
  private readonly county: Uint32Array;
  private readonly countries = new Strings();
  private readonly regions = new Strings();
  private readonly counties = new Strings();
  // Textes pliés des tables, pour les précisions (« Texas », « Isère », « France », « FR »).
  private readonly countryFolded: string[];
  private readonly regionFolded: string[];
  private readonly countyFolded: string[];
  private readonly countryLabel: string[];
  // Clé de deux caractères → numéros des localités dont un mot de nom commence ainsi.
  private readonly byKey = new Map<string, Int32Array>();
  // Premier caractère du nom principal plié → numéros des localités (tolérance aux fautes).
  private readonly byFirst = new Map<string, Int32Array>();

  /**
   * `tsv` : le fichier de la base (nom, lat, lon, pays, région, comté, population, nom français, autres noms).
   * `countryName(code)` : le nom du pays à afficher (en français).
   */
  constructor(tsv: string, countryName: (code: string) => string = (c) => c) {
    const lines = tsv.split('\n').filter(Boolean);
    const display: string[] = [], folded: string[] = [];
    const lat: number[] = [], lon: number[] = [], pop: number[] = [];
    const country: number[] = [], region: number[] = [], county: number[] = [];
    const byKey = new Map<string, number[]>(), byFirst = new Map<string, number[]>();
    for (const line of lines) {
      const [name, la, lo, cc, reg, cty, p, fr, aliases] = line.split('\t');
      const latN = Number(la), lonN = Number(lo);
      if (!name || !Number.isFinite(latN) || !Number.isFinite(lonN)) continue;
      const i = display.length;
      display.push(fr || name);
      const names = [...new Set([name, fr, ...(aliases ? aliases.split('|') : [])].filter(Boolean).map(fold))].filter(Boolean);
      folded.push(names.join('|'));
      lat.push(latN); lon.push(lonN); pop.push(Number(p) || 0);
      country.push(this.countries.id(cc ?? ''));
      region.push(this.regions.id(reg ?? ''));
      county.push(this.counties.id(cty ?? ''));
      const keys = new Set<string>();
      for (const nm of names) for (const w of nm.split(' ')) if (w) keys.add(keyOf(w));
      for (const k of keys) push(byKey, k, i);
      const first = [...(names[0] ?? '')][0];
      if (first) push(byFirst, first, i);
    }
    this.n = display.length;
    this.display = display;
    this.folded = folded;
    this.lat = Float64Array.from(lat);
    this.lon = Float64Array.from(lon);
    this.pop = Uint32Array.from(pop);
    this.country = Uint16Array.from(country);
    this.region = Uint32Array.from(region);
    this.county = Uint32Array.from(county);
    for (const [k, v] of byKey) this.byKey.set(k, Int32Array.from(v));
    for (const [k, v] of byFirst) this.byFirst.set(k, Int32Array.from(v));

    const en = displayNames('en');
    this.countryLabel = this.countries.list.map((c) => (c ? countryName(c) : ''));
    this.countryFolded = this.countries.list.map((c, i) => (c ? fold(`${this.countryLabel[i]} ${en(c)} ${c}`) : ''));
    this.regionFolded = this.regions.list.map(fold);
    this.countyFolded = this.counties.list.map(fold);
  }

  /** Nombre de localités. */
  get size(): number { return this.n; }

  // Contexte plié (comté, région, pays) d'une localité, pour les précisions.
  private contextOf(i: number): string {
    return `${this.countyFolded[this.county[i]]} ${this.regionFolded[this.region[i]]} ${this.countryFolded[this.country[i]]}`.trim();
  }

  // Bonus de population.
  private popBoost(i: number): number { return this.pop[i] > 0 ? 8 * Math.log10(this.pop[i]) : 0; }

  /** Recherche ; renvoie au plus `limit` lieux, du plus pertinent au moins pertinent. */
  search(query: string, limit = 8): PlaceHit[] {
    // « nom, précision, précision » : la partie avant la première virgule est le nom.
    const [headRaw, ...qualRaw] = String(query ?? '').split(',');
    const head = foldQuery(headRaw);
    const quals = qualRaw.map(foldQuery).join(' ').split(' ').filter(Boolean);
    const tokens = head.split(' ').filter(Boolean);
    if (!tokens.length) return [];

    // Candidats : les localités dont un mot commence comme le mot le plus long de la recherche.
    const pivot = [...tokens].sort((a, b) => [...b].length - [...a].length)[0];
    const candidates = this.byKey.get(keyOf(pivot)) ?? new Int32Array();

    const scored = new Map<number, number>();
    for (const i of candidates) {
      const names = this.folded[i].split('|');
      let s = 0;
      for (const nm of names) {
        if (nm === head) { s = 100; break; }
        if (nm.startsWith(head)) s = Math.max(s, 80 - Math.min(20, nm.length - head.length));
        else if (s < 60 && allPrefixWords(tokens, nm)) s = 60;
      }
      // « paris texas » : une partie des mots désigne la région ou le pays.
      if (!s && tokens.length > 1) {
        const ctx = this.contextOf(i);
        for (const nm of names) {
          const inName = tokens.filter((t) => nm.startsWith(t) || nm.includes(` ${t}`));
          const rest = tokens.filter((t) => !inName.includes(t));
          if (inName.length && rest.length && allPrefixWords(rest, ctx)) s = Math.max(s, 50 + 5 * inName.length);
        }
      }
      if (!s) continue;
      if (quals.length) {
        if (!allPrefixWords(quals, this.contextOf(i))) continue;
        s += 15;
      }
      scored.set(i, s + this.popBoost(i));
    }

    // Peu de résultats : tolérance aux fautes de frappe sur le nom entier.
    const headLen = [...head].length;
    if (scored.size < limit && headLen >= 4) {
      const max = headLen >= 8 ? 2 : 1;
      for (const i of this.byFirst.get([...head][0]) ?? new Int32Array()) {
        if (scored.has(i)) continue;
        let s = 0;
        for (const nm of this.folded[i].split('|')) {
          if (Math.abs(nm.length - head.length) <= max && editDistance(head, nm, max) <= max) {
            s = Math.max(s, editDistance(head, nm, max) === 1 ? 40 : 25);
          } else if (nm.length > head.length && editDistance(head, nm.slice(0, head.length), 1) <= 1) {
            s = Math.max(s, 30);
          }
        }
        if (!s) continue;
        if (quals.length && !allPrefixWords(quals, this.contextOf(i))) continue;
        scored.set(i, s + this.popBoost(i));
      }
    }

    const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1]
      || this.pop[b[0]] - this.pop[a[0]]
      || this.display[a[0]].length - this.display[b[0]].length
      || this.display[a[0]].localeCompare(this.display[b[0]], 'fr'));

    const seen = new Set<string>();
    const hits: PlaceHit[] = [];
    for (const [i] of ranked) {
      const name = this.display[i];
      const context = [this.counties.list[this.county[i]], this.regions.list[this.region[i]], this.countryLabel[this.country[i]]]
        .filter((v, k, a) => v && fold(v) !== fold(name) && a.indexOf(v) === k).join(', ');
      const key = `${name}|${context}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ name, context, lon: this.lon[i], lat: this.lat[i] });
      if (hits.length >= limit) break;
    }
    return hits;
  }
}

/**
 * Recherche avec replis, pour un texte qui n'est pas qu'un nom de localité : une adresse (« 12 rue de Rivoli,
 * 75001 Paris ») est ramenée à sa localité. Essais successifs : le texte entier ; puis chaque fin de texte après une
 * virgule (« 75001 Paris », « Paris ») ; enfin les mêmes textes sans les nombres (numéros, codes postaux).
 */
export function searchLoose(index: PlaceIndex, query: string, limit = 8): PlaceHit[] {
  const parts = String(query ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  const tries = [String(query ?? ''), ...parts.slice(1).map((_, k) => parts.slice(k + 1).join(', '))];
  const withoutNumbers = tries.map((t) => t.replace(/\b\d+\w*\b/g, ' ').replace(/\s+/g, ' ').trim());
  for (const t of [...tries, ...withoutNumbers]) {
    if (fold(t).length < 2) continue;
    const hits = index.search(t, limit);
    if (hits.length) return hits;
  }
  return [];
}

/** Nom d'un pays dans une langue (Intl), ou son code si le moteur ne le connaît pas. */
export function displayNames(lang: string): (code: string) => string {
  try {
    const d = new Intl.DisplayNames([lang], { type: 'region' });
    return (c: string) => { try { return d.of(c) ?? c; } catch { return c; } };
  } catch { return (c: string) => c; }
}

function push(map: Map<string, number[]>, key: string, value: number) {
  const list = map.get(key);
  if (list) list.push(value); else map.set(key, [value]);
}
