/**
 * Installe des groupes de méthodes sur la classe du moteur : mêmes propriétés que des méthodes de classe
 * (non énumérables), accesseurs compris.
 */
// Fonction installMethods : la classe, puis les objets de méthodes.
export function installMethods(cls, ...groups) {
  // Chaque groupe.
  for (const group of groups) {
    // Chaque méthode ou accesseur, copié tel quel (sans appeler les accesseurs).
    for (const [name, desc] of Object.entries(Object.getOwnPropertyDescriptors(group))) {
      // Une méthode déjà définie dans la classe ne doit pas être écrasée.
      if (Object.prototype.hasOwnProperty.call(cls.prototype, name)) throw new Error(`SolarEngine.${name} défini deux fois`);
      // Définie comme une méthode de classe.
      Object.defineProperty(cls.prototype, name, { ...desc, enumerable: false });
    // Fin des méthodes.
    }
  // Fin des groupes.
  }
// Fin de installMethods.
}
