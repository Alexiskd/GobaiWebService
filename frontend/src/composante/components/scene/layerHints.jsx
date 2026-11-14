// Textes d’aide sous les interrupteurs des Paramètres.

// Déclare et exporte cityNamesHintText : texte d'aide de l'interrupteur des noms de villes.
export const cityNamesHintText = (namesIncluded, cityInfo) => {
  // Si le fond de carte affiche déjà les noms : on le dit.
  if (namesIncluded) return 'Déjà inclus dans ce fond';
  // Sinon : le nombre de villes (au format français), la source et la condition d'affichage ; « Chargement… » tant que les informations manquent.
  return cityInfo ? `${cityInfo.count.toLocaleString('fr-FR')} villes · Natural Earth · visibles en zoomant` : 'Chargement…';
// Fin de cityNamesHintText.
};
