// Importe le format commun et ses outils.
import { AtmosphericEvent, Provenance, combineConfidence, isLonLat, makeEventId } from './atmospheric-event';

// Points chauds satellite de NASA FIRMS (sans NestJS, donc testable seul).
//
// FIRMS publie, sans clé, un fichier CSV des détections des 24 dernières heures par instrument : VIIRS (pixels de
// 375 m, satellites NOAA-20, NOAA-21 et Suomi NPP) et MODIS (pixels de 1 km, Terra et Aqua). Une détection est un
// POINT CHAUD : un pixel nettement plus chaud que son voisinage. Ce n'est PAS un incendie confirmé (cela peut être un
// brûlage agricole, une torchère, une coulée de lave) : les incendies confirmés viennent des agences (eonet.ts).
//
// Les points chauds, plusieurs dizaines de milliers par jour, sont gardés sous forme compacte (Hotspot) :
//  - fusionnés quand deux satellites différents voient le même lieu à moins de 90 min d'écart (pas de doublon) ;
//  - écartés si leur confiance est faible et qu'aucun autre satellite ne les confirme ;
//  - servis en cellules agrégées pour la vue du globe, et un par un seulement par tuile (vue rapprochée).

/** Bits des satellites, pour un masque compact : un point chaud vu par plusieurs satellites cumule leurs bits. */
// Masques des satellites : NOAA-20, NOAA-21, Suomi NPP, Terra, Aqua.
export const SAT_BITS: Record<string, number> = { N20: 1, N21: 2, N: 4, T: 8, A: 16 };
/** Fournisseur (providers.ts) de chaque satellite. */
// Fournisseur de chaque satellite.
export const SAT_PROVIDER: Record<string, string> = { N20: 'firms-viirs-n20', N21: 'firms-viirs-n21', N: 'firms-viirs-snpp', T: 'firms-modis', A: 'firms-modis' };
/** Nom lisible de chaque satellite. */
// Noms des satellites.
export const SAT_NAMES: Record<string, string> = { N20: 'NOAA-20 (VIIRS)', N21: 'NOAA-21 (VIIRS)', N: 'Suomi NPP (VIIRS)', T: 'Terra (MODIS)', A: 'Aqua (MODIS)' };
// Satellite par défaut de chaque fournisseur, si la colonne « satellite » est illisible.
const PROVIDER_SAT: Record<string, string> = { 'firms-viirs-n20': 'N20', 'firms-viirs-n21': 'N21', 'firms-viirs-snpp': 'N', 'firms-modis': 'T' };

/** Confiance minimale pour afficher un point chaud : en dessous, il faut un second satellite pour le confirmer. */
// Seuil de confiance : 0,5.
export const MIN_HOTSPOT_CONFIDENCE = 0.5;
/** Écart de temps maximal entre deux détections du même lieu par deux satellites : 90 minutes. */
// Fenêtre de fusion : 90 minutes.
export const MERGE_WINDOW_MS = 90 * 60_000;
/** Âge maximal d'un point chaud servi : 24 heures (la durée des fichiers FIRMS). */
// Âge maximal : 24 heures.
export const MAX_HOTSPOT_AGE_MS = 24 * 3_600_000;

/** Point chaud, sous forme compacte. */
// Forme d'un point chaud.
export interface Hotspot {
  // lon : longitude du centre du pixel, en degrés.
  lon: number;
  // lat : latitude du centre du pixel, en degrés.
  lat: number;
  // t : heure de passage du satellite, en millisecondes UTC.
  t: number;
  // frp : puissance radiative du feu, en mégawatts.
  frp: number;
  // conf : confiance, de 0 à 1.
  conf: number;
  // sats : masque des satellites qui l'ont vu (SAT_BITS).
  sats: number;
  // resM : taille du pixel, en mètres (375 pour VIIRS, 1 000 pour MODIS).
  resM: number;
  // night : vrai pour une détection de nuit.
  night: boolean;
  // n : nombre de détections réunies.
  n: number;
// Fin de Hotspot.
}

/** Confiance lue dans le fichier : VIIRS donne low/nominal/high (ou l/n/h), MODIS un pourcentage. */
// Fonction parseConfidence : la valeur brute.
export function parseConfidence(raw: string): number {
  // Valeur en minuscules, sans espace.
  const v = raw.trim().toLowerCase();
  // VIIRS faible.
  if (v === 'l' || v === 'low') return 0.3;
  // VIIRS nominale.
  if (v === 'n' || v === 'nominal') return 0.65;
  // VIIRS haute.
  if (v === 'h' || v === 'high') return 0.9;
  // MODIS : pourcentage.
  const pct = Number(v);
  // Pourcentage lisible : ramené entre 0 et 1 ; sinon confiance nulle.
  return Number.isFinite(pct) && v !== '' ? Math.min(1, Math.max(0, pct / 100)) : 0;
// Fin de parseConfidence.
}

/** Heure de passage : date AAAA-MM-JJ et heure HHMM (UTC), en millisecondes ; NaN si illisible. */
// Fonction parseAcquisition : la date et l'heure.
export function parseAcquisition(date: string, time: string): number {
  // Année, mois et jour.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  // Chiffres de l'heure, complétés à quatre (« 1 » devient « 0001 »).
  const hhmm = time.replace(/\D/g, '').padStart(4, '0');
  // Date ou heure illisible : NaN.
  if (!m || hhmm.length !== 4) return NaN;
  // Heures et minutes.
  const hh = Number(hhmm.slice(0, 2)), mm = Number(hhmm.slice(2));
  // Heure impossible : NaN.
  if (hh > 23 || mm > 59) return NaN;
  // Instant UTC.
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh, mm);
// Fin de parseAcquisition.
}

/** Lit un fichier CSV de FIRMS (VIIRS ou MODIS) : un point chaud par ligne valide. */
// Fonction parseFirmsCsv : le texte du fichier et le fournisseur.
export function parseFirmsCsv(text: string, providerId: string): Hotspot[] {
  // Lignes du fichier.
  const lines = typeof text === 'string' ? text.split('\n') : [];
  // En-tête : noms des colonnes.
  const head = (lines[0] || '').trim().split(',');
  // col : indice d'une colonne par son nom (−1 si absente).
  const col = (name: string) => head.indexOf(name);
  // Indices des colonnes utiles.
  const iLat = col('latitude'), iLon = col('longitude'), iDate = col('acq_date'), iTime = col('acq_time'), iSat = col('satellite'), iConf = col('confidence'), iFrp = col('frp'), iDn = col('daynight');
  // Colonnes indispensables absentes : fichier inattendu, aucun point.
  if (iLat < 0 || iLon < 0 || iDate < 0 || iTime < 0) return [];
  // Instrument : MODIS si la colonne de brillance est « brightness », VIIRS sinon (« bright_ti4 »).
  const modis = head.includes('brightness');
  // Satellite par défaut du fournisseur.
  const fallbackSat = PROVIDER_SAT[providerId] ?? 'N20';
  // Points lus.
  const out: Hotspot[] = [];
  // Pour chaque ligne de données :
  for (let i = 1; i < lines.length; i++) {
    // ses champs ;
    const f = lines[i].trim().split(',');
    // ligne vide ou incomplète : ignorée ;
    if (f.length < head.length) continue;
    // position ;
    const lat = Number(f[iLat]), lon = Number(f[iLon]);
    // heure de passage ;
    const t = parseAcquisition(f[iDate], f[iTime]);
    // position ou heure illisible : ignorée ;
    if (!isLonLat(lon, lat) || !Number.isFinite(t)) continue;
    // satellite : celui de la colonne s'il est connu, sinon celui du fournisseur ;
    const sat = iSat >= 0 && SAT_BITS[f[iSat].trim()] ? f[iSat].trim() : fallbackSat;
    // puissance radiative (0 si absente) ;
    const frp = iFrp >= 0 ? Math.max(0, Number(f[iFrp]) || 0) : 0;
    // point chaud compact.
    out.push({ lon, lat, t, frp, conf: iConf >= 0 ? parseConfidence(f[iConf]) : 0.5, sats: SAT_BITS[sat], resM: modis ? 1000 : 375, night: iDn >= 0 && f[iDn].trim().toUpperCase() === 'N', n: 1 });
  // Fin de la boucle.
  }
  // Renvoie les points chauds.
  return out;
// Fin de parseFirmsCsv.
}

// Taille des cases de la grille de recherche, en degrés : 0,01° (environ 1,1 km).
const GRID_DEG = 0.01;
// Nombre de cases sur un tour de longitude.
const GRID_COLS = Math.round(360 / GRID_DEG);

/** Distance approchée entre deux points proches, en kilomètres (projection équirectangulaire locale). */
// Fonction nearKm : les deux points.
function nearKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  // Écart de longitude, ramené entre −180 et 180 (passage de l'antiméridien).
  let dLon = lon2 - lon1;
  // Trop à l'est : un tour de moins.
  if (dLon > 180) dLon -= 360;
  // Trop à l'ouest : un tour de plus.
  if (dLon < -180) dLon += 360;
  // Écart est-ouest, en kilomètres, à la latitude moyenne.
  const dx = dLon * 111.32 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  // Écart nord-sud, en kilomètres.
  const dy = (lat2 - lat1) * 110.57;
  // Distance.
  return Math.hypot(dx, dy);
// Fin de nearKm.
}

/** Statistiques de la préparation des points chauds. */
// Forme des statistiques.
export interface HotspotStats {
  // read : détections lues dans les fichiers.
  read: number;
  // merged : détections réunies à une autre (même lieu vu par un autre satellite).
  merged: number;
  // dropped : points écartés, confiance trop faible et aucune confirmation.
  dropped: number;
  // kept : points chauds gardés.
  kept: number;
// Fin de HotspotStats.
}

/**
 * Réunit les détections du même lieu par des satellites différents, puis écarte les points peu sûrs non confirmés.
 * Deux détections sont réunies si elles viennent de satellites différents, à moins de 90 min d'écart, et à moins
 * d'une demi-somme de leurs pixels (375 m entre deux VIIRS, 690 m entre VIIRS et MODIS, 1 km entre deux MODIS).
 * La fusion n'est pas transitive : la position gardée est celle de la meilleure détection (pixel le plus fin, puis la
 * plus récente), si bien que les pixels voisins d'un même front de feu restent des points distincts.
 */
// Fonction prepareHotspots : les listes lues, une par fichier.
export function prepareHotspots(lists: Hotspot[][]): { hotspots: Hotspot[]; stats: HotspotStats } {
  // Toutes les détections, copiées (les listes d'origine ne sont pas modifiées).
  const all = lists.flat().map((h) => ({ ...h }));
  // Ordre de traitement : pixel le plus fin d'abord, puis le plus récent.
  all.sort((a, b) => a.resM - b.resM || b.t - a.t);
  // Points gardés.
  const kept: Hotspot[] = [];
  // Grille des points gardés : case → indices dans `kept`.
  const grid = new Map<number, number[]>();
  // Nombre de détections réunies.
  let merged = 0;
  // Pour chaque détection :
  for (const h of all) {
    // sa ligne et sa colonne de grille ;
    const row = Math.floor((h.lat + 90) / GRID_DEG), colIdx = Math.min(GRID_COLS - 1, Math.floor((h.lon + 180) / GRID_DEG));
    // nombre de colonnes à fouiller de chaque côté : 1 km couvre plus de cases près des pôles ;
    const span = Math.min(60, Math.ceil(1 / (111.32 * GRID_DEG * Math.max(0.02, Math.cos(h.lat * (Math.PI / 180))))));
    // meilleur candidat à la fusion et sa distance ;
    let best = -1, bestKm = Infinity;
    // pour chaque case voisine :
    for (let dr = -1; dr <= 1; dr++) for (let dc = -span; dc <= span; dc++) {
      // sa clé, la colonne repliée autour du globe ;
      const key = (row + dr) * GRID_COLS + (((colIdx + dc) % GRID_COLS) + GRID_COLS) % GRID_COLS;
      // pour chaque point gardé de la case :
      for (const k of grid.get(key) ?? []) {
        // le point gardé ;
        const g = kept[k];
        // même satellite (pixels voisins d'une même image) ou trop éloigné dans le temps : pas de fusion ;
        if ((g.sats & h.sats) !== 0 || Math.abs(g.t - h.t) > MERGE_WINDOW_MS) continue;
        // distance entre les deux centres ;
        const km = nearKm(g.lon, g.lat, h.lon, h.lat);
        // assez proche et plus proche que le meilleur candidat : retenu.
        if (km <= (g.resM + h.resM) / 2000 && km < bestKm) { best = k; bestKm = km; }
      // Fin des points de la case.
      }
    // Fin des cases voisines.
    }
    // Candidat trouvé : la détection lui est réunie.
    if (best >= 0) {
      // Le point gardé.
      const g = kept[best];
      // Puissance : la plus forte des deux ; heure : la plus récente.
      g.frp = Math.max(g.frp, h.frp); g.t = Math.max(g.t, h.t);
      // Confiance : deux satellites indépendants.
      g.conf = combineConfidence([g.conf, h.conf]);
      // Satellites réunis, une détection de plus, de nuit si l'une l'est.
      g.sats |= h.sats; g.n += h.n; g.night = g.night || h.night;
      // Compte la fusion.
      merged++;
      // Détection suivante.
      continue;
    // Fin du cas.
    }
    // Sinon : nouveau point gardé, rangé dans sa case.
    const key = row * GRID_COLS + colIdx;
    // Indices de la case, créés au besoin.
    const cell = grid.get(key) ?? [];
    // Ajoute l'indice du nouveau point.
    cell.push(kept.length);
    // Range la case.
    grid.set(key, cell);
    // Garde le point.
    kept.push(h);
  // Fin des détections.
  }
  // Points assez sûrs (seuls ou confirmés par un second satellite).
  const hotspots = kept.filter((h) => h.conf >= MIN_HOTSPOT_CONFIDENCE);
  // Statistiques.
  return { hotspots, stats: { read: all.length, merged, dropped: kept.length - hotspots.length, kept: hotspots.length } };
// Fin de prepareHotspots.
}

/** Cellules agrégées, en colonnes (une valeur par cellule dans chaque tableau) : léger à transmettre. */
// Forme des cellules.
export interface FireCells {
  // cellDeg : taille d'une cellule, en degrés.
  cellDeg: number;
  // count : nombre de cellules.
  count: number;
  // lon : longitude du barycentre des points de la cellule.
  lon: number[];
  // lat : latitude du barycentre.
  lat: number[];
  // frp : puissance radiative totale, en mégawatts.
  frp: number[];
  // n : nombre de points chauds.
  n: number[];
  // ageMin : âge de la détection la plus récente, en minutes.
  ageMin: number[];
  // conf : confiance la plus haute.
  conf: number[];
  // sats : masque des satellites.
  sats: number[];
// Fin de FireCells.
}

// round : arrondi à `d` décimales.
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** Regroupe les points chauds de moins de 24 h en cellules de `cellDeg` degrés, pour la vue du globe. */
// Fonction aggregateHotspots : les points, la taille des cellules et l'instant de référence.
export function aggregateHotspots(hotspots: Hotspot[], cellDeg: number, now: number): FireCells {
  // Cumuls par cellule : sommes des positions, puissance, nombre, heure la plus récente, confiance, satellites.
  const acc = new Map<number, { sx: number; sy: number; frp: number; n: number; t: number; conf: number; sats: number }>();
  // Nombre de colonnes de la grille.
  const cols = Math.round(360 / cellDeg);
  // Pour chaque point chaud :
  for (const h of hotspots) {
    // trop vieux ou daté du futur (horloge du fournisseur) au-delà d'une heure : ignoré ;
    if (now - h.t > MAX_HOTSPOT_AGE_MS || h.t - now > 3_600_000) continue;
    // clé de sa cellule ;
    const key = Math.floor((h.lat + 90) / cellDeg) * cols + Math.min(cols - 1, Math.floor((h.lon + 180) / cellDeg));
    // cumuls de la cellule, créés au besoin ;
    const a = acc.get(key) ?? { sx: 0, sy: 0, frp: 0, n: 0, t: -Infinity, conf: 0, sats: 0 };
    // ajoute le point.
    a.sx += h.lon; a.sy += h.lat; a.frp += h.frp; a.n += 1; a.t = Math.max(a.t, h.t); a.conf = Math.max(a.conf, h.conf); a.sats |= h.sats;
    // Range les cumuls.
    acc.set(key, a);
  // Fin des points.
  }
  // Colonnes de sortie.
  const out: FireCells = { cellDeg, count: acc.size, lon: [], lat: [], frp: [], n: [], ageMin: [], conf: [], sats: [] };
  // Pour chaque cellule :
  for (const a of acc.values()) {
    // barycentre, puissance totale, nombre, âge en minutes, confiance et satellites.
    out.lon.push(round(a.sx / a.n, 3)); out.lat.push(round(a.sy / a.n, 3)); out.frp.push(round(a.frp, 1)); out.n.push(a.n); out.ageMin.push(Math.max(0, Math.round((now - a.t) / 60_000))); out.conf.push(round(a.conf, 2)); out.sats.push(a.sats);
  // Fin des cellules.
  }
  // Renvoie les cellules.
  return out;
// Fin de aggregateHotspots.
}

/** Points chauds d'une emprise [ouest, sud, est, nord], un par un, en colonnes. */
// Forme du détail.
export interface FireDetail {
  // count : nombre de points.
  count: number;
  // lon, lat : position (5 décimales, environ 1 m).
  lon: number[]; lat: number[];
  // frp : puissance radiative (MW) ; ageMin : âge (minutes) ; conf : confiance ; sats : satellites ; resM : pixel (m).
  frp: number[]; ageMin: number[]; conf: number[]; sats: number[]; resM: number[];
// Fin de FireDetail.
}

/** Points chauds de moins de 24 h contenus dans une emprise, au plus `limit` (les plus puissants d'abord). */
// Fonction hotspotsInBounds : les points, l'emprise, l'instant de référence et la limite.
export function hotspotsInBounds(hotspots: Hotspot[], [w, s, e, n]: [number, number, number, number], now: number, limit = 20_000): FireDetail {
  // Points de l'emprise, récents.
  const inside = hotspots.filter((h) => h.lon >= w && h.lon < e && h.lat >= s && h.lat < n && now - h.t <= MAX_HOTSPOT_AGE_MS && h.t - now <= 3_600_000);
  // Trop nombreux : les plus puissants d'abord, puis coupe à la limite.
  if (inside.length > limit) inside.sort((a, b) => b.frp - a.frp).length = limit;
  // Colonnes de sortie.
  const out: FireDetail = { count: inside.length, lon: [], lat: [], frp: [], ageMin: [], conf: [], sats: [], resM: [] };
  // Pour chaque point : ses colonnes.
  for (const h of inside) { out.lon.push(round(h.lon, 5)); out.lat.push(round(h.lat, 5)); out.frp.push(round(h.frp, 1)); out.ageMin.push(Math.max(0, Math.round((now - h.t) / 60_000))); out.conf.push(round(h.conf, 2)); out.sats.push(h.sats); out.resM.push(h.resM); }
  // Renvoie le détail.
  return out;
// Fin de hotspotsInBounds.
}

/** Satellites d'un masque, par leur code (N20, N21, N, T, A). */
// Fonction satellitesOf : le masque.
export function satellitesOf(mask: number): string[] {
  // Codes dont le bit est présent.
  return Object.keys(SAT_BITS).filter((k) => (mask & SAT_BITS[k]) !== 0);
// Fin de satellitesOf.
}

/** Point chaud au format commun : observé, NON confirmé, avec un fournisseur par satellite. */
// Fonction hotspotToEvent : le point chaud et l'heure de lecture des fichiers.
export function hotspotToEvent(h: Hotspot, fetchedAt: string): AtmosphericEvent {
  // Heure de passage, en ISO.
  const at = new Date(h.t).toISOString();
  // Satellites du point.
  const sats = satellitesOf(h.sats);
  // Provenances : une par satellite.
  const sources: Provenance[] = sats.map((s) => ({ provider: SAT_PROVIDER[s], sourceId: s, url: 'https://firms.modaps.eosdis.nasa.gov/', observedAt: at, fetchedAt }));
  // Événement (début).
  return {
    // Identifiant : position arrondie au millième et heure.
    id: makeEventId('hotspot', 'firms', `${h.lon.toFixed(3)}_${h.lat.toFixed(3)}_${h.t}`),
    // Famille, sans nom.
    type: 'hotspot', name: null,
    // Position et géométrie ponctuelle.
    lon: h.lon, lat: h.lat, geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
    // Altitude : au sol (l'altitude du terrain n'est pas fournie).
    altitudeM: null,
    // Heures : détection, début de validité, pas de fin connue.
    detectedAt: at, validFrom: at, validTo: null,
    // Intensité : la puissance radiative.
    intensity: { value: h.frp, unit: 'MW', label: 'Puissance radiative du feu (FRP)' },
    // Confiance et provenance.
    confidence: h.conf, sources,
    // Résolution : la taille du pixel ; passages espacés de quelques heures.
    resolution: { spatialM: h.resM, temporalS: null },
    // Observé, mais pas confirmé par une agence.
    status: 'observé', confirmed: false, flags: [],
    // Détails : satellites, nombre de détections, jour ou nuit.
    details: { satellites: sats.map((s) => SAT_NAMES[s]), detections: h.n, night: h.night },
  // Fin de l'événement.
  };
// Fin de hotspotToEvent.
}
