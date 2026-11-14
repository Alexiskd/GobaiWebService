// Erreur 404 de NestJS.
import { NotFoundException } from '@nestjs/common';
// Types (effacés à la compilation) d'une couche résolue, d'une description de couche et d'un fournisseur.
import type { ResolvedTileLayer, TileLayerInfo, TileProvider } from './tile-provider';

/**
 * NASA GIBS (Global Imagery Browse Services) — fond de secours gratuit, sans clé.
 *
 * ⚠ EXPÉRIMENTAL : les noms de couches, le jeu de tuiles (GoogleMapsCompatible_LevelN) et les extensions ci-dessous
 * proviennent de la connaissance du service, pas d'une page de documentation relue ici. Si une couche ne s'affiche pas,
 * vérifiez-la sur https://nasa-gibs.github.io/gibs-api-docs/ et ajustez GIBS_BASE_URL ou ce fichier.
 * Les tuiles WMTS ont l'ordre {z}/{y}/{x} (ligne avant colonne) ; le modèle renvoyé en tient compte.
 */
// Forme interne d'une couche GIBS : la description publique, plus ce qui sert à construire l'adresse.
interface GibsLayer extends TileLayerInfo {
  // path : le nom de la couche chez la NASA.
  path: string;
  /** Jeu de tuiles, ex. GoogleMapsCompatible_Level8. */
  // matrixSet : le jeu de tuiles.
  matrixSet: string;
  // extension : l'extension des fichiers.
  extension: 'jpeg' | 'jpg';
  /** Couche datée : on demande la veille (UTC), toujours disponible. */
  // dated : vrai si la couche change chaque jour.
  dated: boolean;
// Fin de GibsLayer.
}

// Valeurs communes à toutes les couches GIBS : fournisseur, astre (la Terre), Web Mercator, zoom minimal 0, tuiles de 256 px, JPEG, sans transparence, sans clé, expérimental.
const base = { provider: 'gibs' as const, body: 'earth' as const, projection: 'mercator' as const, minZoom: 0, tileSize: 256, format: 'jpeg' as const, transparent: false, requiresKey: false, experimental: true };

// Liste des couches GIBS.
const LAYERS: GibsLayer[] = [
  // Couche « satellite » : ses valeurs communes, son identifiant, son nom, sa nature et son zoom maximal (8) ;
  { ...base, id: 'satellite', label: 'Satellite (Blue Marble)', kind: 'imagery', maxZoom: 8,
    // sa description ;
    description: 'Image composite NASA Blue Marble avec relief et bathymétrie. Résolution limitée (zoom 8).',
    // son nom chez la NASA, son jeu de tuiles, son extension, et le fait qu'elle n'est pas datée.
    path: 'BlueMarble_ShadedRelief_Bathymetry', matrixSet: 'GoogleMapsCompatible_Level8', extension: 'jpeg', dated: false },
// Fin de la liste.
];

// Forme de la configuration de GIBS.
export interface GibsConfig {
  // baseUrl : son adresse de base.
  baseUrl: string;
// Fin de GibsConfig.
}

// Nombre de millisecondes dans un jour.
const DAY_MS = 24 * 60 * 60 * 1000;

// Classe du fournisseur GIBS.
export class GibsTileProvider implements TileProvider {
  // Son identifiant.
  readonly id = 'gibs' as const;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration ;
    private readonly config: GibsConfig,
    // la fonction qui donne l'heure, Date.now par défaut.
    private readonly now: () => number = Date.now,
  // Corps du constructeur vide.
  ) {}

  // Méthode isAvailable.
  isAvailable(): boolean {
    // Toujours utilisable : aucune clé n'est requise.
    return true;
  // Fin de isAvailable.
  }

  // Méthode layers.
  layers(): TileLayerInfo[] {
    // Chaque couche sans ses quatre champs internes (les variables précédées de « _ » ne servent pas).
    return LAYERS.map(({ path: _p, matrixSet: _m, extension: _e, dated: _d, ...info }) => info);
  // Fin de layers.
  }

  // Méthode resolve : le modèle d'adresse d'une couche.
  async resolve(layerId: string): Promise<ResolvedTileLayer> {
    // Cherche la couche.
    const layer = LAYERS.find((l) => l.id === layerId);
    // Inconnue :
    if (!layer) {
      // erreur 404 qui cite le nom reçu et liste les couches.
      throw new NotFoundException(`Couche inconnue : « ${layerId} ». Couches NASA GIBS : ${LAYERS.map((l) => l.id).join(', ')}.`);
    // Fin du cas.
    }
    // Sépare les champs internes de la description publique.
    const { path, matrixSet, extension, dated, ...info } = layer;
    // Minuit UTC du jour.
    const today = Math.floor(this.now() / DAY_MS) * DAY_MS; // minuit UTC
    // Date de la veille, au format AAAA-MM-JJ.
    const date = new Date(today - DAY_MS).toISOString().slice(0, 10);
    // Partie « date » de l'adresse, pour une couche datée seulement.
    const time = dated ? `/${date}` : '';
    // Renvoie :
    return {
      // la description publique ;
      ...info,
      // le modèle d'adresse, avec la ligne avant la colonne ({z}/{y}/{x}) ;
      urlTemplate: `${this.config.baseUrl}/${path}/default${time}/${matrixSet}/{z}/{y}/{x}.${extension}`,
      // l'expiration : minuit prochain pour une couche datée, jamais sinon ;
      expiresAt: dated ? new Date(today + DAY_MS).toISOString() : null,
      // la mention à afficher.
      attribution: { text: 'NASA EOSDIS GIBS' },
    // Fin de l'objet.
    };
  // Fin de resolve.
  }

  // Méthode attribution.
  async attribution(): Promise<string> {
    // La mention complète de la source.
    return 'Imagerie : NASA EOSDIS Global Imagery Browse Services (GIBS)';
  // Fin de attribution.
  }
// Fin du fournisseur.
}
