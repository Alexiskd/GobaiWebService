// Galerie (données) : missions, satellites et filtre des photos NASA. Voir GalerieApp.jsx.
// Planètes et missions ayant produit des images exploitables.
// `q` = mots-clés envoyés à images-api.nasa.gov (en anglais).

// Catégories de la galerie : chaque astre de PLANETS appartient à l'une des trois premières ;
// « satellites » regroupe les lunes de tous les astres qui en ont.
// Déclare et exporte les quatre catégories de la galerie (début du tableau).
export const CATEGORIES = [
  // Les planètes telluriques : identifiant, nom, titre, sous-titre et couleur.
  { id: 'planetes', name: 'Planètes', title: 'Les planètes telluriques', sub: 'Mercure · Vénus · Terre · Mars', color: '#d98a5f' },
  // Les planètes géantes.
  { id: 'geantes', name: 'Planètes géantes', title: 'Les géantes, vues de près', sub: 'Jupiter · Saturne · Uranus · Neptune', color: '#e4b876' },
  // Les planètes naines.
  { id: 'naines', name: 'Planètes naines', title: 'Les planètes naines', sub: 'Cérès · Pluton · Hauméa · Makémaké · Éris', color: '#b9a6e0' },
  // Les satellites naturels.
  { id: 'satellites', name: 'Satellites', title: 'Les satellites naturels', sub: 'Lune · lunes de Mars, des géantes et de Pluton', color: '#c9d6ea' },
// Fin du tableau.
];

// Déclare et exporte la liste des astres et de leurs missions (début du tableau).
export const PLANETS = [
  // Début d'un astre.
  {
    // Mercure : catégorie des planètes, recherche « mercury », couleur #a9a39b, à 0,39 UA du Soleil.
    id: 'mercury', category: 'planetes', name: 'Mercure', q: 'mercury', color: '#a9a39b', distance: '0,39 UA',
    // Ses missions (début de la liste).
    missions: [
      // Mission « Mariner 10 » (1974–75), recherchée avec « mariner 10 ».
      { id: 'mariner10', name: 'Mariner 10', q: 'mariner 10', year: '1974–75' },
      // Mission « MESSENGER » (2008–2015), recherchée avec « messenger ».
      { id: 'messenger', name: 'MESSENGER', q: 'messenger', year: '2008–2015' },
      // Mission « BepiColombo » (2021–), recherchée avec « bepicolombo ».
      { id: 'bepicolombo', name: 'BepiColombo', q: 'bepicolombo', year: '2021–' },
    // Fin de la liste des missions.
    ],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Vénus : catégorie des planètes, recherche « venus », couleur #e3c27a, à 0,72 UA du Soleil.
    id: 'venus', category: 'planetes', name: 'Vénus', q: 'venus', color: '#e3c27a', distance: '0,72 UA',
    // Ses missions (début de la liste).
    missions: [
      // Mission « Mariner 10 » (1974), recherchée avec « mariner 10 ».
      { id: 'mariner10', name: 'Mariner 10', q: 'mariner 10', year: '1974' },
      // Mission « Pioneer Venus » (1978–1992), recherchée avec « pioneer venus ».
      { id: 'pioneervenus', name: 'Pioneer Venus', q: 'pioneer venus', year: '1978–1992' },
      // Mission « Magellan » (1990–1994), recherchée avec « magellan ».
      { id: 'magellan', name: 'Magellan', q: 'magellan', year: '1990–1994' },
      // Mission « Galileo » (1990), recherchée avec « galileo ».
      { id: 'galileo', name: 'Galileo', q: 'galileo', year: '1990' },
      // Mission « Parker Solar Probe » (2020–), recherchée avec « parker solar probe ».
      { id: 'parker', name: 'Parker Solar Probe', q: 'parker solar probe', year: '2020–' },
    // Fin de la liste des missions.
    ],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Terre : catégorie des planètes, recherche « earth », couleur #5d9be0, à 1,00 UA du Soleil.
    id: 'earth', category: 'planetes', name: 'Terre', q: 'earth', color: '#5d9be0', distance: '1,00 UA',
    // Ses missions (début de la liste).
    missions: [
      // Mission « Apollo » (1968–1972), recherchée avec « apollo ».
      { id: 'apollo', name: 'Apollo', q: 'apollo', year: '1968–1972' },
      // Mission « Galileo » (1990–92), recherchée avec « galileo ».
      { id: 'galileo', name: 'Galileo', q: 'galileo', year: '1990–92' },
      // Mission « DSCOVR · EPIC » (2015–), recherchée avec « dscovr epic ».
      { id: 'dscovr', name: 'DSCOVR · EPIC', q: 'dscovr epic', year: '2015–' },
      // Mission « Artemis » (2022–), recherchée avec « artemis orion ».
      { id: 'artemis', name: 'Artemis', q: 'artemis orion', year: '2022–' },
    // Fin de la liste des missions.
    ],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Mars : catégorie des planètes, recherche « mars », couleur #d2674a, à 1,52 UA du Soleil.
    id: 'mars', category: 'planetes', name: 'Mars', q: 'mars', color: '#d2674a', distance: '1,52 UA',
    // Ses missions (début de la liste).
    missions: [
      // Mission « Mariner 9 » (1971), recherchée avec « mariner 9 ».
      { id: 'mariner9', name: 'Mariner 9', q: 'mariner 9', year: '1971' },
      // Mission « Viking 1 & 2 » (1976), recherchée avec « viking ».
      { id: 'viking', name: 'Viking 1 & 2', q: 'viking', year: '1976' },
      // Mission « Mars Global Surveyor » (1997–2006), recherchée avec « global surveyor ».
      { id: 'mgs', name: 'Mars Global Surveyor', q: 'global surveyor', year: '1997–2006' },
      // Mission « MRO » (2006–), recherchée avec « reconnaissance orbiter ».
      { id: 'mro', name: 'MRO', q: 'reconnaissance orbiter', year: '2006–' },
      // Mission « Hubble » (1990–), recherchée avec « hubble ».
      { id: 'hubble', name: 'Hubble', q: 'hubble', year: '1990–' },
    // Fin de la liste des missions.
    ],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Son identifiant.
    id: 'jupiter',
    // Sa catégorie : les géantes.
    category: 'geantes',
    // Son nom affiché.
    name: 'Jupiter',
    // Ses mots-clés de recherche.
    q: 'jupiter',
    // Sa couleur.
    color: '#d9a066',
    // Sa distance au Soleil, en unités astronomiques.
    distance: '5,20 UA',
    // Ses missions (début de la liste).
    missions: [
      // Mission « Pioneer 10 » (1973), recherchée avec « pioneer 10 ».
      { id: 'pioneer10', name: 'Pioneer 10', q: 'pioneer 10', year: '1973' },
      // Mission « Pioneer 11 » (1974), recherchée avec « pioneer 11 ».
      { id: 'pioneer11', name: 'Pioneer 11', q: 'pioneer 11', year: '1974' },
      // Mission « Voyager 1 & 2 » (1979), recherchée avec « voyager ».
      { id: 'voyager', name: 'Voyager 1 & 2', q: 'voyager', year: '1979' },
      // Mission « Galileo » (1995–2003), recherchée avec « galileo ».
      { id: 'galileo', name: 'Galileo', q: 'galileo', year: '1995–2003' },
      // Mission « Cassini » (2000), recherchée avec « cassini ».
      { id: 'cassini', name: 'Cassini', q: 'cassini', year: '2000' },
      // Mission « New Horizons » (2007), recherchée avec « new horizons ».
      { id: 'newhorizons', name: 'New Horizons', q: 'new horizons', year: '2007' },
      // Mission « Juno » (2016–), recherchée avec « juno junocam ».
      { id: 'juno', name: 'Juno', q: 'juno junocam', year: '2016–' },
      // Mission « Hubble » (1990–), recherchée avec « hubble ».
      { id: 'hubble', name: 'Hubble', q: 'hubble', year: '1990–' },
      // Mission « James Webb » (2022–), recherchée avec « webb ».
      { id: 'webb', name: 'James Webb', q: 'webb', year: '2022–' },
    // Fin de la liste des missions.
    ],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Son identifiant.
    id: 'saturn',
    // Sa catégorie : les géantes.
    category: 'geantes',
    // Son nom affiché.
    name: 'Saturne',
    // Ses mots-clés de recherche.
    q: 'saturn',
    // Sa couleur.
    color: '#e4cf8f',
    // Sa distance au Soleil, en unités astronomiques.
    distance: '9,58 UA',
    // Ses missions (début de la liste).
    missions: [
      // Mission « Pioneer 11 » (1979), recherchée avec « pioneer 11 ».
      { id: 'pioneer11', name: 'Pioneer 11', q: 'pioneer 11', year: '1979' },
      // Mission « Voyager 1 & 2 » (1980–81), recherchée avec « voyager ».
      { id: 'voyager', name: 'Voyager 1 & 2', q: 'voyager', year: '1980–81' },
      // Mission « Cassini » (2004–2017), recherchée avec « cassini ».
      { id: 'cassini', name: 'Cassini', q: 'cassini', year: '2004–2017' },
      // Mission « Hubble » (1990–), recherchée avec « hubble ».
      { id: 'hubble', name: 'Hubble', q: 'hubble', year: '1990–' },
      // Mission « James Webb » (2023–), recherchée avec « webb ».
      { id: 'webb', name: 'James Webb', q: 'webb', year: '2023–' },
    // Fin de la liste des missions.
    ],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Son identifiant.
    id: 'uranus',
    // Sa catégorie : les géantes.
    category: 'geantes',
    // Son nom affiché.
    name: 'Uranus',
    // Ses mots-clés de recherche.
    q: 'uranus',
    // Sa couleur.
    color: '#9fd8dc',
    // Sa distance au Soleil, en unités astronomiques.
    distance: '19,2 UA',
    // Ses missions (début de la liste).
    missions: [
      // Mission « Voyager 2 » (1986), recherchée avec « voyager ».
      { id: 'voyager', name: 'Voyager 2', q: 'voyager', year: '1986' },
      // Mission « Hubble » (1990–), recherchée avec « hubble ».
      { id: 'hubble', name: 'Hubble', q: 'hubble', year: '1990–' },
      // Mission « James Webb » (2023–), recherchée avec « webb ».
      { id: 'webb', name: 'James Webb', q: 'webb', year: '2023–' },
    // Fin de la liste des missions.
    ],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Son identifiant.
    id: 'neptune',
    // Sa catégorie : les géantes.
    category: 'geantes',
    // Son nom affiché.
    name: 'Neptune',
    // Ses mots-clés de recherche.
    q: 'neptune',
    // Sa couleur.
    color: '#5b7fe0',
    // Sa distance au Soleil, en unités astronomiques.
    distance: '30,1 UA',
    // Ses missions (début de la liste).
    missions: [
      // Mission « Voyager 2 » (1989), recherchée avec « voyager ».
      { id: 'voyager', name: 'Voyager 2', q: 'voyager', year: '1989' },
      // Mission « Hubble » (1990–), recherchée avec « hubble ».
      { id: 'hubble', name: 'Hubble', q: 'hubble', year: '1990–' },
      // Mission « James Webb » (2022–), recherchée avec « webb ».
      { id: 'webb', name: 'James Webb', q: 'webb', year: '2022–' },
    // Fin de la liste des missions.
    ],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Cérès : catégorie des planètes naines, recherche « ceres », couleur #9c9a94, à 2,77 UA du Soleil.
    id: 'ceres', category: 'naines', name: 'Cérès', q: 'ceres', color: '#9c9a94', distance: '2,77 UA',
    // Ses missions (début de la liste).
    missions: [
      // Mission « Dawn » (2015–2018), recherchée avec « dawn ».
      { id: 'dawn', name: 'Dawn', q: 'dawn', year: '2015–2018' },
      // Mission « Hubble » (1990–), recherchée avec « hubble ».
      { id: 'hubble', name: 'Hubble', q: 'hubble', year: '1990–' },
    // Fin de la liste des missions.
    ],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Pluton : catégorie des planètes naines, recherche « pluto », couleur #d8b99a, à 39,5 UA du Soleil.
    id: 'pluto', category: 'naines', name: 'Pluton', q: 'pluto', color: '#d8b99a', distance: '39,5 UA',
    // Ses missions (début de la liste).
    missions: [
      // Mission « New Horizons » (2015), recherchée avec « new horizons ».
      { id: 'newhorizons', name: 'New Horizons', q: 'new horizons', year: '2015' },
      // Mission « Hubble » (1990–), recherchée avec « hubble ».
      { id: 'hubble', name: 'Hubble', q: 'hubble', year: '1990–' },
      // Mission « James Webb » (2022–), recherchée avec « webb ».
      { id: 'webb', name: 'James Webb', q: 'webb', year: '2022–' },
    // Fin de la liste des missions.
    ],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Hauméa : catégorie des planètes naines, recherche « haumea », couleur #cfd3da, à 43,1 UA du Soleil.
    id: 'haumea', category: 'naines', name: 'Hauméa', q: 'haumea', color: '#cfd3da', distance: '43,1 UA',
    // Sa seule mission : « Hubble » (1990–), recherchée avec « hubble ».
    missions: [{ id: 'hubble', name: 'Hubble', q: 'hubble', year: '1990–' }],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Makémaké : catégorie des planètes naines, recherche « makemake », couleur #c99a7c, à 45,5 UA du Soleil.
    id: 'makemake', category: 'naines', name: 'Makémaké', q: 'makemake', color: '#c99a7c', distance: '45,5 UA',
    // Sa seule mission : « Hubble » (1990–), recherchée avec « hubble ».
    missions: [{ id: 'hubble', name: 'Hubble', q: 'hubble', year: '1990–' }],
  // Fin de l'astre.
  },
  // Début d'un astre.
  {
    // Éris : catégorie des planètes naines, recherche « eris », couleur #e2e2e6, à 67,9 UA du Soleil.
    id: 'eris', category: 'naines', name: 'Éris', q: 'eris', color: '#e2e2e6', distance: '67,9 UA',
    // Sa seule mission : « Hubble » (1990–), recherchée avec « hubble ».
    missions: [{ id: 'hubble', name: 'Hubble', q: 'hubble', year: '1990–' }],
  // Fin de l'astre.
  },
// Fin de la liste des astres.
];

// --- Filtrage : ne garder que les vraies photos de la planète ---

// Mots qui signalent un lancement, du matériel, des gens, des illustrations ou des graphiques.
// Mots qui écartent une image (début du tableau).
const EXCLUDE = [
  // Les lancements et les fusées.
  'launch', 'liftoff', 'lift-off', 'rocket', 'atlas', 'titan iii', 'titan iv', 'centaur', 'delta ii', 'falcon', 'ariane',
  // Les sites de lancement.
  'launch pad', 'pad 39', 'kennedy space center', 'cape canaveral', 'vandenberg', 'countdown',
  // Les salles blanches, l'assemblage et les essais.
  'clean room', 'cleanroom', 'assembly', 'integration', 'technician', 'engineer', 'workers', 'testing', 'test chamber',
  // Le transport et les maquettes.
  'fairing', 'payload', 'shipping', 'transport', 'mockup', 'model of', 'scale model', 'replica',
  // Les vues d'artiste, les animations et les simulations.
  'artist', "artist's", 'illustration', 'concept', 'rendering', 'animation', 'simulated', 'simulation',
  // Les logos, les écussons et les affiches.
  'logo', 'patch', 'emblem', 'insignia', 'poster', 'infographic',
  // Les conférences de presse et les équipes.
  'press conference', 'news conference', 'briefing', 'scientists', 'team', 'administrator', 'mission control',
  // Les salles de contrôle, les portraits, les expositions et les cérémonies.
  'control room', 'portrait of', 'visitors', 'exhibit', 'museum', 'award', 'ceremony',
  // Les graphiques, les schémas, les trajectoires et les spectres.
  'chart', 'graph', 'diagram', 'plot', 'trajectory', 'orbit diagram', 'timeline', 'spectrum', 'spectra',
  // Le disque d'or des sondes Voyager et les miroirs de télescope.
  'golden record', 'telescope mirror', 'mirror segment',
// Fin du tableau.
];

// Satellites naturels affichés, par planète. `q` = nom anglais utilisé par la NASA.
// Déclare et exporte les lunes affichées, par astre (début de l'objet).
export const MOONS = {
  // Aucune lune affichée pour Mercure.
  mercury: [],
  // Aucune lune affichée pour Vénus.
  venus: [],
  // Pour la Terre : Lune (recherche « moon »).
  earth: [{ id: 'moon', name: 'Lune', q: 'moon' }],
  // Les lunes de Mars (début de la liste).
  mars: [
    // Phobos (recherche « phobos »).
    { id: 'phobos', name: 'Phobos', q: 'phobos' },
    // Déimos (recherche « deimos »).
    { id: 'deimos', name: 'Déimos', q: 'deimos' },
  // Fin de la liste.
  ],
  // Aucune lune affichée pour Cérès.
  ceres: [],
  // Pour Pluton : Charon (recherche « charon »).
  pluto: [{ id: 'charon', name: 'Charon', q: 'charon' }],
  // Aucune lune affichée pour Hauméa.
  haumea: [],
  // Aucune lune affichée pour Makémaké.
  makemake: [],
  // Aucune lune affichée pour Éris.
  eris: [],
  // Les lunes de Jupiter (début de la liste).
  jupiter: [
    // Io (recherche « io »).
    { id: 'io', name: 'Io', q: 'io' },
    // Europe (recherche « europa »).
    { id: 'europa', name: 'Europe', q: 'europa' },
    // Ganymède (recherche « ganymede »).
    { id: 'ganymede', name: 'Ganymède', q: 'ganymede' },
    // Callisto (recherche « callisto »).
    { id: 'callisto', name: 'Callisto', q: 'callisto' },
  // Fin de la liste.
  ],
  // Les lunes de Saturne (début de la liste).
  saturn: [
    // Titan (recherche « titan »).
    { id: 'titan', name: 'Titan', q: 'titan' },
    // Encelade (recherche « enceladus »).
    { id: 'enceladus', name: 'Encelade', q: 'enceladus' },
    // Mimas (recherche « mimas »).
    { id: 'mimas', name: 'Mimas', q: 'mimas' },
    // Téthys (recherche « tethys »).
    { id: 'tethys', name: 'Téthys', q: 'tethys' },
    // Dioné (recherche « dione »).
    { id: 'dione', name: 'Dioné', q: 'dione' },
    // Rhéa (recherche « rhea »).
    { id: 'rhea', name: 'Rhéa', q: 'rhea' },
    // Japet (recherche « iapetus »).
    { id: 'iapetus', name: 'Japet', q: 'iapetus' },
  // Fin de la liste.
  ],
  // Les lunes de Uranus (début de la liste).
  uranus: [
    // Miranda (recherche « miranda »).
    { id: 'miranda', name: 'Miranda', q: 'miranda' },
    // Ariel (recherche « ariel »).
    { id: 'ariel', name: 'Ariel', q: 'ariel' },
    // Umbriel (recherche « umbriel »).
    { id: 'umbriel', name: 'Umbriel', q: 'umbriel' },
    // Titania (recherche « titania »).
    { id: 'titania', name: 'Titania', q: 'titania' },
    // Obéron (recherche « oberon »).
    { id: 'oberon', name: 'Obéron', q: 'oberon' },
  // Fin de la liste.
  ],
  // Les lunes de Neptune (début de la liste).
  neptune: [
    // Triton (recherche « triton »).
    { id: 'triton', name: 'Triton', q: 'triton' },
    // Néréide (recherche « nereid »).
    { id: 'nereid', name: 'Néréide', q: 'nereid' },
  // Fin de la liste.
  ],
// Fin de l'objet.
};

// Autres lunes mineures : servent seulement à écarter les images centrées sur elles.
// Lunes mineures, par astre (début de l'objet).
const MINOR_MOONS = {
  // Aucune pour Mercure, Vénus, la Terre, Mars, Cérès, Hauméa et Makémaké.
  mercury: [], venus: [], earth: [], mars: [], ceres: [], haumea: [], makemake: [],
  // Celles de Pluton.
  pluto: ['nix', 'hydra', 'styx', 'kerberos'],
  // Celle d'Éris.
  eris: ['dysnomia'],
  // Celles de Jupiter.
  jupiter: ['amalthea', 'thebe', 'metis', 'adrastea', 'himalia'],
  // Celles de Saturne.
  saturn: ['hyperion', 'phoebe', 'pandora', 'prometheus', 'janus', 'epimetheus', 'daphnis'],
  // Celle d'Uranus.
  uranus: ['puck'],
  // Celles de Neptune.
  neptune: ['proteus', 'larissa', 'despina'],
// Fin de l'objet.
};

/** Astres d'une catégorie ; « satellites » = tous les astres qui ont des lunes. */
// Déclare et exporte planetsOf : les astres d'une catégorie…
export const planetsOf = (categoryId) =>
  // … ceux qui ont des lunes pour « satellites », ceux de la catégorie sinon.
  categoryId === 'satellites' ? PLANETS.filter((p) => MOONS[p.id].length > 0) : PLANETS.filter((p) => p.category === categoryId);

// Corps sélectionnables pour une planète : la planète elle-même puis ses lunes.
// Déclare et exporte bodiesOf : les corps sélectionnables d'une planète (début du tableau).
export const bodiesOf = (planet) => [
  // La planète elle-même, de type « planet ».
  { id: planet.id, name: planet.name, q: planet.q, kind: 'planet' },
  // Puis chacune de ses lunes, de type « moon ».
  ...MOONS[planet.id].map((m) => ({ ...m, kind: 'moon' })),
// Fin du tableau.
];

// hasWord : vrai si le texte contient le mot entier (non collé à d'autres lettres), les caractères spéciaux du mot étant neutralisés.
const hasWord = (text, w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text);

// Vraie photo du corps demandé (planète ou lune) ?
// Déclare et exporte isBodyPhoto : la planète, le corps demandé et la fiche de l'image.
export function isBodyPhoto(planet, body, d) {
  // Le titre de l'image, en minuscules.
  const title = (d.title ?? '').toLowerCase();
  // Ses mots-clés, réunis, en minuscules.
  const kw = (d.keywords ?? []).join(' ').toLowerCase();
  // Le titre et les mots-clés, réunis.
  const text = `${title} ${kw}`;

  // 1. Pas de lancement, matériel, illustration, graphique… (titre + mots-clés).
  // Un mot d'exclusion est présent : image refusée.
  if (EXCLUDE.some((w) => hasWord(text, w))) return false;

  // Noms de toutes les lunes de la planète, affichées et mineures.
  const moonNames = [...MOONS[planet.id].map((m) => m.q), ...MINOR_MOONS[planet.id]];

  // Si le corps demandé est la planète.
  if (body.kind === 'planet') {
    // 2a. La planète est le sujet, pas une de ses lunes.
    // Son nom n'est ni dans le titre ni dans les mots-clés : refusée.
    if (!hasWord(title, planet.q) && !hasWord(kw, planet.q)) return false;
    // Son nom n'est pas dans le titre mais celui d'une lune y est : refusée.
    if (!hasWord(title, planet.q) && moonNames.some((m) => hasWord(title, m))) return false;
    // Sinon : acceptée.
    return true;
  // Fin du cas.
  }

  // 2b. Lune : son nom doit être dans le titre, et pas une autre lune à la place.
  // Lune : son nom n'est pas dans le titre : refusée.
  if (!hasWord(title, body.q)) return false;
  // Le nom seul est ambigu pour certaines lunes (Titan = fusée, Europa = mission Clipper) :
  // on exige aussi la planète ou une mission connue dans le titre ou les mots-clés.
  // Contexte attendu : le nom de la planète et le premier mot de chacune de ses missions.
  const context = [planet.q, ...planet.missions.map((m) => m.q.split(' ')[0])];
  // Aucun élément de contexte dans le texte : refusée.
  if (!context.some((c) => hasWord(text, c))) return false;
  // Le mot « clipper » est présent : refusée.
  if (hasWord(text, 'clipper')) return false;
  // Sinon : acceptée.
  return true;
// Fin de isBodyPhoto.
}

// Adresse de l'API d'images de la NASA.
const API = 'https://images-api.nasa.gov';
// Nombre de résultats demandés par page.
const PAGE_SIZE = 60; // plus large car le filtre écarte une partie des résultats

// Une page de résultats pour (planète, corps, mission).
// Déclare et exporte searchImages : la planète, le corps, la mission, la page (1 par défaut) et le signal d'annulation.
export async function searchImages(planet, body, mission, page = 1, signal) {
  // Mots-clés : la planète et la mission ; pour une lune, son nom en premier.
  const q = body.kind === 'planet' ? `${planet.q} ${mission.q}` : `${body.q} ${planet.q} ${mission.q}`;
  // Paramètres de la requête (début).
  const params = new URLSearchParams({
    // Les mots-clés.
    q,
    // Des images seulement.
    media_type: 'image',
    // Le numéro de page.
    page: String(page),
    // La taille de la page.
    page_size: String(PAGE_SIZE),
  // Fin des paramètres.
  });
  // Lance la recherche et attend la réponse.
  const res = await fetch(`${API}/search?${params}`, { signal });
  // Réponse en erreur : exception avec le code HTTP.
  if (!res.ok) throw new Error(`NASA API ${res.status}`);
  // Lit la réponse en JSON.
  const json = await res.json();
  // Les résultats, liste vide à défaut.
  const items = json.collection?.items ?? [];
  // Renvoie (début de l'objet).
  return {
    // Vrai si la réponse annonce une page suivante.
    hasMore: Boolean(json.collection?.links?.some((l) => l.rel === 'next')),
    // Les images (début)…
    images: items
      // … seulement les résultats qui ont une vignette, une fiche, et qui sont de vraies photos du corps…
      .filter((it) => it.links?.[0]?.href && it.data?.[0] && isBodyPhoto(planet, body, it.data[0]))
      // … convertis un par un (début).
      .map((it) => {
        // La fiche de l'image.
        const d = it.data[0];
        // L'image (début de l'objet).
        return {
          // Son identifiant à la NASA.
          id: d.nasa_id,
          // Son titre.
          title: d.title,
          // Sa date de création.
          date: d.date_created,
          // Sa description, vide à défaut.
          description: d.description ?? '',
          // Le centre de la NASA, vide à défaut.
          center: d.center ?? '',
          // L'adresse de sa vignette.
          thumb: it.links[0].href,
          // L'adresse de la liste de ses fichiers.
          manifest: it.href,
          // L'identifiant de la mission.
          mission: mission.id,
          // Le nom de la mission.
          missionName: mission.name,
          // L'identifiant du corps.
          body: body.id,
          // Le nom du corps.
          bodyName: body.name,
          // Le type du corps.
          bodyKind: body.kind,
        // Fin de l'objet.
        };
      // Fin de la conversion.
      }),
  // Fin de l'objet renvoyé.
  };
// Fin de searchImages.
}

// Récupère la meilleure résolution disponible pour la visionneuse.
// Déclare et exporte fullResolution : reçoit une image.
export async function fullResolution(image) {
  // Début du bloc protégé.
  try {
    // Demande la liste des fichiers de l'image.
    const res = await fetch(image.manifest);
    // Lit les adresses, passées en https.
    const urls = (await res.json()).map((u) => u.replace(/^http:/, 'https:'));
    // pick : la première adresse d'image JPEG ou PNG qui contient le suffixe donné.
    const pick = (suffix) => urls.find((u) => u.includes(suffix) && /\.(jpe?g|png)$/i.test(u));
    // La grande version, sinon la moyenne, sinon l'originale, sinon la vignette.
    return pick('~large') || pick('~medium') || pick('~orig') || image.thumb;
  // En cas d'échec.
  } catch {
    // La vignette.
    return image.thumb;
  // Fin du bloc.
  }
// Fin de fullResolution.
}

// Meilleure qualité pour le téléchargement : original, sinon grande, sinon moyenne.
// Déclare downloadUrl : l'adresse à télécharger pour une image.
async function downloadUrl(image) {
  // Début du bloc protégé.
  try {
    // Demande la liste des fichiers de l'image.
    const res = await fetch(image.manifest);
    // Lit les adresses, passées en https.
    const urls = (await res.json()).map((u) => u.replace(/^http:/, 'https:'));
    // pick : la première adresse JPEG, PNG ou TIFF qui contient le suffixe donné.
    const pick = (suffix) => urls.find((u) => u.includes(suffix) && /\.(jpe?g|png|tiff?)$/i.test(u));
    // L'originale, sinon la grande, sinon la moyenne, sinon la vignette.
    return pick('~orig') || pick('~large') || pick('~medium') || image.thumb;
  // En cas d'échec.
  } catch {
    // La vignette.
    return image.thumb;
  // Fin du bloc.
  }
// Fin de downloadUrl.
}

/**
 * Télécharge l'image en pleine résolution. Les images NASA sont sur un autre domaine : le fichier est récupéré
 * en blob pour que le navigateur l'enregistre (l'attribut `download` seul est ignoré entre domaines). Si le serveur
 * refuse (CORS), l'image s'ouvre dans un nouvel onglet pour être enregistrée à la main.
 */
// Déclare et exporte downloadImage : reçoit une image.
export async function downloadImage(image) {
  // Cherche l'adresse à télécharger.
  const url = await downloadUrl(image);
  // L'extension du fichier, « jpg » par défaut, en minuscules.
  const ext = (url.match(/\.(jpe?g|png|tiff?)$/i)?.[1] || 'jpg').toLowerCase();
  // Le nom du fichier : l'identifiant et l'extension.
  const name = `${image.id}.${ext}`;
  // Début du bloc protégé.
  try {
    // Télécharge le fichier.
    const res = await fetch(url);
    // Réponse en erreur : exception.
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Lit le contenu en blob.
    const blob = await res.blob();
    // Crée une adresse locale pour ce blob.
    const href = URL.createObjectURL(blob);
    // Crée un lien invisible.
    const a = document.createElement('a');
    // Son adresse : le blob.
    a.href = href;
    // Son nom de téléchargement.
    a.download = name;
    // L'ajoute à la page.
    document.body.appendChild(a);
    // Simule un clic : le navigateur enregistre le fichier.
    a.click();
    // Retire le lien.
    a.remove();
    // Libère l'adresse locale après 10 secondes.
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  // En cas d'échec.
  } catch {
    // Ouvre l'image dans un nouvel onglet.
    window.open(url, '_blank', 'noopener');
  // Fin du bloc.
  }
// Fin de downloadImage.
}

// ---------------------------------------------------------------------------------------------- archive ZIP

// Table du CRC-32, calculée une seule fois (début de la fonction appelée tout de suite).
const CRC_TABLE = (() => {
  // 256 entiers de 32 bits.
  const t = new Uint32Array(256);
  // Pour chaque octet possible.
  for (let n = 0; n < 256; n++) {
    // Part de sa valeur.
    let c = n;
    // Huit fois : décalage d'un bit, avec le polynôme du CRC-32 si le bit sorti vaut 1.
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    // Range le résultat, en entier non signé.
    t[n] = c >>> 0;
  // Fin du parcours.
  }
  // Renvoie la table.
  return t;
// Fin de la fonction, appelée immédiatement.
})();
// Déclare crc32 : somme de contrôle d'un tableau d'octets.
function crc32(bytes) {
  // Valeur de départ : tous les bits à 1.
  let c = 0xffffffff;
  // Pour chaque octet : combine la table et la valeur décalée de 8 bits.
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  // Inverse les bits et renvoie un entier non signé.
  return (c ^ 0xffffffff) >>> 0;
// Fin de crc32.
}

/**
 * Archive ZIP minimale, sans compression (« stored ») : les JPEG/PNG sont déjà compressés, et aucune bibliothèque
 * n'est nécessaire. `files` : [{ name, data: Uint8Array }] → Blob application/zip.
 */
// Déclare et exporte buildZip : reçoit les fichiers.
export function buildZip(files) {
  // Encodeur de texte en UTF-8.
  const enc = new TextEncoder();
  // Parties de l'archive : en-têtes locaux, noms et données.
  const parts = [];
  // Parties du répertoire central.
  const central = [];
  // Position courante dans l'archive.
  let offset = 0;
  // La date du moment.
  const now = new Date();
  // L'heure au format DOS : heures, minutes et secondes divisées par deux.
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  // La date au format DOS : années depuis 1980, mois et jour.
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  // Pour chaque fichier.
  for (const f of files) {
    // Son nom, en octets.
    const name = enc.encode(f.name);
    // Sa somme de contrôle.
    const crc = crc32(f.data);
    // Sa taille.
    const size = f.data.length;
    // En-tête local de 30 octets.
    const local = new DataView(new ArrayBuffer(30));
    // Signature de l'en-tête local, version 2.0 et drapeau « nom en UTF-8 ».
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); // UTF-8
    // Sans compression, puis l'heure et la date.
    local.setUint16(8, 0, true); local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true);
    // La somme de contrôle, la taille compressée et la taille réelle (identiques).
    local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true);
    // La longueur du nom ; pas de champ supplémentaire.
    local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    // Ajoute l'en-tête, le nom et les données.
    parts.push(local, name, f.data);
    // Entrée du répertoire central, de 46 octets.
    const cd = new DataView(new ArrayBuffer(46));
    // Signature de l'entrée, versions 2.0 et drapeau « nom en UTF-8 ».
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    // Sans compression, puis l'heure et la date.
    cd.setUint16(10, 0, true); cd.setUint16(12, dosTime, true); cd.setUint16(14, dosDate, true);
    // La somme de contrôle et les deux tailles.
    cd.setUint32(16, crc, true); cd.setUint32(20, size, true); cd.setUint32(24, size, true);
    // La longueur du nom et la position de l'en-tête local dans l'archive.
    cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
    // Ajoute l'entrée et le nom au répertoire central.
    central.push(cd, name);
    // Avance la position : l'en-tête, le nom et les données.
    offset += 30 + name.length + size;
  // Fin du parcours.
  }
  // Taille totale du répertoire central.
  const cdSize = central.reduce((n, p) => n + p.byteLength, 0);
  // Enregistrement de fin, de 22 octets.
  const end = new DataView(new ArrayBuffer(22));
  // Sa signature et le nombre d'entrées (sur ce disque, puis au total).
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  // La taille du répertoire central et sa position.
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  // Renvoie le tout dans un blob de type zip.
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
// Fin de buildZip.
}

// safe : rend un texte utilisable dans un nom de fichier (sans accents, caractères douteux remplacés par un tiret bas, 60 caractères au plus).
const safe = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

// Version « grande » (sinon moyenne) : l'original peut peser des dizaines de Mo par image.
// Déclare zipImageUrl : l'adresse à mettre dans le zip pour une image.
async function zipImageUrl(image) {
  // Début du bloc protégé.
  try {
    // Demande la liste des fichiers de l'image.
    const res = await fetch(image.manifest);
    // Lit les adresses, passées en https.
    const urls = (await res.json()).map((u) => u.replace(/^http:/, 'https:'));
    // pick : la première adresse JPEG ou PNG qui contient le suffixe donné.
    const pick = (suffix) => urls.find((u) => u.includes(suffix) && /\.(jpe?g|png)$/i.test(u));
    // La grande version, sinon la moyenne, sinon la vignette.
    return pick('~large') || pick('~medium') || image.thumb;
  // En cas d'échec.
  } catch {
    // La vignette.
    return image.thumb;
  // Fin du bloc.
  }
// Fin de zipImageUrl.
}

/**
 * Télécharge toutes les images affichées dans la galerie et les enregistre en un seul .zip (avec un fichier
 * sources.txt : titre, mission, date et lien NASA de chaque image). `onProgress(done, total)` ; `signal` pour annuler.
 * Une image qui échoue est sautée et listée dans sources.txt.
 */
// Déclare et exporte downloadGalleryZip : les images, le nom du zip, la progression et le signal d'annulation.
export async function downloadGalleryZip(images, zipName, { onProgress, signal } = {}) {
  // Fichiers téléchargés, rangés par numéro d'image.
  const files = [];
  // Lignes du fichier sources.txt, rangées de même.
  const lines = [];
  // Images en échec.
  const failed = [];
  // Nombre d'images traitées.
  let done = 0;
  // File d'attente : chaque image avec son numéro.
  const queue = images.map((img, i) => ({ img, i }));
  // Déclare worker, qui traite la file.
  const worker = async () => {
    // Prend les images une à une, tant qu'il en reste.
    for (let job = queue.shift(); job; job = queue.shift()) {
      // Annulation demandée : on s'arrête.
      if (signal?.aborted) return;
      // L'image et son numéro.
      const { img, i } = job;
      // Début du bloc protégé.
      try {
        // Cherche l'adresse à télécharger.
        const url = await zipImageUrl(img);
        // Télécharge le fichier.
        const res = await fetch(url, { signal });
        // Réponse en erreur : exception.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Lit le contenu en octets.
        const data = new Uint8Array(await res.arrayBuffer());
        // L'extension du fichier, « jpg » par défaut.
        const ext = (url.match(/\.(jpe?g|png)$/i)?.[1] || 'jpg').toLowerCase();
        // Son nom : numéro sur trois chiffres, astre, mission et identifiant.
        const name = `${String(i + 1).padStart(3, '0')}_${safe(img.bodyName)}_${safe(img.missionName)}_${safe(img.id)}.${ext}`;
        // Range le fichier à sa place.
        files[i] = { name, data };
        // Range sa ligne de sources : nom, titre, astre, mission, date et lien NASA.
        lines[i] = `${name}\n  ${img.title}\n  ${img.bodyName} · ${img.missionName} · ${img.date || ''}\n  https://images.nasa.gov/details/${img.id}\n`;
      // En cas d'échec.
      } catch (e) {
        // Annulation demandée : on s'arrête.
        if (signal?.aborted) return;
        // Note l'image en échec, avec la cause.
        failed.push(`${img.id} (${e.message})`);
      // Fin du bloc.
      }
      // Signale la progression.
      onProgress?.(++done, images.length);
    // Fin de la boucle.
    }
  // Fin de worker.
  };
  // Lance quatre téléchargements en parallèle et attend leur fin.
  await Promise.all(Array.from({ length: 4 }, worker));
  // Annulation demandée : exception d'annulation.
  if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
  // Les fichiers réussis.
  const ok = files.filter(Boolean);
  // Aucun : exception.
  if (!ok.length) throw new Error('aucune image n’a pu être téléchargée');
  // Texte de sources.txt : l'en-tête…
  const credits = `Galerie Go白 — images NASA (images.nasa.gov), domaine public sauf mention contraire.\n` +
    // … la date d'export, le nombre d'images et les lignes des images…
    `Exporté le ${new Date().toLocaleString('fr-FR')} · ${ok.length} images\n\n${lines.filter(Boolean).join('\n')}` +
    // … puis la liste des images non téléchargées, s'il y en a.
    (failed.length ? `\nNon téléchargées :\n${failed.join('\n')}\n` : '');
  // Ajoute sources.txt aux fichiers.
  ok.push({ name: 'sources.txt', data: new TextEncoder().encode(credits) });
  // Construit l'archive.
  const blob = buildZip(ok);
  // Crée une adresse locale pour l'archive.
  const href = URL.createObjectURL(blob);
  // Crée un lien invisible.
  const a = document.createElement('a');
  // Son adresse : l'archive.
  a.href = href;
  // Son nom de téléchargement, « galerie » à défaut.
  a.download = `${safe(zipName) || 'galerie'}.zip`;
  // L'ajoute à la page.
  document.body.appendChild(a);
  // Simule un clic : le navigateur enregistre le fichier.
  a.click();
  // Retire le lien.
  a.remove();
  // Libère l'adresse locale après 30 secondes.
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
  // Renvoie le nombre d'images enregistrées (sans sources.txt) et le nombre d'échecs.
  return { count: ok.length - 1, failed: failed.length };
// Fin de downloadGalleryZip.
}

/**
 * Toutes les images d'une planète (la planète elle-même, chaque mission, première page de résultats), sans doublon,
 * de la plus ancienne à la plus récente : contenu du .zip « par planète ».
 */
// Déclare et exporte collectPlanetImages : la planète et le signal d'annulation.
export async function collectPlanetImages(planet, signal) {
  // Le corps « planète » lui-même.
  const body = bodiesOf(planet)[0];
  // Lance une recherche par mission, en parallèle (début)…
  const results = await Promise.all(planet.missions.map((m) =>
    // … première page ; un échec donne une liste vide, sauf une annulation, qui est relancée.
    searchImages(planet, body, m, 1, signal).then((r) => r.images).catch((e) => { if (e.name === 'AbortError') throw e; return []; })));
  // Identifiants déjà vus.
  const seen = new Set();
  // Réunit toutes les images…
  return results.flat()
    // … sans doublon…
    .filter((img) => !seen.has(img.id) && seen.add(img.id))
    // … triées de la plus ancienne à la plus récente.
    .sort((a, b) => new Date(a.date) - new Date(b.date));
// Fin de collectPlanetImages.
}
