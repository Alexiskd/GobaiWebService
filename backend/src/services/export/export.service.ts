/**
 * Exports payants : modèle 3D complet d'un astre, tuiles assemblées, et calcul d'orbite.
 *
 * Le modèle 3D est un sphéroïde aux dimensions réelles (en kilomètres), texturé par les tuiles de l'astre
 * assemblées en une seule image, au format GLB — un fichier unique que Blender, three.js ou un visualiseur en
 * ligne ouvrent directement. La mention d'origine des images est inscrite dans le fichier.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MOON, PLANETS, SUN } from '../data/bodies.data';
import { TilesService } from '../map-tiles/map-imagery.service';
import { MosaicService } from './mosaic.service';
import { buildGlb, sphereMesh } from './glb';
import { SUN_KEY, bodyKey } from '../store/catalogue';
import { centuriesTT, earthPosition, heliocentricState, osculatingElements, AU_KM } from '../ephemeris/planet-orbits';
import { solarPosition } from '../ephemeris/solar-position';

/** Rayon terrestre moyen, en kilomètres : l'unité des rayons de la table des astres. */
const EARTH_RADIUS_KM = 6371;

/**
 * Aplatissement des astres dont la rotation déforme visiblement la sphère (valeurs UAI).
 * Les autres sont assez sphériques pour que l'écart ne se voie pas sur un modèle.
 */
const FLATTENING: Record<string, number> = {
  terre: 0.0033528, mars: 0.00589, jupiter: 0.06487, saturne: 0.09796, uranus: 0.02293, neptune: 0.01708,
};

/** Un astre exportable : son nom, son rayon réel et son aplatissement. */
export interface ExportableBody { key: string; name: string; radiusKm: number; flattening: number }

/** Un astre du catalogue tel que la boutique l'affiche : ce qu'il a réellement à vendre. */
export interface CatalogueBody extends ExportableBody {
  /** Vrai si une couche de tuiles existe : sans elle, le modèle 3D est livré sans texture. */
  hasTiles: boolean;
  /** Vrai si cet astre a une orbite héliocentrique ; faux pour le Soleil, qui est au centre. */
  hasOrbit: boolean;
}

/** Finesse du maillage selon la demande. */
const MESH = { basse: [32, 64], normale: [64, 128], haute: [128, 256] } as const;

/** Niveaux de finesse acceptés. */
export type MeshQuality = keyof typeof MESH;

// Service injecté par NestJS.
@Injectable()
// Classe du service d'export.
export class ExportService {
  // Constructeur : NestJS y injecte les tuiles et l'assemblage.
  constructor(private readonly tiles: TilesService, private readonly mosaic: MosaicService) {}

  /** Les astres exportables : les planètes du catalogue, la Lune, et le Soleil. */
  bodies(): ExportableBody[] {
    // Chaque planète, puis la Lune, puis le Soleil.
    return [...PLANETS.map((p) => ({ name: p.name, radius: p.radius })), { name: MOON.name, radius: MOON.radius }, { name: SUN.name, radius: SUN.radius }]
      .map(({ name, radius }) => ({
        key: bodyKey(name),
        name,
        radiusKm: Math.round(radius * EARTH_RADIUS_KM * 10) / 10,
        flattening: FLATTENING[bodyKey(name)] ?? 0,
      }));
  // Fin de bodies.
  }

  /** Un astre exportable par sa clé, ou 404. */
  body(key: string): ExportableBody {
    // Recherche.
    const found = this.bodies().find((b) => b.key === bodyKey(key));
    // Inconnu : la liste des clés acceptées est donnée.
    if (!found) throw new NotFoundException(`Astre inconnu : « ${key} ». Astres disponibles : ${this.bodies().map((b) => b.key).join(', ')}.`);
    // L'astre.
    return found;
  // Fin de body.
  }

  /**
   * Les astres du catalogue, avec ce que chacun a réellement à vendre : la boutique s'en sert pour ne jamais
   * promettre un fond de carte qui n'existe pas, ni une orbite au Soleil.
   */
  catalogueBodies(): CatalogueBody[] {
    // Les couches déclarées par le service des tuiles, une seule fois.
    const { layers } = this.tiles.list();
    // Chaque astre exportable, enrichi.
    return this.bodies().map((b) => ({
      ...b,
      // Une couche existe-t-elle pour cet astre ?
      hasTiles: layers.some((l) => bodyKey(l.body) === b.key),
      // Le Soleil est au centre du repère héliocentrique : il n'a pas d'orbite.
      hasOrbit: b.key !== SUN_KEY,
    }));
  // Fin de catalogueBodies.
  }

  /** Première couche d'imagerie disponible pour un astre, ou null s'il n'en a pas. */
  async layerFor(key: string): Promise<string | null> {
    // Toutes les couches.
    const { layers } = this.tiles.list();
    // Celles de cet astre, les images d'abord.
    const mine = layers.filter((l) => bodyKey(l.body) === bodyKey(key));
    // La première couche d'imagerie, à défaut la première tout court.
    return (mine.find((l) => l.kind === 'imagery') ?? mine[0])?.id ?? null;
  // Fin de layerFor.
  }

  /** Tuiles d'un astre assemblées en une seule image. */
  async mosaicOf(key: string, zoom: number, layerId?: string) {
    // L'astre, pour refuser tout de suite une clé inconnue.
    this.body(key);
    // La couche : celle demandée, ou la première de l'astre.
    const layer = layerId ?? (await this.layerFor(key));
    // Aucune couche : rien à assembler.
    if (!layer) throw new NotFoundException(`Aucune couche de tuiles pour « ${key} ».`);
    // L'assemblage.
    return this.mosaic.build(layer, zoom);
  // Fin de mosaicOf.
  }

  /**
   * Modèle 3D complet d'un astre, au format GLB : sphéroïde aux dimensions réelles, texturé par ses tuiles.
   * Sans tuiles disponibles, le modèle est rendu sans texture plutôt que refusé.
   */
  async model(key: string, { zoom, quality, layerId }: { zoom: number; quality: MeshQuality; layerId?: string }) {
    // L'astre.
    const body = this.body(key);
    // Finesse du maillage.
    const grid = MESH[quality];
    // Finesse inconnue : refus, en listant les valeurs acceptées.
    if (!grid) throw new BadRequestException(`Finesse inconnue. Valeurs acceptées : ${Object.keys(MESH).join(', ')}.`);
    // Les tuiles assemblées, si l'astre en a.
    const layer = layerId ?? (await this.layerFor(key));
    const texture = layer ? await this.mosaic.build(layer, zoom) : null;
    // Le maillage, dans le découpage de la texture.
    const mesh = sphereMesh(body.radiusKm, grid[0], grid[1], body.flattening, texture?.projection ?? 'equirectangular');
    // Mention d'origine inscrite dans le fichier.
    const copyright = texture?.attribution || 'Gobai Space';
    // Le fichier.
    const file = buildGlb({
      name: body.name,
      mesh,
      image: texture?.image,
      mimeType: texture?.mimeType,
      copyright,
      generator: 'Gobai Space — export de modèle 3D',
    });
    // Le modèle et ce qui le décrit.
    return { body, file, texture, mesh: { vertices: mesh.vertexCount, triangles: mesh.triangleCount } };
  // Fin de model.
  }

  /**
   * Calcul d'orbite : positions et vitesses héliocentriques d'un astre, pas à pas, dans l'écliptique J2000.
   * Même calcul local que la scène : aucun service d'éphémérides n'est interrogé.
   */
  orbit(name: string, fromMs: number, toMs: number, steps: number) {
    // Intervalle et nombre de pas plausibles : contrôlés avant tout, pour tous les astres.
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) throw new BadRequestException('Intervalle de dates invalide.');
    if (!Number.isInteger(steps) || steps < 1 || steps > 10_000) throw new BadRequestException('Le nombre de pas doit être un entier de 1 à 10 000.');
    // Le Soleil est au centre du repère héliocentrique : sa position héliocentrique serait toujours nulle. Ce
    // qui se calcule et se vend pour lui, c'est sa position apparente vue de la Terre.
    if (bodyKey(name) === SUN_KEY) return this.solarTrack(fromMs, toMs, steps);
    // La planète demandée.
    const planet = PLANETS.find((p) => bodyKey(p.name) === bodyKey(name));
    // Inconnue : la liste est donnée, le Soleil compris.
    if (!planet) throw new NotFoundException(`Astre inconnu : « ${name} ». Astres disponibles : ${[...PLANETS.map((p) => bodyKey(p.name)), SUN_KEY].join(', ')}.`);
    // Durée d'un pas.
    const step = steps === 1 ? 0 : (toMs - fromMs) / (steps - 1);
    // Un état par pas.
    const points = [];
    // Parcourt les pas.
    for (let i = 0; i < steps; i++) {
      // Instant de ce pas.
      const t = fromMs + i * step;
      // Siècles de Temps terrestre.
      const T = centuriesTT(t);
      // Position et vitesse.
      const { position, velocity } = heliocentricState(planet.elements, T);
      // Pour la Terre, le centre de l'astre et non le barycentre Terre–Lune.
      const p = planet.earth ? earthPosition(planet.elements, T) : position;
      // Le point.
      points.push({
        t,
        time: new Date(t).toISOString(),
        au: p,
        km: p.map((v) => v * AU_KM),
        auPerDay: velocity,
        kmPerSecond: velocity.map((v) => (v * AU_KM) / 86_400),
      });
    // Fin des pas.
    }
    // Éléments osculateurs calculés à partir de l'état VSOP87A au début de l'intervalle.
    const initialState = heliocentricState(planet.elements, centuriesTT(fromMs));
    const k = osculatingElements(initialState.position, initialState.velocity);
    // Le résultat complet, avec ses métadonnées.
    return {
      body: planet.name,
      center: 'Centre du Soleil',
      frame: 'Écliptique J2000',
      timeScale: 'Dates en UTC ; orbites calculées en Temps terrestre',
      unit: 'UA, UA/jour, km et km/s',
      model: 'VSOP87A complet (Bretagnon & Francou, 1988), calcul local ; Kepler pour les corps non couverts',
      elements: {
        semiMajorAxisAu: k.semiMajorAxisAu,
        eccentricity: k.eccentricity,
        inclinationDeg: k.inclinationDeg,
        meanAnomalyDeg: k.meanAnomalyDeg,
        meanLongitudeDeg: k.meanLongitudeDeg,
        longitudeOfPerihelionDeg: k.longitudeOfPerihelionDeg,
        argumentOfPerihelionDeg: k.argumentOfPerihelionDeg,
        longitudeOfAscendingNodeDeg: k.longitudeOfAscendingNodeDeg,
        periodDays: k.periodDays,
      },
      points,
    };
  // Fin de orbit.
  }

  /**
   * Position apparente du Soleil, pas à pas : coordonnées écliptiques et équatoriales, distance, et point de la
   * Terre où il est au zénith. Même calcul local que le reste du site (services/ephemeris/solar-position).
   */
  private solarTrack(fromMs: number, toMs: number, steps: number) {
    // Les éléments képlériens de la Terre : c'est d'eux que sort la position du Soleil vue d'ici.
    const earth = PLANETS.find((p) => p.earth);
    // Table des astres incomplète : on le dit plutôt que de calculer faux.
    if (!earth) throw new NotFoundException('Les éléments orbitaux de la Terre sont introuvables : la position du Soleil ne peut pas être calculée.');
    // Durée d'un pas.
    const step = steps === 1 ? 0 : (toMs - fromMs) / (steps - 1);
    // Un relevé par pas.
    const points = [];
    // Parcourt les pas.
    for (let i = 0; i < steps; i++) {
      // Instant de ce pas.
      const t = fromMs + i * step;
      // La position du Soleil à cet instant.
      const s = solarPosition(earth.elements, t);
      // Le relevé.
      points.push({
        t,
        time: new Date(t).toISOString(),
        au: s.au,
        km: s.km,
        distanceAu: s.distanceAu,
        distanceKm: s.distanceKm,
        eclipticLonDeg: s.eclipticLonDeg,
        eclipticLatDeg: s.eclipticLatDeg,
        rightAscensionDeg: s.rightAscensionDeg,
        declinationDeg: s.declinationDeg,
        subSolar: s.subSolar,
      });
    // Fin des pas.
    }
    // Le résultat complet, avec ses métadonnées.
    return {
      body: SUN.name,
      center: 'Centre de la Terre',
      frame: 'Écliptique et équateur J2000',
      timeScale: 'Dates en UTC ; positions calculées en Temps terrestre, temps sidéral en UT1 confondu avec UTC',
      unit: 'UA, km et degrés',
      model: 'Position apparente du Soleil : opposé de la position VSOP87A de la Terre, puis obliquité J2000 et temps sidéral de Greenwich',
      note: 'Le Soleil est au centre du repère héliocentrique : il n’a pas d’orbite. Ce relevé donne sa position '
        + 'vue de la Terre, et le point de la Terre où il est au zénith.',
      points,
    };
  // Fin de solarTrack.
  }
// Fin du service.
}
