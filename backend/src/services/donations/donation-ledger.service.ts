import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Registre des dons sur le disque du serveur (JSON), source du plafond mensuel.
 *
 *  - `pending`  : commande PayPal créée, en attente d'approbation du donateur. Le montant est réservé pour que deux
 *                 donateurs simultanés ne dépassent pas le plafond ; la réservation tombe au bout de 3 h (durée de vie
 *                 d'une commande PayPal non approuvée).
 *  - `captured` : paiement encaissé, compté dans le mois de l'encaissement.
 *
 * Les opérations passent l'une après l'autre (file d'attente) et chaque écriture est atomique (fichier temporaire puis
 * renommage), pour qu'un arrêt brutal ne corrompe pas le registre.
 */
export interface LedgerEntry {
  orderId: string;
  cents: number;
  status: 'pending' | 'captured';
  /** Mois `AAAA-MM` de la réservation, puis de l'encaissement. */
  month: string;
  createdAt: string;
  capturedAt?: string;
  captureId?: string;
}

interface LedgerFile {
  entries: LedgerEntry[];
}

export const PENDING_TTL_MS = 3 * 60 * 60 * 1000;

export class DonationLedgerService {
  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();
  private cache: LedgerFile | null = null;

  constructor(file: string, private readonly now: () => number = Date.now) {
    this.file = resolve(file);
  }

  /** Exécute `fn` seul, sur le registre à jour ; ce que `fn` modifie est enregistré. */
  transaction<T>(fn: (entries: LedgerEntry[]) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const data = await this.load();
      const before = JSON.stringify(data.entries);
      this.prune(data);
      const result = await fn(data.entries);
      if (JSON.stringify(data.entries) !== before) await this.save(data);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Total réservé + encaissé d'un mois, en centimes. */
  static committed(entries: LedgerEntry[], month: string): number {
    return entries.filter((e) => e.month === month).reduce((sum, e) => sum + e.cents, 0);
  }

  /** Total encaissé d'un mois, en centimes. */
  static raised(entries: LedgerEntry[], month: string): number {
    return entries.filter((e) => e.month === month && e.status === 'captured').reduce((sum, e) => sum + e.cents, 0);
  }

  private prune(data: LedgerFile) {
    const limit = this.now() - PENDING_TTL_MS;
    data.entries = data.entries.filter((e) => e.status === 'captured' || Date.parse(e.createdAt) > limit);
  }

  private async load(): Promise<LedgerFile> {
    if (this.cache) return this.cache;
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8')) as LedgerFile;
      this.cache = { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Registre illisible : on refuse plutôt que de repartir de zéro (le plafond ne serait plus respecté).
        throw new Error(`Registre des dons illisible (${this.file}) : ${(e as Error).message}`);
      }
      this.cache = { entries: [] };
    }
    return this.cache;
  }

  private async save(data: LedgerFile) {
    await fs.mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, this.file);
  }
}
