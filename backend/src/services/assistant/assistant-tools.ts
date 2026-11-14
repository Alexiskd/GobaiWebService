// Données des astres : tous les satellites, la Lune, les planètes et le Soleil.
import { ALL_SATELLITES, MOON, PLANETS, SUN } from '../data/bodies.data';
// Villes de France où le calque LiDAR HD est proposé.
import { LIDAR_HD_CITIES } from '../data/lidar-hd-cities.data';

/**
 * Actions que l'assistant peut déclencher dans l'interface : uniquement des boutons et réglages qui existent déjà
 * dans l'app (téléportation, fenêtres, interrupteurs). Le serveur ne fait que les transmettre au navigateur, qui les
 * exécute avec les mêmes fonctions que les boutons (frontend : scene/useAssistantActions.jsx, même liste de noms).
 * Aucune action ne touche au serveur, aux données ou à une page hors de l'app.
 */
// Noms de tous les astres, dans l'ordre : le Soleil, les planètes, la Lune, puis les satellites ; c'est la liste des valeurs acceptées par les outils.
export const BODY_NAMES: string[] = [SUN.name, ...PLANETS.map((p) => p.name), MOON.name, ...ALL_SATELLITES.map((s) => s.name)];

// Fenêtres que l'assistant peut ouvrir ; « as const » fige la liste et ses valeurs exactes pour TypeScript.
export const WINDOWS = ['galerie', 'parametres', 'recherche', 'aide', 'node', 'langue', 'informations'] as const;
/**
 * Interrupteurs que l'assistant peut actionner : tous ceux de la fenêtre Paramètres et de la barre d'outils. Même
 * liste que la table du navigateur (frontend scene/assistantActions.jsx) ; chacun correspond à un interrupteur que
 * l'utilisateur peut lui-même basculer.
 */
// Interrupteurs d'affichage que l'assistant peut actionner :
export const DISPLAY_SETTINGS = [
  // repères du système solaire,
  'orbites', 'noms_planetes', 'noms_satellites', 'etoiles', 'lieux_lune', 'atmospheres',
  // caméra et rotation,
  'rotation_automatique', 'vue_3_4', 'ombre',
  // cartographie de la Terre à plat,
  'noms_villes', 'noms_pays', 'frontieres_et_littoraux', 'rues', 'routes', 'volcans', 'coordonnees_gps',
  // cartographie en relief,
  'relief_3d', 'lidar_hd', 'points_lidar',
  // appareil.
  'noir_pur', 'economie_energie', 'moniteur_performance',
// Fin de la liste.
] as const;
/** Modèles LiDAR HD : l'ombrage de la surface, du sol nu ou des hauteurs. */
// Modèles LiDAR HD proposés.
export const LIDAR_MODELS = ['surface', 'sol_nu', 'hauteurs'] as const;
/** Couleur des points LiDAR 3D : celles de la photo aérienne, ou le type de chaque point. */
// Modes de couleur des points LiDAR.
export const LIDAR_COLORS = ['photo', 'types'] as const;
/** Villes de France où le calque LiDAR HD est proposé : valeurs acceptées par l'outil des villes. */
// Noms des villes du LiDAR HD.
export const LIDAR_CITY_NAMES: string[] = LIDAR_HD_CITIES.map((c) => c.name);
// Familles d'astres que l'assistant peut afficher ou enlever.
export const FAMILIES = ['planetes_solides', 'planetes_gazeuses', 'planetes_naines', 'satellites_naturels'] as const;
// Vitesses de rotation automatique acceptées.
export const ROTATION_SPEEDS = [0.5, 1, 2, 4] as const;

// Forme d'un outil, au format attendu par l'API Claude.
interface ToolDefinition {
  // name : le nom de l'outil.
  name: string;
  // description : ce qu'il fait, lu par le modèle pour choisir.
  description: string;
  // input_schema : le schéma JSON de ses paramètres (un objet, ses champs, les champs obligatoires, aucun champ en plus).
  input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
// Fin de ToolDefinition.
}

// Fonction tool : fabrique un outil à partir de son nom, de sa description et de ses champs ; par défaut tous les champs sont obligatoires.
const tool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = Object.keys(properties)): ToolDefinition => ({
  // Renvoie l'outil, avec un schéma qui interdit tout champ non déclaré.
  name, description, input_schema: { type: 'object', properties, required, additionalProperties: false },
// Fin de tool.
});

/** Outils envoyés à l'API Claude (format Messages API : name, description, input_schema). */
// Liste des outils envoyés à l'API Claude.
export const ASSISTANT_TOOLS: ToolDefinition[] = [
  // Outil « aller_a_un_astre » : téléporte la vue sur un astre.
  tool('aller_a_un_astre', 'Téléporte la vue sur un astre (comme un clic sur son bouton). Un astre masqué est réaffiché avant.', {
    // Son paramètre astre : un texte parmi les noms d'astres.
    astre: { type: 'string', enum: BODY_NAMES, description: 'Nom français de l’astre.' },
  // Fin de l'outil.
  }),
  // Outil « ouvrir_fenetre » : ouvre une fenêtre de l'interface.
  tool('ouvrir_fenetre', 'Ouvre une fenêtre de l’interface (comme un clic sur son bouton de la barre d’outils).', {
    // Son paramètre fenetre : un texte parmi les fenêtres autorisées.
    fenetre: { type: 'string', enum: [...WINDOWS], description: 'informations = fiche de l’astre ciblé.' },
  // Fin de l'outil.
  }),
  // Outil « regler_affichage » : active ou désactive un interrupteur.
  tool('regler_affichage', 'Active ou désactive un interrupteur de l’interface : repères du système solaire, caméra, '
    + 'cartographie de la Terre (noms, frontières, rues, volcans, relief 3D, LiDAR HD, points LiDAR 3D) et réglages '
    + 'de l’appareil. Ce sont les interrupteurs de la fenêtre Paramètres et de la barre d’outils.', {
    // Paramètre reglage : un texte parmi les réglages autorisés.
    reglage: { type: 'string', enum: [...DISPLAY_SETTINGS] },
    // Paramètre actif : vrai ou faux.
    actif: { type: 'boolean' },
  // Fin de l'outil.
  }),
  // Outil « afficher_famille » : affiche ou enlève une famille d'astres.
  tool('afficher_famille', 'Affiche ou enlève une famille d’astres entière (boutons « Astres affichés » de Paramètres).', {
    // Paramètre famille : un texte parmi les familles autorisées.
    famille: { type: 'string', enum: [...FAMILIES] },
    // Paramètre affiche : vrai ou faux.
    affiche: { type: 'boolean' },
  // Fin de l'outil.
  }),
  // Outil « afficher_astre » : affiche ou enlève un astre précis.
  tool('afficher_astre', 'Affiche ou enlève un astre précis de la scène (sa case dans Paramètres). Le Soleil ne s’enlève pas.', {
    // Paramètre astre : un nom d'astre, sauf le Soleil, retiré de la liste.
    astre: { type: 'string', enum: BODY_NAMES.filter((n) => n !== SUN.name) },
    // Paramètre affiche : vrai ou faux.
    affiche: { type: 'boolean' },
  // Fin de l'outil.
  }),
  // Outil « regler_vitesse_rotation » : règle la vitesse de la rotation automatique.
  tool('regler_vitesse_rotation', 'Règle la vitesse de la rotation automatique de la vue (boutons de Paramètres).', {
    // Paramètre vitesse : un nombre parmi les vitesses autorisées.
    vitesse: { type: 'number', enum: [...ROTATION_SPEEDS], description: '1 = vitesse normale.' },
  // Fin de l'outil.
  }),
  // Outil « choisir_modele_lidar » : choisit le modèle LiDAR HD affiché.
  tool('choisir_modele_lidar', 'Choisit le modèle LiDAR HD affiché sur la France et allume le calque s’il est éteint '
    + '(boutons de Paramètres › Cartographie en relief).', {
    // Paramètre modele : un texte parmi les modèles autorisés.
    modele: { type: 'string', enum: [...LIDAR_MODELS], description: 'surface = sol, bâtiments et végétation ; sol_nu = le sol seul ; hauteurs = ce qui dépasse du sol.' },
  // Fin de l'outil.
  }),
  // Outil « aller_au_dessus_d_une_ville » : se rend au-dessus d'une ville de France, calque LiDAR HD allumé.
  tool('aller_au_dessus_d_une_ville', 'Allume le calque LiDAR HD de l’IGN et se rend au-dessus d’une ville de France '
    + '(menu « Aller au-dessus d’une ville » de Paramètres). Ne fonctionne que pour les villes de la liste.', {
    // Paramètre ville : un texte parmi les villes proposées.
    ville: { type: 'string', enum: LIDAR_CITY_NAMES, description: 'Nom de la ville, tel qu’il figure dans la liste.' },
  // Fin de l'outil.
  }),
  // Outil « choisir_couleur_points_lidar » : choisit la couleur des points LiDAR 3D.
  tool('choisir_couleur_points_lidar', 'Choisit la couleur des points LiDAR 3D (boutons de Paramètres).', {
    // Paramètre couleur : un texte parmi les modes autorisés.
    couleur: { type: 'string', enum: [...LIDAR_COLORS], description: 'photo = couleurs de la photo aérienne ; types = couleur selon le type de point.' },
  // Fin de l'outil.
  }),
  // Outil « aller_a_un_lieu_de_la_terre » : survole un lieu nommé de la Terre.
  tool('aller_a_un_lieu_de_la_terre', 'Survole un lieu nommé de la Terre : une ville du monde, parmi celles que '
    + 'l’application connaît. Donne le nom de la ville, rien d’autre ; un nom qu’elle ne connaît pas est ignoré, '
    + 'alors ne l’invente pas et ne donne jamais de coordonnées.', {
    // Son paramètre lieu : le nom de la ville.
    lieu: { type: 'string', description: 'Nom de la ville, en français (Tokyo, Le Caire, São Paulo).' },
  // Fin de l'outil.
  }),
  // Outil « aller_a_un_lieu_de_la_lune » : survole un lieu nommé de la Lune.
  tool('aller_a_un_lieu_de_la_lune', 'Survole un lieu nommé de la Lune : un site d’alunissage, une mer, un cratère '
    + 'ou une région, parmi ceux que l’application connaît. Donne le nom du lieu, rien d’autre ; un nom qu’elle ne '
    + 'connaît pas est ignoré, alors ne l’invente pas et ne donne jamais de coordonnées.', {
    // Son paramètre lieu : le nom du lieu lunaire.
    lieu: { type: 'string', description: 'Nom du lieu, en français (Apollo 11, Mer de la Tranquillité, Copernic).' },
  // Fin de l'outil.
  }),
  // Outil « zoomer » : rapproche ou éloigne la caméra.
  tool('zoomer', 'Rapproche ou éloigne la caméra de l’astre ciblé (boutons de zoom).', {
    // Paramètre sens : « rapprocher » ou « eloigner ».
    sens: { type: 'string', enum: ['rapprocher', 'eloigner'] },
  // Fin de l'outil.
  }),
  // Outil « vue_globale » : revient à la vue d'ensemble ; aucun paramètre.
  tool('vue_globale', 'Revient à la vue d’ensemble du système solaire (bouton « Vue globale »).'),
  // Outil « agir_sur_un_element » : clique un élément de la page, désigné par son identifiant d'inventaire.
  tool('agir_sur_un_element', 'Agit directement sur un élément de la page : le navigateur le clique réellement. '
    + 'Donne l’identifiant d’un élément de l’inventaire reçu avec le message (e1, e2…), jamais un identifiant '
    + 'inventé ni un sélecteur CSS. Un élément absent de l’inventaire n’est pas à l’écran : ouvre d’abord la fenêtre '
    + 'qui le contient. Préfère une action nommée quand il en existe une pour ce que tu veux faire.', {
    // Son paramètre element : l'identifiant d'inventaire.
    element: { type: 'string', description: 'Identifiant de l’élément dans l’inventaire reçu (e1, e2…).' },
  // Fin de l'outil.
  }),
// Fin de la liste des outils.
];

// Ensemble des noms d'outils connus, pour vérifier vite qu'un nom renvoyé par le modèle existe.
const TOOL_NAMES = new Set(ASSISTANT_TOOLS.map((t) => t.name));

// Forme d'une action transmise au navigateur.
export interface AssistantAction {
  // name : le nom de l'outil.
  name: string;
  // input : ses paramètres, chacun un texte, un nombre ou un booléen.
  input: Record<string, string | number | boolean>;
// Fin de AssistantAction.
}

/**
 * Garde d'un appel d'outil renvoyé par le modèle : nom connu, et entrées réduites à des valeurs simples
 * (texte, nombre, booléen). Le navigateur revalide chaque valeur avant d'agir.
 */
// Fonction toAction : vérifie un appel d'outil renvoyé par le modèle ; reçoit un nom et des paramètres de type inconnu.
export function toAction(name: unknown, input: unknown): AssistantAction | null {
  // Nom qui n'est pas un texte, ou outil inconnu : null, l'appel est ignoré.
  if (typeof name !== 'string' || !TOOL_NAMES.has(name)) return null;
  // Paramètres nettoyés, vides au départ.
  const clean: AssistantAction['input'] = {};
  // Si les paramètres reçus sont bien un objet :
  if (input && typeof input === 'object') {
    // pour chacun de ses champs,
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      // un texte est gardé, coupé à 80 caractères ;
      if (typeof v === 'string') clean[k] = v.slice(0, 80);
      // un nombre fini est gardé ;
      else if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v;
      // un booléen est gardé ; tout le reste (objets, listes, null) est abandonné.
      else if (typeof v === 'boolean') clean[k] = v;
    // Fin de la boucle.
    }
  // Fin du cas « objet ».
  }
  // Renvoie l'action nettoyée.
  return { name, input: clean };
// Fin de toAction.
}
