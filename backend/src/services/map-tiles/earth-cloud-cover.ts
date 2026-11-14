/**
 * Couverture nuageuse du moment sur une grille mondiale (Open-Meteo, sans clé) : seconde source de nuages réels de la
 * Terre, utilisée par le site quand l'image satellite (Xweather, avec identifiants) n'est pas disponible.
 *
 * La valeur est la couverture totale calculée par les modèles météo pour l'heure en cours (0 à 100 %), lue au centre
 * de chaque case. Le site la pose sur le globe (atmosphere.jsx, `setCloudCover`) puis déplace les nuages avec le vent
 * réel (earth-wind.ts) entre deux lectures.
 */
// Forme d'une grille de couverture nuageuse.
export interface CloudCoverGrid {
  // width : nombre de colonnes.
  width: number;
  // height : nombre de lignes.
  height: number;
  /** Octets en base64, un par case (0 = ciel clair, 255 = couvert), lignes du sud au nord, depuis 180° Ouest. */
  // cover : les valeurs, un octet par case, en base64.
  cover: string;
// Fin de CloudCoverGrid.
}

/** Cases de 15° : 24 × 12 = 288 points, aux centres des cases (longitudes -172,5° à 172,5°, latitudes -82,5° à 82,5°). */
// Grille : 24 colonnes sur 12 lignes.
export const CLOUD_GRID = { width: 24, height: 12 } as const;
/** Points par requête : l'adresse reste courte. */
// Nombre de points par requête.
export const CLOUD_BATCH = 96;

// Fonction cloudGridPoints : les points de la grille.
export function cloudGridPoints(): { lat: number; lon: number }[] {
  // Taille de la grille.
  const { width, height } = CLOUD_GRID;
  // Points produits.
  const points: { lat: number; lon: number }[] = [];
  // Pour chaque ligne, du sud au nord,
  for (let y = 0; y < height; y++) {
    // et chaque colonne, d'ouest en est : ajoute le centre de la case (d'où le + 0,5).
    for (let x = 0; x < width; x++) points.push({ lat: -90 + ((y + 0.5) * 180) / height, lon: -180 + ((x + 0.5) * 360) / width });
  // Fin de la boucle.
  }
  // Renvoie les points.
  return points;
// Fin de cloudGridPoints.
}

/** Adresses Open-Meteo à appeler, dans l'ordre des points de la grille. */
// Fonction cloudCoverUrls : les adresses à appeler.
export function cloudCoverUrls(): string[] {
  // Points de la grille.
  const points = cloudGridPoints();
  // Adresses produites.
  const urls: string[] = [];
  // Par paquets de 96 points :
  for (let i = 0; i < points.length; i += CLOUD_BATCH) {
    // le paquet ;
    const batch = points.slice(i, i + CLOUD_BATCH);
    // paramètres de la requête :
    const q = new URLSearchParams({
      // ses latitudes ;
      latitude: batch.map((p) => p.lat).join(','),
      // ses longitudes ;
      longitude: batch.map((p) => p.lon).join(','),
      // la couverture nuageuse du moment.
      current: 'cloud_cover',
    // Fin des paramètres.
    });
    // Ajoute l'adresse.
    urls.push(`https://api.open-meteo.com/v1/forecast?${q}`);
  // Fin de la boucle.
  }
  // Renvoie les adresses.
  return urls;
// Fin de cloudCoverUrls.
}

/** Réponses d'Open-Meteo (une liste d'un objet par point, par requête, dans l'ordre demandé) → grille. */
// Fonction parseCloudCover : lit les réponses d'Open-Meteo.
export function parseCloudCover(responses: unknown[]): CloudCoverGrid & { validAt: string; mean: number } {
  // Met bout à bout les points de toutes les réponses.
  const list = responses.flatMap((json) => (Array.isArray(json) ? json : [json]));
  // Nombre de points attendu.
  const count = CLOUD_GRID.width * CLOUD_GRID.height;
  // Mauvais nombre : erreur.
  if (list.length !== count) throw new Error('réponse de couverture nuageuse inattendue');
  // Octets de la grille.
  const bytes = Buffer.alloc(count);
  // Somme des pourcentages, pour la moyenne.
  let sum = 0;
  // Pour chaque point :
  list.forEach((p, i) => {
    // sa couverture brute ;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (p as any)?.current?.cloud_cover;
    // null ou absent : point sans donnée (Number(null) vaudrait 0, un faux ciel clair).
    // en nombre, ou NaN si ce n'en est pas un ;
    const percent = typeof raw === 'number' ? raw : NaN;
    // absente : erreur.
    if (!Number.isFinite(percent)) throw new Error('couverture nuageuse manquante pour un point');
    // Bornée entre 0 et 100.
    const clamped = Math.min(100, Math.max(0, percent));
    // Convertie en octet, de 0 à 255.
    bytes[i] = Math.round((clamped / 100) * 255);
    // Ajoutée à la somme.
    sum += clamped;
  // Fin de la boucle.
  });
  // Heure de validité donnée par le premier point.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const time = String((list[0] as any)?.current?.time ?? '');
  // Renvoie la taille, les octets en base64, l'heure et la moyenne arrondie.
  return { ...CLOUD_GRID, cover: bytes.toString('base64'), validAt: time, mean: Math.round(sum / count) };
// Fin de parseCloudCover.
}
