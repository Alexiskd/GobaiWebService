/**
 * Paramètres de l'astre sur le globe CesiumJS : les calques réglés dans l'app pour un astre de la scène three.js
 * (rues, frontières, littoraux, noms des pays et des villes, lieux et pays de la Lune) sont redessinés
 * sur son globe CesiumJS, avec les mêmes données et les mêmes interrupteurs.
 *
 * Moteur réglé par une table (OVERLAYS) : chaque ligne dit pour quel astre, quand le calque est voulu (lu dans le
 * moteur three.js), où sont ses données et sous quelle forme le dessiner (imagery, lines, labels, points). Ajouter un
 * paramètre = ajouter une ligne, pas un nouveau moteur.
 *
 * Deux moments :
 *  - superposition (de loin, le globe est dessiné par-dessus la scène three.js) : les calques dessinés en WebGL par
 *    three.js (lignes, noms des pays) sont cachés sous le globe ; ils sont donc redessinés ici. Les repères
 *    HTML (noms des villes, lieux de la Lune) restent ceux de three.js (`html: true` : pas de doublon) ;
 *  - de près (le globe a la main, three.js en attente et repères HTML masqués) : tous les calques sont dessinés ici.
 *
 * Fonctions de calcul pures (testées dans astre-solide.overlays.test.js) ; `GlobeOverlays` crée les objets CesiumJS.
 */

// Importe le fournisseur d'images qui lit une source de tuiles de l'app (les rues : tuiles dessinées par RoadSource).
import { tileSourceImageryProvider } from './astre-solide.imagery.js';
// Importe les lieux de la Lune (mêmes données que les repères three.js).
import { MOON_FEATURES } from '../../Engine/AstreSolideEngine/MoonEngine/moonFeatures.jsx';
// Importe les pays de la Lune : frontières et noms d'après les alunissages.
import { countryLabels, moonBorders } from '../../Engine/AstreSolideEngine/MoonEngine/moonCountries.jsx';
// Importe l'identifiant du calque des rues de la Terre.
import { ROADS_LAYER_ID } from '../../Engine/AstreSolideEngine/MapEngine/earth/roadSource.jsx';

/** Police des noms, celle de l'app. */
// Déclare et exporte la police des noms.
export const LABEL_FONT = '600 13px "Google Sans", system-ui, sans-serif';
/** Villes nommées au plus (les plus peuplées d'abord) : au-delà, le globe serait illisible et lent. */
// Déclare et exporte le nombre maximal de villes.
export const MAX_CITIES = 400;
/** Couleurs des calques (mêmes teintes que three.js : frontières dorées, littoraux crème). */
// Déclare et exporte les couleurs.
export const COLORS = { moonBorder: '#cfe3ff', border: '#ffd166', coast: '#f2efe6', label: '#ffffff', outline: '#000000' };

/**
 * Polylignes plates [lon, lat, lon, lat, …] (format de GET /borders) coupées au saut de l'antiméridien (plus de 180°
 * d'écart) : chaque morceau garde au moins deux points. Fonction pure.
 * @param {number[][]} lines
 * @returns {number[][]} morceaux, au même format
 */
// Déclare et exporte splitLines : les polylignes (début).
export function splitLines(lines) {
  // Morceaux produits.
  const out = [];
  // Pour chaque polyligne (début).
  for (const line of Array.isArray(lines) ? lines : []) {
    // Morceau en cours.
    let run = [];
    // Pour chaque point (début).
    for (let i = 0; i + 1 < line.length; i += 2) {
      // Saut de l'antiméridien depuis le point précédent : le morceau est fermé.
      if (run.length >= 2 && Math.abs(line[i] - run[run.length - 2]) > 180) { if (run.length >= 4) out.push(run); run = []; }
      // Point ajouté.
      run.push(line[i], line[i + 1]);
    // Fin des points.
    }
    // Dernier morceau, s'il a au moins deux points.
    if (run.length >= 4) out.push(run);
  // Fin des polylignes.
  }
  // Renvoie les morceaux.
  return out;
// Fin de splitLines.
}

/**
 * Distance (en rayons de l'astre) au-delà de laquelle un nom s'efface, d'après son rang (0 = le plus important).
 * Fonction pure.
 */
// Déclare et exporte fadeRadii : le rang (début).
export function fadeRadii(rank) {
  // Les 30 premiers : visibles de loin.
  if (rank < 30) return 0.6;
  // Jusqu'au 120e : à moyenne distance.
  if (rank < 120) return 0.25;
  // Les autres : de près seulement.
  return 0.1;
// Fin de fadeRadii.
}

/** Villes à nommer : les MAX_CITIES plus peuplées (capitales d'abord à population égale, visibles au moins à moyenne
 * distance). Fonction pure. */
// Déclare et exporte topCities : la liste des villes (début).
export function topCities(cities, max = MAX_CITIES) {
  // Liste copiée, triée par population décroissante (capitale d'abord en cas d'égalité), coupée.
  return (Array.isArray(cities) ? cities : [])
    .filter((c) => Number.isFinite(c?.lon) && Number.isFinite(c?.lat) && (c.native || c.name))
    .slice().sort((a, b) => (b.pop || 0) - (a.pop || 0) || (b.capital ? 1 : 0) - (a.capital ? 1 : 0))
    .slice(0, max)
    .map((c, rank) => ({ text: c.native || c.name, lon: c.lon, lat: c.lat, rank: c.capital ? Math.min(rank, 100) : rank }));
// Fin de topCities.
}

/** Lieux de la Lune des types choisis, rangés par niveau (0 : sites Apollo et grandes mers). Fonction pure. */
// Déclare et exporte moonPlaces : les types choisis et la liste des lieux (début).
export function moonPlaces(types, features = MOON_FEATURES) {
  // Types choisis (ensemble).
  const set = types instanceof Set ? types : new Set(types || []);
  // Lieux de ces types, avec leur rang d'après leur niveau.
  return features.filter((f) => set.has(f.type)).map((f) => ({ text: f.name, lon: f.lon, lat: f.lat, rank: f.tier === 0 ? 0 : f.tier === 1 ? 60 : 200 }));
// Fin de moonPlaces.
}

/** Pays de la Lune, calculés une seule fois (données figées). */
// memo : une fonction de calcul (début).
const memo = (fn) => { let v = null; return () => (v ??= fn()); };
// Frontières et noms des pays de la Lune, gardés.
const MOON_BORDERS = memo(() => Object.assign(moonBorders(), { ref: 'pays-lune' }));
const MOON_COUNTRY_LABELS = memo(() => Object.assign(countryLabels().map((c) => ({ ...c, rank: 0 })), { ref: 'pays-lune' }));

/** Signature d'un jeu de données : change quand les données changent (nouvelle liste ou autre longueur). */
// sig : les données (début).
const sig = (data) => (data ? `${data.length}:${data.ref ?? ''}` : 'none');

/**
 * La table des paramètres. Chaque ligne :
 *  - id, body : le calque et son astre ;
 *  - kind : 'imagery' (tuiles transparentes), 'lines', 'labels' ou 'points' ;
 *  - html : vrai si three.js le dessine en repères HTML (déjà visibles par-dessus le globe en superposition) ;
 *  - want(engine) : le calque est-il allumé dans l'app ?
 *  - data(engine) : ses données (null si pas encore reçues).
 */
// Déclare et exporte la table des paramètres (début).
export const OVERLAYS = [
  // Rues et routes (OpenFreeMap), le calque superposé de la Terre.
  { id: 'roads', body: 'earth', kind: 'imagery',
    want: (e) => e.tiledById?.earth?.tiles?.overlay?.id === ROADS_LAYER_ID,
    data: (e) => { const s = e.tiledById?.earth?.tiles?.overlay?.source; return s ? Object.assign([s], { ref: ROADS_LAYER_ID }) : null; } },
  // Frontières.
  { id: 'borders', body: 'earth', kind: 'lines', color: COLORS.border, alpha: 0.9,
    want: (e) => Boolean(e.bordersOn), data: (e) => e.borderData?.lines || null },
  // Littoraux (sauf quand le calque des rues donne les siens).
  { id: 'coasts', body: 'earth', kind: 'lines', color: COLORS.coast, alpha: 0.6,
    want: (e) => Boolean(e.coastsOn) && !e.coastsFromTiles, data: (e) => e.borderData?.coastlines || null },
  // Noms des pays (dessinés en WebGL par three.js).
  { id: 'countries', body: 'earth', kind: 'labels',
    want: (e) => Boolean(e.countryLabels?.enabled),
    data: (e) => (e.countryLabels?.items || []).map((c, i) => ({ text: c.text, lon: c.lon, lat: c.lat, rank: i < 40 ? 0 : 30 })) },
  // Noms des villes (repères HTML de three.js).
  { id: 'cities', body: 'earth', kind: 'labels', html: true,
    want: (e) => Boolean(e.worldLabels?.visible), data: (e) => topCities(e.worldCities) },
  // Lieux de la Lune (repères HTML de three.js).
  { id: 'moon-places', body: 'moon', kind: 'labels', html: true,
    want: (e) => (e.moonFeatureTypes?.size ?? 0) > 0, data: (e) => moonPlaces(e.moonFeatureTypes) },
  // Pays de la Lune : frontières entre les territoires des alunissages de chaque nation.
  { id: 'moon-borders', body: 'moon', kind: 'lines', color: COLORS.moonBorder, alpha: 0.85,
    want: (e) => Boolean(e.moonCountriesOn), data: () => MOON_BORDERS() },
  // Pays de la Lune : leurs noms, sur leur capitale.
  { id: 'moon-countries', body: 'moon', kind: 'labels',
    want: (e) => Boolean(e.moonCountriesOn), data: () => MOON_COUNTRY_LABELS() },
// Fin de la table.
];

/** Les calques de la table, dessinés sur un globe CesiumJS. */
// Déclare et exporte GlobeOverlays (début).
export class GlobeOverlays {
  /**
   * @param {{ Cesium: object, viewer: object, engine: object, body: { id: string, radiusKm: number }, ellipsoid: object }} o
   */
  // Constructeur (début).
  constructor({ Cesium, viewer, engine, body, ellipsoid }) {
    // Bibliothèque, globe, moteur three.js, astre et ellipsoïde.
    Object.assign(this, { Cesium, viewer, engine, body, ellipsoid });
    // Calques construits, par identifiant : { sig, show(on), destroy() }.
    this.items = new Map();
    // Lignes et noms cachés par le globe quand ils sont de l'autre côté (et non dessinés à travers lui).
    viewer.scene.globe.depthTestAgainstTerrain = true;
  // Fin du constructeur.
  }

  /**
   * Met chaque calque à jour : allumé ou éteint d'après l'app, reconstruit si ses données ont changé.
   * @param {boolean} active vrai de près (globe aux commandes), faux en superposition
   */
  // sync : de près ou non (début).
  sync(active) {
    // Une image à redessiner ?
    let changed = false;
    // Pour chaque ligne de la table de cet astre (début).
    for (const d of OVERLAYS) {
      // Autre astre : rien.
      if (d.body !== this.body.id) continue;
      // Voulu : allumé dans l'app, et pas en double avec un repère HTML de three.js visible en superposition.
      const want = d.want(this.engine) && (active || !d.html);
      // Données, si voulu.
      const data = want ? d.data(this.engine) : null;
      // Calque déjà construit.
      let it = this.items.get(d.id);
      // Pas voulu ou pas de données : caché.
      if (!want || !data?.length) { if (it?.visible) { it.show(false); changed = true; } continue; }
      // Données nouvelles : reconstruit.
      if (!it || it.sig !== sig(data)) { it?.destroy(); it = this.build(d, data); it.sig = sig(data); this.items.set(d.id, it); changed = true; }
      // Affiché.
      if (!it.visible) { it.show(true); changed = true; }
    // Fin de la table.
    }
    // Une image de plus si quelque chose a changé.
    if (changed) this.viewer.scene.requestRender();
  // Fin de sync.
  }

  /** Construit un calque d'après sa ligne et ses données. */
  // build : la ligne et les données (début).
  build(d, data) {
    // Bibliothèque, scène et rayon (m).
    const { Cesium, viewer, ellipsoid } = this, R = this.body.radiusKm * 1000;
    // Tuiles transparentes (les rues) (début).
    if (d.kind === 'imagery') {
      // Couche posée au-dessus du fond de carte.
      const layer = viewer.imageryLayers.addImageryProvider(tileSourceImageryProvider(Cesium, { source: data[0], projectionId: data[0].info?.projection || 'mercator', ellipsoid, alpha: true }));
      // Renvoie le calque.
      return { visible: true, show(on) { layer.show = on; this.visible = on; }, destroy() { viewer.imageryLayers.remove(layer, true); } };
    // Fin des tuiles.
    }
    // Lignes (frontières, littoraux) (début).
    if (d.kind === 'lines') {
      // Collection de lignes, à 30 m au-dessus du sol (pas de scintillement avec le globe).
      const coll = viewer.scene.primitives.add(new Cesium.PolylineCollection());
      // Matière : la couleur du calque.
      const material = Cesium.Material.fromType('Color', { color: Cesium.Color.fromCssColorString(d.color).withAlpha(d.alpha ?? 1) });
      // Chaque morceau ajouté.
      for (const run of splitLines(data)) {
        // Points avec leur hauteur.
        const pts = []; for (let i = 0; i < run.length; i += 2) pts.push(run[i], run[i + 1], 30);
        // Ligne de 1,5 pixel.
        coll.add({ positions: Cesium.Cartesian3.fromDegreesArrayHeights(pts, ellipsoid), width: 1.5, material });
      // Fin des morceaux.
      }
      // Renvoie le calque.
      return { visible: true, show(on) { coll.show = on; this.visible = on; }, destroy() { viewer.scene.primitives.remove(coll); } };
    // Fin des lignes.
    }
    // Noms, et points des repères si la ligne en demande (début).
    const labels = viewer.scene.primitives.add(new Cesium.LabelCollection());
    // Points (lignes de type « points »).
    const points = d.kind === 'points' ? viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection()) : null;
    // Couleurs.
    const fill = Cesium.Color.fromCssColorString(COLORS.label), outline = Cesium.Color.fromCssColorString(COLORS.outline).withAlpha(0.85);
    // Chaque nom (début).
    for (const p of data) {
      // Position, un peu au-dessus du sol.
      const position = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 50, ellipsoid);
      // Distance d'effacement d'après son rang, en rayons de l'astre.
      const far = fadeRadii(p.rank) * R;
      // Le nom : visible de près, effacé au-delà de sa distance ; avancé vers l'œil (pas mangé par le relief).
      labels.add({
        position, text: p.text, font: LABEL_FONT, fillColor: fill, outlineColor: outline, outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, points ? -8 : 0), eyeOffset: new Cesium.Cartesian3(0, 0, -1000),
        translucencyByDistance: new Cesium.NearFarScalar(far * 0.6, 1, far, 0),
      });
      // Repère : un point.
      if (points) points.add({ position, pixelSize: 7, color: Cesium.Color.fromCssColorString(d.color), outlineColor: outline, outlineWidth: 1 });
    // Fin des noms.
    }
    // Renvoie le calque.
    return {
      visible: true,
      show(on) { labels.show = on; if (points) points.show = on; this.visible = on; },
      destroy() { viewer.scene.primitives.remove(labels); if (points) viewer.scene.primitives.remove(points); },
    };
  // Fin de build.
  }

  /** Libère tous les calques (le globe est détruit ou change d'astre). */
  // destroy (début).
  destroy() {
    // Chaque calque libéré.
    for (const it of this.items.values()) { try { it.destroy(); } catch { /* globe déjà détruit */ } }
    // Plus rien.
    this.items.clear();
  // Fin de destroy.
  }
// Fin de GlobeOverlays.
}
