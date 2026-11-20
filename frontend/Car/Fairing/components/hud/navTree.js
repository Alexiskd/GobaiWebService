/**
 * Arborescence de la navigation des astres (même ordre que la documentation des astres) : le Soleil à la racine, puis deux
 * branches, « Planètes » et « Planètes naines », puis sous chaque planète ses satellites. Calcul pur, sans React.
 *
 * Entrée : les astres de la navigation ({ index, name, color, kind, satellite, parent, number }) — l'indice 0 est le
 * Soleil, `kind: 'dwarf'` marque une planète naine, `parent` l'indice de la planète d'un satellite.
 * Sortie : { sun, branches: [{ id, name, planets: [{ ...planète, moons: [...] }] }] } ; `sun` est null s'il est masqué.
 */
export function navTree(bodies = []) {
  const sun = bodies.find((b) => b.index === 0) ?? null;
  const moonsOf = new Map();
  for (const b of bodies) {
    if (!b.satellite || b.parent == null) continue;
    if (!moonsOf.has(b.parent)) moonsOf.set(b.parent, []);
    moonsOf.get(b.parent).push(b);
  }
  const planets = bodies.filter((b) => b.index !== 0 && !b.satellite).map((p) => ({ ...p, moons: moonsOf.get(p.index) ?? [] }));
  const branches = [
    { id: 'planetes', name: 'Planètes', planets: planets.filter((p) => p.kind !== 'dwarf') },
    { id: 'naines', name: 'Planètes naines', planets: planets.filter((p) => p.kind === 'dwarf') },
  ].filter((b) => b.planets.length);
  return { sun, branches };
}

/**
 * Chemin de l'astre visé dans l'arborescence : { branch, planet } (identifiant de branche et indice de planète), pour
 * déplier automatiquement ce qui mène à lui. Rien pour le Soleil ou un astre inconnu.
 */
export function pathTo(tree, focus) {
  for (const branch of tree.branches) {
    for (const planet of branch.planets) {
      if (planet.index === focus || planet.moons.some((m) => m.index === focus)) return { branch: branch.id, planet: planet.index };
    }
  }
  return { branch: null, planet: null };
}
