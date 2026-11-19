/**
 * Contrôles de la boutique : un achat appartient au compte qui l'a payé, et un jeton redemandé ne prolonge
 * jamais la durée payée.
 *
 * Stripe est remplacé par une doublure : aucun appel réseau, aucune clé. Le registre des achats tourne en
 * mémoire (pas de DATABASE_URL dans les tests), ce qui suffit pour vérifier les règles.
 */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { verifyJwt } from '../../common/jwt';
import { JWT_AUDIENCE, JWT_ISSUER } from '../../common/jwt.guard';
import type { CheckoutSession, StripeCheckoutService } from '../donations/stripe-checkout.service';
import { LicencesService } from './licences.service';
import { StoreService } from './store.service';

/** Les deux comptes des tests. */
const ALICE = { id: 'compte-alice', name: 'alice' };
const BOB = { id: 'compte-bob', name: 'bob' };

/** Une session Stripe telle que la doublure la renvoie. */
const session = (reference: string, paid = true, cents = 49_900): CheckoutSession => ({
  id: 'cs_test_' + reference.replace(/[^A-Za-z0-9]/g, ''),
  url: 'https://checkout.stripe.com/c/pay/cs_test_x',
  status: paid ? 'complete' : 'open',
  paid,
  cents,
  currency: 'EUR',
  paymentIntentId: 'pi_test_x',
  reference,
});

/** Doublure de Stripe : elle retient la référence posée à la création et la rend à la lecture. */
function fakeStripe(): StripeCheckoutService & { last: string | null } {
  // Les sessions connues, par identifiant.
  const sessions = new Map<string, CheckoutSession>();
  // La doublure.
  const stripe = {
    last: null as string | null,
    isConfigured: () => true,
    environment: () => 'test' as const,
    async createSession(cents: number, _currency: string, _label: string, _ok: string, _ko: string, reference?: string) {
      // Retient la référence, comme Stripe le ferait.
      stripe.last = reference ?? null;
      // La session créée.
      const created = session(reference ?? '', false, cents);
      // Rangée pour la lecture.
      sessions.set(created.id, created);
      // Rendue à l'appelant.
      return created;
    },
    async getSession(id: string) {
      // La session connue, marquée payée (le paiement a eu lieu entre-temps).
      const known = sessions.get(id);
      // Inconnue : une session vide, non payée.
      if (!known) return session('', false, 0);
      // Payée.
      return { ...known, paid: true, status: 'complete' };
    },
    async expireSession(id: string) { return session('', false, 0); },
  };
  // La doublure, typée comme le service réel.
  return stripe as unknown as StripeCheckoutService & { last: string | null };
}

/** Une boutique neuve, avec sa doublure Stripe et son registre en mémoire. */
function boutique() {
  // La doublure.
  const stripe = fakeStripe();
  // Le registre, en mémoire faute de DATABASE_URL.
  const licences = new LicencesService();
  // La boutique.
  return { stripe, licences, store: new StoreService(stripe, licences) };
}

describe('boutique', () => {
  // La clé de signature des jetons, nécessaire à tout achat.
  beforeEach(() => { process.env.SESSION_SECRET = 'secret-de-test-assez-long-pour-signer'; });

  it('inscrit l’article, les heures et le compte acheteur chez Stripe', async () => {
    // Une boutique neuve.
    const { store, stripe } = boutique();
    // Alice loue trois heures de calcul d'orbite de Mars.
    await store.createOrder('orbit-mars', 'https://exemple.fr', 3, ALICE);
    // La référence posée chez Stripe porte les trois informations, dans cet ordre.
    expect(stripe.last).toBe('orbit-mars:3:compte-alice');
  });

  it('refuse à un autre compte le jeton d’un paiement', async () => {
    // Une boutique neuve.
    const { store } = boutique();
    // Alice achète le modèle de Mars.
    const order = await store.createOrder('body-mars', 'https://exemple.fr', 1, ALICE);
    // Bob essaie de récupérer le jeton de ce paiement.
    let refus: unknown = null;
    // L'appel.
    try { await store.claim(order.id, BOB); } catch (e) { refus = e; }
    // Il est refusé.
    expect(refus instanceof ForbiddenException).toBe(true);
    // Alice, elle, l'obtient.
    const licence = await store.claim(order.id, ALICE);
    // Avec les droits de l'article.
    expect(licence.scopes).toEqual(['body:mars']);
    // Et son nom dedans.
    expect(licence.buyer.name).toBe('alice');
  });

  it('signe un jeton vérifiable qui porte les droits, l’acheteur et le paiement', async () => {
    // Une boutique neuve.
    const { store } = boutique();
    // Un achat d'Alice.
    const order = await store.createOrder('body-soleil', 'https://exemple.fr', 1, ALICE);
    // Son jeton.
    const licence = await store.claim(order.id, ALICE);
    // Le jeton se vérifie avec la clé du serveur, l'émetteur et le destinataire attendus.
    const claims = verifyJwt(licence.token, process.env.SESSION_SECRET!, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    // Il porte le droit acheté.
    expect((claims.scope as string[])[0]).toBe('body:soleil');
    // Le compte acheteur.
    expect(claims.sub).toBe('compte-alice');
    // Et la session de paiement.
    expect(claims.payment).toBe(order.id);
  });

  it('ne délivre rien pour un paiement qui n’a pas abouti', async () => {
    // Une boutique neuve.
    const { store } = boutique();
    // Une session inconnue de la doublure : elle se présente comme non payée.
    let refus: unknown = null;
    // L'appel.
    try { await store.claim('cs_test_inconnue', ALICE); } catch (e) { refus = e; }
    // Refusé.
    expect(refus instanceof ConflictException).toBe(true);
  });

  it('ne prolonge pas la durée payée quand le jeton est redemandé', async () => {
    // Une boutique neuve.
    const { store } = boutique();
    // Alice loue deux heures d'orbite.
    const order = await store.createOrder('orbit-mars', 'https://exemple.fr', 2, ALICE);
    // Premier jeton.
    const first = await store.claim(order.id, ALICE);
    // Deuxième, redemandé tout de suite.
    const second = await store.claim(order.id, ALICE);
    // La date de fin est la même : c'est celle de l'achat, pas celle de la demande.
    expect(second.expiresAt).toBe(first.expiresAt);
    // Deux heures payées.
    expect(first.hours).toBe(2);
  });

  it('liste les achats du compte, et ceux-là seulement', async () => {
    // Une boutique neuve.
    const { store } = boutique();
    // Un achat d'Alice, un de Bob.
    const a = await store.createOrder('body-mars', 'https://exemple.fr', 1, ALICE);
    const b = await store.createOrder('body-terre', 'https://exemple.fr', 1, BOB);
    // Chacun réclame le sien.
    await store.claim(a.id, ALICE);
    await store.claim(b.id, BOB);
    // Les achats d'Alice.
    const mine = await store.licencesOf(ALICE);
    // Un seul, le sien.
    expect(mine.length).toBe(1);
    expect(mine[0].product.id).toBe('body-mars');
  });

  it('nomme ce qui manque quand le paiement est fermé', async () => {
    // Une boutique dont Stripe n'est pas configuré.
    const licences = new LicencesService();
    // Une doublure sans clé.
    const stripe = { isConfigured: () => false, environment: () => 'test' } as unknown as StripeCheckoutService;
    // La boutique.
    const store = new StoreService(stripe, licences);
    // Sans clé de signature non plus.
    delete process.env.SESSION_SECRET;
    // Les deux variables manquantes sont nommées.
    expect(store.missingConfiguration()).toEqual(['STRIPE_SECRET_KEY', 'SESSION_SECRET']);
    // Et le catalogue dit que le paiement est fermé.
    expect(store.catalogue().enabled).toBe(false);
  });

  it('met le Soleil au catalogue, sans fond de carte et avec sa position apparente', async () => {
    // Une boutique neuve.
    const { store } = boutique();
    // Le catalogue.
    const { products } = store.catalogue();
    // L'article du Soleil existe.
    const soleil = products.find((p) => p.id === 'body-soleil');
    // Il est là, et sans fond de carte.
    expect(soleil).toBeDefined();
    expect(soleil!.tiled).toBe(false);
    // Et son article horaire parle de position, non d'orbite.
    const position = products.find((p) => p.id === 'orbit-soleil');
    expect(position).toBeDefined();
    expect(position!.hourly).toBe(true);
    expect(position!.label).toContain('Position');
  });
});
