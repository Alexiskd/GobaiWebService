/**
 * Vente des exports : page de paiement Stripe, puis jeton JWT qui ouvre les routes payantes.
 *
 *   1. `catalogue()`      → ce qui est vendu et à quel prix ;
 *   2. `createOrder()`    → crée la page de paiement Stripe et renvoie son adresse ;
 *   3. `claim()`          → au retour de l'acheteur, vérifie auprès de Stripe que le paiement a abouti,
 *                           puis signe un jeton JWT portant les droits achetés.
 *
 * Tout achat se fait depuis un compte connecté : la page de paiement Stripe est créée pour ce compte, et le
 * paiement ne peut être réclamé que par lui. L'achat est enregistré (services/store/licences.service) pour que
 * l'acheteur retrouve ses droits sur n'importe quel appareil ; le jeton lui-même n'est pas conservé — il porte
 * les droits, l'acheteur, l'expiration et la référence du paiement, et se redemande à volonté.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { signJwt } from '../../common/jwt';
import { JWT_AUDIENCE, JWT_ISSUER, accessSecret } from '../../common/jwt.guard';
import { StripeCheckoutService } from '../donations/stripe-checkout.service';
import { CURRENCY, LICENCE_SECONDS, MAX_ORBIT_HOURS, Product, buildCatalogue, formatPrice, priceFor, productById } from './catalogue';
import { LicencesService, StoredLicence } from './licences.service';

/** Le compte acheteur, tel que la boutique le reçoit du service des comptes. */
export interface Buyer { id: string; name: string }

/** Un achat abouti : le jeton et ce qu'il ouvre. */
export interface Licence {
  /** Le jeton JWT à présenter dans l'en-tête `Authorization: Bearer`. */
  token: string;
  /** Droits accordés. */
  scopes: string[];
  /** Nombre d'heures payées, pour une location ; 1 pour un article à prix fixe. */
  hours: number;
  /** Expiration, en ISO 8601. */
  expiresAt: string;
  /** Article acheté. */
  product: { id: string; label: string; price: string };
  /** Compte acheteur. */
  buyer: { id: string; name: string };
  /** Identifiant de la session de paiement Stripe, pour retrouver le reçu. */
  payment: string;
}

// Service injecté par NestJS.
@Injectable()
// Classe du service de la boutique.
export class StoreService {
  // Constructeur : NestJS y injecte le client Stripe et le registre des achats.
  constructor(private readonly stripe: StripeCheckoutService, private readonly licences: LicencesService) {}

  /** Les achats sont-ils enregistrés durablement (PostgreSQL) ? */
  get persistent(): boolean { return this.licences.persistent; }

  /** Le catalogue et l'état du paiement. */
  catalogue(sites: readonly string[] = []) {
    // Les articles, avec leur prix mis en forme.
    const products = buildCatalogue().map((p) => ({ ...p, price: formatPrice(p.cents) }));
    // Le catalogue complet.
    return {
      // Le paiement est ouvert si Stripe et la clé de signature sont tous deux configurés.
      enabled: this.stripe.isConfigured() && Boolean(accessSecret()),
      environment: this.stripe.environment(),
      currency: CURRENCY,
      licenceDays: LICENCE_SECONDS / 86_400,
      products,
      sites: [...sites],
      // Ce qui manque pour que le paiement s'ouvre : vide quand tout est en place.
      missing: this.missingConfiguration(),
      // Les achats survivent-ils à un redémarrage ?
      persistent: this.licences.persistent,
    };
  // Fin de catalogue.
  }

  /** Ce qui empêche le paiement de s'ouvrir, nommé variable par variable. Vide quand tout est configuré. */
  missingConfiguration(): string[] {
    // La liste de ce qui manque.
    const missing: string[] = [];
    // La clé secrète Stripe : sans elle, aucune page de paiement ne peut être créée.
    if (!this.stripe.isConfigured()) missing.push('STRIPE_SECRET_KEY');
    // La clé de signature : sans elle, un paiement réussi ne donnerait aucun jeton.
    if (!accessSecret()) missing.push('SESSION_SECRET');
    // Ce qui manque.
    return missing;
  // Fin de missingConfiguration.
  }

  /**
   * Crée la page de paiement d'un article. `site` : l'adresse où ramener l'acheteur.
   * `hours` : pour un article loué à l'heure, le nombre d'heures achetées — le montant et la durée du jeton
   * en découlent. Le nombre d'heures est inscrit chez Stripe avec l'article, pour être relu à la réclamation.
   */
  async createOrder(productId: string, site: string, hours = 1, buyer?: Buyer): Promise<{ id: string; url: string; product: Product; hours: number; cents: number }> {
    // Le paiement doit être ouvert.
    if (!this.stripe.isConfigured()) throw new ServiceUnavailableException('Le paiement n’est pas configuré sur ce serveur.');
    // La clé de signature doit exister, sinon l'achat ne donnerait aucun jeton.
    if (!accessSecret()) throw new ServiceUnavailableException('La clé de signature des jetons n’est pas configurée (SESSION_SECRET).');
    // L'article.
    const product = productById(productId, buildCatalogue());
    // Inconnu.
    if (!product) throw new NotFoundException(`Article inconnu : « ${productId} ».`);
    // Nombre d'heures retenu : une seule pour un article à prix fixe, sinon celui demandé, borné.
    const n = product.hourly ? Math.max(1, Math.min(MAX_ORBIT_HOURS, Math.floor(hours))) : 1;
    // Montant à payer.
    const cents = priceFor(product, n);
    // Intitulé : il porte la durée, pour que le reçu Stripe soit lisible.
    const label = product.hourly ? `Gobai Space — ${product.label} (${n} h)` : `Gobai Space — ${product.label}`;
    // La page de paiement Stripe, avec le retour sur le site.
    const session = await this.stripe.createSession(
      cents, CURRENCY, label,
      `${site}/?achat=ok&session_id={CHECKOUT_SESSION_ID}`, `${site}/?achat=annule`,
      // La référence enregistrée par Stripe dit quel article a été payé, pour combien d'heures, et par quel
      // compte ; elle ne peut plus changer ensuite, donc le navigateur ne peut réclamer ni un article plus
      // cher, ni plus d'heures, ni l'achat de quelqu'un d'autre.
      `${product.id}:${n}:${buyer?.id ?? ''}`,
    );
    // Stripe doit renvoyer une adresse de paiement.
    if (!session.url) throw new ServiceUnavailableException('Stripe n’a pas renvoyé de page de paiement.');
    // La commande.
    return { id: session.id, url: session.url, product, hours: n, cents };
  // Fin de createOrder.
  }

  /**
   * Au retour de l'acheteur : vérifie le paiement auprès de Stripe, enregistre l'achat et signe le jeton.
   * `buyer` est le compte connecté : il doit être celui qui a créé la page de paiement.
   */
  async claim(sessionId: string, buyer: Buyer): Promise<Licence> {
    // Identifiant plausible.
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new BadRequestException('Identifiant de session de paiement inattendu.');
    // La session telle que Stripe la voit.
    const session = await this.stripe.getSession(sessionId);
    // Le paiement doit avoir abouti : c'est Stripe qui fait foi, jamais le navigateur.
    if (!session.paid) throw new ConflictException('Paiement non abouti : aucun accès n’est délivré.');
    // L'article, la durée et le compte acheteur sont ceux que Stripe a enregistrés à la création de la page de
    // paiement : le navigateur ne peut donc pas réclamer un article plus cher, ni plus d'heures, que ce qu'il a
    // payé, ni l'achat d'un autre compte.
    const [id, hoursText, accountId] = (session.reference ?? '').split(':');
    // Le paiement appartient à un autre compte : refus net.
    if (accountId && accountId !== buyer.id) throw new ForbiddenException('Ce paiement a été fait par un autre compte : connectez-vous avec celui-là pour récupérer son jeton.');
    // L'article du catalogue courant.
    const product = id ? productById(id, buildCatalogue()) : null;
    // Référence absente ou inconnue : le paiement existe mais ne correspond à rien du catalogue courant.
    if (!product) throw new ConflictException('Ce paiement ne correspond à aucun article du catalogue.');
    // Nombre d'heures payées, borné comme à l'achat.
    const hours = product.hourly ? Math.max(1, Math.min(MAX_ORBIT_HOURS, Math.floor(Number(hoursText) || 1))) : 1;
    // Durée de validité du jeton : les heures achetées pour une location, un an pour un article à prix fixe.
    const seconds = product.hourly ? hours * 3600 : LICENCE_SECONDS;
    // La clé de signature.
    const secret = accessSecret();
    // Sans elle, aucun jeton ne peut être signé.
    if (!secret) throw new ServiceUnavailableException('La clé de signature des jetons n’est pas configurée (SESSION_SECRET).');
    // Enregistre l'achat ; un même paiement ne donne jamais deux achats, même si la page de retour est rechargée.
    const stored = await this.licences.record({
      accountId: buyer.id,
      productId: product.id,
      hours,
      scopes: product.scopes,
      payment: sessionId,
      cents: session.cents || priceFor(product, hours),
      expiresAt: new Date(Date.now() + seconds * 1000),
    });
    // Le jeton de cet achat.
    return this.licenceOf(stored, buyer, secret);
  // Fin de claim.
  }

  /** Les achats d'un compte connecté, chacun avec un jeton frais pour ce qui n'est pas expiré. */
  async licencesOf(buyer: Buyer): Promise<Licence[]> {
    // La clé de signature.
    const secret = accessSecret();
    // Sans elle, aucun jeton ne peut être signé.
    if (!secret) throw new ServiceUnavailableException('La clé de signature des jetons n’est pas configurée (SESSION_SECRET).');
    // Les achats enregistrés, les expirés écartés.
    const stored = (await this.licences.listOf(buyer.id)).filter((l) => l.expiresAt.getTime() > Date.now());
    // Un jeton par achat.
    return stored.map((l) => this.licenceOf(l, buyer, secret));
  // Fin de licencesOf.
  }

  /**
   * Jeton d'un achat enregistré : il expire à la date de l'achat, pas plus tard. Un jeton redemandé ne
   * prolonge donc rien — une location d'une heure reste une heure, même réclamée dix fois.
   */
  private licenceOf(stored: StoredLicence, buyer: Buyer, secret: string): Licence {
    // Secondes restantes, jamais négatives.
    const seconds = Math.max(1, Math.floor((stored.expiresAt.getTime() - Date.now()) / 1000));
    // L'article du catalogue courant, pour son intitulé ; absent, on retombe sur son identifiant.
    const product = productById(stored.productId, buildCatalogue());
    // Le jeton, qui porte les droits achetés, l'acheteur, la durée payée et la référence du paiement.
    const token = signJwt(
      { scope: stored.scopes, product: stored.productId, hours: stored.hours, payment: stored.payment, sub: buyer.id, buyer: buyer.name },
      secret,
      { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresInSeconds: seconds, now: Date.now() },
    );
    // L'accès délivré.
    return {
      token,
      scopes: stored.scopes,
      hours: stored.hours,
      expiresAt: stored.expiresAt.toISOString(),
      product: { id: stored.productId, label: product?.label ?? stored.productId, price: formatPrice(stored.cents) },
      buyer: { id: buyer.id, name: buyer.name },
      payment: stored.payment,
    };
  // Fin de licenceOf.
  }
// Fin du service.
}
