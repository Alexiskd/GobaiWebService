// Atmosphères des planètes solides, modélisées par la diffusion de la lumière du Soleil dans l'air (atmosphere.jsx) :
//  - diffusion de Rayleigh par les molécules (dépend de la couleur : bleu de la Terre) ;
//  - diffusion de Mie par les poussières, brumes et gouttelettes (voile clair, surtout vers l'avant) ;
//  - densité qui décroît exponentiellement avec l'altitude (hauteur d'échelle).
// Coefficients de diffusion au niveau de référence, en m⁻¹ pour le rouge, le vert et le bleu.
// `mieExt` : extinction des particules rapportée à leur diffusion (> 1 = elles absorbent aussi cette couleur).
//
// Terre   : valeurs de référence de la littérature (air au niveau de la mer, aérosols bas). `simClouds` : couche de
//           nuages simulés, semi-transparente, qui s'efface quand la caméra descend vers le sol pour laisser voir
//           les cartes (entre `fadeFarKm` et `fadeNearKm` d'altitude).
// Vénus   : seule la partie située au-dessus des nuages est visible de l'espace. Niveau de référence = sommet des
//           nuages d'acide sulfurique (≈ 70 km), qui couvrent toute la planète et cachent le sol ; au-dessus, du CO₂
//           raréfié et une brume fine jaunâtre. La couche de nuages elle-même est une sphère opaque, au motif
//           simulé (atmosphereClouds.jsx).
// Mars    : CO₂ très ténu (moins de 1 % de la pression terrestre) : presque pas de Rayleigh ; la poussière en
//           suspension domine et diffuse davantage le rouge, d'où le voile ocre.
// Mercure : pas d'atmosphère (simple exosphère, invisible) : rien n'est dessiné.
//
// Les coefficients de Vénus et de Mars sont des ordres de grandeur déduits de la pression, de la température et de la
// charge en poussière typiques ; ils ne viennent pas d'une mesure unique.

// Déclare et exporte la table des atmosphères modélisées (début).
export const ATMOSPHERES = {
  // La Terre (début).
  earth: {
    // Rayon de 6371 km et sommet de l'atmosphère à 100 km.
    radiusKm: 6371, topKm: 100,
    // Coefficients de Rayleigh pour le rouge, le vert et le bleu, et hauteur d'échelle de 8 km.
    rayleigh: [5.8e-6, 13.5e-6, 33.1e-6], rayleighScaleKm: 8,
    // Coefficients de Mie, extinction de 1,1, hauteur d'échelle de 1,2 km et asymétrie de 0,76.
    mie: [21e-6, 21e-6, 21e-6], mieExt: [1.1, 1.1, 1.1], mieScaleKm: 1.2, mieG: 0.76,
    // Nuages simulés : à 8 km d'altitude, opacité de 0,9, effacés entre 3000 et 600 km d'altitude de la caméra.
    simClouds: { altitudeKm: 8, opacity: 0.9, fadeNearKm: 600, fadeFarKm: 3000 },
  // Fin de la Terre.
  },
  // Vénus (début).
  venus: {
    // Rayon de 6051,8 km et sommet de l'atmosphère à 100 km.
    radiusKm: 6051.8, topKm: 100,
    // Sommet des nuages à 70 km.
    cloudTopKm: 70,
    // Durée de la super-rotation : 4 jours.
    superRotationDays: 4, // la haute atmosphère fait le tour de la planète en quatre jours environ
    // Coefficients de Rayleigh et hauteur d'échelle de 5 km.
    rayleigh: [7.3e-7, 1.7e-6, 4.1e-6], rayleighScaleKm: 5,
    // Coefficients de Mie, extinction plus forte dans le bleu, hauteur d'échelle de 4 km et asymétrie de 0,7.
    mie: [3.2e-5, 3.1e-5, 2.9e-5], mieExt: [1.05, 1.1, 1.35], mieScaleKm: 4, mieG: 0.7,
  // Fin de Vénus.
  },
  // Mars (début).
  mars: {
    // Rayon de 3389,5 km et sommet de l'atmosphère à 80 km.
    radiusKm: 3389.5, topKm: 80,
    // Coefficients de Rayleigh et hauteur d'échelle de 11,1 km.
    rayleigh: [1.2e-7, 2.7e-7, 6.6e-7], rayleighScaleKm: 11.1,
    // La poussière martienne absorbe le bleu : c'est ce qui teinte le ciel et le limbe en ocre.
    // Coefficients de Mie, extinction de 1,04 dans le rouge à 2,1 dans le bleu, hauteur d'échelle de 11,1 km et asymétrie de 0,76.
    mie: [4.5e-5, 4.2e-5, 3.8e-5], mieExt: [1.04, 1.3, 2.1], mieScaleKm: 11.1, mieG: 0.76,
  // Fin de Mars.
  },
// Fin de la table.
};

/**
 * Épaisseur de l'atmosphère de chaque planète, affichée dans ses caractéristiques (ordres de grandeur).
 *  - Planètes solides et Pluton : du sol à l'exobase, l'altitude où le gaz devient si ténu qu'il s'échappe vers
 *    l'espace (Vénus ≈ 220 à 250 km ; Terre ≈ 600 km ; Mars ≈ 200 km ; Pluton ≈ 1 700 km, New Horizons).
 *  - Géantes : pas de sol ; profondeur de la couche où soufflent les vents, sous le sommet des nuages, déduite du
 *    champ de gravité (Jupiter ≈ 3 000 km, Juno ; Saturne ≈ 9 000 km, Cassini ; Uranus et Neptune : au plus
 *    ≈ 1 000 km, Voyager 2 — Kaspi et al., Nature 2013 et 2018, Space Science Reviews 2020).
 *  - Mercure : `km: 0`, simple exosphère.
 * `max` = la valeur est une borne supérieure.
 */
// Déclare et exporte la table des épaisseurs d'atmosphère (début).
export const ATMOSPHERE_THICKNESS = {
  // Mercure : 0 km, avec sa note.
  mercury: { km: 0, note: 'pas de véritable atmosphère : une exosphère extrêmement ténue' },
  // Vénus : 250 km, avec sa note.
  venus: { km: 250, note: 'du sol à l’exobase ; sommet des nuages vers 70 km' },
  // La Terre : 600 km, avec sa note.
  earth: { km: 600, note: 'du sol à l’exobase ; l’espace commence par convention à 100 km (ligne de Kármán)' },
  // Mars : 200 km, avec sa note.
  mars: { km: 200, note: 'du sol à l’exobase ; atmosphère très ténue de CO₂' },
  // Jupiter : 3000 km, avec sa note.
  jupiter: { km: 3000, note: 'couche des vents sous le sommet des nuages (sonde Juno) ; pas de sol' },
  // Saturne : 9000 km, avec sa note.
  saturn: { km: 9000, note: 'couche des vents sous le sommet des nuages (sonde Cassini) ; pas de sol' },
  // Uranus : 1000 km au plus, avec sa note.
  uranus: { km: 1000, max: true, note: 'couche des vents sous le sommet des nuages (gravité, Voyager 2) ; pas de sol' },
  // Neptune : 1000 km au plus, avec sa note.
  neptune: { km: 1000, max: true, note: 'couche des vents sous le sommet des nuages (gravité, Voyager 2) ; pas de sol' },
  // Pluton : 1700 km, avec sa note.
  pluto: { km: 1700, note: 'du sol à l’exobase (New Horizons) ; azote très ténu, brumes jusqu’à 200 km' },
// Fin de la table.
};

/** Épaisseur de l'atmosphère d'une planète { km, max?, note }, ou null si elle n'est pas renseignée. */
// Déclare et exporte atmosphereThickness : l'identifiant de la planète.
export function atmosphereThickness(id) {
  // Renvoie son entrée de la table, ou null.
  return ATMOSPHERE_THICKNESS[id] ?? null;
// Fin de atmosphereThickness.
}

/** Rayon de la couche de nuages, en rayons de l'astre (échelle réelle) ; null si l'astre n'a pas de couche de nuages. */
// Déclare et exporte cloudRadiusFactor : l'identifiant de l'astre.
export function cloudRadiusFactor(id) {
  // Son atmosphère.
  const a = ATMOSPHERES[id];
  // Avec un sommet de nuages : 1 plus cette altitude divisée par le rayon ; sinon null.
  return a?.cloudTopKm ? 1 + a.cloudTopKm / a.radiusKm : null;
// Fin de cloudRadiusFactor.
}

/**
 * Altitude minimale de la caméra, en rayons de l'astre, sous une couche de nuages opaque quand aucune carte du sol
 * n'est affichée (Vénus sans fond Trek) : à mi-hauteur entre le sol et le sommet des nuages, pour pouvoir traverser
 * l'atmosphère tout en restant au-dessus du globe simple (dont les facettes passent jusqu'à ≈ 20 km sous la sphère).
 * null pour un astre sans couche opaque.
 */
// Déclare et exporte underCloudFloorRadii : l'identifiant de l'astre.
export function underCloudFloorRadii(id) {
  // Son atmosphère.
  const a = ATMOSPHERES[id];
  // Avec un sommet de nuages : la moitié de cette altitude, divisée par le rayon ; sinon null.
  return a?.cloudTopKm ? a.cloudTopKm / 2 / a.radiusKm : null;
// Fin de underCloudFloorRadii.
}

/** Opacité (0 à 1) des nuages simulés selon l'altitude de la caméra : nulle près du sol, entière vue de loin. */
// Déclare et exporte simCloudFade : l'identifiant de l'astre et l'altitude de la caméra en kilomètres.
export function simCloudFade(id, altitudeKm) {
  // Les nuages simulés de l'astre.
  const c = ATMOSPHERES[id]?.simClouds;
  // Aucun : opacité 0.
  if (!c) return 0;
  // Avancement entre l'altitude proche (0) et l'altitude lointaine (1), borné.
  const t = Math.min(1, Math.max(0, (altitudeKm - c.fadeNearKm) / (c.fadeFarKm - c.fadeNearKm)));
  // Renvoie cet avancement adouci par une courbe en S.
  return t * t * (3 - 2 * t);
// Fin de simCloudFade.
}

/**
 * Paramètres du shader de diffusion, en rayons de l'astre (longueurs) et par rayon (coefficients) :
 * { ground, top, betaR, hR, betaM, betaE, hM, g } (betaE = extinction des particules). `ground` = niveau de référence (sol, ou sommet des nuages), `top` =
 * sommet de l'atmosphère. null si l'astre n'a pas d'atmosphère modélisée.
 */
// Déclare et exporte scatterParams : l'identifiant de l'astre.
export function scatterParams(id) {
  // Son atmosphère.
  const a = ATMOSPHERES[id];
  // Aucune : null.
  if (!a) return null;
  // Rayon de l'astre en mètres.
  const radiusM = a.radiusKm * 1000;
  // Renvoie les paramètres (début).
  return {
    // Niveau de référence : le sommet des nuages, ou 1 pour le sol.
    ground: cloudRadiusFactor(id) ?? 1,
    // Sommet de l'atmosphère, en rayons.
    top: 1 + a.topKm / a.radiusKm,
    // Coefficients de Rayleigh, multipliés par le rayon en mètres.
    betaR: a.rayleigh.map((b) => b * radiusM),
    // Hauteur d'échelle de Rayleigh, en rayons.
    hR: a.rayleighScaleKm / a.radiusKm,
    // Coefficients de Mie, multipliés par le rayon en mètres.
    betaM: a.mie.map((b) => b * radiusM),
    // Coefficients d'extinction : ceux de Mie multipliés par leur rapport d'extinction.
    betaE: a.mie.map((b, i) => b * a.mieExt[i] * radiusM),
    // Hauteur d'échelle de Mie, en rayons.
    hM: a.mieScaleKm / a.radiusKm,
    // Asymétrie de la diffusion de Mie.
    g: a.mieG,
  // Fin des paramètres.
  };
// Fin de scatterParams.
}
