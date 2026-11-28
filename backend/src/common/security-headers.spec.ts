// Ce qui est testé.
import { CONTENT_SECURITY_POLICY, PERMISSIONS_POLICY, SECURITY_HEADERS, securityHeaders } from './security-headers';

// Groupe de tests.
describe('en-têtes de sécurité', () => {
  // Le middleware pose chaque en-tête et passe la main.
  it('pose tous les en-têtes puis appelle next', () => {
    // Réponse factice qui garde les en-têtes.
    const set: Record<string, string> = {};
    const res = { setHeader: (n: string, v: string) => { set[n] = v; } };
    // Compteur d'appels à next.
    let calls = 0;
    securityHeaders({} as never, res as never, () => { calls += 1; });
    // Tous posés, next appelé une fois.
    expect(set).toEqual(SECURITY_HEADERS);
    expect(calls).toBe(1);
  // Fin du test.
  });

  // La CSP ne bride ni scripts, ni images, ni connexions (Cesium, tuiles, workers).
  it('garde une CSP qui ne bloque aucune ressource du globe', () => {
    // Aucune directive de source de ressources.
    for (const d of ['default-src', 'script-src', 'connect-src', 'img-src', 'worker-src', 'frame-src']) expect(CONTENT_SECURITY_POLICY).not.toContain(d);
    // Encadrement par le site seulement.
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'self'");
  // Fin du test.
  });

  // Position et boussole restent permises (Ma position, boussole du téléphone).
  it('laisse la position et les capteurs au site', () => {
    // Position.
    expect(PERMISSIONS_POLICY).toContain('geolocation=(self)');
    // Boussole.
    expect(PERMISSIONS_POLICY).toContain('magnetometer=(self)');
    // Caméra coupée.
    expect(PERMISSIONS_POLICY).toContain('camera=()');
  // Fin du test.
  });
// Fin du groupe.
});
