// Fonctions des sites partenaires autorisés sans paiement.
import { FREE_API_ORIGINS_DEFAULT, freeApiOrigins, isFreeOrigin, normalizeOrigin } from './free-origins';

// Sites partenaires autorisés sans paiement.
describe('free-origins', () => {
  // Origines normalisées.
  it('normalise une origine et refuse ce qui n’est pas une adresse web', () => {
    expect(normalizeOrigin('https://BAIBAI-qp76.onrender.com/')).toBe('https://baibai-qp76.onrender.com');
    expect(normalizeOrigin('https://baibai-qp76.onrender.com/page?x=1')).toBe('https://baibai-qp76.onrender.com');
    expect(normalizeOrigin('ftp://x.fr')).toBeNull(); expect(normalizeOrigin('pas une adresse')).toBeNull(); expect(normalizeOrigin(undefined)).toBeNull();
  });

  // Liste par défaut et variable d'environnement.
  it('autorise baibai par défaut, plus les sites de FREE_API_ORIGINS', () => {
    expect(FREE_API_ORIGINS_DEFAULT).toContain('https://baibai-qp76.onrender.com');
    expect(freeApiOrigins({ FREE_API_ORIGINS: 'https://autre.fr, https://baibai-qp76.onrender.com' })).toEqual(['https://baibai-qp76.onrender.com', 'https://autre.fr']);
  });

  // Requêtes.
  it('reconnaît une requête de baibai par Origin ou par Referer, et refuse les autres', () => {
    expect(isFreeOrigin({ headers: { origin: 'https://baibai-qp76.onrender.com' } }, {})).toBe(true);
    expect(isFreeOrigin({ headers: { referer: 'https://baibai-qp76.onrender.com/carte' } }, {})).toBe(true);
    expect(isFreeOrigin({ headers: { origin: 'https://baibai-qp76.onrender.com.pirate.fr' } }, {})).toBe(false);
    expect(isFreeOrigin({ headers: {} }, {})).toBe(false);
  });
});
