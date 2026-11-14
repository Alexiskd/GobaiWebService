/**
 * Vents réels du moment sur une grille mondiale grossière (Open-Meteo, sans clé) : ils entraînent les nuages de la
 * Terre dans le site (moteur de mouvement de la météo, frontend weatherFlow.jsx).
 *
 * Une seule requête pour tous les points : https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&current=…
 * Le vent à 700 hPa (≈ 3 km, niveau qui porte les nuages) est préféré ; à défaut, le vent à 10 m.
 */
// Forme d'une grille de vents.
export interface WindGrid {
  // width : nombre de colonnes.
  width: number;
  // height : nombre de lignes.
  height: number;
  // latStart : latitude de la première ligne.
  latStart: number;
  // latStep : écart de latitude entre deux lignes.
  latStep: number;
  // lonStart : longitude de la première colonne.
  lonStart: number;
  // lonStep : écart de longitude entre deux colonnes.
  lonStep: number;
  /** Vitesse vers l'est (m/s), lignes du sud au nord. */
  // u : vitesse vers l'est de chaque point.
  u: number[];
  /** Vitesse vers le nord (m/s). */
  // v : vitesse vers le nord de chaque point.
  v: number[];
// Fin de WindGrid.
}

/** Grille demandée : latitudes de -80° à 80° et longitudes de -180° à 160°, tous les 20° (162 points). */
// Grille demandée : 18 colonnes sur 9 lignes, tous les 20°, à partir de 80° Sud et 180° Ouest.
export const WIND_GRID = { width: 18, height: 9, latStart: -80, latStep: 20, lonStart: -180, lonStep: 20 } as const;

// Fonction windGridPoints : la liste des points de la grille.
export function windGridPoints(): { lat: number; lon: number }[] {
  // Points produits.
  const points: { lat: number; lon: number }[] = [];
  // Pour chaque ligne, du sud au nord,
  for (let y = 0; y < WIND_GRID.height; y++) {
    // et chaque colonne, d'ouest en est : ajoute le point, avec sa latitude et sa longitude.
    for (let x = 0; x < WIND_GRID.width; x++) points.push({ lat: WIND_GRID.latStart + y * WIND_GRID.latStep, lon: WIND_GRID.lonStart + x * WIND_GRID.lonStep });
  // Fin de la boucle.
  }
  // Renvoie les points.
  return points;
// Fin de windGridPoints.
}

/** `upperAir` : demander aussi le vent à 700 hPa (retiré au second essai si l'API le refuse). */
// Fonction windUrl : l'adresse à appeler chez Open-Meteo.
export function windUrl(upperAir: boolean): string {
  // Points de la grille.
  const points = windGridPoints();
  // Variables demandées : le vent à 700 hPa si voulu, et toujours le vent à 10 m (vitesse et direction).
  const vars = [...(upperAir ? ['wind_speed_700hPa', 'wind_direction_700hPa'] : []), 'wind_speed_10m', 'wind_direction_10m'];
  // Paramètres de la requête :
  const q = new URLSearchParams({
    // les latitudes, séparées par des virgules ;
    latitude: points.map((p) => p.lat).join(','),
    // les longitudes ;
    longitude: points.map((p) => p.lon).join(','),
    // les variables voulues, pour l'instant présent ;
    current: vars.join(','),
    // les vitesses en mètres par seconde.
    wind_speed_unit: 'ms',
  // Fin des paramètres.
  });
  // L'adresse complète.
  return `https://api.open-meteo.com/v1/forecast?${q}`;
// Fin de windUrl.
}

/** Vitesse et direction météo (d'où vient le vent, en degrés depuis le nord) → composantes vers l'est et vers le nord. */
// Fonction windComponents : vitesse et direction d'où vient le vent → vitesse vers l'est et vers le nord.
export function windComponents(speed: number, directionDeg: number): [number, number] {
  // Direction en radians.
  const a = (directionDeg * Math.PI) / 180;
  // Le vent va à l'opposé de la direction d'où il vient, d'où les signes moins.
  return [-speed * Math.sin(a), -speed * Math.cos(a)];
// Fin de windComponents.
}

/** Réponse d'Open-Meteo (liste d'un objet par point, dans l'ordre demandé) → grille. */
// Fonction parseWind : lit la réponse d'Open-Meteo.
export function parseWind(json: unknown): WindGrid & { level: '700 hPa' | '10 m'; validAt: string } {
  // La réponse doit être une liste.
  const list = Array.isArray(json) ? json : null;
  // Nombre de points attendu.
  const count = WIND_GRID.width * WIND_GRID.height;
  // Pas une liste, ou mauvais nombre de points : erreur.
  if (!list || list.length !== count) throw new Error('réponse de vent inattendue');
  // Le vent à 700 hPa est-il présent pour tous les points ?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upper = list.every((p: any) => Number.isFinite(p?.current?.wind_speed_700hPa) && Number.isFinite(p?.current?.wind_direction_700hPa));
  // Noms des deux champs à lire : ceux de 700 hPa si oui, ceux de 10 m sinon.
  const [sKey, dKey] = upper ? ['wind_speed_700hPa', 'wind_direction_700hPa'] : ['wind_speed_10m', 'wind_direction_10m'];
  // Vitesses vers l'est.
  const u: number[] = [];
  // Vitesses vers le nord.
  const v: number[] = [];
  // Pour chaque point :
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of list as any[]) {
    // sa vitesse ;
    const speed = Number(p?.current?.[sKey]);
    // sa direction ;
    const dir = Number(p?.current?.[dKey]);
    // l'une des deux manque : erreur.
    if (!Number.isFinite(speed) || !Number.isFinite(dir)) throw new Error('vent manquant pour un point');
    // Ses deux composantes.
    const [east, north] = windComponents(speed, dir);
    // Vers l'est, arrondie au dixième.
    u.push(Math.round(east * 10) / 10);
    // Vers le nord, arrondie au dixième.
    v.push(Math.round(north * 10) / 10);
  // Fin de la boucle.
  }
  // Heure de validité donnée par le premier point.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const time = String((list[0] as any)?.current?.time ?? '');
  // Renvoie la grille, ses vitesses, le niveau utilisé et l'heure.
  return { ...WIND_GRID, u, v, level: upper ? '700 hPa' : '10 m', validAt: time };
// Fin de parseWind.
}
