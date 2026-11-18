// Erreur 404 de NestJS.
import { NotFoundException } from '@nestjs/common';
// Types (effacés à la compilation) d'une couche résolue, d'une description de couche et d'un fournisseur.
import type { ResolvedTileLayer, TileLayerInfo, TileProvider } from './tile-provider';

/**
 * NASA Mars Trek (Solar System Treks, JPL) — mosaïque globale couleur de Mars (Viking MDIM21, 232 m/px),
 * gratuite et sans clé. Service WMTS vérifié : jeu de tuiles `default028mm`, projection géographique
 * (plate carrée), ordre WMTS {z}/{ligne}/{colonne} = {z}/{y}/{x}, images JPEG.
 * Le serveur de la NASA autorise les appels depuis le navigateur (CORS *) : les images sont chargées
 * directement, sans relais par le backend.
 */
// Forme interne d'une couche Mars Trek : la description publique, plus ce qui sert à construire l'adresse.
interface TrekLayer extends TileLayerInfo {
  // path : le nom de la couche chez la NASA.
  path: string;
  // matrixSet : le jeu de tuiles.
  matrixSet: string;
  // extension : l'extension des fichiers.
  extension: 'jpg' | 'png';
// Fin de TrekLayer.
}

// Valeurs communes aux couches de Mars :
const base = {
  // fournisseur, astre (Mars), projection géographique ;
  provider: 'mars-trek' as const, body: 'mars' as const, projection: 'equirectangular' as const,
  // zoom minimal 0, tuiles de 256 px, JPEG, sans transparence, sans clé, vérifié.
  minZoom: 0, tileSize: 256, format: 'jpeg' as const, transparent: false, requiresKey: false, experimental: false,
// Fin des valeurs communes.
};

// Liste des couches de Mars.
const LAYERS: TrekLayer[] = [
  // Une couche :
  {
    // « mars-viking », la mosaïque Viking, jusqu'au niveau 7 ;
    ...base, id: 'mars-viking', label: 'Mars (Viking MDIM21)', kind: 'imagery', maxZoom: 7,
    // sa description ;
    description: 'Mosaïque globale couleur Viking MDIM21 (232 m/pixel), diffusée par Mars Trek.',
    // son nom chez la NASA, son jeu de tuiles et son extension.
    path: 'Mars_Viking_MDIM21_ClrMosaic_global_232m', matrixSet: 'default028mm', extension: 'jpg',
  // Fin de la couche.
  },
// Fin de la liste.
];

// Forme de la configuration de Mars Trek.
export interface MarsTrekConfig {
  // baseUrl : son adresse de base.
  baseUrl: string;
// Fin de MarsTrekConfig.
}

/** Découpage plate carrée : 2^(z+1) colonnes × 2^z lignes. */
// Fonction marsCols : nombre de colonnes à un niveau, 2 puissance (z + 1).
export const marsCols = (z: number) => 2 ** (z + 1);
// Fonction marsRows : nombre de lignes à un niveau, 2 puissance z.
export const marsRows = (z: number) => 2 ** z;

// Classe du fournisseur Mars Trek.
export class NasaTrekMarsProvider implements TileProvider {
  // Son identifiant.
  readonly id = 'mars-trek' as const;

  // Constructeur : reçoit la configuration ; corps vide.
  constructor(private readonly config: MarsTrekConfig) {}

  // Méthode isAvailable.
  isAvailable(): boolean {
    // Toujours utilisable.
    return true;
  // Fin de isAvailable.
  }

  // Méthode has : cette couche est-elle une couche de Mars ?
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

  // Méthode resolve : le modèle d'adresse d'une couche.
  async resolve(layerId: string): Promise<ResolvedTileLayer> {
    // Cherche la couche.
    const layer = LAYERS.find((l) => l.id === layerId);
    // Inconnue :
    if (!layer) {
      // erreur 404 qui cite le nom reçu et liste les couches.
      throw new NotFoundException(`Couche martienne inconnue : « ${layerId} ». Couches : ${LAYERS.map((l) => l.id).join(', ')}.`);
    // Fin du cas.
    }
    // Sépare les champs internes de la description publique.
    const { path, matrixSet, extension, ...info } = layer;
    // Renvoie :
    return {
      // la description publique ;
      ...info,
      // le modèle d'adresse, directement chez la NASA, la ligne avant la colonne ;
      urlTemplate: `${this.config.baseUrl}/${path}/1.0.0/default/${matrixSet}/{z}/{y}/{x}.${extension}`,
      // pas d'expiration ;
      expiresAt: null,
      // la mention à afficher.
      attribution: { text: 'NASA Mars Trek — mosaïque Viking MDIM21 (NASA/GSFC/USGS)' },
    // Fin de l'objet.
    };
  // Fin de resolve.
  }

  // Méthode attribution.
  async attribution(): Promise<string> {
    // La mention complète de la source.
    return 'Mars : mosaïque Viking MDIM21 (NASA/GSFC/USGS) via NASA Mars Trek';
  // Fin de attribution.
  }
// Fin du fournisseur.
}
