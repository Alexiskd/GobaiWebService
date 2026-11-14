// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la fonction testée, renommée r.
import { resolveAssistantAction as r } from './assistantActions';

// Liste d'astres d'essai : Soleil, Vénus et Titan, avec leurs indices.
const BODIES = [{ index: 0, name: 'Soleil' }, { index: 2, name: 'Vénus' }, { index: 16, name: 'Titan' }];
// Villes d'essai du LiDAR HD : une de métropole et une d'outre-mer.
const CITIES = [{ name: 'Toulouse', region: 'Occitanie', lon: 1.448, lat: 43.622 }, { name: 'Cayenne', region: 'Guyane', lon: -52.33, lat: 4.933 }];
// Lieux d'essai de la Terre : deux villes du monde.
const EARTH = [{ name: 'Tokyo', lon: 139.7, lat: 35.7 }, { name: 'Le Caire', lon: 31.2, lat: 30 }];
// Lieux d'essai de la Lune : un site d'alunissage et un cratère.
const MOON = [{ name: 'Apollo 11', type: 'landing', lon: 23.473, lat: 0.674 }, { name: 'Copernic', type: 'crater', lon: -20.1, lat: 9.6 }];
// Les trois listes réunies, comme la composante les passe.
const LISTS = { lidarCities: CITIES, earthPlaces: EARTH, moonPlaces: MOON };

// Test : les actions valides deviennent des commandes de l'interface.
test('assistant : actions valides traduites en commandes de l’interface', () => {
  // Aller à un astre, nom en minuscules : commande focus avec l'indice et le libellé.
  assert.deepEqual(r({ name: 'aller_a_un_astre', input: { astre: 'titan' } }, BODIES), { type: 'focus', index: 16, label: 'Aller à Titan' });
  // Nom sans accent : l'astre est quand même trouvé.
  assert.equal(r({ name: 'aller_a_un_astre', input: { astre: 'Venus' } }, BODIES).index, 2);
  // Ouvrir une fenêtre : la galerie.
  assert.equal(r({ name: 'ouvrir_fenetre', input: { fenetre: 'galerie' } }, BODIES).window, 'galerie');
  // Régler l'affichage : commande setting avec le réglage, l'état et le libellé.
  assert.deepEqual(r({ name: 'regler_affichage', input: { reglage: 'orbites', actif: false } }, BODIES), { type: 'setting', setting: 'orbites', on: false, label: 'Lignes d’orbite : désactivé' });
  // Afficher une famille : les planètes naines donnent le type « dwarf ».
  assert.equal(r({ name: 'afficher_famille', input: { famille: 'planetes_naines', affiche: true } }, BODIES).kind, 'dwarf');
  // Masquer un astre : état faux.
  assert.equal(r({ name: 'afficher_astre', input: { astre: 'Titan', affiche: false } }, BODIES).on, false);
  // Régler la vitesse de rotation : 2.
  assert.equal(r({ name: 'regler_vitesse_rotation', input: { vitesse: 2 } }, BODIES).speed, 2);
  // Zoomer en se rapprochant : facteur 0,5.
  assert.equal(r({ name: 'zoomer', input: { sens: 'rapprocher' } }, BODIES).factor, 0.5);
  // Vue globale : commande reset.
  assert.equal(r({ name: 'vue_globale', input: {} }, BODIES).type, 'reset');
// Fin du test.
});

// Test : les réglages de la fenêtre Paramètres, au-delà des six premiers.
test('assistant : tous les interrupteurs de Paramètres sont pilotables', () => {
  // Le relief 3D.
  assert.deepEqual(r({ name: 'regler_affichage', input: { reglage: 'relief_3d', actif: true } }, BODIES), { type: 'setting', setting: 'relief_3d', on: true, label: 'Relief 3D : activé' });
  // Le calque LiDAR HD.
  assert.equal(r({ name: 'regler_affichage', input: { reglage: 'lidar_hd', actif: true } }, BODIES).setting, 'lidar_hd');
  // Les volcans en éruption.
  assert.equal(r({ name: 'regler_affichage', input: { reglage: 'volcans', actif: false } }, BODIES).on, false);
  // Les rues et routes.
  assert.equal(r({ name: 'regler_affichage', input: { reglage: 'rues', actif: true } }, BODIES).label, 'Rues et routes : activé');
  // Les contours, frontières et littoraux ensemble.
  assert.equal(r({ name: 'regler_affichage', input: { reglage: 'frontieres_et_littoraux', actif: true } }, BODIES).setting, 'frontieres_et_littoraux');
  // L'atmosphère des planètes solides.
  assert.equal(r({ name: 'regler_affichage', input: { reglage: 'atmospheres', actif: false } }, BODIES).setting, 'atmospheres');
  // L'économie d'énergie.
  assert.equal(r({ name: 'regler_affichage', input: { reglage: 'economie_energie', actif: true } }, BODIES).setting, 'economie_energie');
  // Le noir pur.
  assert.equal(r({ name: 'regler_affichage', input: { reglage: 'noir_pur', actif: true } }, BODIES).setting, 'noir_pur');
  // Un réglage inventé reste refusé.
  assert.equal(r({ name: 'regler_affichage', input: { reglage: 'tout_casser', actif: true } }, BODIES), null);
// Fin du test.
});

// Test : les commandes du LiDAR HD.
test('assistant : modèle, ville et couleur du LiDAR HD', () => {
  // Choisir le modèle de surface : commande lidar avec l'identifiant du calque.
  assert.deepEqual(r({ name: 'choisir_modele_lidar', input: { modele: 'surface' } }, BODIES, LISTS), { type: 'lidar', layerId: 'lidar-hd-mns', label: 'LiDAR HD : Surface' });
  // Le sol nu donne le calque du modèle de terrain.
  assert.equal(r({ name: 'choisir_modele_lidar', input: { modele: 'sol_nu' } }, BODIES, LISTS).layerId, 'lidar-hd-mnt');
  // Les hauteurs donnent le calque du modèle de hauteur.
  assert.equal(r({ name: 'choisir_modele_lidar', input: { modele: 'hauteurs' } }, BODIES, LISTS).layerId, 'lidar-hd-mnh');
  // Un modèle inventé est refusé.
  assert.equal(r({ name: 'choisir_modele_lidar', input: { modele: 'laser' } }, BODIES, LISTS), null);
  // Aller au-dessus d'une ville : la ville est retrouvée sans tenir compte de la casse.
  assert.equal(r({ name: 'aller_au_dessus_d_une_ville', input: { ville: 'toulouse' } }, BODIES, LISTS).city.lat, 43.622);
  // Une ville d'outre-mer passe aussi.
  assert.equal(r({ name: 'aller_au_dessus_d_une_ville', input: { ville: 'Cayenne' } }, BODIES, LISTS).label, 'LiDAR HD au-dessus de Cayenne');
  // Une ville absente de la liste est refusée.
  assert.equal(r({ name: 'aller_au_dessus_d_une_ville', input: { ville: 'Berlin' } }, BODIES, LISTS), null);
  // Sans liste de villes, rien ne passe.
  assert.equal(r({ name: 'aller_au_dessus_d_une_ville', input: { ville: 'Toulouse' } }, BODIES), null);
  // Couleur des points : celles de la photo.
  assert.equal(r({ name: 'choisir_couleur_points_lidar', input: { couleur: 'photo' } }, BODIES, LISTS).mode, 'photo');
  // Couleur des points : le type de chaque point, qui vaut « classes » dans le réglage.
  assert.equal(r({ name: 'choisir_couleur_points_lidar', input: { couleur: 'types' } }, BODIES, LISTS).mode, 'classes');
  // Une couleur inventée est refusée.
  assert.equal(r({ name: 'choisir_couleur_points_lidar', input: { couleur: 'arc_en_ciel' } }, BODIES, LISTS), null);
  // Protection du prototype, comme pour les fenêtres.
  assert.equal(r({ name: 'choisir_modele_lidar', input: { modele: '__proto__' } }, BODIES, LISTS), null);
// Fin du test.
});

// Test : les déplacements vers un lieu de la Terre et de la Lune.
test('assistant : survol d’un lieu nommé de la Terre et de la Lune', () => {
  // Un lieu de la Terre : commande earthPlace avec le lieu et son libellé.
  assert.deepEqual(r({ name: 'aller_a_un_lieu_de_la_terre', input: { lieu: 'Tokyo' } }, BODIES, LISTS),
    { type: 'earthPlace', place: EARTH[0], label: 'Survol de Tokyo' });
  // Le nom est retrouvé sans accents ni majuscules.
  assert.equal(r({ name: 'aller_a_un_lieu_de_la_terre', input: { lieu: 'le caire' } }, BODIES, LISTS).place.lat, 30);
  // Un lieu de la Lune : commande moonPlace, avec le lieu complet pour que le moteur le cible.
  assert.deepEqual(r({ name: 'aller_a_un_lieu_de_la_lune', input: { lieu: 'Apollo 11' } }, BODIES, LISTS),
    { type: 'moonPlace', place: MOON[0], label: 'Survol de Apollo 11 (Lune)' });
  // Un cratère passe aussi.
  assert.equal(r({ name: 'aller_a_un_lieu_de_la_lune', input: { lieu: 'copernic' } }, BODIES, LISTS).place.type, 'crater');
  // Un lieu que l'app ne connaît pas est refusé : rien n'est inventé.
  assert.equal(r({ name: 'aller_a_un_lieu_de_la_terre', input: { lieu: 'Atlantide' } }, BODIES, LISTS), null);
  // Un lieu lunaire inventé est refusé aussi.
  assert.equal(r({ name: 'aller_a_un_lieu_de_la_lune', input: { lieu: 'Base Alpha' } }, BODIES, LISTS), null);
  // Un lieu de la Lune demandé comme lieu de la Terre est refusé : les listes ne se mélangent pas.
  assert.equal(r({ name: 'aller_a_un_lieu_de_la_terre', input: { lieu: 'Copernic' } }, BODIES, LISTS), null);
  // Sans liste de lieux, rien ne passe.
  assert.equal(r({ name: 'aller_a_un_lieu_de_la_terre', input: { lieu: 'Tokyo' } }, BODIES), null);
// Fin du test.
});

// Test : tout le reste est refusé (null).
test('assistant : tout ce qui sort de la liste autorisée est ignoré', () => {
  // Action inconnue.
  assert.equal(r({ name: 'supprimer_le_site', input: {} }, BODIES), null);
  // Astre inconnu.
  assert.equal(r({ name: 'aller_a_un_astre', input: { astre: 'Tatooine' } }, BODIES), null);
  // Fenêtre « __proto__ » : pas de fuite par le prototype.
  assert.equal(r({ name: 'ouvrir_fenetre', input: { fenetre: '__proto__' } }, BODIES), null);
  // Fenêtre « constructor » : même protection.
  assert.equal(r({ name: 'ouvrir_fenetre', input: { fenetre: 'constructor' } }, BODIES), null);
  // État qui n'est pas un booléen.
  assert.equal(r({ name: 'regler_affichage', input: { reglage: 'orbites', actif: 'oui' } }, BODIES), null);
  // Masquer le Soleil.
  assert.equal(r({ name: 'afficher_astre', input: { astre: 'Soleil', affiche: false } }, BODIES), null);
  // Vitesse hors limites.
  assert.equal(r({ name: 'regler_vitesse_rotation', input: { vitesse: 1000 } }, BODIES), null);
  // Sens de zoom inconnu.
  assert.equal(r({ name: 'zoomer', input: { sens: 'x' } }, BODIES), null);
  // Action nulle.
  assert.equal(r(null, BODIES), null);
// Fin du test.
});
