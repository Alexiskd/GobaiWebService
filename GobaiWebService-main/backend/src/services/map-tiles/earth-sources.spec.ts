// Ouvre l'import de ce qui est testé :
import {
  // les classes, la liste des sources et les fonctions du module ;
  CoverageMemo, EARTH_SOURCES, NoCoverageError, SourceHealth, TileAbsentError, candidates, directPlan, enabledSources, fillTemplate, hedged, isBlank, mercatorBbox, nativeDepth,
  // la suite des fonctions, et l'emprise de la France.
  isAbsentStatus, tileTouches, FRANCE,
// Fin de l'import.
} from './earth-sources';

/** Tuile Web Mercator qui contient (lon, lat) au niveau z. */
// Fonction tileAt : la tuile qui contient un point.
function tileAt(lon: number, lat: number, z: number): [number, number, number] {
  // Nombre de tuiles par côté.
  const n = 2 ** z;
  // Latitude en radians.
  const r = (lat * Math.PI) / 180;
  // Le niveau, la colonne et la ligne (formule du Web Mercator).
  return [z, Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
// Fin de tileAt.
}
// Fonction ids : les identifiants d'une liste.
const ids = (list: Array<{ id: string }>) => list.map((s) => s.id);
// Sources actives quand aucune variable d'environnement n'est définie.
const noKeys = enabledSources({});

// Premier groupe : les sources.
describe('sources de la couche unique de la Terre', () => {
  // Premier test : aucune clé.
  it('toutes les sources sont libres et actives sans clé', () => {
    // Les sources actives sont,
    expect(ids(noKeys)).toEqual([
      // dans cet ordre, les dix-neuf de la liste.
      'lu', 'ch', 'be', 'nl', 'at', 'cz', 'de-sn', 'de-he', 'de-nw', 'de-by', 'ign', 'es', 'it', 'pl', 'jp', 'au-nsw', 'usgs', 'sentinel2', 'gibs',
    // Fin de la comparaison.
    ]);
    // Aucune source ne demande de clé.
    expect(EARTH_SOURCES.every((s) => !s.keyEnv)).toBe(true);
  // Fin du test.
  });

  // Deuxième test : le choix par niveau et par emprise.
  it('choisit les sources par niveau et par emprise, la plus détaillée d’abord', () => {
    // Paris, niveau 17 : IGN seule (Sentinel-2 s'arrête au niveau 14).
    // Paris, niveau 17 : l'IGN seul.
    expect(ids(candidates(...tileAt(2.35, 48.85, 17), noKeys))).toEqual(['ign']);
    // Paris, niveau 13 : IGN puis Sentinel-2.
    // Paris, niveau 13 : l'IGN puis Sentinel-2.
    expect(ids(candidates(...tileAt(2.35, 48.85, 13), noKeys))).toEqual(['ign', 'sentinel2']);
    // Paris, niveau 10 : Sentinel-2 seule (IGN à partir du niveau 12, Blue Marble jusqu'au niveau 8).
    // Paris, niveau 10 : Sentinel-2 seul.
    expect(ids(candidates(...tileAt(2.35, 48.85, 10), noKeys))).toEqual(['sentinel2']);
    // Monde, niveau 5 : Sentinel-2 puis Blue Marble en secours.
    // Ailleurs, niveau 5 : Sentinel-2 puis NASA GIBS.
    expect(ids(candidates(...tileAt(100, 10, 5), noKeys))).toEqual(['sentinel2', 'gibs']);
    // Denver, niveau 15 : USGS seule ; niveau 14 : USGS puis Sentinel-2.
    // Denver, niveau 15 : l'USGS seul.
    expect(ids(candidates(...tileAt(-104.99, 39.74, 15), noKeys))).toEqual(['usgs']);
    // Denver, niveau 14 : l'USGS puis Sentinel-2.
    expect(ids(candidates(...tileAt(-104.99, 39.74, 14), noKeys))).toEqual(['usgs', 'sentinel2']);
    // Tokyo, niveau 17 : photos aériennes du Japon.
    // Tokyo, niveau 17 : le Japon.
    expect(ids(candidates(...tileAt(139.69, 35.69, 17), noKeys))).toEqual(['jp']);
    // Le Caire, niveau 17 : aucune source native (la tuile sera découpée dans son ancêtre de niveau 14).
    // Le Caire, niveau 17 : aucune source.
    expect(candidates(...tileAt(31.24, 30.04, 17), noKeys)).toEqual([]);
    // Il faut remonter de 3 niveaux pour en trouver une.
    expect(nativeDepth(...tileAt(31.24, 30.04, 17), noKeys, 6)).toBe(3);
  // Fin du test.
  });

  // Troisième test : les orthophotos nationales.
  it('orthophotos nationales : le pays de la tuile, le plus petit d’abord quand les emprises se chevauchent', () => {
    // Fonction at17 : les sources d'un point au niveau 17.
    const at17 = (lon: number, lat: number) => ids(candidates(...tileAt(lon, lat, 17), noKeys));
    // Madrid : l'Espagne.
    expect(at17(-3.7, 40.42)).toEqual(['es']); // Madrid
    // Amsterdam : les Pays-Bas.
    expect(at17(4.9, 52.37)).toEqual(['nl']); // Amsterdam
    // Vienne : l'Autriche d'abord.
    expect(at17(16.37, 48.21)[0]).toBe('at'); // Vienne (le rectangle tchèque déborde jusque-là)
    // Prague : la Tchéquie puis la Pologne.
    expect(at17(14.42, 50.09)).toEqual(['cz', 'pl']); // Prague (le rectangle polonais déborde jusque-là)
    // Varsovie : la Pologne.
    expect(at17(21.01, 52.23)).toEqual(['pl']); // Varsovie
    // Las Palmas : l'Espagne.
    expect(at17(-15.43, 28.12)).toEqual(['es']); // Las Palmas (Canaries)
    // Rectangles qui se chevauchent : la France passe après ses petits voisins.
    // Luxembourg : le Luxembourg, la Belgique, puis la France.
    expect(at17(6.13, 49.61)).toEqual(['lu', 'be', 'ign']); // Luxembourg
    // Berne : la Suisse, la France, puis l'Italie.
    expect(at17(7.45, 46.95)).toEqual(['ch', 'ign', 'it']); // Berne
    // Bruxelles : la Belgique, les Pays-Bas, puis la France.
    expect(at17(4.35, 50.85)).toEqual(['be', 'nl', 'ign']); // Bruxelles
    // Berlin : Land sans service repris ici.
    // Berlin : aucune source.
    expect(at17(13.4, 52.52)).toEqual([]);
  // Fin du test.
  });

  // Quatrième test : les services WMS.
  it('pays sans tuiles nationales : services WMS découpés en tuiles', () => {
    // Fonction at17 : les sources d'un point au niveau 17.
    const at17 = (lon: number, lat: number) => ids(candidates(...tileAt(lon, lat, 17), noKeys));
    // Cologne : les Pays-Bas, la Rhénanie-du-Nord-Westphalie, puis la France.
    expect(at17(6.96, 50.94)).toEqual(['nl', 'de-nw', 'ign']); // Cologne (rectangles néerlandais et français)
    // Francfort : la Hesse puis la France.
    expect(at17(8.68, 50.11)).toEqual(['de-he', 'ign']); // Francfort (le rectangle français déborde jusque-là)
    // Dresde : la Tchéquie puis la Saxe.
    expect(at17(13.74, 51.05)).toEqual(['cz', 'de-sn']); // Dresde (le rectangle tchèque déborde jusque-là)
    // Munich : l'Autriche puis la Bavière.
    expect(at17(11.58, 48.14)).toEqual(['at', 'de-by']); // Munich (le rectangle autrichien déborde jusque-là)
    // Rome : l'Italie.
    expect(at17(12.5, 41.9)).toEqual(['it']); // Rome
    // Sydney : la Nouvelle-Galles du Sud.
    expect(at17(151.21, -33.87)).toEqual(['au-nsw']); // Sydney
    // Melbourne : aucune source.
    expect(at17(144.96, -37.81)).toEqual([]); // Melbourne : hors Nouvelle-Galles du Sud
    // Une requête GetMap par tuile, sur l'emprise Web Mercator de la tuile.
    // Tuile de Munich au niveau 17.
    const [z, x, y] = tileAt(11.58, 48.14, 17);
    // Première adresse de la Bavière pour cette tuile.
    const url = EARTH_SOURCES.find((s) => s.id === 'de-by')!.urls(z, x, y, '')[0];
    // Elle porte l'emprise de la tuile.
    expect(url).toContain(`BBOX=${mercatorBbox(z, x, y)}`);
    // Elle porte la projection, sous le nom SRS.
    expect(url).toContain('SRS=EPSG:3857');
    // Elle demande 256 × 256 pixels.
    expect(url).toContain('WIDTH=256&HEIGHT=256');
    // Adresse qui porte déjà un paramètre : les suivants s'ajoutent avec « & ».
    // L'adresse de l'Italie enchaîne ses paramètres avec « & ».
    expect(EARTH_SOURCES.find((s) => s.id === 'it')!.urls(z, x, y, '')[0]).toContain('ortofoto_colore_12.map&SERVICE=WMS');
  // Fin du test.
  });

  // Cinquième test : l'emprise en mètres.
  it('emprise Web Mercator d’une tuile pour les services WMS', () => {
    // Niveau 0 : le monde entier.
    expect(mercatorBbox(0, 0, 0)).toBe('-20037508.343,-20037508.343,20037508.343,20037508.343');
    // Niveau 1, tuile nord-est : de 0 au bord du monde.
    expect(mercatorBbox(1, 1, 0)).toBe('0.000,0.000,20037508.343,20037508.343');
  // Fin du test.
  });

  // Sixième test : les sources en panne.
  it('écarte une source en panne, sauf si toutes le sont', () => {
    // Tuile de Paris au niveau 13.
    const paris13 = tileAt(2.35, 48.85, 13);
    // L'IGN en panne : Sentinel-2 seul.
    expect(ids(candidates(...paris13, noKeys, (id) => id !== 'ign'))).toEqual(['sentinel2']);
    // Tout en panne : toutes sont gardées.
    expect(ids(candidates(...paris13, noKeys, () => false))).toEqual(['ign', 'sentinel2']);
  // Fin du test.
  });

  // Septième test : l'emprise de la France.
  it('emprise : une tuile touche ou non la France', () => {
    // Paris : la touche.
    expect(tileTouches(FRANCE, ...tileAt(2.35, 48.85, 12))).toBe(true);
    // Berlin : ne la touche pas.
    expect(tileTouches(FRANCE, ...tileAt(13.4, 52.5, 12))).toBe(false);
    // La tuile du monde entier : la touche.
    expect(tileTouches(FRANCE, 0, 0, 0)).toBe(true);
  // Fin du test.
  });

  // Huitième test : la cohérence de chaque source.
  it('chaque source donne au moins une adresse et couvre des niveaux cohérents', () => {
    // Pour chaque source :
    for (const s of EARTH_SOURCES) {
      // son niveau minimal ne dépasse pas son niveau maximal ;
      expect(s.minZoom).toBeLessThanOrEqual(s.maxZoom);
      // ses adresses pour une tuile, avec une clé d'essai ;
      const urls = s.urls(s.maxZoom, 1, 2, 'clé secrète');
      // il y en a au moins une ;
      expect(urls.length).toBeGreaterThan(0);
      // chacune commence par « https:// » ;
      for (const u of urls) expect(u.startsWith('https://')).toBe(true);
      // si la source a une clé, la première adresse la porte, encodée.
      if (s.keyEnv) expect(urls[0]).toContain(encodeURIComponent('clé secrète'));
    // Fin de la boucle.
    }
  // Fin du test.
  });
// Fin du premier groupe.
});

// Deuxième groupe : le plan de chargement direct.
describe('plan de chargement direct (navigateur)', () => {
  // Premier test : le contenu du plan.
  it('toutes les sources, dans l’ordre du serveur ; modèles d’adresse seulement pour les tuiles toutes faites', () => {
    // Plan sans variable d'environnement.
    const plan = directPlan(noKeys, {})!;
    // Les mêmes sources, dans le même ordre.
    expect(ids(plan)).toEqual(ids(noKeys));
    // Table du plan par identifiant.
    const by = new Map(plan.map((s) => [s.id, s]));
    // Services WMS : pas de modèle, la tuile passe par le relais.
    // Les services WMS n'ont pas de modèle d'adresse.
    for (const id of ['be', 'pl', 'it', 'de-sn', 'de-he', 'de-nw', 'de-by'] as const) expect(by.get(id)!.templates).toBe(undefined);
    // Les sources en tuiles toutes faites en ont au moins un.
    for (const id of ['ign', 'ch', 'nl', 'es', 'jp', 'usgs', 'sentinel2', 'gibs'] as const) expect(by.get(id)!.templates!.length).toBeGreaterThan(0);
    // Sentinel-2 n'a pas d'emprise.
    expect(by.get('sentinel2')!.bboxes).toBe(undefined);
    // L'IGN a celle de la France.
    expect(by.get('ign')!.bboxes).toEqual([FRANCE]);
  // Fin du test.
  });

  // Deuxième test : les modèles et les adresses du serveur.
  it('les modèles donnés au navigateur sont exactement les adresses que le serveur utilise', () => {
    // Pour chaque source :
    for (const s of EARTH_SOURCES) {
      // passe celles sans modèle ;
      if (!s.direct) continue;
      // les modèles remplis doivent valoir les adresses du serveur ;
      expect(s.direct.map((t) => fillTemplate(t, 14, 8500, 5700))).toEqual(s.urls(14, 8500, 5700, ''));
      // pour chaque modèle :
      for (const t of s.direct) {
        // il contient {z} ;
        expect(t).toContain('{z}');
        // il contient {x} ;
        expect(t).toContain('{x}');
        // il contient {y}.
        expect(t).toContain('{y}');
      // Fin de la boucle des modèles.
      }
    // Fin de la boucle des sources.
    }
  // Fin du test.
  });

  // Troisième test : la vue de loin.
  it('vue de loin : niveau réduit donné pour les sources nationales en tuiles toutes faites, coupé par EARTH_FAR_ORTHO=0', () => {
    // Table du plan par identifiant.
    const by = new Map(directPlan(noKeys, {})!.map((s) => [s.id, s]));
    // IGN : niveau 8.
    expect(by.get('ign')!.lowZoom).toBe(8);
    // Suisse : niveau 8.
    expect(by.get('ch')!.lowZoom).toBe(8);
    // Japon : niveau 9.
    expect(by.get('jp')!.lowZoom).toBe(9);
    // Sources mondiales, USGS (déjà mondiale aux petits niveaux) et services WMS : pas de vue de loin.
    // Ces six sources n'ont pas de vue de loin.
    for (const id of ['sentinel2', 'gibs', 'usgs', 'de-by', 'it', 'be'] as const) expect(by.get(id)!.lowZoom).toBe(undefined);
    // Avec EARTH_FAR_ORTHO=0, aucune source n'en a.
    for (const s of directPlan(noKeys, { EARTH_FAR_ORTHO: '0' })!) expect(s.lowZoom).toBe(undefined);
    // Le niveau réduit est toujours au-dessus du niveau natif.
    // Le niveau de vue de loin est toujours sous le niveau natif.
    for (const s of EARTH_SOURCES) if (s.lowZoom !== undefined) expect(s.lowZoom).toBeLessThan(s.minZoom);
  // Fin du test.
  });

  // Quatrième test : la coupure du chargement direct.
  it('EARTH_DIRECT=0 coupe le chargement direct', () => {
    // Avec « 0 » : null.
    expect(directPlan(noKeys, { EARTH_DIRECT: '0' })).toBe(null);
    // Avec « off » : null.
    expect(directPlan(noKeys, { EARTH_DIRECT: 'off' })).toBe(null);
    // Avec « 1 » : le plan complet.
    expect(directPlan(noKeys, { EARTH_DIRECT: '1' })!.length).toBe(noKeys.length);
  // Fin du test.
  });
// Fin du deuxième groupe.
});

// Troisième groupe : les tuiles vides.
describe('tuiles vides des sources nationales', () => {
  // Fonction flat : un canal uni, de moyenne donnée.
  const flat = (mean: number) => ({ mean, stdev: 0 });

  // Premier test : la détection.
  it('reconnaît une tuile blanche, noire ou transparente, pas une photo', () => {
    // Toute blanche : vide.
    expect(isBlank([flat(255), flat(255), flat(255)])).toBe(true);
    // Toute noire : vide.
    expect(isBlank([flat(0), flat(0), flat(0)])).toBe(true);
    // Toute transparente : vide.
    expect(isBlank([flat(120), flat(130), flat(90), flat(0)])).toBe(true);
    // Une photo : pas vide.
    expect(isBlank([{ mean: 110, stdev: 40 }, { mean: 120, stdev: 38 }, { mean: 90, stdev: 35 }])).toBe(false);
    // Mer unie mais colorée : gardée.
    // Unie mais colorée : pas vide.
    expect(isBlank([flat(20), flat(60), flat(110)])).toBe(false);
    // Photo opaque avec canal alpha plein : gardée.
    // Une photo avec un canal alpha plein : pas vide.
    expect(isBlank([{ mean: 110, stdev: 40 }, { mean: 120, stdev: 38 }, { mean: 90, stdev: 35 }, flat(255)])).toBe(false);
  // Fin du test.
  });

  // Deuxième test : les descendantes.
  it('une tuile vue vide écarte la source pour toutes ses descendantes', () => {
    // Mémoire neuve.
    const memo = new CoverageMemo();
    // Note une tuile vide pour la Suisse.
    memo.mark('ch', 12, 2130, 1450);
    // Cette tuile : vide.
    expect(memo.isEmpty('ch', 12, 2130, 1450, 12)).toBe(true);
    // Une descendante, trois niveaux plus bas : vide.
    expect(memo.isEmpty('ch', 15, 2130 * 8 + 3, 1450 * 8 + 5, 12)).toBe(true);
    // La tuile voisine : pas vide.
    expect(memo.isEmpty('ch', 12, 2131, 1450, 12)).toBe(false);
    // La même descendante pour l'IGN : pas vide.
    expect(memo.isEmpty('ign', 15, 2130 * 8 + 3, 1450 * 8 + 5, 12)).toBe(false);
  // Fin du test.
  });

  // Troisième test : la capacité.
  it('oublie les plus anciennes au-delà de sa capacité', () => {
    // Mémoire de deux tuiles.
    const memo = new CoverageMemo(2);
    // Note une première tuile,
    memo.mark('ch', 12, 1, 1);
    // une deuxième,
    memo.mark('ch', 12, 2, 2);
    // une troisième.
    memo.mark('ch', 12, 3, 3);
    // La première est oubliée.
    expect(memo.isEmpty('ch', 12, 1, 1, 12)).toBe(false);
    // La troisième est gardée.
    expect(memo.isEmpty('ch', 12, 3, 3, 12)).toBe(true);
  // Fin du test.
  });
// Fin du troisième groupe.
});

// Quatrième groupe : les tuiles absentes.
describe('tuile absente chez une source', () => {
  // Test unique : les codes HTTP.
  it('404, 204 et 410 veulent dire « pas de tuile ici », pas une panne', () => {
    // 404, 204 et 410 : absente.
    for (const status of [404, 204, 410]) expect(isAbsentStatus(status)).toBe(true);
    // Les autres codes : non.
    for (const status of [200, 400, 403, 429, 500, 502, 503]) expect(isAbsentStatus(status)).toBe(false);
    // Erreur 404 avec un détail.
    const e = new TileAbsentError(404, 'text/xml');
    // Elle garde le code.
    expect(e.status).toBe(404);
    // Son message porte le code et le détail.
    expect(e.message).toBe('HTTP 404 text/xml');
    // Ce n'est pas une erreur « hors couverture ».
    expect(e instanceof NoCoverageError).toBe(false);
    // Sans détail : le code seul.
    expect(new TileAbsentError(204).message).toBe('HTTP 204');
  // Fin du test.
  });
// Fin du quatrième groupe.
});

// Cinquième groupe : le coupe-circuit.
describe('coupe-circuit des sources', () => {
  // Premier test : la mise à l'écart.
  it('écarte une source après 3 échecs d’affilée, puis la réessaie après une minute', () => {
    // Horloge d'essai, à zéro.
    let t = 0;
    // État de santé branché sur cette horloge.
    const h = new SourceHealth(() => t);
    // Au départ : utilisable.
    expect(h.usable('ign')).toBe(true);
    // Premier échec : pas écartée.
    expect(h.failure('ign')).toBe(false);
    // Deuxième échec : pas écartée.
    expect(h.failure('ign')).toBe(false);
    // Troisième échec : écartée.
    expect(h.failure('ign')).toBe(true);
    // Elle n'est plus utilisable.
    expect(h.usable('ign')).toBe(false);
    // 59 secondes plus tard,
    t = 59_000;
    // toujours écartée.
    expect(h.usable('ign')).toBe(false);
    // 61 secondes plus tard,
    t = 61_000;
    // de nouveau utilisable.
    expect(h.usable('ign')).toBe(true);
  // Fin du test.
  });

  // Second test : la réussite.
  it('une réussite remet le compteur à zéro', () => {
    // État de santé, horloge figée à zéro.
    const h = new SourceHealth(() => 0);
    // Un échec,
    h.failure('usgs');
    // un deuxième,
    h.failure('usgs');
    // puis une réussite.
    h.success('usgs', 120);
    // L'échec suivant n'écarte pas la source.
    expect(h.failure('usgs')).toBe(false);
    // Elle reste utilisable.
    expect(h.usable('usgs')).toBe(true);
  // Fin du test.
  });
// Fin du cinquième groupe.
});

// Sixième groupe : la cascade rapprochée.
describe('cascade rapprochée', () => {
  // Fonction wait : attend un nombre de millisecondes.
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Premier test : la préférée répond à temps.
  it('la source préférée gagne quand elle répond avant le délai', async () => {
    // Indicateur « la seconde est partie ».
    let second = false;
    // Lance deux tâches :
    const r = await hedged([
      // la première répond « a » en 5 ms ;
      async () => { await wait(5); return 'a'; },
      // la seconde note son départ et répond « b ».
      async () => { second = true; return 'b'; },
    // Délai de 200 ms.
    ], 200);
    // La première gagne.
    expect(r).toEqual({ value: 'a', index: 0 });
    // La seconde n'est pas partie.
    expect(second).toBe(false);
  // Fin du test.
  });

  // Deuxième test : la préférée tarde.
  it('la suivante part quand la préférée tarde, et la première réponse gagne', async () => {
    // Indicateur « la lente a été annulée ».
    let aborted = false;
    // Lance deux tâches :
    const r = await hedged([
      // la première crée une promesse,
      (signal) => new Promise<string>((resolve) => {
        // qui répond « lente » au bout de 300 ms,
        const t = setTimeout(() => resolve('lente'), 300);
        // et qui, annulée, le note et arrête sa minuterie ;
        signal.addEventListener('abort', () => { aborted = true; clearTimeout(t); });
      // fin de la première.
      }),
      // La seconde répond « rapide » en 5 ms.
      async () => { await wait(5); return 'rapide'; },
    // Délai de 20 ms.
    ], 20);
    // La seconde gagne.
    expect(r).toEqual({ value: 'rapide', index: 1 });
    // La lente a été annulée.
    expect(aborted).toBe(true);
  // Fin du test.
  });

  // Troisième test : la préférée échoue.
  it('la suivante part tout de suite quand la préférée échoue', async () => {
    // Heure de départ.
    const started = Date.now();
    // Lance deux tâches :
    const r = await hedged([
      // la première échoue tout de suite ;
      async () => { throw new Error('HTTP 503'); },
      // la seconde répond « secours ».
      async () => 'secours',
    // Délai de 5 secondes.
    ], 5_000);
    // La seconde gagne.
    expect(r).toEqual({ value: 'secours', index: 1 });
    // En moins d'une seconde : elle n'a pas attendu le délai.
    expect(Date.now() - started).toBeLessThan(1_000);
  // Fin du test.
  });

  // Quatrième test : toutes échouent.
  it('rejette avec la dernière erreur quand toutes échouent', async () => {
    // Lance deux tâches :
    await expect(hedged([
      // la première échoue avec « un » ;
      async () => { throw new Error('un'); },
      // la seconde avec « deux ».
      async () => { throw new Error('deux'); },
    // Le rejet porte « deux ».
    ], 10)).rejects.toThrow('deux');
    // Sans tâche : rejet « aucune source ».
    await expect(hedged([], 10)).rejects.toThrow('aucune source');
  // Fin du test.
  });
// Fin du sixième groupe.
});
