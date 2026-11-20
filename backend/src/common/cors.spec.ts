// CORS fermé : seul le frontend reçoit l'en-tête Access-Control-Allow-Origin.
import type { Request } from 'express';
import { corsDelegate, isFrontendOrigin } from './cors';

const FRONTEND = ['https://www.gobaispace.com', 'https://gobai-space.onrender.com'];

// Réponse du délégué pour une origine et une méthode.
function answer(origin: string | undefined, method = 'GET'): boolean {
  let allowed: boolean | null = null;
  corsDelegate(FRONTEND)({ headers: origin ? { origin } : {}, method } as unknown as Request, (_e, o) => { allowed = o.origin; });
  return allowed as unknown as boolean;
}

describe('cors', () => {
  it('autorise le frontend, quelle que soit la casse ou la barre finale', () => {
    expect(answer('https://www.gobaispace.com')).toBe(true);
    expect(answer('https://WWW.gobaispace.com/')).toBe(true);
    expect(answer('https://gobai-space.onrender.com')).toBe(true);
  });

  it('refuse tout autre site, partenaire et pré-vérification compris', () => {
    expect(answer('https://exemple.com')).toBe(false);
    expect(answer('https://exemple.com', 'OPTIONS')).toBe(false);
    expect(answer('https://baibai-qp76.onrender.com')).toBe(false);
    expect(answer('https://www.gobaispace.com.pirate.fr')).toBe(false);
    expect(answer('http://www.gobaispace.com')).toBe(false);
  });

  it('ne pose aucun en-tête sans origine (appel direct, même site)', () => {
    expect(answer(undefined)).toBe(false);
  });

  it('reconnaît le frontend', () => {
    expect(isFrontendOrigin('https://www.gobaispace.com', FRONTEND)).toBe(true);
    expect(isFrontendOrigin('https://exemple.com', FRONTEND)).toBe(false);
    expect(isFrontendOrigin(undefined, FRONTEND)).toBe(false);
  });
});
