// Pays de la Lune : un découpage imaginaire de la Lune d'après les alunissages réussis et les fusées terrestres
// capables d'y aller. Chaque site d'alunissage (MOON_FEATURES, type « landing ») appartient au pays dont la fusée l'a
// lancé ; chaque point de la Lune appartient au site le plus proche (cellules de Voronoï sur la sphère) ; les cellules
// d'un même pays forment un pays lunaire. Les frontières sont les bords entre cellules de pays différents.
//
// Les noms des pays lunaires sont inventés ; leur « descendance sémantique » suit l'histoire de leur nom, du mot le plus
// ancien jusqu'au pays (racine, mythe, programme spatial). Les sites, missions et fusées sont réels.
//
// Fonctions pures, testées dans moonCountries.test.jsx.

// Importe les lieux de la Lune (les sites d'alunissage en font partie).
import { MOON_FEATURES } from './moonFeatures.jsx';

/**
 * Les pays lunaires. Pour chacun : sa nation terrestre, les fusées qui ont posé ses sondes, ses missions (préfixes
 * des noms de sites), sa capitale (un site réel) et la descendance sémantique de son nom, du plus ancien au plus récent.
 */
// Déclare et exporte les pays lunaires (début).
export const MOON_COUNTRIES = [
  // Apollonie : les alunissages américains.
  {
    id: 'apollonie', name: 'Apollonie', earth: 'États-Unis', color: '#7fb3ff',
    rockets: ['Saturn V', 'Atlas-Centaur', 'Falcon 9'], missions: ['Apollo', 'Surveyor', 'IM-', 'Blue Ghost'],
    capital: { name: 'Tranquillité', site: 'Apollo 11' },
    descent: [
      { term: 'Ἀπόλλων (Apollon)', meaning: 'dieu grec de la lumière et des arts' },
      { term: 'programme Apollo', meaning: 'NASA, 1961 : six équipages posés de 1969 à 1972' },
      { term: 'Apollonie', meaning: '« terre d’Apollon »' },
    ],
  },
  // Lunovie : les alunissages soviétiques.
  {
    id: 'lunovie', name: 'Lunovie', earth: 'URSS / Russie', color: '#ff8a7a',
    rockets: ['Molniya', 'Proton'], missions: ['Luna', 'Lunokhod'],
    capital: { name: 'Descensus', site: 'Luna 9' },
    descent: [
      { term: '*leuk-', meaning: 'racine indo-européenne « lumière »' },
      { term: 'lūna (latin)', meaning: '« la lumineuse », la Lune' },
      { term: 'луна (russe)', meaning: 'la Lune, nom du programme Luna (1959-1976)' },
      { term: 'Lunovie', meaning: '« pays de Luna »' },
    ],
  },
  // Guanghanie : les alunissages chinois.
  {
    id: 'guanghanie', name: 'Guanghanie', earth: 'Chine', color: '#ffd36b',
    rockets: ['Longue Marche 3B', 'Longue Marche 5'], missions: ['Chang’e', "Chang'e"],
    capital: { name: 'Tianhe', site: 'Chang’e 4' },
    descent: [
      { term: '嫦娥 (Cháng’é)', meaning: 'déesse qui s’enfuit sur la Lune' },
      { term: '廣寒宮 (Guǎnghán gōng)', meaning: '« palais du vaste froid », sa demeure lunaire' },
      { term: 'programme Chang’e', meaning: 'CNSA, 2007 : quatre alunissages de 2013 à 2024' },
      { term: 'Guanghanie', meaning: '« pays du palais de Guanghan »' },
    ],
  },
  // Chandrapur : l'alunissage indien.
  {
    id: 'chandrapur', name: 'Chandrapur', earth: 'Inde', color: '#8fe3a8',
    rockets: ['LVM3'], missions: ['Chandrayaan'],
    capital: { name: 'Shiv Shakti', site: 'Chandrayaan-3' },
    descent: [
      { term: 'candra (sanskrit)', meaning: '« ce qui brille », la Lune' },
      { term: 'Chandrayaan', meaning: 'candra + yāna « véhicule » : « véhicule lunaire » (ISRO)' },
      { term: 'Chandrapur', meaning: 'candra + pura « cité » : « cité de la Lune »' },
    ],
  },
  // Kaguyakuni : l'alunissage japonais.
  {
    id: 'kaguyakuni', name: 'Kaguyakuni', earth: 'Japon', color: '#e9a6ff',
    rockets: ['H-IIA'], missions: ['SLIM'],
    capital: { name: 'Shioli', site: 'SLIM' },
    descent: [
      { term: 'かぐや姫 (Kaguya-hime)', meaning: 'princesse venue de la Lune, Conte du coupeur de bambous' },
      { term: 'Kaguya (SELENE)', meaning: 'sonde lunaire japonaise, 2007' },
      { term: 'Kaguyakuni', meaning: 'Kaguya + 国 kuni « pays » : « pays de Kaguya »' },
    ],
  },
// Fin des pays.
];

/** Pays lunaire d'un site d'alunissage, d'après le nom de sa mission (préfixe), ou null. */
// Déclare et exporte countryOfSite : le nom du site (début).
export function countryOfSite(name) {
  // Premier pays dont une mission commence le nom.
  return MOON_COUNTRIES.find((c) => c.missions.some((m) => String(name).startsWith(m))) ?? null;
// Fin de countryOfSite.
}

/** Point de la sphère unité d'une longitude et d'une latitude (degrés). */
// toVec : longitude et latitude (début).
const toVec = (lon, lat) => {
  // En radians.
  const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180;
  // Coordonnées.
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
// Fin de toVec.
};
/** Longitude et latitude (degrés) d'un point de la sphère. */
// toLonLat : le point (début).
const toLonLat = ([x, y, z]) => [(Math.atan2(y, x) * 180) / Math.PI, (Math.asin(Math.max(-1, Math.min(1, z))) * 180) / Math.PI];
// Produit scalaire.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Vecteur normé.
const norm = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
// Produit vectoriel.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Sites d'alunissage rattachés à un pays : [{ name, lon, lat, country, v }]. */
// Déclare et exporte landingSites : les lieux de la Lune (début).
export function landingSites(features = MOON_FEATURES) {
  // Sites d'alunissage dont le pays est connu, avec leur point sur la sphère.
  return features.filter((f) => f.type === 'landing').map((f) => ({ name: f.name, lon: f.lon, lat: f.lat, country: countryOfSite(f.name)?.id ?? null, v: toVec(f.lon, f.lat) })).filter((s) => s.country);
// Fin de landingSites.
}

/** Pays lunaire d'un point (longitude, latitude) : celui du site d'alunissage le plus proche. */
// Déclare et exporte countryAt : longitude, latitude et sites (début).
export function countryAt(lon, lat, sites = landingSites()) {
  // Point.
  const p = toVec(lon, lat);
  // Site le plus proche : celui dont le produit scalaire est le plus grand.
  let best = null, bd = -2;
  for (const s of sites) { const d = dot(p, s.v); if (d > bd) { bd = d; best = s; } }
  // Son pays.
  return best?.country ?? null;
// Fin de countryAt.
}

/**
 * Frontières entre pays lunaires : polylignes plates [lon, lat, lon, lat, …], comme les frontières de la Terre.
 * Pour chaque paire de sites de pays différents, le grand cercle à égale distance des deux est parcouru par pas de
 * `stepDeg` ; les morceaux où ces deux sites sont les plus proches de tous forment un bord de frontière.
 */
// Déclare et exporte moonBorders : les sites et le pas en degrés (début).
export function moonBorders(sites = landingSites(), stepDeg = 0.5) {
  // Polylignes produites.
  const out = [];
  // Nombre de pas sur un tour.
  const n = Math.round(360 / stepDeg);
  // Pour chaque paire de sites (début).
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) {
    // Même pays : pas de frontière entre eux.
    if (sites[i].country === sites[j].country) continue;
    // Normale du plan à égale distance des deux sites.
    const nrm = norm([sites[i].v[0] - sites[j].v[0], sites[i].v[1] - sites[j].v[1], sites[i].v[2] - sites[j].v[2]]);
    // Deux axes de ce plan.
    const u = norm(cross(nrm, Math.abs(nrm[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), w = cross(nrm, u);
    // Morceau en cours.
    let run = [];
    // Tour du grand cercle (un pas de plus pour refermer) (début).
    for (let k = 0; k <= n; k++) {
      // Point du grand cercle.
      const t = (k / n) * 2 * Math.PI, p = [Math.cos(t) * u[0] + Math.sin(t) * w[0], Math.cos(t) * u[1] + Math.sin(t) * w[1], Math.cos(t) * u[2] + Math.sin(t) * w[2]];
      // Distance (produit scalaire) aux deux sites (égale par construction).
      const d = dot(p, sites[i].v);
      // Ces deux sites sont-ils les plus proches ? (et pas les plus éloignés : moitié proche du grand cercle)
      let edge = d > -0.999;
      for (let m = 0; edge && m < sites.length; m++) if (m !== i && m !== j && dot(p, sites[m].v) > d + 1e-9) edge = false;
      // Sur le bord : point ajouté ; sinon le morceau est fermé.
      if (edge) run.push(...toLonLat(p)); else { if (run.length >= 4) out.push(run); run = []; }
    // Fin du tour.
    }
    // Dernier morceau.
    if (run.length >= 4) out.push(run);
  // Fin des paires.
  }
  // Renvoie les polylignes.
  return out;
// Fin de moonBorders.
}

/** Noms des pays lunaires, posés sur leur capitale (sinon au milieu de leurs sites) : [{ id, text, lon, lat }]. */
// Déclare et exporte countryLabels : les sites (début).
export function countryLabels(sites = landingSites()) {
  // Pour chaque pays qui a au moins un site (début).
  return MOON_COUNTRIES.map((c) => {
    // Ses sites.
    const own = sites.filter((s) => s.country === c.id);
    // Aucun : pas de nom.
    if (!own.length) return null;
    // Sa capitale (un de ses sites), sinon le milieu de ses sites sur la sphère.
    const cap = own.find((s) => s.name === c.capital.site);
    const [lon, lat] = cap ? [cap.lon, cap.lat] : toLonLat(norm(own.reduce((a, s) => [a[0] + s.v[0], a[1] + s.v[1], a[2] + s.v[2]], [0, 0, 0])));
    // Le nom.
    return { id: c.id, text: c.name, lon, lat };
  // Fin des pays.
  }).filter(Boolean);
// Fin de countryLabels.
}
