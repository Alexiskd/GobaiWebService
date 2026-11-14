// Ouvre l'import de ce qui est testé :
import {
  // quatre règles de cache et les quatre fonctions du module.
  EARTH_FALLBACK_TILE, EARTH_TILE, MOON_TILE, SATELLITE_TILE, etagMatches, sendTile, tileCacheControl, tileEtag,
// Fin de l'import.
} from './tile-http';

// Fonction fakeRes : fabrique une fausse réponse HTTP qui note ce qu'on lui envoie.
function fakeRes() {
  // En-têtes posés, par nom.
  const headers: Record<string, string> = {};
  // Ce que le test relira : les en-têtes, le code (200 au départ), le corps et le nombre d'appels à end.
  const out = { headers, code: 200, body: undefined as Buffer | undefined, ended: 0 };
  // La fausse réponse, avec les trois méthodes que sendTile utilise :
  const res = {
    // setHeader note l'en-tête ;
    setHeader: (n: string, v: string) => { headers[n] = v; },
    // status note le code ;
    status: (c: number) => { out.code = c; },
    // end note le corps et compte l'appel.
    end: (b?: Buffer) => { out.body = b; out.ended++; },
  // Fin de la fausse réponse.
  };
  // Renvoie la fausse réponse et ce qu'elle a noté.
  return { res, out };
// Fin de fakeRes.
}

// Groupe de tests de l'envoi des tuiles.
describe('envoi des tuiles', () => {
  // Test de l'en-tête Cache-Control.
  it('Cache-Control : durée, affichage immédiat puis vérification, ou immuable', () => {
    // Terre : une semaine (604 800 s), puis un mois (2 592 000 s) d'affichage immédiat avec vérification.
    expect(tileCacheControl(EARTH_TILE)).toBe('public, max-age=604800, stale-while-revalidate=2592000');
    // Terre, source de repli : dix minutes.
    expect(tileCacheControl(EARTH_FALLBACK_TILE)).toBe('public, max-age=600');
    // Satellites : une semaine, immuable.
    expect(tileCacheControl(SATELLITE_TILE)).toBe('public, max-age=604800, immutable');
    // Lune : un an (31 536 000 s), immuable.
    expect(tileCacheControl(MOON_TILE)).toBe('public, max-age=31536000, immutable');
  // Fin du test.
  });

  // Test de l'empreinte.
  it('empreinte : forte, stable pour la même image, différente pour une autre', () => {
    // Deux images différentes.
    const a = Buffer.from('tuile A'), b = Buffer.from('tuile B');
    // Forme attendue : entre guillemets, la taille en hexadécimal, un tiret, puis 22 caractères.
    expect(tileEtag(a)).toMatch(/^"[0-9a-f]+-[\w-]{22}"$/);
    // La même image donne deux fois la même empreinte.
    expect(tileEtag(a)).toBe(tileEtag(a));
    // Une autre copie du même contenu donne aussi la même empreinte.
    expect(tileEtag(Buffer.from('tuile A'))).toBe(tileEtag(a));
    // Un contenu différent donne une empreinte différente.
    expect(tileEtag(b)).not.toBe(tileEtag(a));
  // Fin du test.
  });

  // Test de la comparaison avec If-None-Match.
  it('If-None-Match : liste, étoile et préfixe faible', () => {
    // Empreinte d'exemple.
    const tag = '"7-abc"';
    // Sans en-tête : non.
    expect(etagMatches(undefined, tag)).toBe(false);
    // Autre empreinte : non.
    expect(etagMatches('"x"', tag)).toBe(false);
    // Même empreinte : oui.
    expect(etagMatches(tag, tag)).toBe(true);
    // Liste contenant la forme faible W/ de l'empreinte : oui.
    expect(etagMatches(`"x", W/${tag}`, tag)).toBe(true);
    // Étoile : oui.
    expect(etagMatches('*', tag)).toBe(true);
    // En-tête reçu sous forme de tableau : oui.
    expect(etagMatches(['"x"', tag], tag)).toBe(true);
  // Fin du test.
  });

  // Test de l'envoi complet.
  it('première demande : image entière avec sa taille ; demande suivante : 304 sans corps', () => {
    // Tuile d'exemple : un contenu et son type.
    const tile = { body: Buffer.from('image de la tuile'), contentType: 'image/webp' };
    // Première fausse réponse.
    const first = fakeRes();
    // Premier envoi : pas d'en-tête If-None-Match, règle de cache de la Terre, un en-tête supplémentaire.
    sendTile({ headers: {} }, first.res, tile, EARTH_TILE, { 'X-Tile-Source': 'ign' });
    // Code 200.
    expect(first.out.code).toBe(200);
    // Corps : l'image elle-même.
    expect(first.out.body).toBe(tile.body);
    // Type de contenu de l'image.
    expect(first.out.headers['Content-Type']).toBe('image/webp');
    // Taille de l'image, en texte.
    expect(first.out.headers['Content-Length']).toBe(String(tile.body.length));
    // L'en-tête supplémentaire est bien posé.
    expect(first.out.headers['X-Tile-Source']).toBe('ign');
    // Empreinte renvoyée, gardée pour la demande suivante.
    const etag = first.out.headers.ETag;

    // Seconde fausse réponse.
    const again = fakeRes();
    // Second envoi : le navigateur présente l'empreinte qu'il a reçue.
    sendTile({ headers: { 'if-none-match': etag } }, again.res, tile, EARTH_TILE);
    // Code 304.
    expect(again.out.code).toBe(304);
    // Pas de corps.
    expect(again.out.body).toBeUndefined();
    // La réponse a été terminée une seule fois.
    expect(again.out.ended).toBe(1);
    // Pas de taille, puisqu'il n'y a pas de corps.
    expect(again.out.headers['Content-Length']).toBeUndefined();
    // Cache-Control toujours présent.
    expect(again.out.headers['Cache-Control']).toBe(tileCacheControl(EARTH_TILE));
    // Même empreinte.
    expect(again.out.headers.ETag).toBe(etag);
  // Fin du test.
  });
// Fin du groupe.
});
