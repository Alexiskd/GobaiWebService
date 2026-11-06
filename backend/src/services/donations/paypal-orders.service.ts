import { BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { ApiError, CheckoutPaymentIntent, Client, Environment, OrdersController } from '@paypal/paypal-server-sdk';

/**
 * Commandes PayPal (API Orders v2) via le SDK serveur officiel `@paypal/paypal-server-sdk`.
 * Le montant est fixé ici, côté serveur : le navigateur ne peut pas le modifier.
 */
export interface PaypalConfig {
  clientId?: string;
  clientSecret?: string;
  environment: 'sandbox' | 'production';
}

export interface CapturedPayment {
  status: string;
  captureId: string | null;
  cents: number;
  currency: string;
}

export class PaypalOrdersService {
  private readonly orders: OrdersController | null;

  constructor(private readonly config: PaypalConfig) {
    this.orders = this.isConfigured()
      ? new OrdersController(new Client({
        clientCredentialsAuthCredentials: { oAuthClientId: config.clientId!, oAuthClientSecret: config.clientSecret! },
        environment: config.environment === 'production' ? Environment.Production : Environment.Sandbox,
        timeout: 15_000,
      }))
      : null;
  }

  isConfigured(): boolean {
    return Boolean(this.config.clientId && this.config.clientSecret);
  }

  /** Crée une commande et renvoie son identifiant (à passer aux boutons PayPal du navigateur). */
  async createOrder(cents: number, currency: string, description: string): Promise<string> {
    const data = await this.call(() => this.controller().createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [{
          amount: { currencyCode: currency, value: (cents / 100).toFixed(2) },
          description,
        }],
      },
      prefer: 'return=minimal',
    }));
    if (!data?.id) throw new BadGatewayException('PayPal n’a pas renvoyé d’identifiant de commande.');
    return data.id as string;
  }

  /** Encaisse une commande approuvée par le donateur. */
  async captureOrder(orderId: string): Promise<CapturedPayment> {
    const data = await this.call(() => this.controller().captureOrder({ id: orderId, prefer: 'return=representation' }));
    const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];
    return {
      status: String(capture?.status ?? data?.status ?? 'UNKNOWN'),
      captureId: capture?.id ?? null,
      cents: capture ? Math.round(Number(capture.amount?.value) * 100) : 0,
      currency: capture?.amount?.currency_code ?? '',
    };
  }

  private controller(): OrdersController {
    if (!this.orders) throw new BadGatewayException('PayPal n’est pas configuré sur le serveur.');
    return this.orders;
  }

  /** Appel au SDK : renvoie le JSON brut de PayPal, traduit les erreurs en messages lisibles. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async call(fn: () => Promise<{ body: unknown }>): Promise<any> {
    try {
      const { body } = await fn();
      return typeof body === 'string' ? JSON.parse(body) : body;
    } catch (e) {
      if (e instanceof ApiError) {
        let issue = '';
        try {
          const parsed = JSON.parse(String(e.body));
          issue = parsed?.details?.[0]?.issue ?? parsed?.name ?? '';
        } catch { /* corps non JSON */ }
        if (issue === 'INSTRUMENT_DECLINED') {
          throw new UnprocessableEntityException('Moyen de paiement refusé par PayPal : choisis-en un autre.');
        }
        if (issue === 'ORDER_NOT_APPROVED') throw new UnprocessableEntityException('Le don n’a pas été validé dans PayPal.');
        throw new BadGatewayException(`PayPal a refusé la demande (${e.statusCode}${issue ? ` ${issue}` : ''}).`);
      }
      throw new BadGatewayException(`PayPal injoignable : ${(e as Error).message}`);
    }
  }
}
