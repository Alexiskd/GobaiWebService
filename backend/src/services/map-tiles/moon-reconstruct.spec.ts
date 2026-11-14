// Ouvre l'import de ce qui est testé :
import {
  // les fonctions et les constantes du module.
  accumulate, emptyStats, fillSource, holeMask, linearMatch, MIN_HOLE_PIXELS, MOON_FILL, polarRows, polarWeight, reconstruct, tileLatitudes,
// Fin de l'import.
} from './moon-reconstruct';

/** Tuile d'essai w × h : gris `value`, opaque. */
// Fonction tile : une tuile d'essai.
function tile(w: number, h: number, value: number): Uint8Array {
  // 4 octets par pixel.
  const t = new Uint8Array(w * h * 4);
  // Chaque pixel : les trois couleurs à la valeur, alpha à 255.
  for (let i = 0; i < w * h; i++) { t[i * 4] = t[i * 4 + 1] = t[i * 4 + 2] = value; t[i * 4 + 3] = 255; }
  // Renvoie la tuile.
  return t;
// Fin de tile.
}

// Groupe de tests de la reconstruction.
describe('reconstruction de la mosaïque de la Lune', () => {
  // Premier test : les pixels vides.
  it('repère les pixels vides : transparents ou noirs', () => {
    // Tuile de 4 × 4, grise à 120.
    const t = tile(4, 4, 120);
    // Rend le pixel 0 transparent.
    t[3] = 0;                       // pixel 0 transparent
    // Rend le pixel 1 noir.
    t[4] = t[5] = t[6] = 0;         // pixel 1 noir
    // Rend le pixel 2 très sombre.
    t[8] = t[9] = t[10] = 6;        // pixel 2 très sombre mais avec du signal : valide (ombre réelle)
    // Calcule le masque.
    const h = holeMask(t, 4, 4);
    // Deux pixels vides.
    expect(h.holes).toBe(2);
    // Les deux premiers, pas les deux suivants.
    expect(Array.from(h.mask.slice(0, 4))).toEqual([1, 1, 0, 0]);
    // Le seuil est de 16 pixels.
    expect(MIN_HOLE_PIXELS).toBe(16);
  // Fin du test.
  });

  // Deuxième test : la tuile de remplissage.
  it('trouve la tuile de remplissage : la même jusqu’au niveau 7, un ancêtre découpé au-delà', () => {
    // Niveau 5 : la même tuile, entière.
    expect(fillSource(5, 12, 7)).toEqual({ z: 5, x: 12, y: 7, left: 0, top: 0, size: 1 });
    // Niveau 7 : la même tuile, entière.
    expect(fillSource(7, 100, 40)).toEqual({ z: 7, x: 100, y: 40, left: 0, top: 0, size: 1 });
    // Niveau 9 : ancêtre de niveau 7 (2 niveaux au-dessus), quart de côté ; tuile (403, 161) → colonne 3, ligne 1 de l'ancêtre.
    // Niveau 9 : l'ancêtre de niveau 7, et un quart de son côté.
    expect(fillSource(9, 403, 161)).toEqual({ z: 7, x: 100, y: 40, left: 0.75, top: 0.25, size: 0.25 });
    // Le niveau sûr est 7.
    expect(MOON_FILL.maxZoom).toBe(7);
    // Niveau 8 essayé d'abord : la tuile de niveau 9 est alors un quart de son parent de niveau 8.
    // Le niveau à essayer est 8.
    expect(MOON_FILL.probeZoom).toBe(8);
    // Avec le niveau 8 : le parent, et la moitié de son côté.
    expect(fillSource(9, 403, 161, 8)).toEqual({ z: 8, x: 201, y: 80, left: 0.5, top: 0.5, size: 0.5 });
  // Fin du test.
  });

  // Troisième test : un trou comblé.
  it('comble un trou avec le remplissage ramené à la luminosité de la tuile', () => {
    // Tuile de 32 × 32.
    const w = 32, h = 32;
    // Grise à 100.
    const t = tile(w, h, 100);
    // Un peu de contraste dans les pixels valides, et un trou carré de 8 × 8 au centre.
    // Donne un léger contraste à chaque pixel.
    for (let i = 0; i < w * h; i++) { const v = 100 + ((i % 7) - 3) * 4; t[i * 4] = t[i * 4 + 1] = t[i * 4 + 2] = v; }
    // Vide un carré de 8 × 8 au centre.
    for (let y = 12; y < 20; y++) for (let x = 12; x < 20; x++) { const p = (y * w + x) * 4; t[p] = t[p + 1] = t[p + 2] = 0; t[p + 3] = 0; }
    // Remplissage plus clair de 60 et de même contraste : il doit revenir autour de 100.
    // Remplissage.
    const fill = new Uint8Array(w * h);
    // Même contraste, plus clair de 60.
    for (let i = 0; i < w * h; i++) fill[i] = 160 + ((i % 7) - 3) * 4;
    // Masque des vides.
    const hole = holeMask(t, w, h);
    // 64 pixels vides.
    expect(hole.holes).toBe(64);
    // Reconstruit.
    const out = reconstruct(t, fill, w, h, hole);
    // Position du pixel central.
    const centre = (16 * w + 16) * 4;
    // Il est opaque.
    expect(out[centre + 3]).toBe(255);
    // Sa valeur est celle attendue autour de 100, à 2 près.
    expect(Math.abs(out[centre] - (100 + (((16 * w + 16) % 7) - 3) * 4)) <= 2).toBe(true);
    // Plus aucun pixel vide.
    // Aucun pixel vide ne reste.
    expect(holeMask(out, w, h).holes).toBe(0);
    // Loin du trou, la tuile est intacte.
    // Le premier pixel n'a pas changé.
    expect(out[0]).toBe(100 + ((0 % 7) - 3) * 4);
    // Le dernier non plus.
    expect(out[(31 * w + 31) * 4]).toBe(100 + (((31 * w + 31) % 7) - 3) * 4);
  // Fin du test.
  });

  // Quatrième test : une tuile entièrement vide.
  it('tuile entièrement vide : le remplissage est posé tel quel, jamais noir', () => {
    // Tuile de 8 × 8.
    const w = 8, h = 8;
    // Tuile toute transparente.
    const t = new Uint8Array(w * h * 4); // tout transparent
    // Remplissage gris à 90.
    const fill = new Uint8Array(w * h).fill(90);
    // Un pixel noir dans le remplissage.
    fill[5] = 0; // pixel noir dans le remplissage : remonté juste au-dessus du seuil de vide
    // Masque des vides.
    const hole = holeMask(t, w, h);
    // 64 pixels vides.
    expect(hole.holes).toBe(64);
    // Reconstruit.
    const out = reconstruct(t, fill, w, h, hole);
    // Le premier pixel vaut 90.
    expect(out[0]).toBe(90);
    // Le pixel noir est remonté à 5.
    expect(out[5 * 4]).toBe(5);
    // Aucun pixel vide ne reste.
    expect(holeMask(out, w, h).holes).toBe(0);
  // Fin du test.
  });

  // Cinquième test : l'accord de la Lune entière.
  it('accorde le remplissage sur la Lune entière quand la tuile est presque vide', () => {
    // Tuile de 8 × 8.
    const w = 8, h = 8;
    // Tuile toute transparente.
    const t = new Uint8Array(w * h * 4); // tout transparent
    // Remplissage gris à 100.
    const fill = new Uint8Array(w * h).fill(100);
    // Reconstruit avec un accord de gain 0,8 et de décalage 10.
    const out = reconstruct(t, fill, w, h, holeMask(t, w, h), { global: { gain: 0.8, offset: 10 } });
    // 100 × 0,8 + 10 = 90.
    expect(out[0]).toBe(90);
    // Mesure de l'accord : même moyenne que Kaguya, contraste par moindres carrés, gain borné.
    // Quatre pixels de Kaguya et quatre de remplissage.
    const k = tile(4, 1, 0), f = new Uint8Array([10, 20, 30, 40]);
    // Valeurs de Kaguya : 50, 70, 90, 110.
    [50, 70, 90, 110].forEach((v, i) => { k[i * 4] = k[i * 4 + 1] = k[i * 4 + 2] = v; });
    // Mesure l'accord.
    const m = linearMatch(accumulate(emptyStats(), k, f, new Uint8Array(4)))!;
    // Gain borné à 1,6.
    expect(m.gain).toBeCloseTo(1.6, 5); // contraste double, borné à 1,6
    // Décalage qui garde la moyenne.
    expect(m.offset).toBeCloseTo(80 - 25 * 1.6, 5);
    // Sans pixel : null.
    expect(linearMatch(emptyStats())).toBe(null);
    // Grain fin propre à Kaguya (sans lien avec le remplissage) : le contraste du remplissage n'est pas gonflé.
    // 480 pixels de Kaguya et de remplissage.
    const n = 480, kn = tile(n, 1, 0), fn = new Uint8Array(n);
    // Même fond pour les deux ; Kaguya y ajoute un grain de ± 25.
    for (let i = 0; i < n; i++) { const base = 100 + (i % 16) * 3; fn[i] = base; kn[i * 4] = kn[i * 4 + 1] = kn[i * 4 + 2] = base + ((i % 3) - 1) * 25; }
    // Le gain reste proche de 1.
    expect(linearMatch(accumulate(emptyStats(), kn, fn, new Uint8Array(n)))!.gain).toBeCloseTo(1, 1);
  // Fin du test.
  });

  // Sixième test : les latitudes et le fondu.
  it('situe les tuiles en latitude et dose le fondu des pôles', () => {
    // Niveau 0 : de 90° à −90°.
    expect(tileLatitudes(0, 0)).toEqual({ top: 90, bottom: -90 });
    // Niveau 4, première ligne : de 90° à 78,75°.
    expect(tileLatitudes(4, 0)).toEqual({ top: 90, bottom: 78.75 });
    // Niveau 4, dernière ligne : de −78,75° à −90°.
    expect(tileLatitudes(4, 15)).toEqual({ top: -78.75, bottom: -90 });
    // À l'équateur : 0.
    expect(polarWeight(0)).toBe(0);
    // À 70° : 0.
    expect(polarWeight(70)).toBe(0);
    // À −77° : 0,5.
    expect(polarWeight(-77)).toBeCloseTo(0.5, 5);
    // À 84° : 1.
    expect(polarWeight(84)).toBe(1);
    // Au pôle Sud : 1.
    expect(polarWeight(-90)).toBe(1);
    // Zone polaire : lignes du haut et du bas seulement.
    // Ligne 1 du niveau 4 : polaire.
    expect(polarRows(4, 1)).toEqual({ top: 78.75, bottom: 67.5 });
    // Ligne 2 : non.
    expect(polarRows(4, 2)).toBe(null);
    // Ligne 8 : non.
    expect(polarRows(4, 8)).toBe(null);
    // Ligne 14 : polaire.
    expect(polarRows(4, 14)).toEqual({ top: -67.5, bottom: -78.75 });
    // Niveau 0 : polaire.
    expect(polarRows(0, 0)).toEqual({ top: 90, bottom: -90 });
  // Fin du test.
  });

  // Septième test : Kaguya d'accord avec LROC.
  it('au pôle, Kaguya qui s’accorde avec LROC reste intact', () => {
    // Tuile de 32 × 32.
    const w = 32, h = 32;
    // Tuile et remplissage.
    const t = tile(w, h, 0), fill = new Uint8Array(w * h);
    // Mêmes valeurs dans les deux, avec un léger contraste.
    for (let i = 0; i < w * h; i++) { const v = 110 + ((i % 5) - 2) * 6; t[i * 4] = t[i * 4 + 1] = t[i * 4 + 2] = v; fill[i] = v; }
    // Copie de la tuile avant.
    const before = Array.from(t);
    // Reconstruit au pôle.
    const out = reconstruct(t, fill, w, h, holeMask(t, w, h), { polar: { top: 90, bottom: 86 } });
    // Rien n'a changé.
    expect(Array.from(out)).toEqual(before);
  // Fin du test.
  });

  // Huitième test : une bande irréaliste.
  it('au pôle, une bande Kaguya irréaliste (noire ou décalée) prend la luminosité de LROC et garde son grain', () => {
    // Tuile de 64 × 64.
    const w = 64, h = 64;
    // Tuile et remplissage gris à 120.
    const t = tile(w, h, 120), fill = new Uint8Array(w * h).fill(120);
    // Bande sombre (ombre qui n'existe pas dans LROC) sur les colonnes 20 à 43, avec un grain fin de ± 3 ;
    // bande presque noire, sans signal, sur les lignes 50 à 63 de ces colonnes.
    // Pour chaque pixel des colonnes 20 à 43 :
    for (let y = 0; y < h; y++) for (let x = 20; x < 44; x++) {
      // sa position, et sa valeur : 8 à partir de la ligne 50, sinon 40 ± 3 ;
      const p = (y * w + x) * 4, v = y >= 50 ? 8 : 40 + ((x + y) % 2 ? 3 : -3);
      // l'écrit dans les trois couleurs.
      t[p] = t[p + 1] = t[p + 2] = v;
    // Fin de la boucle.
    }
    // Reconstruit au pôle.
    const out = reconstruct(t, fill, w, h, holeMask(t, w, h), { polar: { top: 90, bottom: 86 } });
    // Fonction at : la valeur d'un pixel du résultat.
    const at = (x: number, y: number) => out[(y * w + x) * 4];
    // Cœur de la bande : ramené à la luminosité de LROC (120), grain de Kaguya conservé (pixels voisins différents).
    // Au cœur de la bande, la moyenne de deux voisins revient à 120, à 2 près.
    expect(Math.abs((at(31, 20) + at(32, 20)) / 2 - 120) <= 2).toBe(true);
    // Les deux voisins diffèrent d'au moins 4 : le grain est resté.
    expect(Math.abs(at(31, 20) - at(32, 20)) >= 4).toBe(true);
    // Bande noire : LROC seul, sans grain.
    // Dans la bande noire : 120.
    expect(at(31, 58)).toBe(120);
    // Son voisin aussi.
    expect(at(32, 58)).toBe(120);
    // Loin de la bande, Kaguya est intact.
    // Loin de la bande : 120.
    expect(at(4, 20)).toBe(120);
    // Ailleurs aussi.
    expect(at(60, 40)).toBe(120);
  // Fin du test.
  });

  // Neuvième test : le fondu suit la latitude.
  it('le fondu des pôles suit la latitude : nul sous 70°, partiel à 77°, et jamais hors de la zone polaire', () => {
    // Tuile de 16 × 16.
    const w = 16, h = 16;
    // Fonction make : une tuile grise à 40.
    const make = () => tile(w, h, 40);
    // Remplissage gris à 140.
    const fill = new Uint8Array(w * h).fill(140);
    // Position du pixel central.
    const centre = (8 * w + 8) * 4;
    // Tuile entière plus sombre de 100 que LROC. L'accord par tuile est sans contraste (gain 1, décalage −100) :
    // on passe l'accord de la Lune entière (identité) pour que l'écart se voie près du pôle.
    // Reconstruit entre 69° et 65°.
    const low = reconstruct(make(), fill, w, h, holeMask(make(), w, h), { polar: { top: 69, bottom: 65 } });
    // Rien ne change.
    expect(low[centre]).toBe(40);
    // Reconstruit sans zone polaire.
    const none = reconstruct(make(), fill, w, h, holeMask(make(), w, h));
    // Rien ne change.
    expect(none[centre]).toBe(40);
    // Reconstruit vers 77°.
    const mid = reconstruct(make(), fill, w, h, holeMask(make(), w, h), { polar: { top: 77.5, bottom: 76.5 } });
    // Le pixel est éclairci en partie.
    expect(mid[centre] > 45 && mid[centre] < 100).toBe(true);
    // Reconstruit au pôle.
    const pole = reconstruct(make(), fill, w, h, holeMask(make(), w, h), { polar: { top: 90, bottom: 86 } });
    // Le pixel prend la valeur de LROC.
    expect(pole[centre]).toBe(140);
  // Fin du test.
  });
// Fin du groupe.
});
