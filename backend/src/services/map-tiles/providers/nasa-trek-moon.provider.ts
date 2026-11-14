// Erreur 404 de NestJS.
import { NotFoundException } from '@nestjs/common';
// Types (effacés à la compilation) d'une couche résolue, d'une description de couche et d'un fournisseur.
import type { ResolvedTileLayer, TileLayerInfo, TileProvider } from './tile-provider';

/**
 * NASA Moon Trek (Solar System Treks, JPL) — relief de la Lune (altimètre laser LOLA de LRO), gratuit, sans clé.
 * Les couleurs naturelles viennent d'une texture à part (NASA SVS CGI Moon Kit, GET /api/v1/tiles/moon-color.jpg) :
 * Le client fusionne dans le shader des tuiles : détail (Kaguya TC), relief (ombrage LOLA) et couleurs naturelles.
 *
 * Services WMTS vérifiés sur leurs fichiers de capacités (…/1.0.0/WMTSCapabilities.xml) :
 *  - jeu de tuiles `default028mm`, projection géographique (plate carrée), coin haut-gauche (-180°, 90°) ;
 *  - niveau z : 2^(z+1) colonnes × 2^z lignes de 256 px ;
 *  - ordre WMTS {z}/{ligne}/{colonne}, soit {z}/{y}/{x}.
 * Relief : couche LOLA « Shade » 256 px/° (niveaux 0 à 6).
 * Les images passent par le cache disque du serveur (MoonTileCacheService, GET /api/v1/tiles/moon/{couche}/{z}/{x}/{y}) :
 * chaque tuile n'est téléchargée qu'une fois chez la NASA, puis servie depuis le disque.
 */
// Forme interne d'une couche Moon Trek : la description publique, plus ce qui sert à construire l'adresse.
interface TrekLayer extends TileLayerInfo {
  // format : JPEG ou PNG.
  format: 'jpeg' | 'png';
  // path : le nom de la couche chez la NASA.
  path: string;
  // matrixSet : le jeu de tuiles.
  matrixSet: string;
  // extension : l'extension des fichiers.
  extension: 'jpg' | 'png';
// Fin de TrekLayer.
}

// Valeurs communes aux couches de la Lune :
const base = {
  // fournisseur, astre (la Lune), projection géographique ;
  provider: 'nasa-trek' as const, body: 'moon' as const, projection: 'equirectangular' as const,
  // zoom minimal 0, tuiles de 256 px, JPEG, sans transparence, sans clé, vérifié.
  minZoom: 0, tileSize: 256, format: 'jpeg' as const, transparent: false, requiresKey: false, experimental: false,
// Fin des valeurs communes.
};

// Liste des couches de la Lune.
const LAYERS: TrekLayer[] = [
  // Détail : mosaïque mondiale de la caméra TC de Kaguya/SELENE (JAXA), en niveaux de gris. Capacités WMTS vérifiées :
  // default028mm, PNG, niveaux 0 à 10 (≈ 20 m/pixel au niveau 10). Le client en tire la luminosité fine et garde la
  // couleur de la texture naturelle (principe du « pan-sharpening »).
  // Couche « moon-kaguya » : le détail de la caméra de Kaguya, en PNG, jusqu'au niveau 10 ;
  { ...base, id: 'moon-kaguya', label: 'Détail Kaguya (TC)', kind: 'imagery', maxZoom: 10, format: 'png',
    // sa description ;
    description: 'Mosaïque mondiale de la caméra TC de Kaguya (JAXA), ≈ 20 m/pixel au zoom maximal.',
    // son nom chez la NASA, son jeu de tuiles et son extension.
    path: 'Kaguya_TCortho_Mosaic_Global_4096ppd', matrixSet: 'default028mm', extension: 'png' },
  // Relief réel mesuré par l'altimètre laser LOLA de LRO (capacités WMTS vérifiées : default028mm, PNG, 2 × 1 tuiles au niveau 0).
  // Couche « moon-lola-shade » : le relief ombré mesuré par LOLA, en PNG, jusqu'au niveau 6 ;
  { ...base, id: 'moon-lola-shade', label: 'Relief réel (LOLA)', kind: 'relief', maxZoom: 6, format: 'png',
    // sa description ;
    description: 'Relief réel mesuré par l’altimètre laser LOLA (≈ 120 m/pixel).',
    // son nom chez la NASA, son jeu de tuiles et son extension.
    path: 'LRO_LOLA_Shade_Global_256ppd_v06', matrixSet: 'default028mm', extension: 'png' },
// Fin de la liste.
];

// Forme de la configuration de Moon Trek.
export interface MoonTrekConfig {
  // baseUrl : son adresse de base.
  baseUrl: string;
// Fin de MoonTrekConfig.
}

/** Couches lunaires et leur niveau natif maximal (pour le préchargement). */
// Identifiant et niveau maximal de chaque couche, non modifiables.
export const MOON_LAYER_LEVELS: ReadonlyArray<{ id: string; maxZoom: number }> = LAYERS.map((l) => ({ id: l.id, maxZoom: l.maxZoom }));

/** Découpage plate carrée : 2^(z+1) colonnes × 2^z lignes. */
// Fonction moonCols : nombre de colonnes à un niveau, 2 puissance (z + 1).
export const moonCols = (z: number) => 2 ** (z + 1);
// Fonction moonRows : nombre de lignes à un niveau, 2 puissance z.
export const moonRows = (z: number) => 2 ** z;

// Classe du fournisseur Moon Trek.
export class NasaTrekMoonProvider implements TileProvider {
  // Son identifiant.
  readonly id = 'nasa-trek' as const;

  // Constructeur : reçoit la configuration ; corps vide.
  constructor(private readonly config: MoonTrekConfig) {}

  // Méthode isAvailable.
  isAvailable(): boolean {
    // Toujours utilisable.
    return true;
  // Fin de isAvailable.
  }

  // Méthode has : cette couche est-elle une couche de la Lune ?
  has(layerId: string): boolean {
    // Oui si une couche porte cet identifiant.
    return LAYERS.some((l) => l.id === layerId);
  // Fin de has.
  }

  // Méthode layers.
  layers(): TileLayerInfo[] {
    // Chaque couche sans ses champs internes.
    return LAYERS.map(({ path: _p, matrixSet: _m, extension: _e, ...info }) => info);
  // Fin de layers.
  }

  /** Adresse de la tuile chez la NASA (utilisée par le cache disque), ou null si la tuile n'existe pas. */
  // Méthode upstreamUrl : l'adresse d'une tuile chez la NASA.
  upstreamUrl(layerId: string, z: number, x: number, y: number): string | null {
    // Cherche la couche.
    const layer = LAYERS.find((l) => l.id === layerId);
    // Couche inconnue, niveau hors limites, ou colonne ou ligne hors de la grille : null.
    if (!layer || z < 0 || z > layer.maxZoom || x < 0 || y < 0 || x >= moonCols(z) || y >= moonRows(z)) return null;
    // Adresse WMTS, la ligne avant la colonne.
    return `${this.config.baseUrl}/${layer.path}/1.0.0/default/${layer.matrixSet}/${z}/${y}/${x}.${layer.extension}`;
  // Fin de upstreamUrl.
  }

  // Méthode resolve : le modèle d'adresse d'une couche.
  async resolve(layerId: string): Promise<ResolvedTileLayer> {
    // Cherche la couche.
    const layer = LAYERS.find((l) => l.id === layerId);
    // Inconnue :
    if (!layer) {
      // erreur 404 qui cite le nom reçu et liste les couches.
      throw new NotFoundException(`Couche lunaire inconnue : « ${layerId} ». Couches : ${LAYERS.map((l) => l.id).join(', ')}.`);
    // Fin du cas.
    }
    // Retire les champs internes.
    const { path: _p, matrixSet: _m, extension: _e, ...info } = layer;
    // Renvoie :
    return {
      // la description publique ;
      ...info,
      // Relais avec cache disque : la tuile est servie localement dès le deuxième accès (ou après préchargement).
      // ?v=3 : tuiles en WebP, mosaïque Kaguya reconstruite (zones vides comblées, pôles fondus avec LROC) ; le
      // navigateur ne ressort pas les anciennes tuiles de son cache.
      // le modèle d'adresse, qui passe par le cache du serveur ; « v=3 » est le numéro de version des tuiles ;
      urlTemplate: `/api/v1/tiles/moon/${layer.id}/{z}/{x}/{y}?v=3`,
      // pas d'expiration ;
      expiresAt: null,
      // la mention à afficher, selon la couche.
      attribution: { text: layerId === 'moon-kaguya' ? 'NASA Moon Trek · Kaguya TC (JAXA/SELENE)' : 'NASA Moon Trek · LRO/LOLA (NASA/GSFC)' },
    // Fin de l'objet.
    };
  // Fin de resolve.
  }

  // Méthode attribution.
  async attribution(): Promise<string> {
    // La mention complète des sources.
    return 'Lune : détail JAXA/SELENE (Kaguya TC), relief NASA/GSFC (LRO LOLA) via NASA Solar System Treks, couleurs NASA Scientific Visualization Studio';
  // Fin de attribution.
  }
// Fin du fournisseur.
}
