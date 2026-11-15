// Prévision officielle des cyclones au format ATCF (sans NestJS, donc testable seule).
//
// Le NHC publie, pour chaque cyclone actif de l'Atlantique et du Pacifique Est et Central, sa prévision officielle
// (technique « OFCL ») dans un fichier texte au format ATCF : https://ftp.nhc.noaa.gov/atcf/fst/<id>.fst.
// Une ligne par échéance et par seuil de vent, champs séparés par des virgules :
//   BASIN, CY, YYYYMMDDHH, TECHNUM, TECH, TAU, LatN/S, LonE/W, VMAX, MSLP, TY, RAD, WINDCODE, RAD1, RAD2, RAD3, RAD4, …
// - TAU : échéance en heures après l'heure de base ; latitude et longitude en dixièmes de degré (« 290N », « 652W ») ;
// - VMAX : vent soutenu (nœuds) ; MSLP : pression (hPa) ; TY : nature (TD, TS, HU…) ;
// - RAD : seuil de vent des rayons (34, 50 ou 64 nœuds) ; WINDCODE : AAA (cercle entier) ou NEQ (quadrants) ;
// - RAD1 à RAD4 : extension maximale du seuil (milles nautiques) dans les quadrants NE, SE, SO, NO (ou RAD1 seul en AAA).
// Référence du format : science.nrlmry.navy.mil/atcf/docs/database/new/abrdeck.html.

/** Un mille nautique en kilomètres. */
// Conversion des milles nautiques en kilomètres.
export const NM_KM = 1.852;
/** Seuils de vent des rayons, en nœuds. */
// Les trois seuils : 34, 50 et 64 nœuds.
export const RADII_KT = [34, 50, 64] as const;

/** Rayons de vent d'une échéance : par seuil, extension dans les quadrants NE, SE, SO, NO, en kilomètres. */
// Type des rayons : seuil → quatre rayons (km), ou absent.
export type WindRadii = Partial<Record<34 | 50 | 64, [number, number, number, number]>>;

/** Une échéance de la prévision. */
// Forme d'une échéance.
export interface ForecastPoint {
  // tau : échéance, en heures après l'heure de base.
  tau: number;
  // t : heure de validité, en millisecondes UTC.
  t: number;
  // lon, lat : position prévue du centre, en degrés.
  lon: number; lat: number;
  // windKt : vent soutenu prévu (nœuds), ou null.
  windKt: number | null;
  // pressureMb : pression prévue (hPa), ou null.
  pressureMb: number | null;
  // type : nature prévue (TD, TS, HU, EX, LO…), ou null.
  type: string | null;
  // radiiKm : rayons de vent prévus.
  radiiKm: WindRadii;
// Fin de ForecastPoint.
}

/** Prévision d'un cyclone. */
// Forme d'une prévision.
export interface AtcfForecast {
  // id : identifiant ATCF du cyclone (« al052026 »).
  id: string;
  // tech : technique (OFCL : prévision officielle).
  tech: string;
  // issuedAt : heure de base de la prévision, en millisecondes UTC.
  issuedAt: number;
  // name : nom du cyclone s'il figure dans le fichier, ou null.
  name: string | null;
  // points : échéances, dans l'ordre.
  points: ForecastPoint[];
// Fin de AtcfForecast.
}

/** Coordonnée ATCF « 290N » / « 652W » (dixièmes de degré) en degrés signés ; null si illisible. */
// Fonction atcfCoord : le texte.
export function atcfCoord(text: string): number | null {
  // Nombre de dixièmes suivi d'une lettre d'hémisphère.
  const m = /^\s*(\d{1,4})\s*([NSEW])\s*$/i.exec(text);
  // Illisible : null.
  if (!m) return null;
  // Valeur en degrés.
  const v = Number(m[1]) / 10;
  // Sud et ouest : négatif.
  return /[SW]/i.test(m[2]) ? -v : v;
// Fin de atcfCoord.
}

/** Heure de base « YYYYMMDDHH » en millisecondes UTC ; NaN si illisible. */
// Fonction atcfTime : le texte.
export function atcfTime(text: string): number {
  // Dix chiffres.
  const m = /^\s*(\d{4})(\d{2})(\d{2})(\d{2})\s*$/.exec(text);
  // Illisible : NaN.
  if (!m) return NaN;
  // Instant UTC.
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]));
// Fin de atcfTime.
}

// int : entier lu dans un champ, ou null s'il est vide ou illisible.
const int = (s: string | undefined): number | null => (s !== undefined && /^\s*-?\d+\s*$/.test(s) ? Number(s) : null);

/**
 * Lit un fichier ATCF et rend la prévision de la technique voulue (OFCL par défaut), à l'heure de base la plus récente.
 * Lignes illisibles ignorées ; aucune ligne utile : null (rien n'est inventé).
 */
// Fonction parseAtcf : le texte, l'identifiant du cyclone et la technique.
export function parseAtcf(text: string, id: string, tech = 'OFCL'): AtcfForecast | null {
  // Échéances par heure de base puis par tau.
  const byBase = new Map<number, Map<number, ForecastPoint>>();
  // Nom du cyclone, s'il apparaît.
  let name: string | null = null;
  // Pour chaque ligne :
  for (const line of typeof text === 'string' ? text.split('\n') : []) {
    // ses champs, sans espaces autour ;
    const f = line.split(',').map((s) => s.trim());
    // trop court ou autre technique : ignorée ;
    if (f.length < 11 || f[4].toUpperCase() !== tech) continue;
    // heure de base, échéance et position ;
    const base = atcfTime(f[2]), tau = int(f[5]), lat = atcfCoord(f[6]), lon = atcfCoord(f[7]);
    // illisible ou hors du globe : ignorée ;
    if (!Number.isFinite(base) || tau === null || tau < 0 || lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    // échéances de cette heure de base, créées au besoin ;
    const taus = byBase.get(base) ?? new Map<number, ForecastPoint>();
    // rangées ;
    byBase.set(base, taus);
    // vent et pression (0 ou absents : inconnus) ;
    const wind = int(f[8]), mslp = int(f[9]);
    // échéance déjà vue (autre seuil de vent), sinon créée ;
    const p = taus.get(tau) ?? { tau, t: base + tau * 3_600_000, lon, lat, windKt: wind && wind > 0 ? wind : null, pressureMb: mslp && mslp > 0 ? mslp : null, type: f[10] || null, radiiKm: {} };
    // rangée ;
    taus.set(tau, p);
    // seuil des rayons et code ;
    const rad = int(f[11]), code = (f[12] ?? '').toUpperCase();
    // rayons lus (milles nautiques) ;
    const r = [int(f[13]), int(f[14]), int(f[15]), int(f[16])];
    // seuil connu avec des rayons : convertis en kilomètres (AAA : le même rayon dans les quatre quadrants) ;
    if ((rad === 34 || rad === 50 || rad === 64) && r[0] !== null) {
      // rayons en milles, par quadrant ;
      const nm = code === 'AAA' ? [r[0], r[0], r[0], r[0]] : code === 'NEQ' ? r : null;
      // tous lisibles et au moins un non nul : gardés, en kilomètres.
      if (nm && nm.every((v) => v !== null && v >= 0 && v <= 1200) && nm.some((v) => (v as number) > 0)) p.radiiKm[rad] = nm.map((v) => Math.round((v as number) * NM_KM)) as [number, number, number, number];
    // Fin du cas.
    }
    // nom du cyclone (champ 28), s'il est donné.
    if (f[27] && /[A-Z]/i.test(f[27]) && !/^INVEST$/i.test(f[27])) name = f[27];
  // Fin des lignes.
  }
  // Aucune ligne utile : null.
  if (!byBase.size) return null;
  // Heure de base la plus récente.
  const issuedAt = Math.max(...byBase.keys());
  // Ses échéances, dans l'ordre.
  const points = [...(byBase.get(issuedAt) as Map<number, ForecastPoint>).values()].sort((a, b) => a.tau - b.tau);
  // Prévision.
  return { id: id.toLowerCase(), tech, issuedAt, name, points };
// Fin de parseAtcf.
}

/** Rayon moyen d'un seuil (km) sur les quadrants non nuls, ou null. */
// Fonction meanRadiusKm : les rayons et le seuil.
export function meanRadiusKm(radii: WindRadii | undefined, kt: 34 | 50 | 64): number | null {
  // Les quatre rayons du seuil.
  const r = radii?.[kt];
  // Absents : null.
  if (!r) return null;
  // Quadrants non nuls.
  const nz = r.filter((v) => v > 0);
  // Moyenne, ou null.
  return nz.length ? Math.round(nz.reduce((s, v) => s + v, 0) / nz.length) : null;
// Fin de meanRadiusKm.
}
