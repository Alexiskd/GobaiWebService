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
export const ERUPTION_GRAVITY = 0.02;
/** Durée pendant laquelle une région active projette de la matière, en secondes. */
// Déclare et exporte la durée d'une gerbe : 6 secondes.
export const ERUPTION_BURST_S = 6;
/** Vitesse verticale de départ la plus faible et la plus forte, en rayons solaires par seconde. */
// Déclare et exporte la vitesse verticale minimale.
export const ERUPTION_V_MIN = 0.04;
// Déclare et exporte la vitesse verticale maximale.
export const ERUPTION_V_MAX = 0.13;
/** Latitude maximale des régions actives, en degrés : les taches et les éruptions restent près de l'équateur. */
// Déclare et exporte la latitude maximale des régions actives : 35 degrés.
export const ACTIVE_LATITUDE_DEG = 35;
/** Nombre maximal de régions actives, fixé aussi dans le shader de la surface. */
// Déclare et exporte le nombre maximal de régions actives : 8.
export const MAX_SITES = 8;

/**
 * Générateur de nombres pseudo-aléatoires (mulberry32) : la même graine donne toujours la même suite, donc le même
 * Soleil à chaque visite et dans les tests.
 */
// Déclare et exporte seededRandom : la graine.
export function seededRandom(seed) {
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
export function flightTime(vUp, gravity = ERUPTION_GRAVITY) {
  // Renvoie la durée du vol.
  return (2 * vUp) / gravity;
// Fin de flightTime.
}

/** Hauteur maximale atteinte, en rayons solaires : vUp²/(2·g). */
// Déclare et exporte apexHeight : la vitesse verticale et la gravité.
export function apexHeight(vUp, gravity = ERUPTION_GRAVITY) {
  // Renvoie la hauteur maximale.
  return (vUp * vUp) / (2 * gravity);
// Fin de apexHeight.
}

/**
 * État d'un grain `age` secondes après son départ : `alive` (encore en vol), `height` (hauteur au-dessus de la
 * surface, en rayons) et `arc` (distance parcourue le long de la surface, en rayons). Le shader refait ce calcul.
 */
// Déclare et exporte particleState : l'âge, la vitesse verticale, la vitesse le long de la surface et la gravité.
export function particleState(age, vUp, vTan, gravity = ERUPTION_GRAVITY) {
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
export function particleAge(time, period, offset, delay) {
  // Temps écoulé depuis le départ du grain.
  const t = time - offset - delay;
  // Ramené dans la période, même pour un temps négatif.
  return t - period * Math.floor(t / period);
// Fin de particleAge.
}

/** Rotation synodique du Soleil vue de la Terre, en degrés par jour : une région dérive d'est en ouest à ce rythme. */
// Déclare et exporte la dérive synodique : 360 degrés en 27,2753 jours.
export const SYNODIC_DEG_PER_DAY = 360 / 27.2753;

/** Ramène un angle en degrés dans l'intervalle ]-180, 180]. */
// Déclare et exporte wrapDeg : l'angle en degrés.
export function wrapDeg(deg) {
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
export function driftStonyhurst(lon, fromMs, toMs) {
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
export function localFrame(lat, lon) {
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
export function flareStrength(cls) {
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
export function regionStrength(region) {
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
export function eruptionSites(count = MAX_SITES, seed = 2026) {
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
export function buildEruptionAttributes(sites, perSite, radius = 1, seed = 7) {
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
export const FLARE_WINDOW_MS = 12 * 3600 * 1000;

/**
 * Âge maximal d'une observation de région, en millisecondes : 4 jours. Au-delà, l'instantané de la NOAA est
 * considéré comme périmé et ses régions sont ignorées. C'est une protection, pas une approximation : si le flux
 * cesse d'être mis à jour (panne, gel des publications), une région vieille d'une semaine aurait dérivé de plus
 * de 90 degrés et aurait sans doute disparu, et la placer donnerait une éruption là où il n'y a plus rien.
 */
// Déclare et exporte l'âge maximal d'une observation.
export const REGION_MAX_AGE_MS = 4 * 86400000;

/** Instant auquel vaut la position d'une région : 24h00 UTC du jour d'observation, comme la NOAA la publie. */
// Déclare et exporte regionEpoch : la date d'observation, au format AAAA-MM-JJ.
export function regionEpoch(observedAt) {
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
export function sitesFromRegions(data, { nowMs = Date.now(), earthLongitude = 0, max = MAX_SITES, window = FLARE_WINDOW_MS, maxAge = REGION_MAX_AGE_MS } = {}) {
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
