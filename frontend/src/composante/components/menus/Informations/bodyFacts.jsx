// Importe les mises en forme de latitude, de longitude et de nombre.
import { fmtLat, fmtLon, nf } from '@/moteur/lib/format';
// Importe atmosphereThickness, l'épaisseur de l'atmosphère d'un astre.
import { atmosphereThickness } from '@/moteur/engine/atmosphereData';
// Importe bodyId, qui donne l'identifiant d'un astre.
import { bodyId } from '@/moteur/engine/bodyPlaces';
// Importe les caractéristiques fixes d'une planète, sa masse et la notation scientifique.
import { planetData, planetMass, scientific } from '@/moteur/engine/planetData';

// Rayon moyen de la Terre, en kilomètres.
const EARTH_RADIUS_KM = 6371;

// finite : vrai si la valeur est un nombre fini.
const finite = (value) => Number.isFinite(value);

// Déclare et exporte moonFacts : les caractéristiques en direct de la Lune (début du tableau).
export const moonFacts = (m) => [
  // Nature de l'astre et diamètre moyen lunaire.
  { term: 'Type', value: 'Satellite naturel' },
  // Le diamètre moyen de la Lune : 3 474,8 km.
  { term: 'Diamètre', value: '3 474,8 km', note: 'diamètre moyen' },
  // La phase et la part éclairée ; en note, l'âge de la lune s'il est connu.
  { term: 'Phase', value: `${m.phase} · ${m.lit} % éclairée`, note: finite(m.ageDays) ? `${nf(m.ageDays, 1)} j depuis la nouvelle lune` : null },
  // La distance ; en note, le temps de trajet de la lumière et, si elle est connue, la source de la position.
  { term: 'Distance', value: `${nf(m.distKm)} km`, note: `lumière : ${nf(m.lightSeconds, 3)} s${m.source ? ` · position ${m.source}` : ''}` },
  // La libration, si elle est connue.
  m.libration && { term: 'Libration', value: `${fmtLon(m.libration.lon)} · ${fmtLat(m.libration.lat)}`, note: 'point de la Lune vu au centre depuis la Terre' },
  // Le point subsolaire, s'il est connu.
  m.subSolar && { term: 'Soleil au zénith', value: `${fmtLon(m.subSolar.lon)} · ${fmtLat(m.subSolar.lat)}`, note: 'point subsolaire ; le terminateur est à 90° de là' },
// Fin du tableau ; les entrées absentes sont retirées.
].filter(Boolean);

/** Durée en jours, écrite en heures sous deux jours. */
// days : écrit une durée en jours à partir de deux jours, en heures en dessous.
const days = (d) => (d >= 2 ? `${nf(d, 2)} j` : `${nf(d * 24, 1)} h`);

/**
 * Fiche d'un satellite naturel. `def` = ses caractéristiques fixes (API /bodies : rayon, demi-grand axe, période) ;
 * `live` = ce qui change en direct (moteur : distance à sa planète, distance au Soleil).
 */
// Déclare et exporte satelliteFacts : les mesures en direct et la définition du satellite.
export const satelliteFacts = (live, def) => {
  // Liste des caractéristiques.
  const facts = [];
  // Nom de la planète du satellite, « sa planète » à défaut.
  const parent = live?.parentName || 'sa planète';
  // Si le rayon est connu.
  if (finite(def.radiusKm)) {
    // Ajoute le diamètre (une décimale sous 100 km de rayon) ; en note, le rayon moyen.
    facts.push({ term: 'Diamètre', value: `${nf(2 * def.radiusKm, def.radiusKm < 100 ? 1 : 0)} km`, note: `rayon moyen : ${nf(def.radiusKm, 1)} km` });
  // Fin du cas.
  }
  // Si le demi-grand axe est connu et positif.
  if (finite(def.aKm) && def.aKm > 0) {
    // Ajoute l'orbite, avec sa planète en note.
    facts.push({ term: 'Orbite', value: `${nf(def.aKm)} km`, note: `demi-grand axe autour de ${parent}` });
  // Fin du cas.
  }
  // Si la période est connue et non nulle.
  if (finite(def.periodDays) && def.periodDays !== 0) {
    // Sa valeur absolue (une période négative signale une orbite rétrograde).
    const period = Math.abs(def.periodDays);
    // Ajoute la période, avec la mention « rétrograde » s'il y a lieu.
    facts.push({ term: 'Période orbitale', value: `${days(period)}${def.periodDays < 0 ? ' (rétrograde)' : ''}`, note: `un tour autour de ${parent}` });
    // Si le demi-grand axe est aussi connu.
    if (finite(def.aKm) && def.aKm > 0) {
      // Ajoute la vitesse orbitale moyenne : la circonférence de l'orbite divisée par la période en secondes.
      facts.push({ term: 'Vitesse orbitale', value: `${nf((2 * Math.PI * def.aKm) / (period * 86400), 2)} km/s`, note: 'moyenne sur une orbite' });
    // Fin du cas.
    }
  // Fin du cas.
  }
  // Si la distance en direct est connue.
  if (finite(live?.distKm)) {
    // Ajoute la distance à la planète ; la note signale une position approchée s'il y a lieu.
    facts.push({ term: `Distance à ${parent}`, value: `${nf(live.distKm)} km`, note: live.exact === false ? 'en direct, de centre à centre · position approchée' : 'en direct, de centre à centre' });
  // Fin du cas.
  }
  // Si la distance au Soleil est connue.
  if (finite(live?.au)) {
    // Ajoute cette distance en unités astronomiques ; en note, le temps de trajet de la lumière s'il est connu.
    facts.push({ term: 'Distance au Soleil', value: `${nf(live.au, 3)} UA`, note: finite(live.lightMinutes) ? `en direct · lumière : ${nf(live.lightMinutes, 1)} min` : 'en direct' });
  // Fin du cas.
  }
  // Renvoie la liste.
  return facts;
// Fin de satelliteFacts.
};

// Déclare et exporte planetFacts : les mesures en direct et la définition de la planète.
export const planetFacts = (body, def) => {
  // Liste des caractéristiques.
  const facts = [];
  // Caractéristiques fixes de la planète (type, densité, gravité, températures, noyau, champ magnétique) : planetData.
  // Identifiant de la planète, si elle a un nom.
  const id = def.name ? bodyId(def) : null;
  // Ses caractéristiques fixes, si l'identifiant est connu.
  const fixed = id ? planetData(id) : null;
  // Sa masse, si l'identifiant est connu.
  const mass = id ? planetMass(id) : null;
  // Ajoute le type, s'il est connu.
  if (fixed?.type) facts.push({ term: 'Type', value: fixed.type });
  // Si le rayon est connu.
  if (finite(def.radius)) {
    // Ajoute le diamètre en kilomètres ; en note, le rayon en rayons terrestres.
    facts.push({ term: 'Diamètre', value: `${nf(2 * def.radius * EARTH_RADIUS_KM)} km`, note: `${nf(def.radius, 3)} rayon terrestre` });
  // Fin du cas.
  }
  // Si la masse est connue.
  if (mass) {
    // Masse en masses terrestres : une décimale à partir de 10, trois en dessous.
    const earths = mass.earths >= 10 ? nf(mass.earths, 1) : nf(mass.earths, 3);
    // Ajoute la masse en kilogrammes, en notation scientifique.
    facts.push({ term: 'Masse', value: `${scientific(mass.kg)} kg`, note: `${earths} masse terrestre` });
  // Fin du cas.
  }
  // S'il y a des caractéristiques fixes.
  if (fixed) {
    // Ajoute la densité.
    facts.push({ term: 'Densité', value: `${nf(fixed.density, 2)} g/cm³`, note: 'moyenne ; eau = 1' });
    // Ajoute la gravité ; en note, sa valeur en g et le niveau de référence (1 bar pour une géante, le sol sinon).
    facts.push({ term: 'Gravité', value: `${nf(fixed.gravity, 2)} m/s²`, note: `${nf(fixed.gravity / 9.80665, 2)} g · ${fixed.type.startsWith('Géante') ? 'au niveau 1 bar' : 'au sol'}` });
  // Fin du cas.
  }
  // Si la rotation est connue et non nulle.
  if (finite(def.rotation) && def.rotation !== 0) {
    // Sa valeur absolue.
    const absRot = Math.abs(def.rotation);
    // Écrite en jours à partir de deux jours, en heures en dessous.
    const rotation = absRot >= 2 ? `${nf(absRot, 2)} j` : `${nf(absRot * 24, 1)} h`;
    // Ajoute la rotation, avec la mention « rétrograde » s'il y a lieu.
    facts.push({ term: 'Rotation', value: `${rotation}${def.rotation < 0 ? ' (rétrograde)' : ''}`, note: 'un tour sur elle-même' });
  // Fin du cas.
  }
  // Ajoute le jour solaire, s'il est connu.
  if (fixed?.solarDay) facts.push({ term: 'Jour solaire', ...fixed.solarDay });
  // S'il y a des caractéristiques fixes.
  if (fixed) {
    // Ajoute la température.
    facts.push({ term: 'Température', ...fixed.temperature });
    // Ajoute le noyau.
    facts.push({ term: 'Noyau', ...fixed.core });
    // Ajoute le champ magnétique.
    facts.push({ term: 'Champ magnétique', ...fixed.magnetic });
  // Fin du cas.
  }
  // Si la distance au Soleil est connue.
  if (finite(body?.au)) {
    // Ajoute cette distance en unités astronomiques ; en note, le temps de trajet de la lumière s'il est connu.
    facts.push({ term: 'Distance au Soleil', value: `${nf(body.au, 3)} UA`, note: finite(body.lightMinutes) ? `lumière : ${nf(body.lightMinutes, 1)} min` : null });
  // Fin du cas.
  }
  // Épaisseur de l'atmosphère : jusqu'à l'exobase (planètes solides), couche des vents (géantes) ; voir atmosphereData.
  // Épaisseur de l'atmosphère, si l'identifiant est connu.
  const atmosphere = id ? atmosphereThickness(id) : null;
  // Si elle est connue.
  if (atmosphere) {
    // Sa valeur en kilomètres, précédée de ≤ ou de ≈ ; « Aucune » si elle est nulle.
    const value = atmosphere.km > 0 ? `${atmosphere.max ? '≤' : '≈'} ${nf(atmosphere.km)} km` : 'Aucune';
    // Ajoute l'épaisseur de l'atmosphère, avec sa note.
    facts.push({ term: 'Épaisseur de l’atmosphère', value, note: atmosphere.note });
  // Fin du cas.
  }
  // Troisième loi de Kepler (demi-grand axe en UA) ; ignorée si les éléments orbitaux manquent.
  // Demi-grand axe : le premier élément orbital, s'il existe.
  const semiMajor = def.elements?.[0];
  // S'il est connu et positif.
  if (finite(semiMajor) && semiMajor > 0) {
    // Période en années : le demi-grand axe à la puissance 1,5.
    const periodYears = Math.pow(semiMajor, 1.5);
    // Ajoute la période orbitale : en jours sous un an, en années sinon.
    facts.push({ term: 'Période orbitale', value: periodYears < 1 ? `${nf(periodYears * 365.25)} j` : `${nf(periodYears, 2)} ans`, note: 'un tour autour du Soleil' });
  // Fin du cas.
  }
  // Renvoie la liste.
  return facts;
// Fin de planetFacts.
};
