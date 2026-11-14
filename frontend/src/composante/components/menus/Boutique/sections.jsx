/**
 * Mise en forme du catalogue de la boutique : regroupement des articles et exemples de code.
 *
 * Module pur, sans React ni réseau : il ne fait que ranger ce que le serveur renvoie et écrire les quelques
 * lignes de JavaScript qu'un acheteur colle chez lui. Testé tel quel (sections.test.jsx).
 */

/**
 * Ce que chaque réglage manquant empêche, et comment le poser.
 *
 * Le serveur renvoie les noms des variables d'environnement absentes (champ `missing` du catalogue) ; cette
 * table les traduit en une phrase utile. Sans elle, la boutique annonçait « paiement non configuré » sans dire
 * quoi faire.
 */
export const MISSING_SETTINGS = {
  // La clé Stripe : c'est elle qui crée les pages de paiement.
  STRIPE_SECRET_KEY: 'La clé secrète Stripe, qui crée les pages de paiement. À poser dans le tableau de bord '
    + 'Render : sk_test_… pour essayer sans prélever, sk_live_… pour de vrais paiements.',
  // Le secret de signature : sans lui, un paiement abouti ne donnerait aucune clé.
  SESSION_SECRET: 'Le secret qui signe les clés d’API. Sans lui, un paiement abouti ne pourrait délivrer '
    + 'aucune clé. Render le tire au hasard tout seul au prochain déploiement du blueprint.',
// Fin de la table.
};

/** La phrase qui explique un réglage manquant, ou son nom brut s'il n'est pas connu. */
export const missingLabel = (key) => MISSING_SETTINGS[key] || `Réglage « ${key} » absent du serveur.`;

/** Identifiant de l'astre d'un article : « body-mars » → « mars », « orbit-soleil » → « soleil ». */
export function bodyOfProduct(id) {
  // Rien à lire.
  if (typeof id !== 'string') return null;
  // Un article d'astre ou un article d'orbite.
  const match = /^(?:body|orbit)-(.+)$/.exec(id);
  // La clé de l'astre, ou rien.
  return match ? match[1] : null;
// Fin de bodyOfProduct.
}

/** Les quatre rayons de la boutique, dans l'ordre d'affichage. */
export const SECTION_ORDER = ['astres', 'cartes', 'orbites', 'tout'];

/** Titre et sous-titre de chaque rayon. */
export const SECTION_LABELS = {
  astres: {
    title: 'Astres : modèle 3D et fond de carte',
    blurb: 'Un article par astre. Il donne les deux : le modèle 3D complet au format GLB, aux dimensions '
      + 'réelles en kilomètres, et le fond de carte de l’astre assemblé en une seule image. Le jeton vaut un an.',
  },
  cartes: {
    title: 'Fonds de carte de tous les astres',
    blurb: 'Les fonds de carte assemblés de tous les astres tuilés, sans les modèles 3D.',
  },
  orbites: {
    title: 'Orbites et position du Soleil',
    blurb: 'Le calcul, loué à l’heure et pour un astre à la fois : le jeton expire au bout des heures achetées. '
      + 'Pour le Soleil, qui est au centre du repère et n’a donc pas d’orbite, c’est sa position vue de la Terre.',
  },
  tout: {
    title: 'Tout le catalogue',
    blurb: 'Les modèles 3D et les fonds de carte de tous les astres d’un seul coup. Les locations à l’heure '
      + 'restent à part.',
  },
};

/** Rayon d'un article, d'après son identifiant. */
export function sectionOfProduct(id) {
  // Les orbites et la position du Soleil.
  if (typeof id === 'string' && id.startsWith('orbit-')) return 'orbites';
  // Les astres.
  if (typeof id === 'string' && id.startsWith('body-')) return 'astres';
  // Les fonds de carte de tous les astres.
  if (id === 'tiles') return 'cartes';
  // Tout le catalogue.
  if (id === 'all') return 'tout';
  // Un article inattendu rejoint les astres, pour rester visible plutôt que disparaître.
  return 'astres';
// Fin de sectionOfProduct.
}

/**
 * Le catalogue rangé en rayons, chacun enrichi de ce que l'astre a réellement à vendre.
 * `bodies` vient de `GET /export/bodies` : il dit pour chaque astre s'il a un fond de carte et une orbite.
 */
export function sectionsOf(products = [], bodies = []) {
  // Les astres, rangés par clé.
  const byKey = new Map(bodies.map((b) => [b.key, b]));
  // Chaque article, enrichi de son astre.
  const enriched = products.map((p) => {
    // La clé de son astre, s'il en a une.
    const key = bodyOfProduct(p.id);
    // L'astre correspondant.
    const body = key ? byKey.get(key) ?? null : null;
    // L'article, son astre et son rayon.
    return { ...p, body, section: sectionOfProduct(p.id) };
  // Fin de l'enrichissement.
  });
  // Un rayon par identifiant, les rayons vides retirés.
  return SECTION_ORDER
    .map((id) => ({ id, ...SECTION_LABELS[id], products: enriched.filter((p) => p.section === id) }))
    .filter((s) => s.products.length > 0);
// Fin de sectionsOf.
}

/** Ce que l'article d'un astre contient réellement, en une ligne de badges. */
export function badgesOf(product) {
  // Les badges.
  const badges = [];
  // Un article d'orbite : la location.
  if (product.hourly) badges.push('loué à l’heure');
  // Un article d'astre ou l'ensemble : le modèle 3D.
  if (product.section === 'astres' || product.id === 'all') badges.push('modèle 3D (GLB)');
  // Le fond de carte, présent ou non : le serveur le dit, article par article.
  if (product.section === 'astres') badges.push(product.tiled ? 'fond de carte' : 'sans fond de carte');
  // Les fonds de carte de tous les astres.
  if (product.id === 'tiles' || product.id === 'all') badges.push('fonds de carte');
  // Les badges.
  return badges;
// Fin de badgesOf.
}

/** Chemin de l'API qu'un droit ouvre, ou null si le droit n'ouvre rien de téléchargeable. */
export function pathOfScope(scope) {
  // Rien à lire.
  if (typeof scope !== 'string') return null;
  // Le modèle 3D d'un astre.
  if (scope.startsWith('body:')) return `/export/bodies/${scope.slice(5)}/model.glb`;
  // Le fond de carte d'un astre.
  if (scope.startsWith('tiles:')) return `/export/bodies/${scope.slice(6)}/tiles.jpg`;
  // Le calcul d'orbite ou la position du Soleil.
  if (scope.startsWith('orbit:')) return `/export/orbits?body=${scope.slice(6)}&steps=365`;
  // Les fonds de carte de tous les astres : un exemple avec la Terre.
  if (scope === 'tiles') return '/export/bodies/terre/tiles.jpg';
  // Tout le catalogue : un exemple avec Mars.
  if (scope === 'all') return '/export/bodies/mars/model.glb';
  // Un droit sans route.
  return null;
// Fin de pathOfScope.
}

/**
 * Quelques lignes de JavaScript qui téléchargent ce qu'un achat ouvre, à coller dans un projet.
 * `base` est l'adresse de l'API, `scopes` les droits du jeton.
 */
export function jsSnippet(base, scopes = []) {
  // Le premier droit qui ouvre une route.
  const scope = scopes.find((s) => pathOfScope(s));
  // Aucun : rien à montrer.
  if (!scope) return '';
  // Le chemin.
  const path = pathOfScope(scope);
  // Un calcul d'orbite rend du JSON ; un modèle et un fond de carte rendent un fichier.
  const json = path.startsWith('/export/orbits');
  // Le code.
  return [
    "const jeton = '…'; // votre jeton JWT",
    `const reponse = await fetch('${base}${path}', {`,
    '  headers: { Authorization: `Bearer ${jeton}` },',
    '});',
    'if (!reponse.ok) throw new Error(await reponse.text());',
    ...(json
      // Le calcul d'orbite : du JSON, directement exploitable.
      ? ['const orbite = await reponse.json();', 'console.log(orbite.points.length, orbite.points[0]);']
      // Le modèle ou le fond de carte : un fichier, chargé dans three.js ou enregistré.
      : [
        'const fichier = await reponse.blob();',
        'const url = URL.createObjectURL(fichier);',
        '// three.js : new GLTFLoader().load(url, (gltf) => scene.add(gltf.scene));',
      ]),
  ].join('\n');
// Fin de jsSnippet.
}
