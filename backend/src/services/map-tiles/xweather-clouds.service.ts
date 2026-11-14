// Outils NestJS : erreurs 502 et 400, service injectable, journal, erreur 503.
import { BadGatewayException, BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

// Délai maximal d'un appel : 30 secondes.
const TIMEOUT_MS = 30_000;
// Durée de garde d'une tuile : 30 minutes.
const CACHE_MS = 30 * 60_000;   // une tuile est redemandée au plus toutes les 30 min
// Après un échec, pas de nouvel essai avant 5 minutes.
const RETRY_MS = 5 * 60_000;    // échec : nouvel essai après 5 min
// Taille maximale d'une tuile : 4 Mo.
const MAX_BYTES = 4 * 1024 * 1024;
/** Niveau de zoom le plus fin relayé : 2 = 16 tuiles pour le monde entier (assez pour une couche de nuages). */
// Niveau de zoom maximal relayé : 3.
export const XWEATHER_MAX_ZOOM = 3;

// Forme d'une tuile de nuages : ses octets et son type de contenu.
export interface CloudTile { body: Buffer; contentType: string }

/** Adresse d'une tuile Xweather Raster Maps (Web Mercator, 256 px) : image satellite du moment. */
// Fonction xweatherTileUrl : l'adresse d'une tuile chez Xweather.
export function xweatherTileUrl(clientId: string, clientSecret: string, layer: string, z: number, x: number, y: number): string {
  // Elle contient les identifiants, la couche, les coordonnées et « current » (l'image du moment).
  return `https://maps.api.xweather.com/${clientId}_${clientSecret}/${layer}/${z}/${x}/${y}/current.png`;
// Fin de xweatherTileUrl.
}

/**
 * Nuages réels de la Terre vus par satellite, relayés depuis Xweather Raster Maps (couche `satellite`).
 * Les identifiants (XWEATHER_CLIENT_ID, XWEATHER_CLIENT_SECRET) restent sur le serveur : le navigateur ne voit que
 * /api/v1/tiles/earth-clouds/xweather/{z}/{x}/{y}. Chaque tuile est gardée 30 minutes en mémoire, et seuls les
 * niveaux 0 à 3 sont relayés, pour borner le nombre d'appels facturés. Sans identifiants : 503, le site utilise une
 * autre source de nuages.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des nuages Xweather.
export class XweatherCloudsService {
  // Journal préfixé par « Nuages Xweather ».
  private readonly log = new Logger('Nuages Xweather');
  // Identifiant client, lu dans l'environnement ; vide s'il manque.
  private readonly clientId = process.env.XWEATHER_CLIENT_ID?.trim() || '';
  // Secret client, lu dans l'environnement.
  private readonly clientSecret = process.env.XWEATHER_CLIENT_SECRET?.trim() || '';
  // Couche : XWEATHER_CLOUD_LAYER si elle a une forme valable, sinon « satellite ».
  private readonly layer = /^[a-z0-9:,-]{1,80}$/i.test(process.env.XWEATHER_CLOUD_LAYER?.trim() || '') ? process.env.XWEATHER_CLOUD_LAYER!.trim() : 'satellite';
  // Tuiles gardées en mémoire, avec leur heure.
  private readonly cache = new Map<string, { at: number; tile: CloudTile }>();
  // Téléchargements en cours, par tuile.
  private readonly loading = new Map<string, Promise<CloudTile>>();
  // Heure du dernier échec.
  private failedAt = 0;
  // Message du dernier échec.
  private lastError = '';

  // Constructeur : reçoit la fonction de téléchargement et la fonction qui donne l'heure ; corps vide.
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args), private readonly now: () => number = Date.now) {}

  // Méthode isConfigured : les identifiants sont-ils présents ?
  isConfigured(): boolean {
    // Oui si l'identifiant fait 8 à 64 lettres ou chiffres, et le secret 16 à 128.
    return /^[A-Za-z0-9]{8,64}$/.test(this.clientId) && /^[A-Za-z0-9]{16,128}$/.test(this.clientSecret);
  // Fin de isConfigured.
  }

  // Méthode tile : une tuile de nuages.
  tile(z: number, x: number, y: number): Promise<CloudTile> {
    // Sans identifiants :
    if (!this.isConfigured()) {
      // erreur 503.
      return Promise.reject(new ServiceUnavailableException('Nuages Xweather non configurés (XWEATHER_CLIENT_ID et XWEATHER_CLIENT_SECRET).'));
    // Fin du cas.
    }
    // Nombre de tuiles par côté à ce niveau.
    const size = 2 ** z;
    // Coordonnées non entières, niveau hors de 0 à 3, ou tuile hors de la grille :
    if (![z, x, y].every(Number.isInteger) || z < 0 || z > XWEATHER_MAX_ZOOM || x < 0 || y < 0 || x >= size || y >= size) {
      // erreur 400.
      return Promise.reject(new BadRequestException(`Tuile ${z}/${x}/${y} hors des niveaux 0 à ${XWEATHER_MAX_ZOOM}.`));
    // Fin du cas.
    }
    // Clé de la tuile.
    const key = `${z}/${x}/${y}`;
    // Tuile en mémoire.
    const cached = this.cache.get(key);
    // De moins de 30 minutes : on la rend.
    if (cached && this.now() - cached.at < CACHE_MS) return Promise.resolve(cached.tile);
    // Téléchargement en cours pour cette tuile.
    const pending = this.loading.get(key);
    // S'il y en a un : on rend le même.
    if (pending) return pending;
    // Échec de moins de 5 minutes :
    if (this.now() - this.failedAt < RETRY_MS) {
      // on rend l'ancienne tuile s'il y en a une ;
      if (cached) return Promise.resolve(cached.tile); // image précédente plutôt que rien
      // sinon erreur 502.
      return Promise.reject(new BadGatewayException(`Nuages Xweather indisponibles (${this.lastError}).`));
    // Fin du cas.
    }
    // Lance le téléchargement ;
    const p = this.download(z, x, y)
      // en cas de succès : garde la tuile avec l'heure ;
      .then((tile) => { this.cache.set(key, { at: this.now(), tile }); return tile; })
      // en cas d'échec :
      .catch((e) => {
        // note l'heure de l'échec ;
        this.failedAt = this.now();
        // note son message ;
        this.lastError = e instanceof Error ? e.message : String(e);
        // l'écrit dans le journal ;
        this.log.warn(`Xweather indisponible : ${this.lastError}`);
        // rend l'ancienne tuile s'il y en a une ;
        if (cached) return cached.tile;
        // sinon erreur 502.
        throw new BadGatewayException(`Nuages Xweather indisponibles (${this.lastError}).`);
      // Fin du traitement d'échec.
      })
      // Dans tous les cas, efface la marque « en cours ».
      .finally(() => { this.loading.delete(key); });
    // Marque le téléchargement comme en cours.
    this.loading.set(key, p);
    // Le renvoie.
    return p;
  // Fin de tile.
  }

  // Méthode privée download.
  private async download(z: number, x: number, y: number): Promise<CloudTile> {
    // Contrôleur qui permet d'abandonner l'appel.
    const ctrl = new AbortController();
    // Minuterie : abandon au bout du délai.
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    // Essaie :
    try {
      // d'appeler Xweather ;
      const res = await this.fetchFn(xweatherTileUrl(this.clientId, this.clientSecret, this.layer, z, x, y), { signal: ctrl.signal });
      // Le code HTTP suffit au diagnostic : l'adresse contient les identifiants, elle n'est jamais journalisée.
      // une réponse en erreur lève une erreur avec le code HTTP seul ;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // type de contenu, image PNG par défaut ;
      const contentType = res.headers.get('content-type') || 'image/png';
      // ce n'est pas une image : erreur ;
      if (!contentType.startsWith('image/')) throw new Error('réponse qui n’est pas une image');
      // lit les octets ;
      const body = Buffer.from(await res.arrayBuffer());
      // trop lourde : erreur ;
      if (body.length > MAX_BYTES) throw new Error('tuile trop lourde');
      // renvoie la tuile.
      return { body, contentType };
    // Dans tous les cas,
    } finally {
      // arrête la minuterie.
      clearTimeout(timer);
    // Fin du bloc.
    }
  // Fin de download.
  }
// Fin du service.
}
