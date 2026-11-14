// Fonction testée.
import { compactTile } from './satellite-tiles.service';

// Groupe de tests de la recompression.
describe('tuiles des satellites : recompression avant envoi', () => {
  // Tuile PNG d'exemple, de 1 000 octets.
  const png = { body: Buffer.alloc(1000, 1), contentType: 'image/png' };

  // Premier test : le WebP est plus léger.
  it('PNG plus léger en WebP : servi en WebP', async () => {
    // Recompresse avec un faux encodeur qui rend 300 octets.
    const out = await compactTile(png, async () => Buffer.alloc(300, 2));
    // La tuile est servie en WebP.
    expect(out.contentType).toBe('image/webp');
    // Elle fait 300 octets.
    expect(out.body.length).toBe(300);
  // Fin du test.
  });

  // Second test : les cas où la tuile d'origine est gardée.
  it('JPEG, WebP pas plus léger, ou recompression en échec : tuile d’origine', async () => {
    // Tuile JPEG d'exemple.
    const jpeg = { body: Buffer.alloc(1000, 1), contentType: 'image/jpeg' };
    // Compteur d'appels à l'encodeur.
    let called = 0;
    // Un JPEG est rendu tel quel.
    expect(await compactTile(jpeg, async () => { called++; return Buffer.alloc(1); })).toBe(jpeg);
    // L'encodeur n'a pas été appelé.
    expect(called).toBe(0);
    // Un WebP aussi lourd que le PNG : le PNG est gardé.
    expect(await compactTile(png, async () => Buffer.alloc(1000, 2))).toBe(png);
    // Un WebP vide : le PNG est gardé.
    expect(await compactTile(png, async () => Buffer.alloc(0))).toBe(png);
    // Un encodeur en panne : le PNG est gardé.
    expect(await compactTile(png, async () => { throw new Error('sharp absent'); })).toBe(png);
    // Un type PNG suivi de paramètres est quand même reconnu.
    expect(await compactTile({ ...png, contentType: 'image/png; charset=binary' }, async () => Buffer.alloc(10))).toMatchObject({ contentType: 'image/webp' });
  // Fin du test.
  });
// Fin du groupe.
});
