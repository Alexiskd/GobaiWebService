// Importe BadGatewayException, l'erreur 502 de NestJS.
import { BadGatewayException } from '@nestjs/common';

/**
 * Paiement des dons par carte bancaire via Stripe Checkout (page de paiement hébergée par Stripe).
 * Appels directs à l'API REST de Stripe (https://docs.stripe.com/api/checkout/sessions) : aucune dépendance à installer.
 * Le montant est fixé ici, côté serveur : le navigateur ne peut pas le modifier, et ne voit jamais la clé secrète.
 */
// Déclare et exporte l'interface StripeConfig (début).
export interface StripeConfig {
  // secretKey : la clé secrète Stripe, facultative.
  secretKey?: string;
// Fin de StripeConfig.
}

// Déclare et exporte l'interface CheckoutSession, une session de paiement (début).
export interface CheckoutSession {
  // id : son identifiant.
  id: string;
  /** Adresse de la page de paiement (tant que la session est ouverte). */
  // url : l'adresse de la page de paiement, ou null.
  url: string | null;
  /** `open` : en attente du donateur ; `complete` : terminée ; `expired` : abandonnée. */
  // status : son état.
  status: 'open' | 'complete' | 'expired' | string;
  // paid : vrai si le paiement a abouti.
  paid: boolean;
  // cents : le montant total, en centimes.
  cents: number;
  // currency : la devise.
  currency: string;
  // paymentIntentId : l'identifiant du paiement chez Stripe, ou null.
  paymentIntentId: string | null;
  /** Référence libre posée à la création (`client_reference_id`) : dit ce qui a été acheté. */
  reference: string | null;
// Fin de CheckoutSession.
}

/** Durée de vie d'une page de paiement : 30 min est le minimum accepté par Stripe, plus une marge. */
// Déclare et exporte la durée de vie d'une page de paiement : 31 minutes.
export const CHECKOUT_TTL_MS = 31 * 60 * 1000;

// Adresse de l'API de Stripe.
const API = 'https://api.stripe.com/v1';

// Déclare et exporte la classe StripeCheckoutService (début).
export class StripeCheckoutService {
  // Constructeur (début) :
  constructor(
    // la configuration Stripe,
    private readonly config: StripeConfig,
    // la fonction de requête, fetch par défaut,
    private readonly fetcher: typeof fetch = fetch,
    // et l'horloge, Date.now par défaut.
    private readonly now: () => number = Date.now,
  // Fin du constructeur.
  ) {}

  // isConfigured : Stripe est-il configuré (début).
  isConfigured(): boolean {
    // Vrai s'il y a une clé secrète.
    return Boolean(this.config.secretKey);
  // Fin de isConfigured.
  }

  /** Vrais paiements (clé `sk_live_…` ou `rk_live_…`) ou mode test de Stripe. */
  // environment : production ou test (début).
  environment(): 'test' | 'production' {
    // Production si la clé commence par « sk_live_ » ou « rk_live_ », sinon test.
    return /^[sr]k_live_/.test(this.config.secretKey ?? '') ? 'production' : 'test';
  // Fin de environment.
  }

  /**
   * Crée une page de paiement ; `successUrl` peut contenir `{CHECKOUT_SESSION_ID}`.
   * `reference` : ce qui est acheté, enregistré par Stripe — sans elle, la page est celle d'un don.
   */
  // createSession : crée la page de paiement d'un don (début).
  createSession(cents: number, currency: string, label: string, successUrl: string, cancelUrl: string, reference?: string): Promise<CheckoutSession> {
    // Appelle POST /checkout/sessions avec (début) :
    return this.call('POST', '/checkout/sessions', {
      // un paiement unique,
      mode: 'payment',
      // un bouton « Faire un don » pour un don, « Payer » pour un achat,
      submit_type: reference ? 'pay' : 'donate',
      // la référence de ce qui est acheté, enregistrée par Stripe et non modifiable ensuite,
      ...(reference ? { client_reference_id: reference } : {}),
      // la page en français,
      locale: 'fr',
      // l'adresse de retour après paiement,
      success_url: successUrl,
      // l'adresse de retour après abandon,
      cancel_url: cancelUrl,
      // l'instant d'expiration, en secondes,
      expires_at: String(Math.floor((this.now() + CHECKOUT_TTL_MS) / 1000)),
      // une seule ligne, en un exemplaire,
      'line_items[0][quantity]': '1',
      // sa devise, en minuscules,
      'line_items[0][price_data][currency]': currency.toLowerCase(),
      // son montant en centimes,
      'line_items[0][price_data][unit_amount]': String(cents),
      // et son libellé.
      'line_items[0][price_data][product_data][name]': label,
    // Fin de l'appel.
    });
  // Fin de createSession.
  }

  // getSession : lit une session de paiement (début).
  getSession(id: string): Promise<CheckoutSession> {
    // Appelle GET /checkout/sessions/{id}.
    return this.call('GET', `/checkout/sessions/${encodeURIComponent(id)}`);
  // Fin de getSession.
  }

  /** Ferme une page de paiement encore ouverte : le donateur ne peut plus payer avec. */
  // expireSession : ferme une page de paiement encore ouverte (début).
  expireSession(id: string): Promise<CheckoutSession> {
    // Appelle POST /checkout/sessions/{id}/expire.
    return this.call('POST', `/checkout/sessions/${encodeURIComponent(id)}/expire`, {});
  // Fin de expireSession.
  }

  // call, privée et asynchrone : envoie une requête à Stripe (début).
  private async call(method: 'GET' | 'POST', path: string, form?: Record<string, string>): Promise<CheckoutSession> {
    // Sans clé secrète : erreur 502.
    if (!this.config.secretKey) throw new BadGatewayException('Stripe n’est pas configuré sur le serveur.');
    // Réponse de Stripe.
    let res: Response;
    // Essai (début).
    try {
      // Envoie la requête (début) :
      res = await this.fetcher(`${API}${path}`, {
        // la méthode,
        method,
        // les en-têtes (début) :
        headers: {
          // la clé secrète en jeton,
          Authorization: `Bearer ${this.config.secretKey}`,
          // et le type de formulaire, s'il y a des champs ;
          ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        // fin des en-têtes ;
        },
        // les champs encodés, s'il y en a ;
        body: form ? new URLSearchParams(form).toString() : undefined,
        // abandon après 15 secondes.
        signal: AbortSignal.timeout(15_000),
      // Fin de la requête.
      });
    // En cas d'erreur (début).
    } catch (e) {
      // Erreur 502 « Stripe injoignable ».
      throw new BadGatewayException(`Stripe injoignable : ${(e as Error).message}`);
    // Fin de l'essai.
    }
    // Lit le JSON de la réponse ; null s'il est illisible.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json().catch(() => null);
    // Réponse en erreur, ou sans identifiant (début).
    if (!res.ok || !data?.id) {
      // Le code d'erreur de Stripe suffit au diagnostic ; son message peut contenir des détails du compte.
      const code = data?.error?.code ?? data?.error?.type ?? '';
      // Erreur 502 avec le code HTTP et le code d'erreur de Stripe.
      throw new BadGatewayException(`Stripe a refusé la demande (${res.status}${code ? ` ${code}` : ''}).`);
    // Fin de ce cas.
    }
    // Renvoie la session (début) :
    return {
      // son identifiant,
      id: String(data.id),
      // l'adresse de la page, ou null,
      url: typeof data.url === 'string' ? data.url : null,
      // son état,
      status: String(data.status ?? ''),
      // payée ou non,
      paid: data.payment_status === 'paid',
      // la référence posée à la création, ou rien,
      reference: typeof data.client_reference_id === 'string' ? data.client_reference_id : null,
      // le montant en centimes, ou 0,
      cents: Number(data.amount_total) || 0,
      // la devise, en majuscules,
      currency: String(data.currency ?? '').toUpperCase(),
      // l'identifiant du paiement, ou null.
      paymentIntentId: typeof data.payment_intent === 'string' ? data.payment_intent : null,
    // Fin de la session.
    };
  // Fin de call.
  }
// Fin de la classe StripeCheckoutService.
}
