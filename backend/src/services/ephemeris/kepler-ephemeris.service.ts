// Injectable : rend le service injectable par NestJS.
import { Injectable, NotFoundException } from '@nestjs/common';
// Types (effacés à la compilation) des réponses : Lune, un satellite, tous les satellites.
import type { MoonEphemerisDto, SatelliteEphemerisDto, SatellitesEphemerisDto } from '../../dto/ephemeris.dto';
// Liste de tous les satellites naturels de l'application.
import { ALL_SATELLITES } from '../data/bodies.data';
// Table identifiant → éléments d'orbite.
import { ASTRE_BY_ID } from '../data/kepler-elements';
// Position de la Lune par la théorie ELP, et siècles de Temps terrestre.
import { centuriesTT, moonVector } from './planet-orbits';
// Fonction qui calcule une table de positions à pas régulier.
import { meanMotion, periodDays, stateAt, stateTable } from './kepler-orbits';

// Nom français de chaque planète mère, pour l'écrire dans la réponse :
const PARENT_NAMES: Record<string, string> = {
  // Mars, Jupiter, Saturne, Uranus, Neptune, Pluton.
  mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturne', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluton',
// Fin de la table.
};
// Nombre de millisecondes dans une heure.
const HOUR = 3_600_000;
// La table commence 2 heures avant maintenant.
const WINDOW_BEFORE_MS = 2 * HOUR;
// Elle couvre ensuite 48 heures après maintenant : 50 heures en tout.
const WINDOW_AFTER_MS = 48 * HOUR;
// Un point toutes les 30 minutes pour la Lune.
const MOON_STEP_MIN = 30;
// Un point toutes les 20 minutes pour les satellites.
const SAT_STEP_MIN = 20; // Mimas fait le tour de Saturne en 22,6 h : ≈ 68 points par orbite

/**
 * Orbites de la Lune et des satellites, calculées localement par les lois de Kepler (data/kepler-elements.ts) :
 * aucun appel à JPL Horizons. Tables de 50 h (−2 h / +48 h) au même format qu'avant, interpolées par le client ;
 * recalculées quand il reste moins de 24 h de données.
 */
// Rend la classe injectable par NestJS.
/**
 * Table de positions de la Lune, pas à pas, par la théorie ELP (voir planet-orbits.ts).
 * Une ellipse képlérienne moyenne ne convient pas à la Lune : l'évection (1,27°) et la variation (0,66°) la
 * déplacent de plus de dix mille kilomètres, que les termes périodiques d'ELP reprennent un à un. Le client
 * remplace sa propre position par celle de cette table : elle doit donc être au moins aussi bonne.
 */
// moonTable : les positions de la Lune entre deux instants (début).
function moonTable(fromMs: number, toMs: number, stepMinutes: number) {
  // Les points de la table.
  const out: { t: number; x: number; y: number; z: number }[] = [];
  // Pas en millisecondes.
  const step = stepMinutes * 60_000;
  // Un point par pas.
  for (let t = fromMs; t <= toMs; t += step) {
    // Vecteur Terre → Lune à cet instant, en kilomètres, écliptique J2000.
    const [x, y, z] = moonVector(centuriesTT(t));
    // Rangé dans la table.
    out.push({ t, x, y, z });
  // Fin des points.
  }
  // La table.
  return out;
// Fin de moonTable.
}

@Injectable()
// Classe du service des orbites de Kepler.
export class KeplerEphemerisService {
  // Table de la Lune gardée en mémoire, avec la période qu'elle couvre ; null au départ.
  private moonCache: { from: number; to: number; data: MoonEphemerisDto } | null = null;
  // Tables des satellites gardées en mémoire, de la même façon.
  private satCache: { from: number; to: number; data: SatellitesEphemerisDto } | null = null;

  // Constructeur : reçoit la fonction qui donne l'heure, Date.now par défaut (remplaçable dans les tests) ; corps vide.
  constructor(private readonly now: () => number = Date.now) {}

  // Méthode privée window : la période à couvrir.
  private window() {
    // Début : deux heures avant maintenant, ramené à l'heure ronde précédente.
    const from = Math.floor((this.now() - WINDOW_BEFORE_MS) / HOUR) * HOUR;
    // Fin : 50 heures après ce début.
    return { from, to: from + WINDOW_BEFORE_MS + WINDOW_AFTER_MS };
  // Fin de window.
  }

  // Méthode privée fresh : une table en mémoire est-elle encore bonne ?
  private fresh(c: { from: number; to: number } | null): boolean {
    // Heure actuelle.
    const now = this.now();
    // Oui si elle existe, si elle a commencé, et s'il lui reste plus de 24 heures de données.
    return Boolean(c && now >= c.from && c.to - now > 24 * HOUR);
  // Fin de fresh.
  }

  /**
   * État képlérien instantané d’un corps du catalogue.
   * Les planètes sont héliocentriques ; les satellites sont relatifs à leur planète mère.
   */
  body(id: string, timeMs: number = this.now()) {
    const astre = ASTRE_BY_ID.get(id.toLowerCase());
    if (!astre) throw new NotFoundException(`Corps céleste inconnu : ${id}`);

    const state = stateAt(astre, timeMs);
    const unit = astre.kepler.unit;
    return {
      id: astre.id,
      name: astre.nom,
      type: astre.type,
      center: astre.type === 'planet' ? 'Centre du Soleil' : `Centre de ${PARENT_NAMES[astre.parent] ?? astre.parent}`,
      time: new Date(timeMs).toISOString(),
      timeScale: 'UTC en entrée, TT pour la propagation depuis J2000',
      frame: astre.kepler.frame,
      outputFrame: 'Écliptique J2000',
      distanceUnit: unit,
      velocityUnit: `${unit}/jour`,
      model: 'Kepler elliptique à deux corps, éléments moyens référencés à J2000',
      limitations: 'Ne modélise pas les perturbations mutuelles, les résonances ni les corrections relativistes.',
      position: state.position,
      velocity: state.velocity,
      distance: state.distance,
      meanMotionRadPerDay: meanMotion(astre),
      periodDays: periodDays(astre),
      eccentricAnomalyRad: state.eccentricAnomaly,
      trueAnomalyRad: state.trueAnomaly,
    };
  }

  // Méthode moon : la table de positions de la Lune.
  async moon(): Promise<MoonEphemerisDto> {
    // Table en mémoire encore bonne : on la rend (le « ! » affirme qu'elle n'est pas null).
    if (this.fresh(this.moonCache)) return this.moonCache!.data;
    // Sinon, période à couvrir.
    const { from, to } = this.window();
    // Réponse :
    const data: MoonEphemerisDto = {
      // origine des données ;
      source: 'Théorie ELP, termes principaux (Meeus, « Astronomical Algorithms », chap. 47), calcul local',
      // astre visé ;
      target: 'Lune',
      // point de départ du vecteur ;
      center: 'Centre de la Terre',
      // repère ;
      frame: 'Écliptique',
      // unité ;
      unit: 'km',
      // écart entre deux points ;
      stepMinutes: MOON_STEP_MIN,
      // positions calculées sur la période, au pas de la Lune.
      points: moonTable(from, to, MOON_STEP_MIN),
    // Fin de la réponse.
    };
    // Garde la table en mémoire avec sa période.
    this.moonCache = { from, to, data };
    // La renvoie.
    return data;
  // Fin de moon.
  }

  // Méthode satellites : les tables de tous les satellites.
  async satellites(): Promise<SatellitesEphemerisDto> {
    // Tables en mémoire encore bonnes : on les rend.
    if (this.fresh(this.satCache)) return this.satCache!.data;
    // Sinon, période à couvrir.
    const { from, to } = this.window();
    // Tables produites.
    const out: SatelliteEphemerisDto[] = [];
    // Pour chaque satellite de l'application :
    for (const s of ALL_SATELLITES) {
      // ses éléments d'orbite ;
      const astre = ASTRE_BY_ID.get(s.id);
      // absents, ou l'astre n'est pas un satellite : on passe.
      if (!astre || astre.type !== 'satellite') continue;
      // Essaie
      try {
        // d'ajouter sa table :
        out.push({
          // son identifiant ;
          id: s.id,
          // son nom et le plan de référence de ses éléments ;
          target: `${s.name} (éléments képlériens, ${astre.kepler.frame})`,
          // le centre de sa planète, nommée en français si elle est connue ;
          center: `Centre de ${PARENT_NAMES[s.parent] ?? s.parent}`,
          // ses positions sur la période, au pas des satellites.
          points: stateTable(astre, from, to, SAT_STEP_MIN),
        // Fin de la table.
        });
      // En cas d'erreur de calcul,
      } catch (e) {
        // on l'écrit dans le journal et ce satellite est simplement absent de la réponse.
        console.warn(`Kepler : ${s.name} incalculable (${(e as Error).message})`);
      // Fin du cas.
      }
    // Fin de la boucle.
    }
    // Réponse :
    const data: SatellitesEphemerisDto = {
      // origine des données ;
      source: 'Éléments képlériens (calcul local)',
      // repère ;
      frame: 'Écliptique J2000',
      // unité ;
      unit: 'km',
      // écart entre deux points ;
      stepMinutes: SAT_STEP_MIN,
      // les tables.
      satellites: out,
    // Fin de la réponse.
    };
    // Garde les tables en mémoire avec leur période.
    this.satCache = { from, to, data };
    // Les renvoie.
    return data;
  // Fin de satellites.
  }
// Fin du service.
}
