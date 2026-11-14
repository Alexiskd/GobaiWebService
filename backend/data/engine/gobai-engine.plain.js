// Moteur Go白 — texte en clair, servi CHIFFRÉ par l'API (voir services/engine). THREE est fourni par l'hôte.
'use strict';

// Calculs des éruptions du Soleil (sans three.js, donc testables seuls) : régions actives, trajectoire balistique
// de la matière projetée, et tableaux de particules envoyés au shader de sunSurface.jsx.
//
// Modèle : chaque région active projette, à intervalles réguliers, une gerbe de matière. Chaque grain part de la
// surface avec une vitesse verticale `vUp` et une vitesse le long de la surface `vTan`, puis retombe sous la gravité
// (mêmes formules qu'une projection volcanique : hauteur = vUp·t − g·t²/2). Les distances sont en rayons solaires
// et le temps en secondes d'affichage : le mouvement est très accéléré par rapport au vrai Soleil, où une
// protubérance met des heures à monter et retomber.

/** Gravité du modèle, en rayons solaires par seconde carrée (temps d'affichage accéléré). */
// Déclare et exporte la gravité du modèle.
const ERUPTION_GRAVITY = 0.02;
/** Durée pendant laquelle une région active projette de la matière, en secondes. */
// Déclare et exporte la durée d'une gerbe : 6 secondes.
const ERUPTION_BURST_S = 6;
/** Vitesse verticale de départ la plus faible et la plus forte, en rayons solaires par seconde. */
// Déclare et exporte la vitesse verticale minimale.
const ERUPTION_V_MIN = 0.04;
// Déclare et exporte la vitesse verticale maximale.
const ERUPTION_V_MAX = 0.13;
/** Latitude maximale des régions actives, en degrés : les taches et les éruptions restent près de l'équateur. */
// Déclare et exporte la latitude maximale des régions actives : 35 degrés.
const ACTIVE_LATITUDE_DEG = 35;
/** Nombre maximal de régions actives, fixé aussi dans le shader de la surface. */
// Déclare et exporte le nombre maximal de régions actives : 8.
const MAX_SITES = 8;

/**
 * Générateur de nombres pseudo-aléatoires (mulberry32) : la même graine donne toujours la même suite, donc le même
 * Soleil à chaque visite et dans les tests.
 */
// Déclare et exporte seededRandom : la graine.
function seededRandom(seed) {
  // État du générateur, en entier non signé de 32 bits.
  let a = seed >>> 0;
  // Renvoie la fonction qui donne le nombre suivant (début).
  return () => {
    // Avance l'état.
    a = (a + 0x6d2b79f5) >>> 0;
    // Premier mélange des bits.
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    // Second mélange des bits.
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    // Nombre entre 0 inclus et 1 exclu.
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  // Fin de la fonction renvoyée.
  };
// Fin de seededRandom.
}

/** Durée du vol d'un grain lancé à la vitesse verticale `vUp` : il retombe à la surface après 2·vUp/g. */
// Déclare et exporte flightTime : la vitesse verticale et la gravité.
function flightTime(vUp, gravity = ERUPTION_GRAVITY) {
  // Renvoie la durée du vol.
  return (2 * vUp) / gravity;
// Fin de flightTime.
}

/** Hauteur maximale atteinte, en rayons solaires : vUp²/(2·g). */
// Déclare et exporte apexHeight : la vitesse verticale et la gravité.
function apexHeight(vUp, gravity = ERUPTION_GRAVITY) {
  // Renvoie la hauteur maximale.
  return (vUp * vUp) / (2 * gravity);
// Fin de apexHeight.
}

/**
 * État d'un grain `age` secondes après son départ : `alive` (encore en vol), `height` (hauteur au-dessus de la
 * surface, en rayons) et `arc` (distance parcourue le long de la surface, en rayons). Le shader refait ce calcul.
 */
// Déclare et exporte particleState : l'âge, la vitesse verticale, la vitesse le long de la surface et la gravité.
function particleState(age, vUp, vTan, gravity = ERUPTION_GRAVITY) {
  // En vol : entre le départ et la retombée.
  const alive = age >= 0 && age <= flightTime(vUp, gravity);
  // Hauteur balistique, jamais sous la surface.
  const height = alive ? Math.max(0, vUp * age - 0.5 * gravity * age * age) : 0;
  // Distance le long de la surface.
  const arc = alive ? vTan * age : 0;
  // Renvoie l'état.
  return { alive, height, arc };
// Fin de particleState.
}

/**
 * Âge d'un grain à l'instant `time` : chaque région recommence sa gerbe toutes les `period` secondes, décalée de
 * `offset` ; le grain part `delay` secondes après le début de la gerbe. Toujours entre 0 et `period`.
 */
// Déclare et exporte particleAge : l'instant, la période, le décalage de la région et le retard du grain.
function particleAge(time, period, offset, delay) {
  // Temps écoulé depuis le départ du grain.
  const t = time - offset - delay;
  // Ramené dans la période, même pour un temps négatif.
  return t - period * Math.floor(t / period);
// Fin de particleAge.
}

/** Rotation synodique du Soleil vue de la Terre, en degrés par jour : une région dérive d'est en ouest à ce rythme. */
// Déclare et exporte la dérive synodique : 360 degrés en 27,2753 jours.
const SYNODIC_DEG_PER_DAY = 360 / 27.2753;

/** Ramène un angle en degrés dans l'intervalle ]-180, 180]. */
// Déclare et exporte wrapDeg : l'angle en degrés.
function wrapDeg(deg) {
  // L'angle ramené dans [0, 360[.
  const d = deg - 360 * Math.floor(deg / 360);
  // Au-delà de 180 degrés, on compte depuis l'autre bord.
  return d > 180 ? d - 360 : d;
// Fin de wrapDeg.
}

/**
 * Longitude de Stonyhurst d'une région à l'instant `toMs`, connaissant sa longitude `lon` (en degrés, positive à
 * l'ouest) à l'instant `fromMs` : le Soleil tourne, la région dérive vers l'ouest à la vitesse synodique.
 */
// Déclare et exporte driftStonyhurst : la longitude, l'instant de référence et l'instant visé.
function driftStonyhurst(lon, fromMs, toMs) {
  // Nombre de jours écoulés entre les deux instants.
  const days = (toMs - fromMs) / 86400000;
  // La longitude avancée de la dérive, ramenée dans ]-180, 180].
  return wrapDeg(lon + SYNODIC_DEG_PER_DAY * days);
// Fin de driftStonyhurst.
}

/**
 * Repère local d'un point de la surface, à partir de sa latitude et de sa longitude en radians : sa direction
 * (axe y = pôle nord du Soleil), l'est local et le nord local. Sert à coucher l'arche d'une éruption.
 */
// Déclare et exporte localFrame : la latitude et la longitude, en radians.
function localFrame(lat, lon) {
  // Direction du point, unitaire.
  const dir = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
  // Longueur de la projection de la direction dans le plan de l'équateur.
  const el = Math.hypot(dir[2], dir[0]) || 1;
  // Direction de l'est local : produit vectoriel de l'axe des pôles et de la direction, rendu unitaire.
  const east = [dir[2] / el, 0, -dir[0] / el];
  // Direction du nord local : produit vectoriel de la direction et de l'est.
  const north = [dir[1] * east[2] - dir[2] * east[1], dir[2] * east[0] - dir[0] * east[2], dir[0] * east[1] - dir[1] * east[0]];
  // Renvoie les trois axes.
  return { dir, east, north };
// Fin de localFrame.
}

/**
 * Force d'une éruption d'après sa classe GOES (« C3.2 », « M1.4 », « X2.0 »), entre 0 et 1 : la lettre donne
 * l'ordre de grandeur (un facteur dix par lettre) et le nombre qui suit la gradue à l'intérieur de sa classe.
 */
// Déclare et exporte flareStrength : la classe GOES.
function flareStrength(cls) {
  // Sans texte : force nulle.
  if (typeof cls !== 'string' || !cls) return 0;
  // La lettre de la classe, en majuscule.
  const letter = cls[0].toUpperCase();
  // Le nombre qui suit, 1 par défaut.
  const value = Number.parseFloat(cls.slice(1)) || 1;
  // Palier de départ de chaque classe : A et B sont négligeables, X est au maximum.
  const base = { A: 0, B: 0.1, C: 0.3, M: 0.6, X: 0.85 }[letter];
  // Lettre inconnue : force nulle.
  if (base === undefined) return 0;
  // Graduation à l'intérieur de la classe : le logarithme décimal du nombre, borné à une classe d'écart.
  const inside = Math.min(1, Math.max(0, Math.log10(Math.max(1, value))));
  // La force, bornée à 1.
  return Math.min(1, base + inside * 0.15);
// Fin de flareStrength.
}

/**
 * Force d'une région active, entre 0 et 1, d'après ce que la NOAA en publie : d'abord les probabilités d'éruption
 * des prochaines 24 heures (une région qui va éclater compte plus qu'une grande région calme), ensuite la surface
 * du groupe de taches, qui sert de repli quand les probabilités sont nulles.
 */
// Déclare et exporte regionStrength : la région.
function regionStrength(region) {
  // Les probabilités, absentes ou non.
  const p = region?.probability || {};
  // Part des probabilités : les classes fortes pèsent davantage, le tout borné à 1.
  const risk = Math.min(1, ((p.c || 0) * 0.3 + (p.m || 0) * 1.4 + (p.x || 0) * 4) / 100);
  // Part de la surface : 600 millionièmes de disque et au-delà valent le maximum.
  const size = Math.min(1, (region?.area || 0) / 600);
  // La force : le plus fort des deux critères, avec un plancher qui garde la région visible.
  return Math.max(0.18, risk, size * 0.7);
// Fin de regionStrength.
}

/**
 * Régions actives du Soleil : `count` points de la surface (au plus MAX_SITES), dans la bande des latitudes actives,
 * chacun avec sa direction `dir` (axe y = pôle nord du Soleil), la direction `tangent` dans laquelle l'arche se
 * couche, sa `period` (secondes entre deux éruptions) et son `offset` (décalage de départ).
 */
// Déclare et exporte eruptionSites : le nombre de régions et la graine.
function eruptionSites(count = MAX_SITES, seed = 2026) {
  // Générateur pseudo-aléatoire.
  const rnd = seededRandom(seed);
  // Nombre de régions, entre 1 et le maximum.
  const n = Math.max(1, Math.min(MAX_SITES, Math.floor(count)));
  // Liste des régions.
  const sites = [];
  // Pour chaque région (début).
  for (let i = 0; i < n; i++) {
    // Longitude : régions réparties autour du Soleil, avec un écart aléatoire.
    const lon = ((i + rnd() * 0.7) / n) * Math.PI * 2;
    // Hémisphère : nord et sud en alternance.
    const sign = i % 2 === 0 ? 1 : -1;
    // Latitude : entre 8 degrés et la latitude maximale, en radians.
    const lat = sign * (8 + rnd() * (ACTIVE_LATITUDE_DEG - 8)) * (Math.PI / 180);
    // Repère local de la région : sa direction, l'est et le nord locaux.
    const { dir, east, north } = localFrame(lat, lon);
    // Angle de l'arche par rapport à l'est, au hasard.
    const angle = rnd() * Math.PI * 2;
    // Direction dans laquelle l'arche se couche : mélange de l'est et du nord locaux.
    const tangent = east.map((e, k) => e * Math.cos(angle) + north[k] * Math.sin(angle));
    // Période : entre 20 et 46 secondes.
    const period = 20 + rnd() * 26;
    // Décalage de départ : quelque part dans la période.
    const offset = rnd() * period;
    // Ajoute la région.
    sites.push({ dir, tangent, period, offset });
  // Fin de la boucle.
  }
  // Renvoie les régions.
  return sites;
// Fin de eruptionSites.
}

/**
 * Tableaux des particules pour le shader : `perSite` grains par région. Pour chaque grain :
 *  - `position` : son point de départ sur la sphère de rayon `radius` (3 nombres) ;
 *  - `tangent`  : la direction dans laquelle il part le long de la surface, unitaire (3 nombres) ;
 *  - `launch`   : vitesse verticale, vitesse le long de la surface, retard dans la gerbe, taille relative (4 nombres) ;
 *  - `cycle`    : période et décalage de sa région (2 nombres).
 */
// Déclare et exporte buildEruptionAttributes : les régions, le nombre de grains par région, le rayon et la graine.
function buildEruptionAttributes(sites, perSite, radius = 1, seed = 7) {
  // Générateur pseudo-aléatoire.
  const rnd = seededRandom(seed);
  // Nombre total de grains.
  const count = sites.length * perSite;
  // Points de départ.
  const position = new Float32Array(count * 3);
  // Directions de départ le long de la surface.
  const tangent = new Float32Array(count * 3);
  // Paramètres de lancement.
  const launch = new Float32Array(count * 4);
  // Période et décalage.
  const cycle = new Float32Array(count * 2);
  // Indice du grain.
  let i = 0;
  // Pour chaque région (début).
  for (const site of sites) {
    // La direction de la région et celle de son arche.
    const [ox, oy, oz] = site.dir;
    // La direction de l'arche.
    const [tx, ty, tz] = site.tangent;
    // Troisième axe local : produit vectoriel de la direction et de l'arche.
    const bx = oy * tz - oz * ty, by = oz * tx - ox * tz, bz = ox * ty - oy * tx;
    // Pour chaque grain de la région (début).
    for (let k = 0; k < perSite; k++, i++) {
      // Écart du pied du grain autour de la région : jusqu'à 0,025 rayon, dans les deux directions locales.
      const du = (rnd() - 0.5) * 0.05, dv = (rnd() - 0.5) * 0.05;
      // Pied du grain, avant normalisation.
      const px = ox + tx * du + bx * dv, py = oy + ty * du + by * dv, pz = oz + tz * du + bz * dv;
      // Sa longueur.
      const pl = Math.hypot(px, py, pz);
      // Pied du grain sur la sphère : x.
      position[i * 3] = (px / pl) * radius;
      // y.
      position[i * 3 + 1] = (py / pl) * radius;
      // z.
      position[i * 3 + 2] = (pz / pl) * radius;
      // Écart de direction autour de l'arche : ± 0,45 radian, resserré vers le centre (deux tirages).
      const spread = (rnd() + rnd() - 1) * 0.45;
      // Direction de départ : l'arche tournée de cet angle autour de la verticale locale.
      tangent[i * 3] = tx * Math.cos(spread) + bx * Math.sin(spread);
      // y.
      tangent[i * 3 + 1] = ty * Math.cos(spread) + by * Math.sin(spread);
      // z.
      tangent[i * 3 + 2] = tz * Math.cos(spread) + bz * Math.sin(spread);
      // Part de hasard dans la vitesse : tout le hasard pour une région simulée, un tiers pour une région réelle,
      // dont la force (`strength`, entre 0 et 1) décide des deux autres tiers : une classe X monte beaucoup plus haut.
      const reach = typeof site.strength === 'number' ? rnd() / 3 + (2 / 3) * Math.min(1, Math.max(0, site.strength)) : rnd();
      // Vitesse verticale : entre le minimum et le maximum.
      const vUp = ERUPTION_V_MIN + reach * (ERUPTION_V_MAX - ERUPTION_V_MIN);
      // La range.
      launch[i * 4] = vUp;
      // Vitesse le long de la surface : de 10 % à 60 % de la vitesse verticale, pour dessiner une arche.
      launch[i * 4 + 1] = vUp * (0.1 + rnd() * 0.5);
      // Retard dans la gerbe : entre 0 et la durée de la gerbe.
      launch[i * 4 + 2] = rnd() * ERUPTION_BURST_S;
      // Taille relative : entre 0,6 et 1,4.
      launch[i * 4 + 3] = 0.6 + rnd() * 0.8;
      // Période de la région.
      cycle[i * 2] = site.period;
      // Décalage de la région.
      cycle[i * 2 + 1] = site.offset;
    // Fin de la boucle des grains.
    }
  // Fin de la boucle des régions.
  }
  // Renvoie les tableaux et le nombre de grains.
  return { count, position, tangent, launch, cycle };
// Fin de buildEruptionAttributes.
}

/** Fenêtre pendant laquelle une éruption observée continue d'alimenter sa région, en millisecondes : 12 heures. */
// Déclare et exporte la fenêtre des éruptions.
const FLARE_WINDOW_MS = 12 * 3600 * 1000;

/**
 * Âge maximal d'une observation de région, en millisecondes : 4 jours. Au-delà, l'instantané de la NOAA est
 * considéré comme périmé et ses régions sont ignorées. C'est une protection, pas une approximation : si le flux
 * cesse d'être mis à jour (panne, gel des publications), une région vieille d'une semaine aurait dérivé de plus
 * de 90 degrés et aurait sans doute disparu, et la placer donnerait une éruption là où il n'y a plus rien.
 */
// Déclare et exporte l'âge maximal d'une observation.
const REGION_MAX_AGE_MS = 4 * 86400000;

/** Instant auquel vaut la position d'une région : 24h00 UTC du jour d'observation, comme la NOAA la publie. */
// Déclare et exporte regionEpoch : la date d'observation, au format AAAA-MM-JJ.
function regionEpoch(observedAt) {
  // L'instant du début de ce jour, en millisecondes ; une date illisible donne NaN.
  const day = Date.parse(observedAt);
  // Un jour plus tard : la fin du jour d'observation.
  return Number.isFinite(day) ? day + 86400000 : NaN;
// Fin de regionEpoch.
}

/**
 * Régions actives à placer sur le Soleil, à partir de la réponse de /api/v1/sun/regions.
 *
 * Deux conversions sont faites ici :
 *  - dans le temps : la position publiée vaut à l'instant de l'observation, donc elle est avancée jusqu'à
 *    `nowMs` à la vitesse de rotation synodique (driftStonyhurst) ;
 *  - dans l'espace : la longitude de Stonyhurst est comptée depuis le méridien qui fait face à la Terre, alors
 *    que le moteur place les régions dans le repère propre du Soleil, qui tourne avec lui. `earthLongitude` est
 *    la longitude de ce repère qui fait face à la Terre à cet instant (le moteur la mesure sur le maillage) ;
 *    une région à `s` degrés à l'ouest est donc à `earthLongitude - s` dans le repère du Soleil. Les régions de
 *    la face cachée sont placées normalement : la rotation les amènera dans le champ.
 *
 * `max` régions au plus sont rendues, les plus actives d'abord : les probabilités d'éruption publiées et la
 * surface du groupe donnent la force de chacune, et une éruption observée dans les douze dernières heures la
 * remonte à la force de sa classe. Une éruption dont la région n'est pas dans la liste devient une région à elle
 * seule. Liste vide : l'appelant garde ses régions simulées.
 */
// Déclare et exporte sitesFromRegions : les données du serveur et les options de placement.
function sitesFromRegions(data, { nowMs = Date.now(), earthLongitude = 0, max = MAX_SITES, window = FLARE_WINDOW_MS, maxAge = REGION_MAX_AGE_MS } = {}) {
  // Les régions reçues, ou une liste vide.
  const regions = Array.isArray(data?.regions) ? data.regions : [];
  // Les éruptions reçues, ou une liste vide.
  const flares = Array.isArray(data?.flares) ? data.flares : [];
  // Les candidates, rangées par numéro de région pour retrouver celle d'une éruption.
  const byNumber = new Map();
  // Les candidates sans numéro de région (éruptions isolées).
  const loose = [];
  // Pour chaque région reçue (début).
  for (const region of regions) {
    // Instant auquel vaut sa position.
    const epoch = regionEpoch(region?.observedAt);
    // Position illisible : région ignorée.
    if (!Number.isFinite(epoch) || !Number.isFinite(region?.lat) || !Number.isFinite(region?.lon)) continue;
    // Observation trop vieille : région ignorée, l'instantané du serveur n'est plus à jour.
    if (nowMs - epoch > maxAge) continue;
    // La candidate : sa latitude, sa longitude avancée jusqu'à maintenant, sa force et son étiquette.
    byNumber.set(region.number, {
      // sa latitude ;
      lat: region.lat,
      // sa longitude de Stonyhurst à l'instant présent ;
      lon: driftStonyhurst(region.lon, epoch, nowMs),
      // sa force, d'après les probabilités et la surface ;
      strength: regionStrength(region),
      // son numéro, qui sert aussi de graine ;
      number: region.number,
      // son étiquette pour l'interface ;
      label: `AR ${region.number}`,
      // la classe de la dernière éruption observée, remplie plus bas.
      flare: null,
    // Fin de la candidate.
    });
  // Fin de la boucle des régions.
  }
  // Pour chaque éruption reçue (début).
  for (const flare of flares) {
    // Instant de référence de sa position : son maximum, ou à défaut son début.
    const epoch = Date.parse(flare?.peak || flare?.begin || '');
    // Position ou instant illisibles, ou éruption trop ancienne : ignorée.
    if (!Number.isFinite(epoch) || nowMs - epoch > window || !Number.isFinite(flare?.lat) || !Number.isFinite(flare?.lon)) continue;
    // Sa force, d'après sa classe GOES.
    const strength = flareStrength(flare.cls);
    // Force nulle (classe A, B ou illisible) : ignorée.
    if (strength <= 0) continue;
    // La région d'origine, si elle est dans la liste.
    const region = flare.region !== null && flare.region !== undefined ? byNumber.get(flare.region) : undefined;
    // Si la région est connue (début) :
    if (region) {
      // sa force est remontée à celle de l'éruption, si celle-ci est plus forte ;
      region.strength = Math.max(region.strength, strength);
      // et la classe de l'éruption est notée, la plus récente l'emportant.
      region.flare = region.flare || flare.cls;
    // Sinon (début) :
    } else {
      // l'éruption devient une région à elle seule.
      loose.push({
        // sa latitude ;
        lat: flare.lat,
        // sa longitude de Stonyhurst à l'instant présent ;
        lon: driftStonyhurst(flare.lon, epoch, nowMs),
        // sa force ;
        strength,
        // sa graine : le numéro de région s'il existe, sinon l'instant de l'éruption ;
        number: flare.region || Math.floor(epoch / 1000),
        // son étiquette ;
        label: flare.region ? `AR ${flare.region}` : `Éruption ${flare.cls}`,
        // sa classe.
        flare: flare.cls,
      // Fin de la candidate.
      });
    // Fin du choix.
    }
  // Fin de la boucle des éruptions.
  }
  // Toutes les candidates, les plus actives d'abord, puis les plus proches du centre du disque, bornées en nombre.
  const chosen = [...byNumber.values(), ...loose]
    // rangement par force décroissante, puis par distance au méridien central ;
    .sort((a, b) => b.strength - a.strength || Math.abs(a.lon) - Math.abs(b.lon))
    // on n'en garde que le nombre demandé.
    .slice(0, Math.max(0, Math.min(MAX_SITES, Math.floor(max))));
  // Chaque candidate devient une région du moteur (début).
  return chosen.map((c) => {
    // Générateur pseudo-aléatoire propre à la région : la même région donne toujours la même arche.
    const rnd = seededRandom(c.number + 1);
    // Latitude en radians.
    const lat = (c.lat * Math.PI) / 180;
    // Longitude dans le repère propre du Soleil : le méridien face à la Terre, moins la longitude vers l'ouest.
    const lon = earthLongitude - (c.lon * Math.PI) / 180;
    // Repère local de la région.
    const { dir, east, north } = localFrame(lat, lon);
    // Angle de l'arche par rapport à l'est, au hasard mais stable pour cette région.
    const angle = rnd() * Math.PI * 2;
    // Direction dans laquelle l'arche se couche : mélange de l'est et du nord locaux.
    const tangent = east.map((e, k) => e * Math.cos(angle) + north[k] * Math.sin(angle));
    // Période entre deux gerbes : de 52 secondes pour une région calme à 18 pour une région qui éclate.
    const period = 18 + (1 - c.strength) * 34;
    // La région du moteur.
    return {
      // sa direction ;
      dir,
      // la direction de son arche ;
      tangent,
      // sa période ;
      period,
      // son décalage de départ, quelque part dans la période ;
      offset: rnd() * period,
      // sa force, qui règle la hauteur des gerbes ;
      strength: c.strength,
      // sa latitude et sa longitude de Stonyhurst à l'instant présent, pour l'interface ;
      lat: c.lat,
      // la longitude.
      lon: c.lon,
      // son étiquette ;
      label: c.label,
      // la classe de sa dernière éruption, ou null.
      flare: c.flare,
    // Fin de la région.
    };
  // Fin de la transformation.
  });
// Fin de sitesFromRegions.
}

// Importe toute la bibliothèque three.js sous le nom THREE.
// Importe les constantes et les calculs des éruptions, depuis sunSurfaceMath.

// Soleil modélisé en 3D : une surface animée (cellules de convection, granulation, filaments sombres, régions actives) et des
// éruptions (gerbes de matière projetées depuis les régions actives, qui montent en arche puis retombent).
// Tout est calculé par la carte graphique : la surface par un bruit procédural (aucune image à télécharger), les
// éruptions par une formule balistique évaluée dans le shader à partir du temps (voir sunSurfaceMath.jsx). Le
// processeur ne fait rien à chaque image, à part donner l'heure. Tout est exprimé dans le repère du Soleil (axe y =
// pôle nord) : la surface et les éruptions tournent avec lui.

// Code GLSL du bruit procédural, commun aux deux profils (début).
const noiseChunk = [
  // Nombre pseudo-aléatoire entre 0 et 1 à partir d'un point de l'espace.
  'float sHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
  // Bruit lissé : mélange des huit valeurs aux coins du cube qui contient le point (début).
  'float sNoise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.-2.*f);',
  // Face du bas du cube.
  '  float a=mix(mix(sHash(i),sHash(i+vec3(1.,0.,0.)),f.x),mix(sHash(i+vec3(0.,1.,0.)),sHash(i+vec3(1.,1.,0.)),f.x),f.y);',
  // Face du haut du cube.
  '  float b=mix(mix(sHash(i+vec3(0.,0.,1.)),sHash(i+vec3(1.,0.,1.)),f.x),mix(sHash(i+vec3(0.,1.,1.)),sHash(i+vec3(1.,1.,1.)),f.x),f.y);',
  // Mélange des deux faces, puis fin de la fonction.
  '  return mix(a,b,f.z);}',
  // Bruit fractal : somme de OCTAVES bruits de plus en plus fins et de moins en moins forts, ramenée entre 0 et 1.
  'float sFbm(vec3 p){float a=.5;float s=0.;float n=0.;for(int i=0;i<OCTAVES;i++){s+=a*sNoise(p);n+=a;p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s/n;}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de sommets de la surface (début).
const surfaceVertex = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Variables transmises au shader de fragments : le point dans le repère du Soleil, la normale et la direction de la caméra.
  'varying vec3 vDir;varying vec3 vN;varying vec3 vV;',
  // Début de la fonction principale.
  'void main(){',
  // Point de la surface dans le repère du Soleil : le bruit y est accroché et tourne avec lui.
  '  vDir=position;',
  // Normale dans le repère de la caméra.
  '  vN=normalMatrix*normal;',
  // Position dans le repère de la caméra.
  '  vec4 mv=modelViewMatrix*vec4(position,1.);',
  // Direction du point vers la caméra.
  '  vV=-mv.xyz;',
  // Position à l'écran.
  '  gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique, puis fin de la fonction principale.
  '#include <logdepthbuf_vertex>', '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de fragments de la surface (début).
const surfaceFragment = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables uniformes : le temps, la durée d'une gerbe, le nombre de régions actives, leur direction et leur cycle.
  `uniform float time;uniform float burst;uniform int siteCount;uniform vec3 siteDir[${MAX_SITES}];uniform vec2 siteCycle[${MAX_SITES}];`,
  // Variables reçues du shader de sommets.
  'varying vec3 vDir;varying vec3 vN;varying vec3 vV;',
  // Le bruit procédural.
  noiseChunk,
  // Début de la fonction principale.
  'void main(){',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Point de la surface, unitaire.
  '  vec3 p=normalize(vDir);',
  // Temps ralenti : la surface bouillonne lentement.
  '  float t=time*.04;',
  // Grandes cellules de convection, qui dérivent lentement.
  '  float cells=sFbm(p*6.+vec3(0.,t,0.));',
  // Granulation fine, plus rapide.
  '  float grains=sFbm(p*28.+vec3(t*2.,0.,-t));',
  // Chaleur du point : mélange des deux.
  '  float heat=.6*cells+.4*grains;',
  // Filaments sombres : lignes fines où un bruit large passe par sa valeur moyenne, dans les zones les plus froides.
  '  float filament=(1.-smoothstep(0.,.03,abs(sFbm(p*3.2+vec3(11.,-t*.3,5.))-.5)))*(1.-smoothstep(.44,.5,cells));',
  // Cosinus de l’angle entre la surface et la direction de la caméra : 1 au centre du disque, 0 au bord.
  '  float mu=max(dot(normalize(vN),normalize(vV)),0.);',
  // Couleur, sur le modèle des vues de la sonde SDO : du rouge sombre à l’orange selon la chaleur.
  '  vec3 col=mix(vec3(.36,.05,.0),vec3(.92,.3,.03),smoothstep(.38,.52,heat));',
  // Points les plus chauds : orange clair.
  '  col=mix(col,vec3(1.,.6,.12),smoothstep(.54,.68,heat));',
  // Filaments : bien plus sombres.
  '  col*=mix(1.,.3,filament);',
  // Bord légèrement assombri.
  '  col*=.72+.28*pow(mu,.5);',
  // Éclat des régions actives et du cœur des éruptions, à zéro au départ.
  '  float glow=0.;float flare=0.;',
  // Pour chaque région active (début).
  `  for(int i=0;i<${MAX_SITES};i++){`,
  // Au-delà du nombre de régions : arrêt.
  '    if(i>=siteCount)break;',
  // Temps écoulé depuis le début de la gerbe de cette région.
  '    float a=mod(time-siteCycle[i].y,siteCycle[i].x);',
  // Force de l’éruption : monte en une demi-seconde, puis s’éteint en quatre secondes après la gerbe.
  '    float env=smoothstep(0.,.5,a)*(1.-smoothstep(burst,burst+4.,a));',
  // Proximité de la région : 1 en son centre, 0 ailleurs.
  '    float d=dot(p,siteDir[i]);',
  // Région active : plage jaune toujours visible, morcelée par la granulation, plus vive pendant l’éruption.
  '    glow+=smoothstep(.965,.998,d)*(.35+.9*grains)*(.55+env);',
  // Cœur de l’éruption : point presque blanc.
  '    flare+=(.25+env)*smoothstep(.994,.9997,d);',
  // Fin de la boucle.
  '  }',
  // Ajoute les régions actives, jaune orangé.
  '  col+=vec3(1.,.7,.18)*glow;',
  // Ajoute le cœur des éruptions, jaune très clair.
  '  col+=vec3(1.,.92,.7)*flare;',
  // Liseré rouge orangé lumineux au bord du disque (chromosphère).
  '  col+=vec3(1.,.3,.05)*pow(1.-mu,2.5)*.6;',
  // Couleur finale, opaque.
  '  gl_FragColor=vec4(col,1.);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de sommets des éruptions (début).
const eruptionVertex = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Variables uniformes : le temps, la gravité, le rayon du Soleil et l’échelle en pixels de l’écran.
  'uniform float time;uniform float gravity;uniform float radius;uniform float pixels;',
  // Attributs du grain : sa direction de départ le long de la surface, son lancement et le cycle de sa région.
  'attribute vec3 slide;attribute vec4 launch;attribute vec2 cycle;',
  // Variables transmises au shader de fragments : la chaleur du grain et son opacité.
  'varying float vHeat;varying float vAlpha;',
  // Début de la fonction principale.
  'void main(){',
  // Âge du grain : temps écoulé depuis son départ, ramené dans la période de sa région.
  '  float age=mod(time-cycle.y-launch.z,cycle.x);',
  // Durée de son vol : 2·vUp/g.
  '  float flight=2.*launch.x/gravity;',
  // En vol (1) ou retombé (0).
  '  float alive=step(age,flight);',
  // Hauteur balistique, en rayons : vUp·t − g·t²/2, jamais sous la surface.
  '  float h=max(launch.x*age-.5*gravity*age*age,0.);',
  // Pied du grain, unitaire.
  '  vec3 foot=normalize(position);',
  // Direction du grain : il glisse le long de la surface à la vitesse vTan.
  '  vec3 dir=normalize(foot+slide*launch.y*age);',
  // Position du grain, dans le repère de la caméra.
  '  vec4 mv=modelViewMatrix*vec4(dir*radius*(1.+h*alive),1.);',
  // Position à l’écran.
  '  gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_vertex>',
  // Avancement du vol, entre 0 et 1.
  '  float k=clamp(age/flight,0.,1.);',
  // Chaleur : le grain part brûlant et refroidit.
  '  vHeat=1.-k;',
  // Taille à l’écran, en pixels : 0,017 rayon solaire, selon la taille relative du grain et la distance.
  '  float size=launch.w*.017*radius*pixels/max(-mv.z,1e-6);',
  // Opacité : nulle au départ et à la retombée, et quand le grain fait moins d’un pixel (Soleil vu de loin).
  '  vAlpha=alive*sin(k*PI)*smoothstep(.4,1.4,size);',
  // Taille du point, entre 1 et 48 pixels ; nulle si le grain est retombé.
  '  gl_PointSize=alive*clamp(size,1.,48.);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de fragments des éruptions (début).
const eruptionFragment = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables reçues du shader de sommets.
  'varying float vHeat;varying float vAlpha;',
  // Début de la fonction principale.
  'void main(){',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Distance au centre du point, de 0 au centre à 1 au bord.
  '  float d=length(gl_PointCoord-.5)*2.;',
  // Disque flou : plein au centre, transparent au bord.
  '  float soft=1.-smoothstep(0.,1.,d);',
  // Grain invisible : pas dessiné.
  '  if(vAlpha*soft<.004)discard;',
  // Couleur : rouge sombre quand il est froid, orange puis jaune très clair quand il est brûlant.
  '  vec3 col=mix(vec3(.85,.12,.02),vec3(1.,.55,.12),smoothstep(0.,.5,vHeat));',
  // Les plus chauds : presque blancs.
  '  col=mix(col,vec3(1.,.95,.75),smoothstep(.6,1.,vHeat));',
  // Couleur finale, avec son opacité.
  '  gl_FragColor=vec4(col,vAlpha*soft);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Crée le Soleil de rayon `radius` (unités de la scène) : renvoie le maillage de la surface, auquel les éruptions
 * sont rattachées (`mesh.userData.eruptions`). `lite` (téléphone) : bruit moins détaillé, moins de régions actives
 * et moins de grains. Les éruptions ne sont dessinées que si le Soleil fait au moins 24 pixels de rayon à l'écran.
 *
 * Les régions sont simulées au départ (eruptionSites), et `mesh.userData.setEruptionSites(sites)` les remplace par
 * les régions actives réelles quand le moteur les reçoit du serveur ; `setEruptionSites(null)` ramène les simulées.
 */
// Déclare et exporte createSunSurface : le rayon du Soleil et le profil allégé.
function createSunSurface(THREE, radius, { lite = false } = {}) {
  // Nombre de régions affichées : 5 sur téléphone, 8 sinon.
  const siteBudget = lite ? 5 : MAX_SITES;
  // Régions simulées, utilisées jusqu'à l'arrivée des régions réelles et en cas de panne du serveur.
  const fallbackSites = eruptionSites(siteBudget);
  // Régions affichées à cet instant : les simulées au départ, remplacées par setSites.
  let sites = fallbackSites;
  // Directions des régions pour le shader : toujours MAX_SITES cases, les cases en trop restent à zéro.
  const siteDir = Array.from({ length: MAX_SITES }, () => new THREE.Vector3());
  // Cycles des régions : période et décalage (période de 1 pour les cases vides, jamais lues).
  const siteCycle = Array.from({ length: MAX_SITES }, () => new THREE.Vector2(1, 0));
  // Le temps, partagé par la surface et les éruptions.
  const time = { value: 0 };

  // Maillage de la surface (début).
  const mesh = new THREE.Mesh(
    // Géométrie : une sphère au rayon du Soleil.
    new THREE.SphereGeometry(radius, 64, 48),
    // Matériau à shader (début).
    new THREE.ShaderMaterial({
      // Nombre d'octaves du bruit : 3 sur téléphone, 5 sinon.
      defines: { OCTAVES: lite ? 3 : 5 },
      // Variables uniformes : le temps, la durée d'une gerbe, les régions actives.
      uniforms: { time, burst: { value: ERUPTION_BURST_S }, siteCount: { value: siteBudget }, siteDir: { value: siteDir }, siteCycle: { value: siteCycle } },
      // Les deux shaders.
      vertexShader: surfaceVertex, fragmentShader: surfaceFragment,
    // Fin du matériau.
    })
  // Fin du maillage.
  );

  // Nombre de grains par région : 130 sur téléphone, 320 sinon.
  const perSite = lite ? 130 : 320;
  // Géométrie des éruptions.
  const geometry = new THREE.BufferGeometry();
  // Les tableaux sont dimensionnés pour MAX_SITES régions une fois pour toutes : le nombre de régions réelles
  // change à chaque mise à jour, mais la mémoire de la carte graphique, elle, n'est allouée qu'ici.
  // declareAttribute : déclare un attribut de la taille maximale, mis à jour en place.
  const declareAttribute = (name, size) => {
    // L'attribut, vide au départ.
    const attribute = new THREE.BufferAttribute(new Float32Array(MAX_SITES * perSite * size), size);
    // Il sera réécrit de temps en temps : la carte graphique en est avertie.
    attribute.setUsage(THREE.DynamicDrawUsage);
    // On le pose sur la géométrie.
    geometry.setAttribute(name, attribute);
    // Et on le rend, pour pouvoir le remplir.
    return attribute;
  // Fin de declareAttribute.
  };
  // Point de départ de chaque grain.
  const positionAttribute = declareAttribute('position', 3);
  // Direction de départ le long de la surface.
  const slideAttribute = declareAttribute('slide', 3);
  // Paramètres de lancement.
  const launchAttribute = declareAttribute('launch', 4);
  // Période et décalage de la région.
  const cycleAttribute = declareAttribute('cycle', 2);
  // Volume englobant : les grains bougent dans le shader, donc une sphère fixe de 1,6 rayon autour du Soleil.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.6);
  // Échelle en pixels de l'écran, mise à jour avant chaque rendu.
  const pixels = { value: 1000 };
  // Les éruptions : un nuage de points (début).
  const eruptions = new THREE.Points(geometry, new THREE.ShaderMaterial({
    // Variables uniformes : le temps, la gravité, le rayon et l'échelle en pixels.
    uniforms: { time, gravity: { value: ERUPTION_GRAVITY }, radius: { value: radius }, pixels },
    // Les deux shaders.
    vertexShader: eruptionVertex, fragmentShader: eruptionFragment,
    // Transparent, en mélange additif (la matière brille), sans écriture de la profondeur ; le Soleil cache les grains passés derrière lui.
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  // Fin des éruptions.
  }));
  // Les grains ne se cliquent pas : seul le Soleil répond au clic.
  eruptions.raycast = () => {};

  /**
   * Pose les régions actives : remplit les tableaux des grains et les variables du shader de la surface. Une liste
   * vide ou absente ramène les régions simulées, pour que le Soleil continue d'éclater quand le serveur ne répond
   * pas. Appelée au départ, puis à chaque arrivée des régions réelles (toutes les quinze minutes) : jamais à
   * chaque image, car elle réécrit les tableaux des grains.
   */
  // Déclare setSites : la liste des régions.
  const setSites = (next) => {
    // Les régions à poser : celles reçues, bornées au budget, ou les simulées à défaut.
    sites = next?.length ? next.slice(0, siteBudget) : fallbackSites;
    // Les tableaux des grains de ces régions.
    const grains = buildEruptionAttributes(sites, perSite, radius);
    // Recopie chacun des quatre tableaux au début de l'attribut correspondant.
    for (const [attribute, data] of [[positionAttribute, grains.position], [slideAttribute, grains.tangent], [launchAttribute, grains.launch], [cycleAttribute, grains.cycle]]) {
      // Les valeurs sont écrites au début du tableau de l'attribut.
      attribute.array.set(data);
      // La carte graphique renvoie le tableau au prochain rendu.
      attribute.needsUpdate = true;
    // Fin de la boucle des attributs.
    }
    // Seuls les grains des régions posées sont dessinés : les cases au-delà sont ignorées.
    geometry.setDrawRange(0, grains.count);
    // Nombre de régions lu par le shader de la surface, pour les taches sombres et les pieds d'éruption.
    mesh.material.uniforms.siteCount.value = sites.length;
    // Pour chaque case de région (début).
    for (let i = 0; i < MAX_SITES; i++) {
      // La direction de la région, ou zéro pour une case vide.
      siteDir[i].set(...(sites[i]?.dir || [0, 0, 0]));
      // Sa période et son décalage ; une période de 1 pour une case vide, jamais lue.
      siteCycle[i].set(sites[i]?.period || 1, sites[i]?.offset || 0);
    // Fin de la boucle.
    }
  // Fin de setSites.
  };
  // Pose les régions simulées : le Soleil éclate dès la première image, sans attendre le serveur.
  setSites(null);
  // Range setSites dans userData : le moteur l'appelle quand les régions réelles arrivent.
  mesh.userData.setEruptionSites = setSites;
  // Rattache les éruptions au Soleil : elles le suivent et tournent avec lui.
  mesh.add(eruptions);
  // Les range dans userData.
  mesh.userData.eruptions = eruptions;

  // Instant de création, en millisecondes.
  const start = performance.now();
  // Vecteur de travail : position du Soleil dans le repère de la caméra.
  const view = new THREE.Vector3();
  // Vecteur de travail : taille du rendu.
  const bufferSize = new THREE.Vector2();
  // Avant chaque rendu de la surface (début).
  mesh.onBeforeRender = (renderer, scene, camera) => {
    // Temps écoulé depuis la création, en secondes.
    time.value = (performance.now() - start) / 1000;
    // Échelle : nombre de pixels couverts par une unité de la scène placée à une unité de la caméra.
    pixels.value = renderer.getDrawingBufferSize(bufferSize).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    // Distance du Soleil à la caméra.
    const distance = view.setFromMatrixPosition(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse).length() || 1;
    // Éruptions dessinées seulement si le Soleil fait au moins 24 pixels de rayon : de loin, elles ne se verraient pas.
    eruptions.visible = (radius * pixels.value) / distance >= 24;
  // Fin du traitement avant rendu.
  };
  // Fonction de libération rangée dans userData : libère les deux géométries et les deux matériaux.
  mesh.userData.dispose = () => { mesh.geometry.dispose(); mesh.material.dispose(); geometry.dispose(); eruptions.material.dispose(); };
  // Renvoie le maillage.
  return mesh;
// Fin de createSunSurface.
}

// ---------------------------------------------------------------------------
// Corps générique : une sphère colorée, sans lumière nécessaire (matériau basique). Mutable par son matériau et sa géométrie.
function createGenericBody(THREE, opts) {
  opts = opts || {};
  // Sphère au rayon demandé.
  var mesh = new THREE.Mesh(
    new THREE.SphereGeometry(opts.radius || 1, 64, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(opts.color || '#9aa0a6') })
  );
  // Libération rangée dans userData, pour une interface commune avec le Soleil.
  mesh.userData.dispose = function () { mesh.geometry.dispose(); mesh.material.dispose(); };
  return mesh;
}

// ---------------------------------------------------------------------------
// Fabrique exposée : renvoie un objet 3D MUTABLE (un Group), sans scène ni fond. L'hôte l'ajoute à sa propre scène.
// options : { body, radius, lite, color, regions, earthLongitude }. Le Soleil porte la surface animée et les éruptions ;
// tout autre astre est une sphère colorée. L'objet se change en place : setBody, setParams, setRegions, dispose.
exports.create = function (THREE, options) {
  // Paramètres par défaut ; la Terre est sur l'axe +Z (face à la caméra au départ).
  options = Object.assign({ body: 'soleil', radius: 1, lite: false, color: '#9aa0a6', regions: null, earthLongitude: Math.atan2(1, 0) }, options || {});
  // Conteneur mutable : il ne change jamais, seul son enfant est remplacé.
  var group = new THREE.Group();
  // L'astre courant (Soleil ou sphère).
  var child = null;

  // Retire et libère l'enfant courant.
  function clear() {
    if (child) { if (child.userData.dispose) child.userData.dispose(); group.remove(child); child = null; }
  }
  // Pose les régions actives réelles sur le Soleil (ignoré pour les autres astres).
  function applyRegions() {
    if (options.body !== 'soleil' || !child || !child.userData.setEruptionSites) return;
    var sites = options.regions ? sitesFromRegions(options.regions, { nowMs: Date.now(), earthLongitude: options.earthLongitude }) : null;
    child.userData.setEruptionSites(sites);
  }
  // Construit l'astre courant.
  function build() {
    clear();
    if (options.body === 'soleil') { child = createSunSurface(THREE, options.radius, { lite: options.lite }); applyRegions(); }
    else { child = createGenericBody(THREE, { radius: options.radius, color: options.color }); }
    group.add(child);
  }

  // Change d'astre en gardant le même conteneur.
  group.userData.setBody = function (name) { if (name !== options.body) { options.body = name; build(); } };
  // Modifie les paramètres : reconstruit si le type, le rayon ou le profil change ; sinon applique couleur et régions en place.
  group.userData.setParams = function (next) {
    next = next || {};
    var rebuild = ('body' in next && next.body !== options.body) || ('radius' in next && next.radius !== options.radius) || ('lite' in next && next.lite !== options.lite);
    Object.assign(options, next);
    if (rebuild) { build(); return; }
    if (child && options.body !== 'soleil' && child.material && child.material.color && next.color) child.material.color.set(options.color);
    applyRegions();
  };
  // Met à jour les régions actives (et, si fourni, la longitude de la Terre).
  group.userData.setRegions = function (data, earthLongitude) {
    options.regions = data;
    if (earthLongitude !== undefined) options.earthLongitude = earthLongitude;
    applyRegions();
  };
  // Libère l'astre courant.
  group.userData.dispose = function () { clear(); };

  // Première construction.
  build();
  return group;
};
