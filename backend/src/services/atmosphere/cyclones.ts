// Importe le format commun et ses outils.
import { AtmosphericEvent, Provenance, combineConfidence, haversineKm, makeEventId } from './atmospheric-event';
// Importe les relevés des positions courantes (NHC, GDACS).
import { CycloneFix } from './cyclone-sources';
// Importe les trajectoires observées (EONET).
import { StormTrack, TrackPoint } from './eonet';

// CycloneEngine, partie données (sans NestJS, donc testable seule) : réunit les lectures de plusieurs fournisseurs
// (trajectoires EONET/JTWC, relevés NHC et GDACS) en un événement par cyclone, sans doublon, avec :
//  - la position la plus récente, la trajectoire observée, la catégorie de Saffir-Simpson du vent courant ;
//  - le déplacement ESTIMÉ (cap et vitesse) d'après les deux dernières positions observées ;
//  - les contradictions entre fournisseurs (vents trop différents au même moment) signalées, jamais effacées ;
//  - l'exclusion des cyclones dont la dernière position est trop vieille : rien n'est montré sans source récente.

/** Âge maximal de la dernière position d'un cyclone affiché : 36 heures. */
// Âge maximal : 36 heures.
export const CYCLONE_MAX_AGE_MS = 36 * 3_600_000;
// Distance et écart de temps au-delà desquels deux lectures sans nom commun sont deux cyclones distincts.
const MATCH_KM = 600, MATCH_MS = 12 * 3_600_000;
// Confiance de chaque fournisseur : centre opérationnel, relais de l'agence, système d'alerte.
const PROVIDER_CONFIDENCE: Record<string, number> = { nhc: 0.95, 'eonet-storms': 0.9, gdacs: 0.85 };
// Rang de préférence à heure égale (petit : préféré).
const PROVIDER_RANK: Record<string, number> = { nhc: 0, 'eonet-storms': 1, gdacs: 2 };

/** Catégorie de Saffir-Simpson d'après le vent soutenu (nœuds), avec un libellé en français. */
// Fonction saffirSimpson : le vent soutenu.
export function saffirSimpson(windKt: number | null): { code: string; label: string } {
  // Vent inconnu.
  if (windKt === null || !Number.isFinite(windKt)) return { code: 'NC', label: 'Intensité inconnue' };
  // Moins de 34 nœuds : dépression tropicale.
  if (windKt < 34) return { code: 'TD', label: 'Dépression tropicale' };
  // 34 à 63 nœuds : tempête tropicale.
  if (windKt < 64) return { code: 'TS', label: 'Tempête tropicale' };
  // 64 à 82 nœuds : catégorie 1.
  if (windKt < 83) return { code: 'C1', label: 'Cyclone de catégorie 1' };
  // 83 à 95 nœuds : catégorie 2.
  if (windKt < 96) return { code: 'C2', label: 'Cyclone de catégorie 2' };
  // 96 à 112 nœuds : catégorie 3.
  if (windKt < 113) return { code: 'C3', label: 'Cyclone de catégorie 3' };
  // 113 à 136 nœuds : catégorie 4.
  if (windKt < 137) return { code: 'C4', label: 'Cyclone de catégorie 4' };
  // 137 nœuds et plus : catégorie 5.
  return { code: 'C5', label: 'Cyclone de catégorie 5' };
// Fin de saffirSimpson.
}

// Titres retirés devant un nom de cyclone (anglais, tels que publiés par les agences).
const TITLES = /^(SUPER TYPHOON|TYPHOON|MAJOR HURRICANE|HURRICANE|SEVERE TROPICAL CYCLONE|INTENSE TROPICAL CYCLONE|VERY INTENSE TROPICAL CYCLONE|TROPICAL CYCLONE|TROPICAL STORM|MODERATE TROPICAL STORM|SEVERE TROPICAL STORM|TROPICAL DEPRESSION|SUBTROPICAL STORM|SUBTROPICAL DEPRESSION|POST-TROPICAL CYCLONE|POTENTIAL TROPICAL CYCLONE|REMNANTS OF|SUPER CYCLONIC STORM|EXTREMELY SEVERE CYCLONIC STORM|VERY SEVERE CYCLONIC STORM|SEVERE CYCLONIC STORM|CYCLONIC STORM|DEEP DEPRESSION|DEPRESSION|CYCLONE|STORM)\s+/;

/** Nom normalisé d'un cyclone : sans titre, sans suffixe d'année GDACS (« -26 »), en majuscules sans accent. */
// Fonction normalizeStormName : le nom publié.
export function normalizeStormName(name: string): string {
  // Majuscules sans accent, espaces simples.
  let s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  // Retire les titres, tant qu'il y en a (« REMNANTS OF TROPICAL STORM X »).
  for (let prev = ''; prev !== s;) { prev = s; s = s.replace(TITLES, ''); }
  // Retire le suffixe d'année de GDACS et tout ce qui n'est ni lettre ni chiffre.
  return s.replace(/-\d{2}$/, '').replace(/[^A-Z0-9]/g, '');
// Fin de normalizeStormName.
}

/** Cap (degrés depuis le nord, sens horaire) d'un point vers un autre. */
// Fonction bearingDeg : les deux points.
export function bearingDeg(lon1: number, lat1: number, lon2: number, lat2: number): number {
  // Degrés vers radians.
  const r = Math.PI / 180;
  // Composante est.
  const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  // Composante nord.
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  // Angle ramené entre 0 et 360.
  return ((Math.atan2(y, x) / r) + 360) % 360;
// Fin de bearingDeg.
}

/** Déplacement estimé d'après les deux dernières positions observées : cap (°) et vitesse (km/h), ou null. */
// Fonction movementOf : les positions, triées dans le temps.
export function movementOf(points: TrackPoint[]): { dirDeg: number; speedKmh: number } | null {
  // Moins de deux positions : pas de déplacement.
  if (points.length < 2) return null;
  // Avant-dernière et dernière positions.
  const a = points[points.length - 2], b = points[points.length - 1];
  // Durée entre les deux, en heures.
  const hours = (b.t - a.t) / 3_600_000;
  // Durée nulle ou trop longue (plus de 24 h : estimation peu sûre) : pas de déplacement.
  if (!(hours > 0) || hours > 24) return null;
  // Cap et vitesse, arrondis.
  return { dirDeg: Math.round(bearingDeg(a.lon, a.lat, b.lon, b.lat)), speedKmh: Math.round(haversineKm(a.lon, a.lat, b.lon, b.lat) / hours) };
// Fin de movementOf.
}

// Un groupe de lectures du même cyclone.
interface Group {
  // name : nom normalisé ;
  name: string;
  // tracks : trajectoires ;
  tracks: StormTrack[];
  // fixes : relevés courants.
  fixes: CycloneFix[];
// Fin de Group.
}

// last : la position la plus récente d'un groupe (trajectoires et relevés confondus).
function lastOf(g: Group): { lon: number; lat: number; t: number } | null {
  // Candidats : dernières positions des trajectoires et relevés.
  const all = [...g.tracks.map((tr) => tr.points[tr.points.length - 1]), ...g.fixes];
  // La plus récente, ou null.
  return all.reduce<{ lon: number; lat: number; t: number } | null>((best, p) => (!best || p.t > best.t ? p : best), null);
// Fin de lastOf.
}

/** Résultat de la fusion : cyclones affichables et cyclones écartés (avec la raison). */
// Forme du résultat.
export interface CycloneMerge {
  // cyclones : les événements affichables.
  cyclones: AtmosphericEvent[];
  // excluded : les cyclones écartés, leur raison et leur dernière heure connue.
  excluded: { name: string; reason: string; lastSeen: string }[];
// Fin de CycloneMerge.
}

/** Réunit trajectoires et relevés en un événement par cyclone, à l'instant `now`. */
// Fonction mergeCyclones : trajectoires, relevés, heures de lecture par fournisseur et instant de référence.
export function mergeCyclones(tracks: StormTrack[], fixes: CycloneFix[], fetchedAt: Record<string, string>, now: number, maxAgeMs = CYCLONE_MAX_AGE_MS): CycloneMerge {
  // Groupes formés.
  const groups: Group[] = [];
  // join : place une lecture dans le groupe du même nom, sinon dans un groupe proche, sinon dans un nouveau groupe.
  const join = (name: string, lon: number, lat: number, t: number): Group => {
    // Nom normalisé.
    const key = normalizeStormName(name);
    // Groupe du même nom (nom non vide).
    let g = key ? groups.find((x) => x.name === key) : undefined;
    // Sinon : groupe proche dans l'espace et le temps, seulement si l'un des deux n'a pas de vrai nom (numéro seul,
    // « 31W ») : deux cyclones nommés différemment restent distincts même tout proches (effet Fujiwhara).
    g ??= groups.find((x) => { const p = lastOf(x); return (!key || !x.name || /\d/.test(key) || /\d/.test(x.name)) && p !== null && Math.abs(p.t - t) <= MATCH_MS && haversineKm(p.lon, p.lat, lon, lat) <= MATCH_KM; });
    // Sinon : nouveau groupe.
    if (!g) { g = { name: key, tracks: [], fixes: [] }; groups.push(g); }
    // Renvoie le groupe.
    return g;
  // Fin de join.
  };
  // Les trajectoires d'abord (elles portent l'histoire du cyclone).
  for (const tr of tracks) { const p = tr.points[tr.points.length - 1]; join(tr.name, p.lon, p.lat, p.t).tracks.push(tr); }
  // Puis les relevés, du centre opérationnel au système d'alerte.
  for (const f of [...fixes].sort((a, b) => (PROVIDER_RANK[a.provider] ?? 9) - (PROVIDER_RANK[b.provider] ?? 9))) join(f.name, f.lon, f.lat, f.t).fixes.push(f);
  // Résultat.
  const out: CycloneMerge = { cyclones: [], excluded: [] };
  // Pour chaque groupe :
  for (const g of groups) {
    // relevés datés de tous les fournisseurs : positions des trajectoires et relevés courants ;
    const readings = [
      // Dernière position de chaque trajectoire.
      ...g.tracks.map((tr) => ({ provider: tr.provider, key: tr.key, ...tr.points[tr.points.length - 1], pressureMb: null as number | null, url: tr.url })),
      // Chaque relevé courant.
      ...g.fixes.map((f) => ({ provider: f.provider, key: f.key, lon: f.lon, lat: f.lat, t: f.t, windKt: f.windKt, pressureMb: f.pressureMb, url: f.url })),
    // Les plus récents d'abord, puis par préférence de fournisseur.
    ].sort((a, b) => b.t - a.t || (PROVIDER_RANK[a.provider] ?? 9) - (PROVIDER_RANK[b.provider] ?? 9));
    // le relevé le plus récent ;
    const head = readings[0];
    // nom publié : celui du NHC, sinon d'EONET, sinon de GDACS ;
    const display = g.fixes.find((f) => f.provider === 'nhc')?.name ?? g.tracks[0]?.name ?? g.fixes[0]?.name ?? g.name;
    // dernière position trop vieille : cyclone écarté (aucune source récente ne le confirme) ;
    if (now - head.t > maxAgeMs) { out.excluded.push({ name: display, reason: `dernière position il y a ${Math.round((now - head.t) / 3_600_000)} h`, lastSeen: new Date(head.t).toISOString() }); continue; }
    // vent courant : celui du relevé le plus récent qui en a un ;
    const wind = readings.find((r) => r.windKt !== null && head.t - r.t <= 6 * 3_600_000)?.windKt ?? null;
    // pression : celle du relevé le plus récent qui en a une ;
    const pressure = readings.find((r) => r.pressureMb !== null)?.pressureMb ?? null;
    // trajectoire observée : la plus longue des trajectoires du groupe ;
    const track = [...g.tracks].sort((a, b) => b.points.length - a.points.length)[0]?.points ?? [];
    // contradictions : vents de deux fournisseurs différents, à moins de 6 h d'écart, trop éloignés ;
    const flags: string[] = [];
    // pour chaque paire de relevés :
    for (let i = 0; i < readings.length; i++) for (let j = i + 1; j < readings.length; j++) {
      // les deux relevés ;
      const a = readings[i], b = readings[j];
      // même fournisseur, vent manquant ou trop d'écart de temps : pas de comparaison ;
      if (a.provider === b.provider || a.windKt === null || b.windKt === null || Math.abs(a.t - b.t) > 6 * 3_600_000) continue;
      // écart de vent ;
      const diff = Math.abs(a.windKt - b.windKt);
      // plus de 15 nœuds et plus de 20 % : contradiction signalée.
      if (diff > 15 && diff > 0.2 * Math.max(a.windKt, b.windKt)) flags.push(`contradiction : vent ${Math.round(a.windKt)} kt (${a.provider}) contre ${Math.round(b.windKt)} kt (${b.provider})`);
    // Fin des paires.
    }
    // catégorie du vent courant ;
    const category = saffirSimpson(wind);
    // provenances : une par lecture ;
    const sources: Provenance[] = readings.map((r) => ({ provider: r.provider, sourceId: r.key, url: r.url, observedAt: new Date(r.t).toISOString(), fetchedAt: fetchedAt[r.provider] ?? new Date(now).toISOString() }));
    // fournisseurs distincts ;
    const providers = [...new Set(readings.map((r) => r.provider))];
    // première heure connue ;
    const first = Math.min(...readings.map((r) => r.t), ...track.map((p) => p.t));
    // cyclone (début).
    out.cyclones.push({
      // Identifiant stable : nom normalisé et année de la première position.
      id: makeEventId('cyclone', 'multi', `${g.name || display}-${new Date(first).getUTCFullYear()}`),
      // Famille et nom publié.
      type: 'cyclone', name: display,
      // Position courante.
      lon: head.lon, lat: head.lat,
      // Géométrie : la trajectoire observée (au moins deux positions), sinon le point courant.
      geometry: track.length >= 2 ? { type: 'LineString', coordinates: track.map((p) => [p.lon, p.lat]) } : { type: 'Point', coordinates: [head.lon, head.lat] },
      // Altitude : de la surface au sommet de la troposphère tropicale (ordre de grandeur, non mesuré ici).
      altitudeM: null,
      // Heures : dernière position, première connue, pas de fin.
      detectedAt: new Date(head.t).toISOString(), validFrom: new Date(first).toISOString(), validTo: null,
      // Intensité : vent soutenu en nœuds, libellé de catégorie.
      intensity: { value: wind === null ? null : Math.round(wind), unit: 'kt', label: category.label },
      // Confiance : fournisseurs indépendants combinés.
      confidence: combineConfidence(providers.map((p) => PROVIDER_CONFIDENCE[p] ?? 0.7)),
      // Provenances.
      sources,
      // Résolution : une position toutes les 6 h (trajectoires des agences).
      resolution: { spatialM: null, temporalS: track.length >= 2 ? 21_600 : null },
      // Observé, confirmé par une agence, alertes de contrôle.
      status: 'observé', confirmed: true, flags,
      // Détails (début).
      details: {
        // Catégorie : code et libellé.
        category: category.code, categoryLabel: category.label,
        // Vent soutenu (nœuds et km/h) et pression au centre (hPa).
        windKt: wind === null ? null : Math.round(wind), windKmh: wind === null ? null : Math.round(wind * 1.852), pressureMb: pressure,
        // Classe publiée et niveau d'alerte GDACS.
        classification: g.fixes.find((f) => f.classification)?.classification ?? null, alertLevel: g.fixes.find((f) => f.alertLevel)?.alertLevel ?? null,
        // Trajectoire observée, compacte : [longitude, latitude, heure (ms), vent (kt)].
        track: track.map((p) => [p.lon, p.lat, p.t, p.windKt]),
        // Déplacement estimé d'après les deux dernières positions observées.
        movement: movementOf(track.length >= 2 ? track : []),
        // Hémisphère : le sens de rotation en dépend (antihoraire au nord, horaire au sud).
        hemisphere: head.lat >= 0 ? 'nord' : 'sud',
        // Agences d'origine.
        agencies: [...new Set([...g.tracks.flatMap((tr) => tr.agencies), ...g.fixes.map((f) => f.agency).filter((a): a is string => Boolean(a))])],
      // Fin des détails.
      },
    // Fin du cyclone.
    });
  // Fin des groupes.
  }
  // Renvoie les cyclones et les exclusions.
  return out;
// Fin de mergeCyclones.
}
