// Ouvre l'import de ce qui est testé :
import {
  // les constantes, les sources et les fonctions du module.
  LIVE_LATENCY_MS, LIVE_MAX_ZOOM, LIVE_SLOT_MS, LIVE_SOURCES, isLiveTile, liveCandidates, liveExpiry, liveSlot, liveTemplate, liveTime,
// Fin de l'import.
} from './earth-live';

/** Tuile Web Mercator qui contient (lon, lat) au niveau z. */
// Fonction tileAt : la tuile Web Mercator qui contient un point.
function tileAt(lon: number, lat: number, z: number): [number, number, number] {
  // Nombre de tuiles par côté.
  const n = 2 ** z;
  // Latitude en radians.
  const r = (lat * Math.PI) / 180;
  // Le niveau, la colonne et la ligne (formule du Web Mercator).
  return [z, Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
// Fin de tileAt.
}
// Fonction ids : les identifiants d'une liste de sources.
const ids = (list: Array<{ id: string }>) => list.map((s) => s.id);

// Premier groupe : les créneaux.
describe('Terre à l’instant T : créneaux de dix minutes', () => {
  // Instant de référence : le 11 novembre 2026 à 20 h 17 min 30 s UTC (le mois 10 est novembre).
  const now = Date.UTC(2026, 10, 11, 20, 17, 30);

  // Premier test : le créneau demandé.
  it('demande la dernière image sûrement disponible (il y a 50 minutes, arrondie à 10 minutes)', () => {
    // Créneau à cet instant.
    const slot = liveSlot(now);
    // C'est 19 h 20.
    expect(liveTime(slot)).toBe('2026-11-11T19:20:00Z');
    // Il tombe sur un multiple de 10 minutes.
    expect(slot % LIVE_SLOT_MS).toBe(0);
    // Il a au moins 50 minutes de retard.
    expect(now - slot).toBeGreaterThanOrEqual(LIVE_LATENCY_MS);
    // Et moins de 60.
    expect(now - slot).toBeLessThan(LIVE_LATENCY_MS + LIVE_SLOT_MS);
  // Fin du test.
  });

  // Deuxième test : le changement de créneau.
  it('le créneau change toutes les dix minutes, et l’adresse des tuiles avec lui', () => {
    // Créneau à l'instant de référence.
    const slot = liveSlot(now);
    // Deux minutes plus tard : le même.
    expect(liveSlot(now + 2 * 60_000)).toBe(slot);
    // Trois minutes plus tard : le suivant.
    expect(liveSlot(now + 3 * 60_000)).toBe(slot + LIVE_SLOT_MS);
    // Forme du modèle d'adresse.
    expect(liveTemplate(slot)).toMatch(/^\/api\/v1\/tiles\/earth\/earth-live\/\{z\}\/\{x\}\/\{y\}\?t=\d+$/);
    // Il change avec le créneau.
    expect(liveTemplate(slot)).not.toBe(liveTemplate(slot + LIVE_SLOT_MS));
  // Fin du test.
  });

  // Troisième test : l'expiration.
  it('la fiche expire de sorte que le navigateur la relise au début du créneau suivant', () => {
    // Créneau à l'instant de référence.
    const slot = liveSlot(now);
    // Le navigateur relit la fiche dix minutes avant son expiration : ce doit être l'instant où le créneau change.
    // Instant où le navigateur relit la fiche : dix minutes avant l'expiration.
    const reread = Date.parse(liveExpiry(slot)) - 10 * 60_000;
    // À cet instant, le créneau est le suivant.
    expect(liveSlot(reread)).toBe(slot + LIVE_SLOT_MS);
    // Une milliseconde avant, c'est encore l'ancien.
    expect(liveSlot(reread - 1)).toBe(slot);
  // Fin du test.
  });
// Fin du premier groupe.
});

// Second groupe : les fuseaux.
describe('Terre à l’instant T : un satellite par fuseau', () => {
  // Premier test : la couverture.
  it('les quatre fuseaux couvrent toutes les longitudes, sans trou ni recouvrement', () => {
    // Bords ouest et est de chaque fuseau, triés d'ouest en est.
    const edges = LIVE_SOURCES.map((s) => [s.bbox[0], s.bbox[2]]).sort((a, b) => a[0] - b[0]);
    // Le premier commence à 180° Ouest.
    expect(edges[0][0]).toBe(-180);
    // Le dernier finit à 180° Est.
    expect(edges[edges.length - 1][1]).toBe(180);
    // Chaque fuseau commence où le précédent finit.
    for (let i = 1; i < edges.length; i++) expect(edges[i][0]).toBe(edges[i - 1][1]);
  // Fin du test.
  });

  // Deuxième test : le bon satellite.
  it('choisit le satellite qui voit l’endroit', () => {
    // Paris : Meteosat.
    expect(ids(liveCandidates(...tileAt(2.35, 48.85, 6)))).toEqual(['meteosat']);    // Paris
    // New York : GOES-East.
    expect(ids(liveCandidates(...tileAt(-74, 40.7, 6)))).toEqual(['goes-east']);     // New York
    // Honolulu : GOES-West.
    expect(ids(liveCandidates(...tileAt(-157.8, 21.3, 6)))).toEqual(['goes-west']);  // Honolulu
    // Tokyo : Himawari.
    expect(ids(liveCandidates(...tileAt(139.7, 35.7, 6)))).toEqual(['himawari']);    // Tokyo
  // Fin du test.
  });

  // Troisième test : les pôles.
  it('aux pôles aucun satellite : le fond habituel reste seul', () => {
    // À 84,5° Nord : aucun satellite.
    expect(liveCandidates(...tileAt(0, 84.5, 7))).toEqual([]);
    // À 84,5° Sud : aucun non plus.
    expect(liveCandidates(...tileAt(120, -84.5, 7))).toEqual([]);
  // Fin du test.
  });

  // Quatrième test : une tuile sur deux fuseaux.
  it('une tuile à cheval sur deux fuseaux interroge les deux, le plus couvrant d’abord', () => {
    // Niveau 4, tuile de 112,5° O à 90° O : 6,5° pour GOES-West, 16° pour GOES-East.
    // Les deux satellites, le plus couvrant d'abord.
    expect(ids(liveCandidates(4, 3, 6))).toEqual(['goes-east', 'goes-west']);
    // Le monde entier (niveau 0) : les quatre satellites.
    // Au niveau 0, les quatre satellites.
    expect(ids(liveCandidates(0, 0, 0)).sort()).toEqual(['goes-east', 'goes-west', 'himawari', 'meteosat']);
  // Fin du test.
  });

  // Cinquième test : les adresses.
  it('adresses : requête WMS sur l’emprise de la tuile, à l’instant demandé, fond transparent', () => {
    // Les deux adresses de GOES-East pour une tuile et un instant.
    const [url, backup] = LIVE_SOURCES.find((s) => s.id === 'goes-east')!.urls(2, 1, 1, '2026-11-11T19:20:00Z');
    // La bonne couche.
    expect(url).toContain('LAYERS=GOES-East_ABI_GeoColor');
    // La projection Web Mercator.
    expect(url).toContain('CRS=EPSG:3857');
    // L'emprise de la tuile, en mètres.
    expect(url).toContain('BBOX=-10018754.171,0.000,0.000,10018754.171');
    // L'instant demandé.
    expect(url).toContain('TIME=2026-11-11T19:20:00Z');
    // Le fond transparent.
    expect(url).toContain('TRANSPARENT=TRUE');
    // Secours : tuile toute faite de la NOAA, ligne avant colonne.
    // L'adresse de secours finit par niveau, ligne, colonne.
    expect(backup).toMatch(/MERGEDGC_current\/ImageServer\/tile\/2\/1\/1$/);
    // Meteosat : d'abord le créneau demandé, puis la dernière image du service (sans instant).
    // Les deux adresses de Meteosat.
    const meteosat = LIVE_SOURCES.find((s) => s.id === 'meteosat')!.urls(3, 4, 2, '2026-11-11T19:20:00Z');
    // La bonne couche.
    expect(meteosat[0]).toContain('LAYERS=mtg_fd:rgb_geocolour');
    // La première porte un instant.
    expect(meteosat[0]).toContain('TIME=');
    // La seconde n'en porte pas.
    expect(meteosat[1]).not.toContain('TIME=');
  // Fin du test.
  });

  // Sixième test : les tuiles de la couche.
  it('tuiles de la couche : niveaux 0 à 7', () => {
    // La tuile du niveau 0 existe.
    expect(isLiveTile(0, 0, 0)).toBe(true);
    // La dernière tuile du niveau 7 existe.
    expect(isLiveTile(LIVE_MAX_ZOOM, 127, 127)).toBe(true);
    // Le niveau 8 n'existe pas.
    expect(isLiveTile(LIVE_MAX_ZOOM + 1, 0, 0)).toBe(false);
    // Une colonne hors de la grille n'existe pas.
    expect(isLiveTile(3, 8, 0)).toBe(false);
  // Fin du test.
  });
// Fin du second groupe.
});
