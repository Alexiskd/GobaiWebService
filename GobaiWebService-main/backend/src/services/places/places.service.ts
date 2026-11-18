// Outils NestJS : erreur 502, injection par jeton, service injectable.
import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from '../../modules/config.module';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Types (effacés à la compilation) d'un lieu et de la réponse.
import type { PlaceDto, PlacesDto } from '../../dto/places.dto';
// Fonctions de recherche d'adresses et type d'un résultat Photon.
import { addressItems, looksLikeAddress, type PhotonFeature } from './address';

// Adresse de l'API Photon.
const PHOTON_API = 'https://photon.komoot.io/api/';
// Délai maximal d'un appel : 8 secondes.
const TIMEOUT_MS = 8000;
// Mention à afficher avec les résultats.
const ATTRIBUTION = '© contributeurs OpenStreetMap · Photon (komoot)';

/** Types OpenStreetMap `place=*` gardés par la recherche Photon : toutes les localités habitées. */
// Types de lieux OpenStreetMap gardés : ville, bourg, village, hameau, commune, quartiers et lieux-dits.
const SETTLEMENTS = ['city', 'town', 'village', 'hamlet', 'municipality', 'suburb', 'borough', 'quarter', 'locality', 'isolated_dwelling'];

/**
 * Recherche de villes et lieux du monde entier : Photon (géocodeur OpenStreetMap de komoot, sans clé), limité aux
 * localités habitées (ville, bourg, village, hameau…), plus les adresses quand le texte ressemble à une adresse.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de recherche de lieux.
export class PlacesService {
  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    // la fonction de téléchargement, fetch par défaut.
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  // Corps du constructeur vide.
  ) {}

  /**
   * Localités, et adresses (rue, numéro) quand le texte y ressemble : les deux recherches partent ensemble, et une
   * panne de l'une laisse les résultats de l'autre. Les adresses passent devant (c'est ce qui a été demandé).
   */
  // Méthode find : reçoit le texte cherché et le nombre de résultats, 8 par défaut.
  async find(q: string, limit = 8): Promise<PlacesDto> {
    // Le texte ne ressemble pas à une adresse : recherche de localités seule.
    if (!looksLikeAddress(q)) return this.findPhoton(q, limit);
    // Sinon lance les deux recherches en même temps et attend que chacune ait fini, réussie ou non.
    const [addresses, places] = await Promise.allSettled([this.findAddresses(q, limit), this.findPhoton(q, limit)]);
    // Les deux ont échoué : on transmet l'erreur de la recherche de localités.
    if (addresses.status === 'rejected' && places.status === 'rejected') throw places.reason;
    // Adresses trouvées, liste vide si cette recherche a échoué.
    const first: PlaceDto[] = addresses.status === 'fulfilled' ? addresses.value : [];
    // Localités trouvées, liste vide si cette recherche a échoué.
    const rest: PlaceDto[] = places.status === 'fulfilled' ? places.value.items : [];
    // Renvoie les adresses puis les localités, coupées à la limite.
    return { provider: 'photon', items: [...first, ...rest].slice(0, limit), attribution: ATTRIBUTION };
  // Fin de find.
  }

  /** Photon sans filtre de type : maisons numérotées et voies du monde entier. */
  // Méthode privée findAddresses.
  private async findAddresses(q: string, limit: number): Promise<PlaceDto[]> {
    // Paramètres de la requête : le texte, deux fois plus de résultats que demandé (15 au plus) pour compenser les doublons, en français.
    const qs = new URLSearchParams({ q, limit: String(Math.min(15, limit * 2)), lang: 'fr' });
    // Réponse HTTP.
    let res: Response;
    // Essaie
    try {
      // d'appeler Photon, avec :
      res = await this.fetchFn(`${PHOTON_API}?${qs}`, {
        // un en-tête qui identifie l'application et demande du JSON ;
        headers: { 'User-Agent': 'GobaiWebService (recherche d’adresses)', Accept: 'application/json' },
        // un abandon au bout du délai.
        signal: AbortSignal.timeout(TIMEOUT_MS),
      // Fin de l'appel.
      });
    // Échec réseau : erreur 502.
    } catch { throw new BadGatewayException('Recherche OpenStreetMap (Photon) injoignable.'); }
    // Réponse en erreur : erreur 502 avec le code reçu.
    if (!res.ok) throw new BadGatewayException(`Recherche OpenStreetMap (Photon) a répondu ${res.status}.`);
    // Lit le JSON.
    const body = await res.json() as { features?: PhotonFeature[] };
    // Renvoie les adresses, sans doublon, à la limite.
    return addressItems(body.features, limit);
  // Fin de findAddresses.
  }

  /** Photon (OpenStreetMap) : toutes les localités du monde, avec région et pays, sans clé. */
  // Méthode privée findPhoton.
  private async findPhoton(q: string, limit: number): Promise<PlacesDto> {
    // Paramètres de la requête : le texte, deux fois plus de résultats que demandé (10 au plus), en français.
    const qs = new URLSearchParams({ q, limit: String(Math.min(10, limit * 2)), lang: 'fr' });
    // Ajoute un filtre par type de localité gardé.
    for (const v of SETTLEMENTS) qs.append('osm_tag', `place:${v}`);
    // Réponse HTTP.
    let res: Response;
    // Essaie
    try {
      // d'appeler Photon, avec :
      res = await this.fetchFn(`${PHOTON_API}?${qs}`, {
        // un en-tête qui identifie l'application et demande du JSON ;
        headers: { 'User-Agent': 'GobaiWebService (recherche de villes)', Accept: 'application/json' },
        // un abandon au bout du délai.
        signal: AbortSignal.timeout(TIMEOUT_MS),
      // Fin de l'appel.
      });
    // Échec réseau : erreur 502.
    } catch { throw new BadGatewayException('Recherche OpenStreetMap (Photon) injoignable.'); }
    // Réponse en erreur : erreur 502 avec le code reçu.
    if (!res.ok) throw new BadGatewayException(`Recherche OpenStreetMap (Photon) a répondu ${res.status}.`);
    // Lit le JSON, vu comme
    const body = await res.json() as {
      // une liste de résultats avec position et propriétés.
      features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> }>;
    // Fin du type.
    };
    // Lieux déjà vus.
    const seen = new Set<string>();
    // Lieux produits.
    const items = [];
    // Pour chaque résultat :
    for (const f of body.features ?? []) {
      // ses propriétés ;
      const p = f.properties ?? {};
      // sa longitude et sa latitude ;
      const [lon, lat] = f.geometry?.coordinates ?? [NaN, NaN];
      // sans nom ou sans coordonnées valides : on passe.
      if (!p.name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      // Contexte : comté, région, pays, sans les morceaux vides, ceux qui répètent le nom, ni les doublons.
      const context = [p.county, p.state, p.country].filter((v, i, a) => v && v !== p.name && a.indexOf(v) === i).join(', ');
      // Clé du lieu : nom et contexte.
      const key = `${p.name}|${context}`;
      // Déjà vu : on passe.
      if (seen.has(key)) continue;
      // On le note,
      seen.add(key);
      // on l'ajoute,
      items.push({ name: p.name, context, lon, lat });
      // et on s'arrête à la limite.
      if (items.length >= limit) break;
    // Fin de la boucle.
    }
    // Renvoie le fournisseur, les lieux et la mention.
    return { provider: 'photon', items, attribution: ATTRIBUTION };
  // Fin de findPhoton.
  }
// Fin du service.
}
