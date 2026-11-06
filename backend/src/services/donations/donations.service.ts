import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { AppConfig } from '../../common/configuration';
import { DonationLedgerService } from './donation-ledger.service';
import { donationPeriod } from './donation-period';
import { PaypalOrdersService } from './paypal-orders.service';

export interface DonationStatus {
  enabled: boolean;
  clientId: string | null;
  environment: 'sandbox' | 'production';
  currency: string;
  month: string;
  resetsAt: string;
  timeZone: string;
  monthlyLimit: number;
  raised: number;
  remaining: number;
  minAmount: number;
}

const cents = (euros: number) => Math.round(euros * 100);
const euros = (c: number) => c / 100;

/**
 * Dons PayPal plafonnés par mois civil :
 *  1. `createOrder` vérifie le reste du mois (réservations comprises), crée la commande PayPal et réserve le montant ;
 *  2. le donateur approuve dans la fenêtre PayPal ;
 *  3. `capture` revérifie le plafond du mois en cours (cas d'un don à cheval sur deux mois) puis encaisse.
 * Si le plafond est atteint entre-temps, la commande n'est pas encaissée : le donateur n'est pas débité.
 */
export class DonationsService {
  constructor(
    private readonly config: AppConfig['donations'],
    private readonly paypal: PaypalOrdersService,
    private readonly ledger: DonationLedgerService,
    private readonly now: () => number = Date.now,
  ) {}

  private period() {
    return donationPeriod(this.now(), this.config.timeZone);
  }

  async status(): Promise<DonationStatus> {
    const period = this.period();
    const { raised, committed } = await this.ledger.transaction((entries) => ({
      raised: DonationLedgerService.raised(entries, period.month),
      committed: DonationLedgerService.committed(entries, period.month),
    }));
    return {
      enabled: this.paypal.isConfigured(),
      clientId: this.paypal.isConfigured() ? this.config.paypal.clientId! : null,
      environment: this.config.paypal.environment,
      currency: this.config.currency,
      month: period.month,
      resetsAt: period.resetsAt,
      timeZone: this.config.timeZone,
      monthlyLimit: euros(this.config.monthlyLimitCents),
      raised: euros(raised),
      remaining: euros(Math.max(0, this.config.monthlyLimitCents - committed)),
      minAmount: euros(this.config.minAmountCents),
    };
  }

  async createOrder(amount: number): Promise<{ id: string }> {
    if (!this.paypal.isConfigured()) throw new ServiceUnavailableException('Les dons ne sont pas encore ouverts.');
    const want = cents(amount);
    if (want < this.config.minAmountCents) {
      throw new BadRequestException(`Montant minimum : ${euros(this.config.minAmountCents)} €.`);
    }
    const period = this.period();
    return this.ledger.transaction(async (entries) => {
      const left = this.config.monthlyLimitCents - DonationLedgerService.committed(entries, period.month);
      if (left <= 0) throw new ConflictException(`La collecte de ce mois est complète. Reprise le ${frenchDate(period.resetsAt, this.config.timeZone)}.`);
      if (want > left) throw new ConflictException(`Il reste ${euros(left).toFixed(2)} € à collecter ce mois-ci.`);
      const id = await this.paypal.createOrder(want, this.config.currency, `Don Gobai Space — ${period.month}`);
      entries.push({ orderId: id, cents: want, status: 'pending', month: period.month, createdAt: new Date(this.now()).toISOString() });
      return { id };
    });
  }

  async capture(orderId: string): Promise<{ status: string; amount: number; raised: number; remaining: number }> {
    const period = this.period();
    const result = await this.ledger.transaction(async (entries) => {
      const entry = entries.find((e) => e.orderId === orderId);
      if (!entry) throw new NotFoundException('Don inconnu ou expiré : recommence depuis le formulaire.');
      if (entry.status === 'captured') return { status: 'COMPLETED', cents: entry.cents };
      // Un don réservé le mois précédent compte dans le mois de l'encaissement : on revérifie.
      const others = DonationLedgerService.committed(entries.filter((e) => e !== entry), period.month);
      if (others + entry.cents > this.config.monthlyLimitCents) {
        entries.splice(entries.indexOf(entry), 1);
        throw new ConflictException('Le plafond du mois vient d’être atteint : ton don n’a pas été prélevé.');
      }
      const payment = await this.paypal.captureOrder(orderId);
      if (payment.status !== 'COMPLETED' && payment.status !== 'PENDING') {
        entries.splice(entries.indexOf(entry), 1);
        throw new ConflictException(`Paiement non abouti (${payment.status}).`);
      }
      Object.assign(entry, {
        status: 'captured',
        month: period.month,
        cents: payment.cents || entry.cents,
        capturedAt: new Date(this.now()).toISOString(),
        captureId: payment.captureId ?? undefined,
      });
      return { status: payment.status, cents: entry.cents };
    });
    const after = await this.status();
    return { status: result.status, amount: euros(result.cents), raised: after.raised, remaining: after.remaining };
  }
}

function frenchDate(iso: string, timeZone: string): string {
  const label = new Intl.DateTimeFormat('fr-FR', { timeZone, day: 'numeric', month: 'long' }).format(new Date(iso));
  return label.replace(/^1 /, '1er ');
}
