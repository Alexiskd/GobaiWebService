// Importe les erreurs 400, 409 et 503 de NestJS.
import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
// Importe le type AppConfig, la configuration de l'application.
import type { AppConfig } from '../../common/configuration';
// Importe StripeCheckoutService, le service de paiement Stripe.
import { StripeCheckoutService } from './stripe-checkout.service';

// Déclare et exporte l'interface DonationStatus, l'état des dons (début).
export interface DonationStatus {
  // enabled : dons ouverts ou non.
  enabled: boolean;
  // environment : test ou production.
  environment: 'test' | 'production';
  // currency : la devise.
  currency: string;
  // minAmount : le montant minimal, en euros.
  minAmount: number;
// Fin de DonationStatus.
}

// cents : convertit des euros en centimes entiers.
const cents = (euros: number) => Math.round(euros * 100);
// euros : convertit des centimes en euros.
const euros = (c: number) => c / 100;

/**
 * Dons par carte bancaire (Stripe Checkout), sans objectif ni limite :
 *  1. `createOrder` crée la page de paiement Stripe (montant fixé ici, côté serveur) ;
 *  2. le donateur paie sur la page hébergée par Stripe, puis revient sur le site ;
 *  3. `capture` demande à Stripe si le paiement a abouti, pour remercier le donateur.
 * Rien n'est enregistré ici : l'historique des dons est celui du tableau de bord Stripe.
 */
// Déclare et exporte la classe DonationsService (début).
export class DonationsService {
  // Constructeur (début) :
  constructor(
    // la configuration des dons
    private readonly config: AppConfig['donations'],
    // et le service Stripe.
    private readonly stripe: StripeCheckoutService,
  // Fin du constructeur.
  ) {}

  // status : l'état des dons (début).
  status(): DonationStatus {
    // Renvoie (début)
    return {
      // si Stripe est configuré,
      enabled: this.stripe.isConfigured(),
      // l'environnement,
      environment: this.stripe.environment(),
      // la devise
      currency: this.config.currency,
      // et le montant minimal en euros.
      minAmount: euros(this.config.minAmountCents),
    // Fin de l'état.
    };
  // Fin de status.
  }

  /** `origin` : en-tête Origin du navigateur, pour revenir sur le site d'où vient le don (s'il est autorisé). */
  // createOrder, asynchrone : crée un don et renvoie l'adresse de paiement (début).
  async createOrder(amount: number, origin?: string): Promise<{ id: string; url: string }> {
    // Stripe non configuré : erreur 503.
    if (!this.stripe.isConfigured()) throw new ServiceUnavailableException('Les dons ne sont pas encore ouverts.');
    // Montant demandé, en centimes.
    const want = cents(amount);
    // Sous le minimum (début).
    if (want < this.config.minAmountCents) {
      // Erreur 400 avec le montant minimal.
      throw new BadRequestException(`Montant minimum : ${euros(this.config.minAmountCents)} €.`);
    // Fin de ce cas.
    }
    // Site de retour.
    const site = this.returnSite(origin);
    // Crée la session de paiement (début) :
    const session = await this.stripe.createSession(
      // le montant, la devise et le libellé,
      want, this.config.currency, 'Don Gobai Space',
      // l'adresse de retour après paiement et celle après abandon.
      `${site}/?don=merci&session_id={CHECKOUT_SESSION_ID}`, `${site}/?don=annule`,
    // Fin de la création.
    );
    // Sans adresse de page : erreur 503.
    if (!session.url) throw new ServiceUnavailableException('Stripe n’a pas renvoyé de page de paiement.');
    // Renvoie l'identifiant et l'adresse.
    return { id: session.id, url: session.url };
  // Fin de createOrder.
  }

  /** Au retour du donateur : confirme auprès de Stripe que le don est payé. */
  // capture, asynchrone : confirme qu'un don est payé (début).
  async capture(orderId: string): Promise<{ status: string; amount: number }> {
    // Lit la session chez Stripe.
    const session = await this.stripe.getSession(orderId);
    // Non payée : erreur 409.
    if (!session.paid) throw new ConflictException('Le paiement n’a pas abouti : rien n’a été prélevé.');
    // Renvoie « COMPLETED » et le montant en euros.
    return { status: 'COMPLETED', amount: euros(session.cents) };
  // Fin de capture.
  }

  /** Le donateur a quitté la page de paiement : on la ferme, pour qu'elle ne puisse plus servir (sauf s'il a payé). */
  // cancel, asynchrone : abandonne un don (début).
  async cancel(orderId: string): Promise<{ status: string }> {
    // Lit la session chez Stripe.
    let session = await this.stripe.getSession(orderId);
    // Si elle est encore ouverte (début).
    if (session.status === 'open') {
      // Entre la lecture et la fermeture, le paiement a pu aboutir : Stripe refuse alors de fermer, on relit.
      session = await this.stripe.expireSession(orderId).catch(() => this.stripe.getSession(orderId));
    // Fin de ce cas.
    }
    // Renvoie « COMPLETED » si elle est payée, sinon « CANCELLED ».
    return { status: session.paid ? 'COMPLETED' : 'CANCELLED' };
  // Fin de cancel.
  }

  /** Site vers lequel Stripe renvoie le donateur : celui d'où vient la demande s'il est autorisé, sinon le site principal. */
  // returnSite, privée : le site vers lequel Stripe renvoie le donateur (début).
  private returnSite(origin?: string): string {
    // Sites autorisés.
    const sites = this.config.siteUrls;
    // Origine de la demande, sans barre finale.
    const from = origin?.replace(/\/+$/, '');
    // Origine autorisée : c'est elle.
    if (from && sites.includes(from)) return from;
    // En mode test, le développement local est accepté.
    if (from && this.stripe.environment() === 'test' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(from)) return from;
    // Sinon : le site principal.
    return sites[0];
  // Fin de returnSite.
  }
// Fin de la classe DonationsService.
}
