/**
 * Import des planètes naines depuis JPL Horizons.
 *
 * Les cinq planètes naines reconnues par l'UAI (Cérès, Pluton, Haumea, Makemake, Éris) n'ont pas d'éléments dans la
 * table « Keplerian Elements for Approximate Positions of the Major Planets » qui sert aux huit planètes : il faut
 * les demander à Horizons. Ce module ne contient que des fonctions pures — construction de l'adresse, lecture de la
 * réponse, conversion, contrôles — pour être testable sans réseau ; l'appel lui-même est dans
 * services/scripts/dwarf-planets-import.ts, qui s'exécute à la main et écrit un fichier de données du dépôt.
 *
 * L'app ne parle donc jamais à Horizons à l'exécution : les orbites restent calculées localement par Kepler, à
 * partir de données fixes du dépôt, comme pour les huit planètes.
 */
// Type (effacé à la compilation) des données d'une planète.
import type { PlanetData } from '../data/bodies.data';

/** Rayon terrestre moyen (km) : les rayons de la table sont exprimés en rayons terrestres. */
// Rayon de la Terre : 6 371 km.
export const EARTH_RADIUS_KM = 6371;
/** Jours d'un siècle julien : sert à passer d'un mouvement par jour à une dérive par siècle. */
// Un siècle julien : 36 525 jours.
export const JULIAN_CENTURY_DAYS = 36525;

// Forme de la définition d'une planète naine à importer.
export interface DwarfPlanetDef {
  // id : son identifiant interne.
  id: string;
  // nom : son nom français, celui de la table des planètes.
  nom: string;
  /** Commande Horizons : le numéro du petit corps suivi d'un point-virgule (sans lui, Horizons cherche une planète). */
  // horizons : sa commande Horizons.
  horizons: string;
  // color : sa couleur dans l'interface.
  color: string;
  /**
   * Demi-grand axe attendu (UA), pour le contrôle de vraisemblance. Horizons peut répondre à propos d'un autre
   * corps que celui demandé (relais, cache, numéro ambigu) : comparer le demi-grand axe reçu à cette valeur
   * repère immédiatement une réponse qui ne correspond pas à l'objet.
   */
  // aAttendu : son demi-grand axe approximatif.
  aAttendu: number;
  /**
   * Rayon moyen publié (km), utilisé seulement quand Horizons répond « RAD= n.a. », ce qui est le cas des objets
   * transneptuniens. La provenance est écrite dans le fichier produit, pour ne pas faire passer une valeur publiée
   * pour une mesure d'Horizons.
   */
  // rayonPublieKm : son rayon moyen publié, s'il en faut un.
  rayonPublieKm?: number;
// Fin de DwarfPlanetDef.
}

/** Les cinq planètes naines reconnues par l'UAI, de la plus proche à la plus lointaine du Soleil. */
// Liste des planètes naines à importer :
export const DWARF_PLANETS: DwarfPlanetDef[] = [
  // Cérès, dans la ceinture d'astéroïdes : commande « 1; », gris pierreux, demi-grand axe attendu 2,77 UA.
  { id: 'ceres', nom: 'Cérès', horizons: '1;', color: '#9b9289', aAttendu: 2.77 },
  // Pluton, déjà dans la table des planètes : commande « 134340; », beige, demi-grand axe attendu 39,5 UA.
  { id: 'pluto', nom: 'Pluton', horizons: '134340;', color: '#d8b894', aAttendu: 39.5 },
  // Haumea, transneptunienne allongée : commande « 136108; », blanc glacé, demi-grand axe attendu 43,1 UA, rayon publié 816 km.
  { id: 'haumea', nom: 'Haumea', horizons: '136108;', color: '#dcd8cf', aAttendu: 43.1, rayonPublieKm: 816 },
  // Makemake, transneptunienne rougeâtre : commande « 136472; », rouge pâle, demi-grand axe attendu 45,4 UA, rayon publié 715 km.
  { id: 'makemake', nom: 'Makemake', horizons: '136472;', color: '#c8a08c', aAttendu: 45.4, rayonPublieKm: 715 },
  // Éris, la plus lointaine : commande « 136199; », gris très clair, demi-grand axe attendu 67,8 UA, rayon publié 1 163 km.
  { id: 'eris', nom: 'Éris', horizons: '136199;', color: '#e3e1dc', aAttendu: 67.8, rayonPublieKm: 1163 },
// Fin de la liste.
];

/** Adresse du service Horizons : HORIZONS_API_URL si elle est définie, sinon l'adresse officielle de la NASA. */
// Adresse de l'API Horizons.
export const HORIZONS_URL = process.env.HORIZONS_API_URL?.trim() || 'https://ssd.jpl.nasa.gov/api/horizons.api';

/**
 * Adresse de la requête : les éléments osculateurs d'un corps à une date, autour du centre du Soleil (500@10),
 * en unités astronomiques et jours. Une seule date suffit, c'est l'époque des éléments.
 */
// Fonction horizonsElementsUrl : reçoit la commande et la date (J2000 par défaut), et renvoie l'adresse.
export function horizonsElementsUrl(command: string, epoch = '2000-01-01 12:00', base: string = HORIZONS_URL): string {
  // Paramètres de la requête (début).
  const q = new URLSearchParams({
    // réponse en texte ;
    format: 'text',
    // le corps demandé ;
    COMMAND: `'${command}'`,
    // avec ses paramètres physiques (rayon, rotation) ;
    OBJ_DATA: 'YES',
    // en calculant une éphéméride ;
    MAKE_EPHEM: 'YES',
    // de type « éléments d'orbite » ;
    EPHEM_TYPE: 'ELEMENTS',
    // autour du centre du Soleil ;
    CENTER: "'500@10'",
    // à cette date ;
    START_TIME: `'${epoch}'`,
    // jusqu'au lendemain ;
    STOP_TIME: `'${epoch.slice(0, 10)} 23:59'`,
    // un seul pas ;
    STEP_SIZE: "'1 d'",
    // en unités astronomiques et jours.
    OUT_UNITS: 'AU-D',
  // Fin des paramètres.
  });
  // L'adresse complète.
  return `${base}?${q.toString()}`;
// Fin de horizonsElementsUrl.
}

// Forme des éléments lus dans une réponse d'Horizons.
export interface HorizonsElements {
  /** Nom du corps tel qu'Horizons le renvoie : contrôlé contre celui demandé. */
  // target : le corps de la réponse.
  target: string;
  // ec : excentricité.
  ec: number;
  // inc : inclinaison sur l'écliptique, en degrés.
  inc: number;
  // om : longitude du nœud ascendant Ω, en degrés.
  om: number;
  // w : argument du périhélie ω, en degrés.
  w: number;
  // n : moyen mouvement, en degrés par jour.
  n: number;
  // ma : anomalie moyenne à l'époque, en degrés.
  ma: number;
  // a : demi-grand axe, en unités astronomiques.
  a: number;
  // radiusKm : le rayon donné par Horizons, ou null s'il répond « n.a. ».
  radiusKm: number | null;
  // rotationHours : la période de rotation donnée par Horizons, ou null.
  rotationHours: number | null;
// Fin de HorizonsElements.
}

/** Lit un champ « CLE= valeur » de la réponse ; null si le champ manque ou vaut « n.a. ». */
// Fonction field : reçoit le texte et la clé.
function field(text: string, key: string): number | null {
  // Cherche la clé, un « = » éventuellement espacé, puis un nombre (notation scientifique comprise) ou « n.a. ».
  // La clé ne doit pas être précédée d'une lettre : sans cela, « A » serait trouvé dans « MA= » et « N » dans
  // « IN= », et on lirait l'anomalie moyenne à la place du demi-grand axe.
  const m = new RegExp(`(?<![A-Za-z])${key}\\s*=\\s*(n\\.a\\.|[-+]?[\\d.]+(?:[eE][-+]?\\d+)?)`).exec(text);
  // Champ absent : null.
  if (!m) return null;
  // Champ à « n.a. » : null.
  if (m[1].startsWith('n.a')) return null;
  // Le nombre lu.
  const v = Number(m[1]);
  // Un nombre valide, sinon null.
  return Number.isFinite(v) ? v : null;
// Fin de field.
}

/**
 * Lit une réponse texte d'Horizons. Lève une erreur si le bloc d'éléments ($$SOE … $$EOE) manque ou s'il manque un
 * élément indispensable : mieux vaut s'arrêter que produire une orbite muette.
 */
// Fonction parseHorizonsElements : reçoit le texte de la réponse.
export function parseHorizonsElements(text: string): HorizonsElements {
  // Bloc d'éléments, entre les deux marqueurs d'Horizons.
  const block = /\$\$SOE([\s\S]*?)\$\$EOE/.exec(text);
  // Bloc absent : la requête a échoué (corps inconnu, service en panne, message d'erreur).
  if (!block) throw new Error(`réponse Horizons sans bloc d’éléments ($$SOE) : ${text.trim().slice(0, 200)}`);
  // Le contenu du bloc.
  const body = block[1];
  // Nom du corps, pris dans le bandeau « JPL/HORIZONS <nom> » de l'en-tête.
  const banner = /JPL\/HORIZONS\s+(.+?)\s{2,}/.exec(text);
  // Le nom trouvé, ou un texte vide.
  const target = banner ? banner[1].trim() : '';
  // Les six éléments, le moyen mouvement et l'anomalie moyenne, lus dans le bloc.
  const got = { ec: field(body, 'EC'), inc: field(body, 'IN'), om: field(body, 'OM'), w: field(body, 'W'), n: field(body, 'N'), ma: field(body, 'MA'), a: field(body, 'A') };
  // Pour chaque élément (début).
  for (const [key, value] of Object.entries(got)) {
    // Manquant : erreur qui le nomme.
    if (value === null) throw new Error(`élément « ${key.toUpperCase()} » absent de la réponse Horizons pour ${target || 'ce corps'}`);
  // Fin de la boucle.
  }
  // Renvoie les éléments, plus le rayon et la rotation pris dans l'en-tête (absents pour les transneptuniens).
  return { target, ...(got as Record<keyof typeof got, number>), radiusKm: field(text, 'RAD'), rotationHours: field(text, 'ROTPER') };
// Fin de parseHorizonsElements.
}

/** Angle ramené dans l'intervalle [0, 360[. */
// Fonction wrap360 : reçoit un angle en degrés.
export const wrap360 = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Convertit les éléments osculateurs d'Horizons au format de la table des planètes :
 * [a, a', e, e', I, I', L, L', ϖ, ϖ', Ω, Ω'] — chaque élément suivi de sa dérive par siècle julien.
 *
 * Horizons donne ω (argument du périhélie) et M (anomalie moyenne) ; la table attend ϖ (longitude du périhélie,
 * soit Ω + ω) et L (longitude moyenne, soit ϖ + M). Les dérives séculaires des huit planètes sont ajustées sur les
 * observations ; pour une planète naine on n'en a pas, donc elles valent zéro, sauf celle de la longitude moyenne,
 * qui vaut le moyen mouvement d'Horizons multiplié par la durée d'un siècle julien. C'est une propagation à deux
 * corps : juste à quelques minutes d'arc par siècle, ce qui est sans effet à l'écran, mais ce n'est pas une
 * éphéméride de précision.
 */
// Fonction toPlanetElements : reçoit les éléments lus.
export function toPlanetElements(el: HorizonsElements): number[] {
  // Longitude du périhélie : nœud plus argument du périhélie.
  const varpi = wrap360(el.om + el.w);
  // Longitude moyenne : longitude du périhélie plus anomalie moyenne.
  const L = wrap360(varpi + el.ma);
  // Les douze nombres : chaque élément, puis sa dérive par siècle.
  return [el.a, 0, el.ec, 0, el.inc, 0, L, el.n * JULIAN_CENTURY_DAYS, varpi, 0, el.om, 0];
// Fin de toPlanetElements.
}

/**
 * Contrôle de vraisemblance : le corps renvoyé est-il bien celui demandé ? Lève une erreur si son nom ne contient
 * pas celui attendu, ou si le demi-grand axe reçu s'écarte de plus de 15 % de celui attendu. C'est ce contrôle qui
 * repère une réponse portant sur un autre corps — un relais ou un cache peut renvoyer la page d'un objet voisin,
 * et une orbite fausse passerait sinon inaperçue.
 */
// Fonction checkHorizonsTarget : reçoit la définition et les éléments lus.
export function checkHorizonsTarget(def: DwarfPlanetDef, el: HorizonsElements): void {
  // Nom attendu, sans accents ni majuscules.
  const wanted = def.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Nom reçu, traité de même.
  const got = el.target.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Le nom reçu ne contient pas le nom attendu : erreur qui montre les deux.
  if (got && !got.includes(wanted)) throw new Error(`Horizons a répondu à propos de « ${el.target} » et non de « ${def.nom} » : requête abandonnée`);
  // Écart relatif entre le demi-grand axe reçu et celui attendu.
  const ecart = Math.abs(el.a - def.aAttendu) / def.aAttendu;
  // Écart de plus de 15 % : erreur qui donne les deux valeurs.
  if (ecart > 0.15) throw new Error(`demi-grand axe invraisemblable pour ${def.nom} : ${el.a} UA reçu, ${def.aAttendu} UA attendu`);
// Fin de checkHorizonsTarget.
}

// Forme d'une planète naine importée : ses données et la provenance de son rayon.
export interface ImportedDwarf {
  // id : son identifiant.
  id: string;
  // data : ses données, au format de la table des planètes.
  data: PlanetData;
  // rayonSource : d'où vient son rayon, d'Horizons ou d'une valeur publiée.
  rayonSource: 'horizons' | 'publié';
// Fin de ImportedDwarf.
}

/**
 * Construit l'entrée de la table des planètes. Le rayon vient d'Horizons quand il le donne, sinon de la valeur
 * publiée de la définition ; sans l'un ni l'autre, erreur, car un astre sans rayon ne peut pas être dessiné.
 * La rotation est convertie en jours, négative pour une rotation rétrograde, comme le reste de la table.
 */
// Fonction toDwarfPlanet : reçoit la définition et les éléments lus.
export function toDwarfPlanet(def: DwarfPlanetDef, el: HorizonsElements): ImportedDwarf {
  // Rayon retenu : celui d'Horizons, sinon la valeur publiée.
  const rayonKm = el.radiusKm ?? def.rayonPublieKm ?? null;
  // Aucun des deux : erreur.
  if (rayonKm === null) throw new Error(`rayon inconnu pour ${def.nom} : Horizons répond « n.a. » et aucune valeur publiée n’est inscrite`);
  // Période de rotation en jours ; une journée par défaut si Horizons ne la donne pas.
  const rotation = el.rotationHours === null ? 1 : el.rotationHours / 24;
  // Renvoie l'identifiant, les données et la provenance du rayon.
  return {
    // son identifiant ;
    id: def.id,
    // ses données ;
    data: {
      // son nom ;
      name: def.nom,
      // son rayon, en rayons terrestres ;
      radius: Number((rayonKm / EARTH_RADIUS_KM).toFixed(5)),
      // sa rotation, en jours ;
      rotation: Number(rotation.toFixed(5)),
      // la marque de planète naine ;
      dwarf: true,
      // sa couleur ;
      color: def.color,
      // ses éléments d'orbite.
      elements: toPlanetElements(el),
    // Fin des données.
    },
    // la provenance du rayon.
    rayonSource: el.radiusKm === null ? 'publié' : 'horizons',
  // Fin de l'objet.
  };
// Fin de toDwarfPlanet.
}
