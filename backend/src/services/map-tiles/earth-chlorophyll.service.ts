// Outils NestJS : erreur 502, service injectable, journal.
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
// createRequire : fabrique un « require » pour charger un module CommonJS.
import { createRequire } from 'node:module';
// Adresses à essayer, lecture de la grille et pixels de l'image.
import { chlorophyllPixels, chlorophyllUrls, parseEsriAscii } from './earth-chlorophyll';

// Même chargement que earth-imagery.service.ts (module CommonJS natif).
// Charge la bibliothèque d'images sharp, sans typage (la ligne du dessous autorise ce « any » pour ESLint).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sharp = createRequire(__filename)('sharp') as any;

// Délai maximal d'un appel : 60 secondes (la grille fait environ 2 Mo de texte).
const TIMEOUT_MS = 60_000;
// Durée de garde : un jour (le composite est mensuel).
const REFRESH_MS = 24 * 3600_000;
// Après un échec, pas de nouvel essai avant une heure.
const RETRY_MS = 3600_000;

// Forme de l'image rendue : le PNG et le mois des données.
export interface ChlorophyllImage { png: Buffer; month: string }

/**
 * Image de la chlorophylle des océans (voir earth-chlorophyll.ts), gardée un jour en mémoire. Si ERDDAP est
 * injoignable, 502 : le navigateur garde les fonds marins sans couleur réelle.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de la chlorophylle.
export class EarthChlorophyllService {
  // Journal préfixé par « Chlorophylle ».
  private readonly log = new Logger('Chlorophylle');
  // Dernière image obtenue, avec son heure.
  private current: { at: number; image: ChlorophyllImage } | null = null;
  // Téléchargement en cours.
  private loading: Promise<ChlorophyllImage> | null = null;
  // Heure du dernier échec.
  private failedAt = 0;
  // Message du dernier échec.
  private lastError = '';

  // Constructeur : reçoit la fonction de téléchargement et la fonction qui donne l'heure ; corps vide.
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args), private readonly now: () => number = Date.now) {}

  // Méthode get : l'image du jour.
  get(): Promise<ChlorophyllImage> {
    // Image de moins d'un jour : on la rend.
    if (this.current && this.now() - this.current.at < REFRESH_MS) return Promise.resolve(this.current.image);
    // Téléchargement déjà en cours : on rend le même.
    if (this.loading) return this.loading;
    // Échec de moins d'une heure : l'ancienne image s'il y en a une, sinon erreur 502.
    if (this.now() - this.failedAt < RETRY_MS) return this.current ? Promise.resolve(this.current.image) : Promise.reject(new BadGatewayException(`Chlorophylle indisponible (${this.lastError}).`));
    // Lance le téléchargement ;
    this.loading = this.download()
      // en cas de succès : garde l'image avec l'heure ;
      .then((image) => { this.current = { at: this.now(), image }; return image; })
      // en cas d'échec :
      .catch((e) => {
        // note l'heure et le message ;
        this.failedAt = this.now(); this.lastError = e instanceof Error ? e.message : String(e);
        // l'écrit dans le journal ;
        this.log.warn(`ERDDAP indisponible : ${this.lastError}`);
        // rend l'ancienne image s'il y en a une, sinon erreur 502.
        if (this.current) return this.current.image;
        // Erreur 502.
        throw new BadGatewayException(`Chlorophylle indisponible (${this.lastError}).`);
      // Fin du traitement d'échec.
      })
      // Dans tous les cas, efface la marque « en cours ».
      .finally(() => { this.loading = null; });
    // Renvoie le téléchargement en cours.
    return this.loading;
  // Fin de get.
  }

  // Méthode privée download : essaie chaque adresse, la première grille lisible gagne.
  private async download(): Promise<ChlorophyllImage> {
    // Dernière erreur.
    let last: unknown = null;
    // Pour chaque adresse (début).
    for (const { url, month } of chlorophyllUrls(new Date(this.now()))) {
      // Essai (début).
      try {
        // Lit la grille.
        const grid = parseEsriAscii(await this.fetchText(url));
        // En fait une image grise avec transparence, en PNG.
        const png: Buffer = await sharp(Buffer.from(chlorophyllPixels(grid)), { raw: { width: grid.ncols, height: grid.nrows, channels: 2 } }).png({ compressionLevel: 9 }).toBuffer();
        // Le note dans le journal.
        this.log.log(`Chlorophylle chargée (${month}, ${grid.ncols} × ${grid.nrows}, ${png.length} octets).`);
        // Renvoie l'image et son mois.
        return { png, month };
      // En cas d'échec : garde l'erreur, adresse suivante.
      } catch (e) { last = e; }
    // Fin de la boucle.
    }
    // Aucune adresse n'a répondu : relance la dernière erreur.
    throw last ?? new Error('aucune adresse');
  // Fin de download.
  }

  // Méthode privée fetchText : appelle une adresse et rend son texte.
  private async fetchText(url: string): Promise<string> {
    // Contrôleur qui permet d'abandonner l'appel.
    const ctrl = new AbortController();
    // Minuterie : abandon au bout du délai.
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    // Essaie :
    try {
      // d'appeler l'adresse, en s'identifiant ;
      const res = await this.fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': 'GobaiWebService' } });
      // une réponse en erreur lève une erreur avec le code HTTP ;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // renvoie le texte.
      return await res.text();
    // Dans tous les cas,
    } finally {
      // arrête la minuterie.
      clearTimeout(timer);
    // Fin du bloc.
    }
  // Fin de fetchText.
  }
// Fin du service.
}
