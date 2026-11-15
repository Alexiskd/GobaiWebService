/**
 * Exports payants : modèle 3D complet d'un astre, tuiles assemblées, et calcul d'orbite.
 *
 * Le modèle 3D est un sphéroïde aux dimensions réelles (en kilomètres), texturé par les tuiles de l'astre
 * assemblées en une seule image, au format GLB — un fichier unique que Blender, three.js ou un visualiseur en
 * ligne ouvrent directement. La mention d'origine des images est inscrite dans le fichier.
 */
import { BadRequestException, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
// Bibliothèque d'images : assemblage des tuiles et lecture des pixels du modèle de la Terre.
import sharp from 'sharp';
import { MOON, PLANETS, SUN } from '../data/bodies.data';
import { TilesService } from '../map-tiles/map-imagery.service';
import { MosaicService } from './mosaic.service';
import { buildGlb, sphereMesh } from './glb';
// Imagerie de la Terre (satellite HD et fonds GEBCO, sans passer par HTTP) et chlorophylle des océans.
import { EarthImageryService } from '../map-tiles/earth-imagery.service';
// Chlorophylle des océans (image grise du mois).
import { EarthChlorophyllService } from '../map-tiles/earth-chlorophyll.service';
// Bornes de l'échelle de la chlorophylle et mention de ses données.
import { CHL_ATTRIBUTION, CHL_MAX, CHL_MIN } from '../map-tiles/earth-chlorophyll';
// Modèle d'adresse des altitudes Terrarium et table des fonds marins (mentions).
import { SEAFLOOR_BY_ID, TERRARIUM } from '../map-tiles/earth-seafloor';
// Océans du modèle de la Terre : altitudes, textures et relief.
import { composeSeabed, decodeChlorophyll, decodeTerrarium, fillGaps, reliefMesh, waterTexture, type ChlorophyllGrid, type MercatorGrid } from './earth-oceans';
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

/** Niveau maximal des altitudes du modèle de la Terre : 3 (grille de 2 048 px, 64 tuiles Terrarium). */
const ELEVATION_MAX_ZOOM = 3;
/** Côté maximal de la texture de l'eau (px) : la couleur de l'eau varie lentement. */
const WATER_TEXTURE_MAX = 2048;
/** Tuiles demandées en même temps pour le modèle de la Terre. */
const EARTH_PARALLEL = 8;
/** Niveau maximal des textures du modèle de la Terre : 4 (4 096 px de côté, ≈ 50 Mo de pixels par image en mémoire). */
const EARTH_MAX_ZOOM = 4;

// Service injecté par NestJS.
@Injectable()
// Classe du service d'export.
export class ExportService {
  // Journal du service.
  private readonly log = new Logger('Exports');

  // Constructeur : NestJS y injecte les tuiles, l'assemblage, et, s'ils sont là, l'imagerie de la Terre et la chlorophylle.
  constructor(private readonly tiles: TilesService, private readonly mosaic: MosaicService, @Optional() private readonly earth?: EarthImageryService, @Optional() private readonly chlorophyll?: EarthChlorophyllService) {}

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
      // Une couche existe-t-elle pour cet astre ? La Terre a la sienne quand son imagerie est là.
      hasTiles: layers.some((l) => bodyKey(l.body) === b.key) || (b.key === 'terre' && Boolean(this.earth)),
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
  async model(key: string, { zoom, quality, layerId, oceans = true, exaggeration = 20 }: { zoom: number; quality: MeshQuality; layerId?: string; oceans?: boolean; exaggeration?: number }) {
    // L'astre.
    const body = this.body(key);
    // Finesse du maillage.
    const grid = MESH[quality];
    // Finesse inconnue : refus, en listant les valeurs acceptées.
    if (!grid) throw new BadRequestException(`Finesse inconnue. Valeurs acceptées : ${Object.keys(MESH).join(', ')}.`);
    // La Terre, sans couche imposée, quand son imagerie est là : satellite HD (niveau 4 au plus), et ses océans si demandé.
    if (body.key === 'terre' && !layerId && this.earth) return this.earthModel(body, grid, Math.min(zoom, EARTH_MAX_ZOOM), oceans, exaggeration);
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
    return { body, file, texture, mesh: { vertices: mesh.vertexCount, triangles: mesh.triangleCount }, oceans: false };
  // Fin de model.
  }

  /**
   * Modèle 3D de la Terre (voir earth-oceans.ts) : le satellite HD assemblé au niveau `zoom` (Web Mercator). Avec les
   * océans : le sphéroïde soulevé par les altitudes Terrarium (relief exagéré), les fonds GEBCO au large, et un second
   * objet, la surface de l'eau, colorée par la chlorophylle du mois et transparente sur les côtes.
   */
  private async earthModel(body: ExportableBody, grid: readonly [number, number], zoom: number, oceans: boolean, exaggeration: number) {
    // Imagerie de la Terre (présente : contrôlé par l'appelant).
    const earth = this.earth!;
    // Satellite HD assemblé : pixels RGB et côté.
    const land = await this.assemble(zoom, (x, y) => earth.tile('earth-hd', zoom, x, y).then((t) => t.body));
    // Aucune tuile : rien à vendre.
    if (!land) throw new ServiceUnavailableException('Imagerie de la Terre indisponible.');
    // Mentions : celles de la couche unique.
    const credits = [(await earth.resolve('earth-hd')).attribution.text];
    // Sans les océans : sphéroïde lisse, texture du satellite.
    if (!oceans) {
      // Le maillage, texture en Web Mercator.
      const flat = sphereMesh(body.radiusKm, grid[0], grid[1], body.flattening, 'mercator');
      // Le fichier.
      const file = buildGlb({ name: body.name, mesh: flat, image: await this.jpeg(land.raw, land.size), copyright: credits.join(' · '), generator: 'Gobai Space — export de modèle 3D' });
      // Le modèle et ce qui le décrit.
      return { body, file, texture: { projection: 'mercator' as const, width: land.size, height: land.size, attribution: credits.join(' · ') }, mesh: { vertices: flat.vertexCount, triangles: flat.triangleCount }, oceans: false };
    // Fin de ce cas.
    }
    // Altitudes : tuiles Terrarium jusqu'au niveau 3.
    const elevation = await this.elevation(Math.min(zoom, ELEVATION_MAX_ZOOM));
    // Fonds GEBCO assemblés au même niveau que le satellite.
    const sea = await this.assemble(zoom, (x, y) => earth.tile('earth-gebco', zoom, x, y).then((t) => t.body));
    // Texture du relief : le satellite, et les fonds GEBCO au large s'ils sont arrivés.
    if (sea) composeSeabed(land.raw, sea.raw, land.size, elevation);
    // Chlorophylle du mois, ou null (couleur par défaut).
    const chl = await this.chlorophyllGrid();
    // Côté de la texture de l'eau.
    const waterSize = Math.min(land.size, WATER_TEXTURE_MAX);
    // Texture de l'eau, en PNG avec transparence.
    const water = await sharp(Buffer.from(waterTexture(waterSize, elevation, chl)), { raw: { width: waterSize, height: waterSize, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
    // Mentions : GEBCO, la NOAA, et la chlorophylle si elle a servi.
    credits.push(SEAFLOOR_BY_ID.get('earth-gebco')!.source.attribution, 'Altitudes : AWS Terrain Tiles (Mapzen)', ...(chl ? [CHL_ATTRIBUTION] : []));
    // Relief : sphéroïde soulevé par les altitudes, exagérées.
    const relief = reliefMesh(body.radiusKm, grid[0], grid[1], body.flattening, elevation, exaggeration);
    // Surface de l'eau : sphéroïde au niveau de la mer.
    const surface = sphereMesh(body.radiusKm, grid[0], grid[1], body.flattening, 'mercator');
    // Le fichier : la Terre en relief, puis la surface de l'eau, objet à part, transparente et presque lisse.
    const file = buildGlb({
      // Nom de l'objet principal.
      name: `${body.name} — relief et fonds marins`,
      // Son maillage et sa texture.
      mesh: relief, image: await this.jpeg(land.raw, land.size),
      // Mentions et outil.
      copyright: credits.join(' · '), generator: 'Gobai Space — export de modèle 3D (océans)',
      // La surface de l'eau.
      parts: [{ name: 'Océans — surface de l’eau', mesh: surface, image: water, mimeType: 'image/png', transparent: true, roughness: 0.15 }],
    // Fin du fichier.
    });
    // Le modèle et ce qui le décrit.
    return { body, file, texture: { projection: 'mercator' as const, width: land.size, height: land.size, attribution: credits.join(' · ') }, mesh: { vertices: relief.vertexCount + surface.vertexCount, triangles: relief.triangleCount + surface.triangleCount }, oceans: true };
  // Fin de earthModel.
  }

  /** Tuiles d'un niveau (Web Mercator) assemblées en pixels RGB bruts ; null si aucune n'est arrivée. */
  private async assemble(zoom: number, get: (x: number, y: number) => Promise<Buffer>): Promise<{ raw: Uint8Array; size: number } | null> {
    // Nombre de tuiles par côté, et côté de l'image.
    const n = 2 ** zoom, size = n * 256;
    // Les tuiles obtenues, prêtes à coller.
    const pieces: { input: Buffer; left: number; top: number }[] = [];
    // Toutes les positions du quadrillage.
    const all = Array.from({ length: n * n }, (_, k) => ({ x: k % n, y: Math.floor(k / n) }));
    // Par paquets (début).
    for (let i = 0; i < all.length; i += EARTH_PARALLEL) {
      // Chaque tuile du paquet : son image, ou null en cas d'échec.
      const got = await Promise.all(all.slice(i, i + EARTH_PARALLEL).map(({ x, y }) => Promise.resolve().then(() => get(x, y)).then((input) => ({ input, left: x * 256, top: y * 256 })).catch(() => null)));
      // Range celles qui sont arrivées.
      for (const p of got) if (p) pieces.push(p);
    // Fin des paquets.
    }
    // Aucune : null.
    if (!pieces.length) return null;
    // Manquantes : notées dans le journal.
    if (pieces.length < all.length) this.log.warn(`Modèle de la Terre z${zoom} : ${all.length - pieces.length} tuiles sur ${all.length} manquantes.`);
    // Collées sur un fond noir, en pixels RGB bruts.
    const raw = await sharp({ create: { width: size, height: size, channels: 3, background: { r: 0, g: 0, b: 0 } } }).composite(pieces).raw().toBuffer();
    // Les pixels et le côté.
    return { raw: new Uint8Array(raw.buffer, raw.byteOffset, raw.length), size };
  // Fin de assemble.
  }

  /** Grille des altitudes (m, Web Mercator) au niveau `zoom`, tirée des tuiles Terrarium ; 0 là où une tuile manque. */
  private async elevation(zoom: number): Promise<MercatorGrid> {
    // Tuiles Terrarium assemblées (PNG sans perte : les altitudes restent exactes).
    const img = await this.assemble(zoom, async (x, y) => {
      // Adresse de la tuile.
      const res = await fetch(TERRARIUM.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)));
      // Réponse en erreur : tuile manquante.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Les octets.
      return Buffer.from(await res.arrayBuffer());
    // Fin de la lecture d'une tuile.
    });
    // Côté de la grille.
    const size = 256 * 2 ** zoom;
    // Aucune tuile : relief plat (altitude 32 768 − 32 768 = 0 partout).
    if (!img) return { size, values: new Int16Array(size * size) };
    // Altitudes décodées.
    return { size, values: decodeTerrarium(img.raw, 3) };
  // Fin de elevation.
  }

  /** Chlorophylle du mois : grille comblée, ou null si le service ou ERDDAP ne répondent pas. */
  private async chlorophyllGrid(): Promise<ChlorophyllGrid | null> {
    // Pas de service : null.
    if (!this.chlorophyll) return null;
    // Essai (début).
    try {
      // L'image du mois.
      const { png } = await this.chlorophyll.get();
      // Ses pixels bruts : gris et transparence.
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      // Grille décodée et comblée, avec ses dimensions.
      return { grid: fillGaps(decodeChlorophyll(new Uint8Array(data.buffer, data.byteOffset, data.length), info.channels, CHL_MIN, CHL_MAX), info.width, info.height), w: info.width, h: info.height };
    // En cas d'échec : null.
    } catch { return null; }
  // Fin de chlorophyllGrid.
  }

  /** Pixels RGB bruts encodés en JPEG. */
  private jpeg(raw: Uint8Array, size: number): Promise<Buffer> {
    // Encodage JPEG de qualité 85.
    return sharp(Buffer.from(raw.buffer, raw.byteOffset, raw.length), { raw: { width: size, height: size, channels: 3 } }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  // Fin de jpeg.
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
