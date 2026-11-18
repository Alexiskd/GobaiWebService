// Injectable : rend le service injectable par NestJS.
import { Injectable } from '@nestjs/common';
// Tous les satellites, et le code JPL Horizons de chaque planète.
import { ALL_SATELLITES, PLANET_HORIZONS } from '../data/bodies.data';
// Service des cartes des satellites.
import { SatelliteTilesService } from './satellite-tiles.service';

/**
 * Résultat du test d'un astre : `ready` = l'astre a une carte NASA Solar System Treks (vérifiée sur l'API Trek).
 * Les orbites sont toutes calculées par Kepler (data/kepler-elements.ts) : seul Trek est testé. `null` = test en cours.
 * `jpl` = l'astre a un code JPL Horizons dans la table (bodies.data.ts) ; l'API JPL n'est pas interrogée.
 */
// Forme du résultat du test d'un astre.
export interface BodyAvailability {
  // id : son identifiant.
  id: string;
  // name : son nom.
  name: string;
  // kind : planète ou satellite.
  kind: 'planet' | 'satellite';
  // parent : sa planète, ou null.
  parent: string | null;
  // trek : carte NASA Trek trouvée, non trouvée, ou null si le test est en cours.
  trek: boolean | null;
  // jpl : vrai s'il a un code JPL Horizons.
  jpl: boolean;
  // ready : vrai s'il peut être affiché.
  ready: boolean;
// Fin de BodyAvailability.
}

// Nom français de chaque planète :
const PLANET_NAMES: Record<string, string> = {
  // Mercure, Vénus, Terre, Mars, Jupiter ;
  mercury: 'Mercure', venus: 'Vénus', earth: 'Terre', mars: 'Mars', jupiter: 'Jupiter',
  // Saturne, Uranus, Neptune, Pluton.
  saturn: 'Saturne', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluton',
// Fin de la table.
};

/** Test unique avant affichage : l'astre a-t-il une carte NASA Trek ? */
// Fonction isReady : prêt seulement si la carte Trek est trouvée (ni « non », ni « en cours »).
export const isReady = (trek: boolean | null) => trek === true;

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de disponibilité.
export class BodyAvailabilityService {
  // Constructeur : reçoit le service des cartes des satellites ; corps vide.
  constructor(private readonly tiles: SatelliteTilesService) {}

  // Méthode all : teste tous les astres ; attend chaque test 8 secondes au plus par défaut.
  async all(waitMs = 8_000): Promise<{ planets: BodyAvailability[]; satellites: BodyAvailability[] }> {
    // Lance les deux séries de tests en même temps :
    const [satellites, planets] = await Promise.all([
      // pour chaque satellite,
      Promise.all(ALL_SATELLITES.map(async (s): Promise<BodyAvailability> => {
        // cherche sa carte Trek (null en cas d'erreur) ;
        const trek = await this.tiles.hasTrek(s.id, waitMs).catch(() => null);
        // et rend son résultat.
        return { id: s.id, name: s.name, kind: 'satellite', parent: s.parent, trek, jpl: Boolean(s.horizons), ready: isReady(trek) };
      // Fin de la série des satellites.
      })),
      // Pour chaque planète,
      Promise.all(Object.keys(PLANET_HORIZONS).map(async (id): Promise<BodyAvailability> => {
        // cherche sa carte Trek (faux en cas d'erreur) ;
        const trek = await this.tiles.planetHasTrek(id).catch(() => false);
        // et rend son résultat.
        return { id, name: PLANET_NAMES[id] ?? id, kind: 'planet', parent: null, trek, jpl: Boolean(PLANET_HORIZONS[id]), ready: isReady(trek) };
      // Fin de la série des planètes.
      })),
    // Fin des deux séries.
    ]);
    // Renvoie les planètes et les satellites.
    return { planets, satellites };
  // Fin de all.
  }

  /** Préchauffage : test Trek de tout le monde au démarrage, résultat dans le journal. */
  // Méthode warmUp : lance les tests au démarrage.
  async warmUp(): Promise<void> {
    // Teste tout, en attendant jusqu'à 10 minutes.
    const r = await this.all(10 * 60_000);
    // Noms des astres prêts.
    const ok = [...r.planets, ...r.satellites].filter((b) => b.ready).map((b) => b.name);
    // Les écrit dans le journal.
    console.log(`[Disponibilité] Carte NASA Trek : ${ok.length ? ok.join(', ') : 'aucun astre'}`);
  // Fin de warmUp.
  }
// Fin du service.
}
