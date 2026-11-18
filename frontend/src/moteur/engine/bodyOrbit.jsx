// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';

/**
 * Tracé de l'orbite d'un astre quelconque : planète, planète naine ou satellite naturel.
 *
 * Un seul composant pour tous les astres : ce qui change d'un astre à l'autre (sa période, la fonction qui donne
 * sa position, l'unité de cette position, la couleur de la ligne) est passé en paramètre. Le calcul des positions
 * n'est pas refait ici : il vient du moteur képlérien du backend (services/ephemeris/kepler-orbits.ts), qui sait
 * déjà traiter chaque astre de la table d'éléments (services/data/kepler-elements.ts), y compris les satellites
 * dont les éléments sont rapportés à l'équateur de leur planète ou à un plan de Laplace.
 *
 * Le tracé couvre une période orbitale complète centrée sur l'instant simulé : il passe donc exactement par
 * l'astre et suit la précession de l'orbite. Il est dessiné en ruban (orbitRibbon.jsx), en style traînée : le plus
 * clair juste derrière l'astre, il s'éteint en remontant la moitié passée, et la moitié à venir reste faible
 * (windowTrailAlphas). Sa boucle est fermée (voir closeOrbitLoop dans bodyOrbitMath.jsx).
 *
 * Repères. Les positions du backend sont dans l'écliptique J2000 « mathématique » (x vers l'équinoxe de mars,
 * z vers le pôle nord de l'écliptique) ; la scène 3D utilise (x, z, −y), parce que Three.js dessine la verticale
 * en y. Les unités du backend sont l'UA pour les planètes et le kilomètre pour les satellites ; la scène compte
 * en rayons terrestres. La conversion est faite par `scale`, calculé une fois par astre.
 *
 * Pour un satellite, les positions sont relatives à sa planète : l'appelant place la ligne sur la planète
 * (orbit.line.position.copy(planète.group.position)), comme le moteur le fait déjà pour la Lune.
 */

// Importe les éléments d'orbite de chaque astre, côté backend.
import { ASTRES } from '../../../../backend/src/services/data/kepler-elements';
// Importe la période orbitale et la position d'un astre à un instant, côté backend.
import { periodDays, positionAt as keplerPositionAt } from '../../../../backend/src/services/ephemeris/kepler-orbits';
// Importe le nombre d'unités de scène dans une unité astronomique.
import { AU_UNITS } from './planetOrbits';
// Importe les réglages par défaut du tracé, l'intervalle de recalcul, les instants et la fermeture de la boucle.
import { DEFAULT_SAMPLES, DAY_MS, refreshMsFor, orbitTimes, closeOrbitLoop } from './bodyOrbitMath';
// Importe le ruban des orbites.
import { OrbitRibbon } from './orbitRibbon';
// Importe les opacités d'un tracé centré sur l'astre, en style traînée.
import { windowTrailAlphas } from './orbitRibbonMath';

/** Rayon terrestre moyen (km) : l'unité de longueur de la scène. */
// Déclare EARTH_RADIUS_KM : la taille d'une unité de scène, en kilomètres.
const EARTH_RADIUS_KM = 6371;

/** Nombre d'unités de scène dans l'unité du backend : l'UA pour une planète, le kilomètre pour un satellite. */
// Déclare et exporte sceneScaleOf : reçoit l'unité des éléments d'orbite de l'astre.
export const sceneScaleOf = (unit) => (unit === 'km' ? 1 / EARTH_RADIUS_KM : AU_UNITS);

/**
 * Ruban de l'orbite d'un astre, dans le repère de la scène, centré sur l'astre central (le Soleil pour une
 * planète, la planète pour un satellite).
 *
 * @param {object}   o
 * @param {function} o.positionAt   (ms, out) => THREE.Vector3, position de l'astre dans le repère de la scène
 * @param {number}   o.periodMs     période orbitale, en millisecondes
 * @param {number}  [o.color]       couleur de la ligne
 * @param {number}  [o.samples]     nombre de segments du tracé
 * @param {number}  [o.refreshMs]   intervalle de recalcul, en millisecondes simulées
 * @param {boolean} [o.closed]      ferme la boucle du tracé (vrai par défaut)
 * @param {string}  [o.name]        nom de l'objet three.js
 */
// Déclare et exporte la classe BodyOrbit (début).
export class BodyOrbit {
  // Constructeur : tout ce qui dépend de l'astre est reçu en paramètre.
  constructor({
    // La fonction qui donne la position de l'astre à un instant ;
    positionAt,
    // sa période orbitale ;
    periodMs,
    // la couleur de la ligne (bleu-gris par défaut) ;
    color = 0x8fa3d0,
    // le nombre de segments du tracé ;
    samples = DEFAULT_SAMPLES,
    // l'intervalle de recalcul, déduit de la période par défaut ;
    refreshMs,
    // la fermeture de la boucle ;
    closed = true,
    // le nom de l'objet dans la scène.
    name = 'body-orbit',
  // Fin des paramètres.
  }) {
    // Garde la fonction de position.
    this.positionAt = positionAt;
    // Garde la période orbitale.
    this.periodMs = periodMs;
    // Garde le nombre de segments.
    this.samples = samples;
    // Garde l'intervalle de recalcul : celui demandé, sinon la durée d'un segment.
    this.refreshMs = refreshMs ?? refreshMsFor(periodMs, samples);
    // Garde la fermeture de la boucle.
    this.closed = closed;
    // Instant au centre du tracé : NaN, donc aucun tracé calculé pour l'instant.
    this.centerMs = NaN;
    // Vecteur de travail, pour ne rien allouer à chaque point.
    this.tmp = new THREE.Vector3();
    // Nombre d'intervalles du tracé.
    const n = samples;
    // Tableau des positions : trois nombres pour chacun des n + 1 points.
    this.positions = new Float32Array((n + 1) * 3);
    // Ruban de l'orbite, sur ces positions (remplies au premier update).
    this.ribbon = new OrbitRibbon({ points: this.positions, color, name });
    // Opacités de la traînée : la plus claire juste derrière l'astre, au milieu du tracé.
    windowTrailAlphas(this.ribbon.alphas);
    // Les envoie à la carte graphique.
    this.ribbon.alphasChanged();
    // Le maillage du ruban, sous le nom habituel de la ligne.
    this.line = this.ribbon.mesh;
  // Fin du constructeur.
  }

  /** Recalcule le tracé autour de `simMs` si nécessaire (ou toujours avec force = true). */
  // update : l'instant simulé et le recalcul forcé, faux par défaut (début).
  update(simMs, force = false) {
    // Sans forçage, si le centre du tracé est à moins d'un intervalle de recalcul de cet instant : rien à faire.
    if (!force && Math.abs(simMs - this.centerMs) < this.refreshMs) return;
    // Nouveau centre du tracé.
    this.centerMs = simMs;
    // Les instants des points du tracé : une période complète centrée sur cet instant.
    const times = orbitTimes(simMs, this.periodMs, this.samples);
    // Raccourci vers le tableau des positions.
    const p = this.positions;
    // Pour chaque instant (début).
    for (let k = 0; k < times.length; k++) {
      // Position de l'astre à cet instant, écrite dans le vecteur de travail.
      const v = this.positionAt(times[k], this.tmp);
      // Range ses trois coordonnées dans le tableau.
      p[3 * k] = v.x; p[3 * k + 1] = v.y; p[3 * k + 2] = v.z;
    // Fin de la boucle.
    }
    // Ferme la boucle du tracé : les deux bouts se rejoignent, sans déplacer l'astre au milieu.
    if (this.closed) closeOrbitLoop(p, this.samples);
    // Signale à three.js que les positions ont changé.
    this.ribbon.positionsChanged();
  // Fin de update.
  }

  /** Met en avant le tracé de l'astre visé (trait plus épais, pleine opacité). */
  // setFocused : vrai pour l'astre visé.
  setFocused(on) { this.ribbon.setFocused(on); }

  /** Force un recalcul à la prochaine image (ex. arrivée d'une table de positions plus précise). */
  // invalidate : remet le centre à NaN, ce qui force le prochain recalcul.
  invalidate() { this.centerMs = NaN; }

  // dispose : libère les ressources (début).
  dispose() {
    // Libère le ruban (géométrie et matériau).
    this.ribbon.dispose();
  // Fin de dispose.
  }
// Fin de la classe BodyOrbit.
}

/**
 * Tracé prêt à l'emploi pour un astre de la table d'éléments : la période et les positions viennent du moteur
 * képlérien du backend, l'unité de l'astre donne la conversion vers la scène. Rien d'autre à fournir que l'astre.
 *
 * @param {object|string} astre      un astre de ASTRES, ou son identifiant (« mars », « europa »…)
 * @param {object}       [options]   les options de BodyOrbit (couleur, nombre de segments…)
 * @returns {BodyOrbit}
 */
// Déclare et exporte orbitForAstre : construit le tracé d'un astre de la table.
export function orbitForAstre(astre, options = {}) {
  // L'astre : celui qui est donné, ou celui que son identifiant désigne dans la table.
  const body = typeof astre === 'string' ? ASTRES.find((a) => a.id === astre) : astre;
  // Identifiant inconnu : erreur explicite plutôt qu'un tracé vide.
  if (!body) throw new Error(`Astre inconnu : ${astre}`);
  // Nombre d'unités de scène dans l'unité de ses éléments d'orbite.
  const scale = sceneScaleOf(body.kepler.unit);
  // Le tracé (début) :
  return new BodyOrbit({
    // sa période orbitale, en millisecondes ;
    periodMs: periodDays(body) * DAY_MS,
    // son nom dans la scène ;
    name: `orbit-${body.id}`,
    // les options demandées par l'appelant ;
    ...options,
    // sa position à un instant, convertie de l'écliptique du backend vers le repère de la scène (début) :
    positionAt: (ms, out = new THREE.Vector3()) => {
      // position écliptique de l'astre, dans l'unité de ses éléments ;
      const [x, y, z] = keplerPositionAt(body, ms);
      // rangée dans le repère de la scène (x, z, −y) et dans son unité.
      return out.set(x * scale, z * scale, -y * scale);
    // Fin de la position.
    },
  // Fin du tracé.
  });
// Fin de orbitForAstre.
}
