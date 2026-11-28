// Actions d'interface que l'assistant peut demander : traduction d'une action { name, input } reçue du serveur en une
// commande déjà offerte par l'interface (boutons et réglages React existants). Fonction pure : elle valide chaque valeur
// et renvoie quoi faire, sans rien exécuter. Même liste de noms que backend/src/services/content/assistant/assistant-tools.ts.
// Importe fold, qui normalise un texte (minuscules, sans accents).
import { fold } from '../../../Engine/shared/lib/format.jsx';

// Fenêtres que l'assistant peut ouvrir : identifiant → nom affiché (début de l'objet).
const WINDOWS = {
  // Données, Paramètres et Recherche.
  galerie: 'Données', parametres: 'Paramètres', recherche: 'Recherche',
  // Sources et Informations.
  node: 'Node Open Source', informations: 'Informations',
// Fin de l'objet.
};
// Réglages que l'assistant peut changer : identifiant → nom affiché (début de l'objet).
const SETTINGS = {
  // Repères du système solaire : orbites, noms des planètes, noms des satellites,
  orbites: 'Lignes d’orbite', noms_planetes: 'Points et noms des planètes', noms_satellites: 'Points et noms des satellites',
  // étoiles, lieux de la Lune, atmosphère de Vénus et de Mars, nuages et atmosphère de la Terre.
  etoiles: 'Étoiles et Voie lactée', lieux_lune: 'Lieux de la Lune', atmospheres: 'Atmosphère de Vénus et de Mars', atmosphere_terre: 'Nuages et atmosphère de la Terre',
  // Caméra : rotation automatique, vue 3/4 et ombre.
  rotation_automatique: 'Rotation automatique', vue_3_4: 'Vue 3/4', ombre: 'Ombre',
  // Cartographie de la Terre à plat : noms des villes, noms des pays, contours,
  noms_villes: 'Noms des villes', noms_pays: 'Noms des pays', frontieres_et_littoraux: 'Frontières et littoraux',
  // rues et routes et coordonnées GPS.
  rues: 'Rues et routes', coordonnees_gps: 'Coordonnées GPS',
  // Cartographie en relief : relief 3D.
  relief_3d: 'Relief 3D',
  // Appareil : économie d'énergie (le noir pur est fusionné dans le thème, le moniteur de performance a été retiré).
  economie_energie: 'Économie d’énergie',
// Fin de l'objet.
};
// Familles d'astres : identifiant → [type du moteur, nom affiché] (début de l'objet).
const FAMILIES = {
  // Planètes solides et planètes gazeuses.
  planetes_solides: ['solid', 'Planètes solides'], planetes_gazeuses: ['gas', 'Planètes gazeuses'],
  // Planètes naines et satellites naturels.
  planetes_naines: ['dwarf', 'Planètes naines'], satellites_naturels: ['satellite', 'Satellites naturels'],
// Fin de l'objet.
};
// Vitesses de rotation autorisées.
const SPEEDS = [0.5, 1, 2, 4];

/** Clé présente dans la table elle-même (pas « constructor » ni « __proto__ », hérités de tout objet). */
// own : vrai si la clé est un texte et appartient en propre à la table.
const own = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);

// findBody : cherche un astre par son nom, sans tenir compte des accents ni de la casse ; null s'il est absent.
const findBody = (bodies, name) => bodies.find((b) => fold(b.name) === fold(String(name ?? ''))) || null;

/**
 * @param action  { name, input } venu du serveur
 * @param bodies  astres de la navigation : [{ index, name }]
 * @param lists   listes de lieux, chacune facultative :
 *           *                earthPlaces  lieux nommés de la Terre : [{ name, lon, lat }]
 *                moonPlaces   lieux nommés de la Lune : [{ name, type, lon, lat, info }]
 * @returns {{ type: string, label: string, ... } | null}  commande validée et son libellé affiché ; null si l'action
 *          est inconnue ou si une valeur n'est pas dans la liste autorisée (elle est alors ignorée)
 */
// Déclare et exporte resolveAssistantAction : reçoit l'action, la liste des astres et les listes de lieux.
export function resolveAssistantAction(action, bodies = [], lists = {}) {
  // Les paramètres de l'action, objet vide à défaut.
  const input = action?.input || {};
  // Les trois listes de lieux, vides à défaut.
  const { earthPlaces = [], moonPlaces = [] } = lists;
  // byName : cherche un lieu par son nom dans une liste, sans tenir compte des accents ni de la casse.
  const byName = (list, name) => list.find((p) => fold(p.name) === fold(String(name ?? ''))) || null;
  // Selon le nom de l'action.
  switch (action?.name) {
    // Aller à un astre.
    case 'aller_a_un_astre': {
      // Cherche l'astre demandé.
      const body = findBody(bodies, input.astre);
      // Trouvé : commande focus avec son indice et son libellé ; sinon null.
      return body ? { type: 'focus', index: body.index, label: `Aller à ${body.name}` } : null;
    // Fin du cas.
    }
    // Ouvrir une fenêtre.
    case 'ouvrir_fenetre':
      // Fenêtre autorisée : commande window avec son libellé ; sinon null.
      return own(WINDOWS, input.fenetre) ? { type: 'window', window: input.fenetre, label: `Ouvrir ${WINDOWS[input.fenetre]}` } : null;
    // Régler l'affichage.
    case 'regler_affichage':
      // Si le réglage est autorisé et que l'état est un booléen…
      return own(SETTINGS, input.reglage) && typeof input.actif === 'boolean'
        // … commande setting avec le réglage, l'état et le libellé « activé » ou « désactivé »…
        ? { type: 'setting', setting: input.reglage, on: input.actif, label: `${SETTINGS[input.reglage]} : ${input.actif ? 'activé' : 'désactivé'}` }
        // … sinon null.
        : null;
    // Afficher une famille d'astres.
    case 'afficher_famille': {
      // La famille demandée, null si elle n'est pas autorisée.
      const family = own(FAMILIES, input.famille) ? FAMILIES[input.famille] : null;
      // Si la famille existe et que l'état est un booléen…
      return family && typeof input.affiche === 'boolean'
        // … commande kind avec le type du moteur, l'état et le libellé…
        ? { type: 'kind', kind: family[0], on: input.affiche, label: `${family[1]} : ${input.affiche ? 'affichées' : 'enlevées'}` }
        // … sinon null.
        : null;
    // Fin du cas.
    }
    // Afficher ou enlever un astre.
    case 'afficher_astre': {
      // Cherche l'astre demandé.
      const body = findBody(bodies, input.astre);
      // Si l'astre existe, n'est pas le Soleil (indice 0) et que l'état est un booléen…
      return body && body.index !== 0 && typeof input.affiche === 'boolean'
        // … commande body avec l'indice, l'état et le libellé…
        ? { type: 'body', index: body.index, on: input.affiche, label: `${body.name} : ${input.affiche ? 'affiché' : 'enlevé'}` }
        // … sinon null.
        : null;
    // Fin du cas.
    }
    // Régler la vitesse de rotation.
    case 'regler_vitesse_rotation':
      // Si la vitesse fait partie des vitesses autorisées…
      return SPEEDS.includes(input.vitesse)
        // … commande speed, avec un libellé où le point décimal devient une virgule…
        ? { type: 'speed', speed: input.vitesse, label: `Vitesse de rotation ×${String(input.vitesse).replace('.', ',')}` }
        // … sinon null.
        : null;
    // Aller à un lieu nommé de la Terre.
    case 'aller_a_un_lieu_de_la_terre': {
      // Le lieu demandé, parmi ceux que l'app connaît.
      const place = byName(earthPlaces, input.lieu);
      // Trouvé : commande earthPlace avec le lieu et son libellé ; sinon null, le nom est inconnu.
      return place ? { type: 'earthPlace', place, label: `Survol de ${place.name}` } : null;
    // Fin du cas.
    }
    // Aller à un lieu nommé de la Lune.
    case 'aller_a_un_lieu_de_la_lune': {
      // Le lieu demandé, parmi ceux que l'app connaît.
      const place = byName(moonPlaces, input.lieu);
      // Trouvé : commande moonPlace avec le lieu et son libellé ; sinon null.
      return place ? { type: 'moonPlace', place, label: `Survol de ${place.name} (Lune)` } : null;
    // Fin du cas.
    }
    // Zoomer.
    case 'zoomer':
      // Si le sens est « rapprocher » ou « eloigner »…
      return input.sens === 'rapprocher' || input.sens === 'eloigner'
        // … commande zoom, de facteur 0,5 pour se rapprocher et 2 pour s'éloigner, avec son libellé…
        ? { type: 'zoom', factor: input.sens === 'rapprocher' ? 0.5 : 2, label: input.sens === 'rapprocher' ? 'Zoom avant' : 'Zoom arrière' }
        // … sinon null.
        : null;
    // Vue globale.
    case 'vue_globale':
      // Commande reset.
      return { type: 'reset', label: 'Vue globale' };
    // Toute autre action.
    default:
      // Ignorée.
      return null;
  // Fin du choix.
  }
// Fin de resolveAssistantAction.
}
