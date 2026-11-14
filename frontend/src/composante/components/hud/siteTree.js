// Arborescence du site, affichée dans l'onglet « Arborescence » de la fenêtre Node.
// Mêmes adresses que backend/src/services/data/body-pages.ts et public/sitemap.xml : une page ajoutée là-bas s'ajoute ici.

// node : fabrique un nœud de l'arborescence à partir d'un nom, d'une adresse et de ses enfants (aucun par défaut).
const node = (name, path, children = []) => ({ name, path, children });

// Déclare et exporte l'arborescence : la racine « Accueil », à l'adresse /, et ses enfants (début).
export const SITE_TREE = node('Accueil', '/', [
  // Le groupe « Astres », sans adresse propre, et ses enfants (début).
  node('Astres', null, [
    // La page « Soleil » : /soleil.
    node('Soleil', '/soleil'),
    // La page « Mercure » : /mercure.
    node('Mercure', '/mercure'),
    // La page « Vénus » : /venus.
    node('Vénus', '/venus'),
    // La page de Terre (/terre), avec son satellite : Lune (/lune).
    node('Terre', '/terre', [node('Lune', '/lune')]),
    // La page de Mars (/mars), avec ses satellites : Phobos (/phobos) et Deimos (/deimos).
    node('Mars', '/mars', [node('Phobos', '/phobos'), node('Deimos', '/deimos')]),
    // La page de Jupiter (/jupiter) et ses satellites (début).
    node('Jupiter', '/jupiter', [
      // La page « Io » : /io.
      node('Io', '/io'),
      // La page « Europe » : /europe.
      node('Europe', '/europe'),
      // La page « Ganymède » : /ganymede.
      node('Ganymède', '/ganymede'),
      // La page « Callisto » : /callisto.
      node('Callisto', '/callisto'),
    // Fin de la liste des enfants.
    ]),
    // La page de Saturne (/saturne) et ses satellites (début).
    node('Saturne', '/saturne', [
      // La page « Mimas » : /mimas.
      node('Mimas', '/mimas'),
      // La page « Encelade » : /encelade.
      node('Encelade', '/encelade'),
      // La page « Téthys » : /tethys.
      node('Téthys', '/tethys'),
      // La page « Dioné » : /dione.
      node('Dioné', '/dione'),
      // La page « Rhéa » : /rhea.
      node('Rhéa', '/rhea'),
      // La page « Titan » : /titan.
      node('Titan', '/titan'),
      // La page « Japet » : /japet.
      node('Japet', '/japet'),
    // Fin de la liste des enfants.
    ]),
    // La page de Uranus (/uranus) et ses satellites (début).
    node('Uranus', '/uranus', [
      // La page « Miranda » : /miranda.
      node('Miranda', '/miranda'),
      // La page « Ariel » : /ariel.
      node('Ariel', '/ariel'),
      // La page « Umbriel » : /umbriel.
      node('Umbriel', '/umbriel'),
      // La page « Titania » : /titania.
      node('Titania', '/titania'),
      // La page « Obéron » : /oberon.
      node('Obéron', '/oberon'),
    // Fin de la liste des enfants.
    ]),
    // La page de Neptune (/neptune), avec son satellite : Triton (/triton).
    node('Neptune', '/neptune', [node('Triton', '/triton')]),
    // La page de Pluton (/pluton), avec son satellite : Charon (/charon).
    node('Pluton', '/pluton', [node('Charon', '/charon')]),
  // Fin de la liste des enfants.
  ]),
  // La page « Galerie » : /galerie.
  node('Galerie', '/galerie'),
  // La page « Anthropic Node Open Source » : /node.
  node('Anthropic Node Open Source', '/node'),
  // La page des dons : /faire-un-don.
  node('Dons au développeur de l’application Gobai', '/faire-un-don'),
// Fin de l'arborescence.
]);

/** Nombre de pages (nœuds ayant une adresse) de l'arborescence. */
// countPages : compte 1 si le nœud a une adresse, plus le total de ses enfants (par défaut, depuis la racine).
export const countPages = (n = SITE_TREE) => (n.path ? 1 : 0) + n.children.reduce((sum, c) => sum + countPages(c), 0);
